from typing import Literal
from pydantic import BaseModel, Field


class ItemContentResponse(BaseModel):
    item_id: int
    persona: str
    language: str
    content: str
    has_audio: bool
    audio_url: str | None = None
    audio_status: Literal["pending", "ready", "failed"] = "pending"
    stored: bool
    source: str


class ItemContentUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1)
    persona: str = "Mặc định"
    language: str = "Tiếng Việt"


class ItemContentDraftRequest(BaseModel):
    persona: str = "Mặc định"
    language: str = "Tiếng Việt"


class ItemContentDraftResponse(BaseModel):
    item_id: int
    persona: str
    language: str
    content: str


class BulkRegenerateContentRequest(BaseModel):
    document_ids: list[int] | None = None


class BulkRegenerateContentResponse(BaseModel):
    updated_count: int
    skipped_count: int
    updated_item_ids: list[int]
    skipped_item_ids: list[int]
