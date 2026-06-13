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
    created_at: datetime
    updated_at: datetime


class GroupDocumentDetail(GroupDocumentSummary):
    extracted_text: str


class GroupDocumentDeleteResponse(BaseModel):
    message: str = "success"
