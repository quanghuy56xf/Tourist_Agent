from pydantic import BaseModel, Field


class ItemContentResponse(BaseModel):
    item_id: int
    persona: str
    language: str
    content: str
    has_audio: bool
    audio_url: str | None = None
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


class ItemContentSyncState(BaseModel):
    item_id: int
    state: str
    variants_ready: int
    variants_total: int
    needs_regeneration: bool


class GroupContentSyncSummary(BaseModel):
    total: int
    synced: int
    needs_update: int
    in_progress: int


class GroupContentSyncStatusResponse(BaseModel):
    group_id: int
    is_sync_active: bool
    summary: GroupContentSyncSummary
    items: list[ItemContentSyncState]


class SyncMissingContentResponse(BaseModel):
    queued_count: int
    queued_item_ids: list[int]
    message: str
