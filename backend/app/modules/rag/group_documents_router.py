import json
import logging
from unittest.mock import Mock

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import require_admin_if_enabled, resolve_current_user
from app.modules.auth.service import ensure_group_access
from app.modules.content.bulk_update import (
    regenerate_related_items_for_group,
    regenerate_related_items_task,
)
from app.modules.objects.groups import get_group_or_404
from app.modules.rag.group_documents import get_group_document_service
from app.modules.rag.index_lifecycle import (
    DocumentIndexStatus,
    GroupIndexHealth,
    get_group_index_health,
    reindex_group,
    reindex_group_document,
)
from app.schemas.content import BulkRegenerateContentRequest, BulkRegenerateContentResponse
from app.schemas.group_document import (
    DocumentIndexStatusResponse,
    GroupDocumentDeleteResponse,
    GroupDocumentDetail,
    GroupDocumentSummary,
    GroupIndexHealthResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/groups", tags=["group-documents"])


def _safe_attr(document, name: str, default=None):
    value = getattr(document, name, default)
    return default if isinstance(value, Mock) else value


def _json_list_attr(document, name: str) -> list[str]:
    raw = _safe_attr(document, name, "[]") or "[]"
    if isinstance(raw, list):
        return raw
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def _to_summary(document) -> GroupDocumentSummary:
    return GroupDocumentSummary(
        id=document.id,
        group_id=document.group_id,
        title=document.title,
        source_type=document.source_type,
        original_filename=document.original_filename,
        chunk_count=document.chunk_count,
        status=document.status,
        error_message=document.error_message,
        quality_score=_safe_attr(document, "quality_score", 1.0),
        quality_warnings=_json_list_attr(document, "quality_warnings"),
        visibility=_safe_attr(document, "visibility", "internal"),
        trust_level=_safe_attr(document, "trust_level", "uploaded"),
        governance_warnings=_json_list_attr(document, "governance_warnings"),
        content_hash=_safe_attr(document, "content_hash", None),
        normalized_hash=_safe_attr(document, "normalized_hash", None),
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _to_detail(document) -> GroupDocumentDetail:
    return GroupDocumentDetail(
        **_to_summary(document).model_dump(),
        extracted_text=document.extracted_text,
        canonical_text=_safe_attr(document, "canonical_text", ""),
    )


def _to_index_status(status: DocumentIndexStatus) -> DocumentIndexStatusResponse:
    return DocumentIndexStatusResponse(
        document_id=status.document_id,
        title=status.title,
        expected_chunks=status.expected_chunks,
        indexed_chunks=status.indexed_chunks,
        missing_chunk_ids=status.missing_chunk_ids,
        stale_chunk_ids=status.stale_chunk_ids,
        surplus_chunk_ids=status.surplus_chunk_ids,
        healthy=status.healthy,
    )


def _to_index_health(health: GroupIndexHealth) -> GroupIndexHealthResponse:
    return GroupIndexHealthResponse(
        group_id=health.group_id,
        document_count=health.document_count,
        healthy=health.healthy,
        documents=[_to_index_status(status) for status in health.documents],
        orphan_chunk_ids=health.orphan_chunk_ids,
    )


def _map_error(exc: ValueError) -> HTTPException:
    message = str(exc)
    mapping = {
        "title_required": (400, "Tiêu đề tài liệu không được để trống"),
        "content_required": (400, "Cần nhập văn bản hoặc chọn file tài liệu"),
        "unsupported_file_type": (400, "Chỉ hỗ trợ .txt, .docx, .pdf hoặc văn bản"),
        "pdf_no_text": (400, "PDF không có lớp văn bản để trích xuất"),
        "empty_content": (400, "Tài liệu không có nội dung sau khi trích xuất"),
        "ingest_failed": (502, "Không thể lưu tài liệu lúc này"),
        "document_not_found": (404, "Không tìm thấy tài liệu"),
        "group_not_found": (404, "Không tìm thấy nhóm"),
        "file_too_large": (413, "Tài liệu vượt quá giới hạn dung lượng"),
        "invalid_visibility": (400, "Phạm vi hiển thị tài liệu không hợp lệ"),
        "invalid_trust_level": (400, "Mức độ tin cậy tài liệu không hợp lệ"),
    }
    if message in mapping:
        status, detail = mapping[message]
        return HTTPException(status_code=status, detail=detail)
    if "chunk" in message and "giới hạn" in message:
        return HTTPException(status_code=400, detail=message)
    if "RAG retriever unavailable" in message:
        return HTTPException(status_code=503, detail="Chỉ mục RAG tạm thời không khả dụng")
    return HTTPException(status_code=400, detail=message or "Không thể xử lý tài liệu")


@router.post("/{group_id}/content/bulk-regenerate", response_model=BulkRegenerateContentResponse)
def bulk_regenerate_group_content(
    group_id: int,
    payload: BulkRegenerateContentRequest,
    db: Session = Depends(get_db),
    _staff=Depends(require_admin_if_enabled),
):
    get_group_or_404(db, group_id)
    ensure_group_access(_staff, group_id)
    result = regenerate_related_items_for_group(db, group_id, payload.document_ids)
    return BulkRegenerateContentResponse(**result)


@router.get("/{group_id}/documents", response_model=list[GroupDocumentSummary])
def list_group_documents(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    get_group_or_404(db, group_id)
    ensure_group_access(user, group_id)
    documents = get_group_document_service().list_documents(db, group_id)
    return [_to_summary(document) for document in documents]


@router.get("/{group_id}/rag/health", response_model=GroupIndexHealthResponse)
def get_rag_index_health(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    get_group_or_404(db, group_id)
    ensure_group_access(user, group_id)
    return _to_index_health(get_group_index_health(db, group_id))


@router.post("/{group_id}/rag/reindex", response_model=GroupIndexHealthResponse)
def reindex_group_rag(
    group_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    get_group_or_404(db, group_id)
    ensure_group_access(staff, group_id)
    try:
        return _to_index_health(reindex_group(db, group_id))
    except ValueError as exc:
        raise _map_error(exc) from exc
    except RuntimeError as exc:
        if "RAG retriever unavailable" in str(exc):
            raise HTTPException(status_code=503, detail="Chỉ mục RAG tạm thời không khả dụng") from exc
        raise


@router.post("/{group_id}/documents", response_model=GroupDocumentDetail, status_code=201)
async def create_group_document(
    group_id: int,
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    visibility: str | None = Form(None),
    trust_level: str | None = Form(None),
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    get_group_or_404(db, group_id)
    ensure_group_access(staff, group_id)
    try:
        document = await get_group_document_service().create_document(
            db,
            group_id=group_id,
            title=title,
            text=text,
            upload=file,
            visibility=visibility,
            trust_level=trust_level,
        )
    except ValueError as exc:
        raise _map_error(exc) from exc
    except Exception:
        logger.exception("Create group document failed for group %s", group_id)
        raise HTTPException(status_code=502, detail="Không thể lưu tài liệu lúc này")
    background_tasks.add_task(
        regenerate_related_items_task,
        group_id,
        [document.id],
    )
    return _to_detail(document)


@router.get("/{group_id}/documents/{document_id}", response_model=GroupDocumentDetail)
def get_group_document(
    group_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    ensure_group_access(user, group_id)
    try:
        document = get_group_document_service().get_document(db, group_id, document_id)
    except ValueError as exc:
        raise _map_error(exc) from exc
    return _to_detail(document)


@router.post("/{group_id}/documents/{document_id}/reindex", response_model=DocumentIndexStatusResponse)
def reindex_group_document_rag(
    group_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    ensure_group_access(staff, group_id)
    try:
        return _to_index_status(reindex_group_document(db, group_id, document_id))
    except ValueError as exc:
        raise _map_error(exc) from exc
    except RuntimeError as exc:
        if "RAG retriever unavailable" in str(exc):
            raise HTTPException(status_code=503, detail="Chỉ mục RAG tạm thời không khả dụng") from exc
        raise


@router.put("/{group_id}/documents/{document_id}", response_model=GroupDocumentDetail)
async def update_group_document(
    group_id: int,
    document_id: int,
    background_tasks: BackgroundTasks,
    title: str | None = Form(None),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    visibility: str | None = Form(None),
    trust_level: str | None = Form(None),
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    ensure_group_access(staff, group_id)
    try:
        document = await get_group_document_service().update_document(
            db,
            group_id=group_id,
            document_id=document_id,
            title=title,
            text=text,
            upload=file,
            visibility=visibility,
            trust_level=trust_level,
        )
    except ValueError as exc:
        raise _map_error(exc) from exc
    except Exception:
        logger.exception("Update group document failed: %s", document_id)
        raise HTTPException(status_code=502, detail="Không thể cập nhật tài liệu lúc này")
    background_tasks.add_task(
        regenerate_related_items_task,
        group_id,
        [document.id],
    )
    return _to_detail(document)


@router.delete(
    "/{group_id}/documents/{document_id}",
    response_model=GroupDocumentDeleteResponse,
)
def delete_group_document(
    group_id: int,
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    ensure_group_access(staff, group_id)
    try:
        affected_ids = get_group_document_service().delete_document(
            db, group_id, document_id
        )
    except ValueError as exc:
        raise _map_error(exc) from exc
    except Exception:
        logger.exception("Delete group document failed: %s", document_id)
        raise HTTPException(status_code=502, detail="Không thể xóa tài liệu lúc này")
    background_tasks.add_task(
        regenerate_related_items_task,
        group_id,
        None,
        affected_ids,
    )
    return GroupDocumentDeleteResponse()
