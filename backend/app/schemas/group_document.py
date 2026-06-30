from datetime import datetime

from pydantic import BaseModel


class GroupDocumentSummary(BaseModel):
    id: int
    group_id: int
    title: str
    source_type: str
    original_filename: str | None
    chunk_count: int
    status: str
    error_message: str | None
    quality_score: float = 1.0
    quality_warnings: list[str] = []
    visibility: str = "internal"
    trust_level: str = "uploaded"
    governance_warnings: list[str] = []
    content_hash: str | None = None
    normalized_hash: str | None = None
    created_at: datetime
    updated_at: datetime


class GroupDocumentDetail(GroupDocumentSummary):
    extracted_text: str
    canonical_text: str = ""


class GroupDocumentDeleteResponse(BaseModel):
    message: str = "success"


class DocumentIndexStatusResponse(BaseModel):
    document_id: int
    title: str
    expected_chunks: int
    indexed_chunks: int
    missing_chunk_ids: list[str] = []
    stale_chunk_ids: list[str] = []
    surplus_chunk_ids: list[str] = []
    healthy: bool


class GroupIndexHealthResponse(BaseModel):
    group_id: int
    document_count: int
    healthy: bool
    documents: list[DocumentIndexStatusResponse]
    orphan_chunk_ids: list[str] = []
