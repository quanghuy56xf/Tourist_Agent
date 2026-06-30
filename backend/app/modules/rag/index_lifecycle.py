from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.group_document import GroupDocument
from app.modules.rag.chunking import sections_to_chunks_with_meta
from app.modules.rag.document_parser import parse_flat_text_sections
from app.modules.rag.retriever import HybridRetriever, try_get_rag_retriever
from app.modules.rag.types import ChunkDraft


@dataclass(frozen=True)
class DocumentIndexStatus:
    document_id: int
    title: str
    expected_chunks: int
    indexed_chunks: int
    missing_chunk_ids: list[str] = field(default_factory=list)
    stale_chunk_ids: list[str] = field(default_factory=list)
    surplus_chunk_ids: list[str] = field(default_factory=list)

    @property
    def healthy(self) -> bool:
        return (
            not self.missing_chunk_ids
            and not self.stale_chunk_ids
            and not self.surplus_chunk_ids
            and self.expected_chunks == self.indexed_chunks
        )


@dataclass(frozen=True)
class GroupIndexHealth:
    group_id: int
    document_count: int
    healthy: bool
    documents: list[DocumentIndexStatus]
    orphan_chunk_ids: list[str] = field(default_factory=list)


def chunk_id_for(document_id: int, chunk_index: int) -> str:
    return f"group-doc-{document_id}-chunk-{chunk_index}"


def _drafts_for_document(document: GroupDocument) -> list[ChunkDraft]:
    source_text = document.canonical_text or document.extracted_text or ""
    if not source_text.strip():
        return []
    sections = parse_flat_text_sections(source_text, source_hint="canonical")
    drafts, _warning = sections_to_chunks_with_meta(sections)
    return drafts


def _chunks_for_group(retriever: HybridRetriever, group_id: int) -> list[Any]:
    return [
        chunk
        for chunk in retriever.chunks
        if (chunk.metadata or {}).get("source") == "group_doc"
        and (chunk.metadata or {}).get("group_id") == group_id
    ]


def _chunks_for_document(retriever: HybridRetriever, document_id: int) -> list[Any]:
    return [
        chunk
        for chunk in retriever.chunks
        if (chunk.metadata or {}).get("source") == "group_doc"
        and (chunk.metadata or {}).get("document_id") == document_id
    ]


def build_document_index_status(
    document: GroupDocument,
    retriever: HybridRetriever,
) -> DocumentIndexStatus:
    expected_count = document.chunk_count or len(_drafts_for_document(document))
    expected_ids = {chunk_id_for(document.id, index) for index in range(expected_count)}
    indexed_chunks = _chunks_for_document(retriever, document.id)
    indexed_ids = {
        str((chunk.metadata or {}).get("page") or "")
        for chunk in indexed_chunks
        if (chunk.metadata or {}).get("page")
    }
    stale_ids = [
        chunk_id
        for chunk_id in indexed_ids & expected_ids
        for chunk in indexed_chunks
        if (chunk.metadata or {}).get("page") == chunk_id
        and (chunk.metadata or {}).get("document_version") != document.knowledge_version
    ]
    return DocumentIndexStatus(
        document_id=document.id,
        title=document.title,
        expected_chunks=expected_count,
        indexed_chunks=len(indexed_chunks),
        missing_chunk_ids=sorted(expected_ids - indexed_ids),
        stale_chunk_ids=sorted(set(stale_ids)),
        surplus_chunk_ids=sorted(indexed_ids - expected_ids),
    )


def get_group_index_health(db: Session, group_id: int) -> GroupIndexHealth:
    retriever = try_get_rag_retriever()
    if retriever is None:
        documents = (
            db.query(GroupDocument)
            .filter(GroupDocument.group_id == group_id)
            .order_by(GroupDocument.id.asc())
            .all()
        )
        statuses = [
            DocumentIndexStatus(
                document_id=document.id,
                title=document.title,
                expected_chunks=document.chunk_count,
                indexed_chunks=0,
                missing_chunk_ids=[
                    chunk_id_for(document.id, index)
                    for index in range(document.chunk_count or 0)
                ],
            )
            for document in documents
        ]
        return GroupIndexHealth(
            group_id=group_id,
            document_count=len(documents),
            healthy=False,
            documents=statuses,
        )

    documents = (
        db.query(GroupDocument)
        .filter(GroupDocument.group_id == group_id)
        .order_by(GroupDocument.id.asc())
        .all()
    )
    statuses = [build_document_index_status(document, retriever) for document in documents]
    document_ids = {document.id for document in documents}
    orphan_ids = sorted(
        str((chunk.metadata or {}).get("page") or "")
        for chunk in _chunks_for_group(retriever, group_id)
        if (chunk.metadata or {}).get("document_id") not in document_ids
        and (chunk.metadata or {}).get("page")
    )
    return GroupIndexHealth(
        group_id=group_id,
        document_count=len(documents),
        healthy=not orphan_ids and all(status.healthy for status in statuses),
        documents=statuses,
        orphan_chunk_ids=orphan_ids,
    )


def reindex_group_document(db: Session, group_id: int, document_id: int) -> DocumentIndexStatus:
    document = (
        db.query(GroupDocument)
        .filter(GroupDocument.id == document_id, GroupDocument.group_id == group_id)
        .first()
    )
    if document is None:
        raise ValueError("document_not_found")

    retriever = try_get_rag_retriever()
    if retriever is None:
        raise RuntimeError("RAG retriever unavailable")

    drafts = _drafts_for_document(document)
    retriever.upsert_group_document(
        document.id,
        group_id,
        document.title,
        drafts,
        document_version=document.knowledge_version,
        source_type=document.source_type,
        content_hash=document.content_hash,
        normalized_hash=document.normalized_hash,
        quality_score=document.quality_score,
        visibility=document.visibility,
        trust_level=document.trust_level,
    )
    if document.chunk_count != len(drafts):
        document.chunk_count = len(drafts)
        db.commit()
        db.refresh(document)
    return build_document_index_status(document, retriever)


def reindex_group(db: Session, group_id: int) -> GroupIndexHealth:
    if db.query(Group.id).filter(Group.id == group_id).first() is None:
        raise ValueError("group_not_found")
    documents = (
        db.query(GroupDocument)
        .filter(GroupDocument.group_id == group_id)
        .order_by(GroupDocument.id.asc())
        .all()
    )
    for document in documents:
        reindex_group_document(db, group_id, document.id)
    return get_group_index_health(db, group_id)
