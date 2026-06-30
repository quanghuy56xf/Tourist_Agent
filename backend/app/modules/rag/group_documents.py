import json
import logging

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.group_doc_storage import (
    delete_group_document_file,
    save_group_document_file,
)
from app.models.group import Group
from app.models.group_document import GroupDocument
from app.modules.content.invalidate import invalidate_item_content_for_group
from app.modules.objects.groups import get_group_or_404
from app.modules.rag.chunking import sections_to_chunks_with_meta
from app.modules.rag.normalization import sections_to_canonical_markdown
from app.modules.rag.quality import build_quality_report, has_duplicate_normalized_hash
from app.modules.rag.document_parser import (
    detect_source_type,
    extract_pdf_text,
    parse_flat_text_sections,
    parse_upload_to_sections,
    sections_to_plain_text,
)
from app.modules.rag.retriever import try_get_rag_retriever
from app.modules.rag.security import build_governance_result, enforce_upload_size
from app.modules.rag.types import StructuredSection

logger = logging.getLogger(__name__)

STORAGE_EXTENSIONS = {
    "text": "txt",
    "txt": "txt",
    "docx": "docx",
}


class GroupDocumentService:
    def list_documents(self, db: Session, group_id: int) -> list[GroupDocument]:
        get_group_or_404(db, group_id)
        return (
            db.query(GroupDocument)
            .filter(GroupDocument.group_id == group_id)
            .order_by(GroupDocument.created_at.desc())
            .all()
        )

    def get_document(
        self,
        db: Session,
        group_id: int,
        document_id: int,
    ) -> GroupDocument:
        get_group_or_404(db, group_id)
        document = (
            db.query(GroupDocument)
            .filter(
                GroupDocument.id == document_id,
                GroupDocument.group_id == group_id,
            )
            .first()
        )
        if document is None:
            raise ValueError("document_not_found")
        return document

    async def create_document(
        self,
        db: Session,
        *,
        group_id: int,
        title: str,
        text: str | None = None,
        upload: UploadFile | None = None,
        visibility: str | None = None,
        trust_level: str | None = None,
    ) -> GroupDocument:
        try:
            group = get_group_or_404(db, group_id)
            normalized_title = title.strip()
            if not normalized_title:
                raise ValueError("title_required")

            source_type, raw_bytes, filename = await self._read_source(text, upload)
            return self._create_from_bytes(
                db,
                group=group,
                title=normalized_title,
                source_type=source_type,
                raw_bytes=raw_bytes,
                filename=filename,
                visibility=visibility,
                trust_level=trust_level,
            )
        except HTTPException:
            raise
        except ValueError:
            raise
        except Exception as exc:
            logger.exception("Create document failed for group %s", group_id)
            raise ValueError(str(exc) or "ingest_failed") from exc

    async def update_document(
        self,
        db: Session,
        *,
        group_id: int,
        document_id: int,
        title: str | None = None,
        text: str | None = None,
        upload: UploadFile | None = None,
        visibility: str | None = None,
        trust_level: str | None = None,
    ) -> GroupDocument:
        document = self.get_document(db, group_id, document_id)

        if title is not None:
            normalized_title = title.strip()
            if not normalized_title:
                raise ValueError("title_required")
            document.title = normalized_title

        next_visibility = visibility if visibility is not None else document.visibility
        next_trust_level = trust_level if trust_level is not None else document.trust_level
        if text is None and upload is None:
            governance = build_governance_result(
                filename=document.original_filename,
                text=document.canonical_text or document.extracted_text,
                visibility=next_visibility,
                trust_level=next_trust_level,
            )
            document.original_filename = governance.sanitized_filename
            document.visibility = governance.visibility
            document.trust_level = governance.trust_level
            document.governance_warnings = json.dumps(governance.warnings, ensure_ascii=False)
            chunk_drafts = sections_to_chunks_with_meta(
                parse_flat_text_sections(
                    document.canonical_text or document.extracted_text,
                    source_hint="canonical",
                )
            )[0]
            self._index_document(document, group_id, chunk_drafts)
            db.commit()
            db.refresh(document)
            invalidate_item_content_for_group(db, group_id, document_ids=[document.id])
            return document

        group = get_group_or_404(db, group_id)
        source_type, raw_bytes, filename = await self._read_source(
            text,
            upload,
            fallback_type=document.source_type,
        )
        self._remove_vectors(document.id)
        delete_group_document_file(document.storage_path)

        storage_type, storage_bytes, sections, original_filename = (
            self._prepare_storage_content(source_type, raw_bytes, filename)
        )
        if not sections:
            raise ValueError("empty_content")

        canonical_text = sections_to_canonical_markdown(sections)
        governance = build_governance_result(
            filename=original_filename,
            text=canonical_text,
            visibility=next_visibility,
            trust_level=next_trust_level,
        )
        original_filename = governance.sanitized_filename
        chunk_drafts, truncation_warning = sections_to_chunks_with_meta(sections)
        initial_report = build_quality_report(
            canonical_text=canonical_text,
            section_count=len(sections),
            chunk_count=len(chunk_drafts),
            truncated=bool(truncation_warning),
        )
        duplicate = has_duplicate_normalized_hash(
            db,
            group_id=group.id,
            normalized_hash=initial_report.normalized_hash,
            exclude_document_id=document.id,
        )
        quality_report = build_quality_report(
            canonical_text=canonical_text,
            section_count=len(sections),
            chunk_count=len(chunk_drafts),
            duplicate=duplicate,
            truncated=bool(truncation_warning),
        )

        document.source_type = storage_type
        document.original_filename = original_filename
        document.extracted_text = sections_to_plain_text(sections)
        document.canonical_text = canonical_text
        document.content_hash = quality_report.content_hash
        document.normalized_hash = quality_report.normalized_hash
        document.quality_score = quality_report.quality_score
        document.quality_warnings = quality_report.warnings_json()
        document.visibility = governance.visibility
        document.trust_level = governance.trust_level
        document.governance_warnings = json.dumps(governance.warnings, ensure_ascii=False)
        self._index_document(document, group.id, chunk_drafts)

        extension = STORAGE_EXTENSIONS[storage_type]
        document.storage_path = save_group_document_file(
            group_id=group.id,
            document_id=document.id,
            extension=extension,
            content=storage_bytes,
        )
        document.chunk_count = len(chunk_drafts)
        document.status = "ready"
        document.error_message = truncation_warning
        document.knowledge_version += 1
        group.knowledge_version += 1
        db.commit()
        db.refresh(document)
        invalidate_item_content_for_group(db, group.id, document_ids=[document.id])
        return document

    def delete_document(self, db: Session, group_id: int, document_id: int) -> list[int]:
        document = self.get_document(db, group_id, document_id)
        group = get_group_or_404(db, group_id)
        affected_ids = invalidate_item_content_for_group(
            db, group.id, document_ids=[document_id]
        )
        self._remove_vectors(document.id)
        delete_group_document_file(document.storage_path)
        db.delete(document)
        group.knowledge_version += 1
        db.commit()
        return affected_ids

    def _prepare_storage_content(
        self,
        source_type: str,
        raw_bytes: bytes,
        filename: str | None,
    ) -> tuple[str, bytes, list[StructuredSection], str | None]:
        if source_type == "pdf":
            text = extract_pdf_text(raw_bytes)
            if not text:
                raise ValueError("pdf_no_text")
            storage_bytes = text.encode("utf-8")
            sections = parse_flat_text_sections(text, source_hint="pdf:txt")
            return "txt", storage_bytes, sections, filename

        sections = parse_upload_to_sections(
            source_type=source_type,
            content=raw_bytes,
            filename=filename,
        )
        if source_type == "text":
            storage_bytes = raw_bytes
            return "txt", storage_bytes, sections, filename

        return source_type, raw_bytes, sections, filename

    def _create_from_bytes(
        self,
        db: Session,
        *,
        group: Group,
        title: str,
        source_type: str,
        raw_bytes: bytes,
        filename: str | None,
        visibility: str | None = None,
        trust_level: str | None = None,
    ) -> GroupDocument:
        storage_path: str | None = None
        document_id: int | None = None

        try:
            storage_type, storage_bytes, sections, original_filename = (
                self._prepare_storage_content(source_type, raw_bytes, filename)
            )
            if not sections:
                raise ValueError("empty_content")

            canonical_text = sections_to_canonical_markdown(sections)
            governance = build_governance_result(
                filename=original_filename,
                text=canonical_text,
                visibility=visibility,
                trust_level=trust_level,
            )
            original_filename = governance.sanitized_filename
            chunk_drafts, truncation_warning = sections_to_chunks_with_meta(sections)
            initial_report = build_quality_report(
                canonical_text=canonical_text,
                section_count=len(sections),
                chunk_count=len(chunk_drafts),
                truncated=bool(truncation_warning),
            )
            duplicate = has_duplicate_normalized_hash(
                db,
                group_id=group.id,
                normalized_hash=initial_report.normalized_hash,
            )
            quality_report = build_quality_report(
                canonical_text=canonical_text,
                section_count=len(sections),
                chunk_count=len(chunk_drafts),
                duplicate=duplicate,
                truncated=bool(truncation_warning),
            )

            document = GroupDocument(
                group_id=group.id,
                title=title,
                source_type=storage_type,
                original_filename=original_filename,
                extracted_text="",
                canonical_text=canonical_text,
                content_hash=quality_report.content_hash,
                normalized_hash=quality_report.normalized_hash,
                quality_score=quality_report.quality_score,
                quality_warnings=quality_report.warnings_json(),
                visibility=governance.visibility,
                trust_level=governance.trust_level,
                governance_warnings=json.dumps(governance.warnings, ensure_ascii=False),
                status="processing",
            )
            db.add(document)
            db.flush()
            document_id = document.id

            extension = STORAGE_EXTENSIONS[storage_type]
            storage_path = save_group_document_file(
                group_id=group.id,
                document_id=document_id,
                extension=extension,
                content=storage_bytes,
            )
            self._index_document(document, group.id, chunk_drafts)

            document.extracted_text = sections_to_plain_text(sections)
            document.canonical_text = canonical_text
            document.storage_path = storage_path
            document.chunk_count = len(chunk_drafts)
            document.status = "ready"
            document.error_message = truncation_warning
            document.knowledge_version = 1
            group.knowledge_version += 1
            db.commit()
            db.refresh(document)
            invalidate_item_content_for_group(db, group.id, document_ids=[document.id])
            return document
        except Exception as exc:
            db.rollback()
            logger.exception("Failed to ingest group document for group %s", group.id)
            if document_id is not None:
                try:
                    self._remove_vectors(document_id)
                except Exception:
                    logger.exception(
                        "Cleanup vectors failed for document %s",
                        document_id,
                    )
            delete_group_document_file(storage_path)
            if isinstance(exc, ValueError):
                raise
            raise ValueError(str(exc) or "ingest_failed") from exc

    async def _read_source(
        self,
        text: str | None,
        upload: UploadFile | None,
        fallback_type: str | None = None,
    ) -> tuple[str, bytes, str | None]:
        if upload is not None and upload.filename:
            raw_bytes = await upload.read()
            enforce_upload_size(raw_bytes)
            source_type = detect_source_type(upload.filename, upload.content_type)
            if source_type is None:
                raise ValueError("unsupported_file_type")
            return source_type, raw_bytes, upload.filename

        if text is not None and text.strip():
            encoded = text.strip().encode("utf-8")
            enforce_upload_size(encoded)
            return "text", encoded, None

        if fallback_type is not None:
            raise ValueError("content_required")

        raise ValueError("content_required")

    def _index_document(
        self,
        document: GroupDocument,
        group_id: int,
        chunk_drafts,
    ) -> None:
        retriever = try_get_rag_retriever()
        if retriever is None:
            raise RuntimeError("RAG retriever unavailable")
        retriever.upsert_group_document(
            document.id,
            group_id,
            document.title,
            chunk_drafts,
            document_version=document.knowledge_version,
            source_type=document.source_type,
            content_hash=document.content_hash,
            normalized_hash=document.normalized_hash,
            quality_score=document.quality_score,
            visibility=document.visibility,
            trust_level=document.trust_level,
        )

    def _remove_vectors(self, document_id: int) -> None:
        retriever = try_get_rag_retriever()
        if retriever is None:
            return
        try:
            retriever.delete_group_document(document_id)
        except Exception:
            logger.exception("Failed to remove vectors for document %s", document_id)


_service: GroupDocumentService | None = None


def get_group_document_service() -> GroupDocumentService:
    global _service
    if _service is None:
        _service = GroupDocumentService()
    return _service
