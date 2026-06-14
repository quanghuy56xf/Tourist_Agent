from datetime import datetime

from pydantic import BaseModel, Field


class TourStopInput(BaseModel):
    item_id: int
    hint_vi: str = ""
    hint_en: str = ""


class TourStopResponse(BaseModel):
    item_id: int
    name: str
    description: str
    hint_vi: str
    hint_en: str
    image_url: str | None
    sort_order: int


class TourCreate(BaseModel):
    title_vi: str
    title_en: str
    description_vi: str = ""
    description_en: str = ""
    is_published: bool = True
    stops: list[TourStopInput] = Field(min_length=2)


class TourUpdate(BaseModel):
    title_vi: str
    title_en: str
    description_vi: str = ""
    description_en: str = ""
    is_published: bool = True
    stops: list[TourStopInput] = Field(min_length=2)


class TourSummaryResponse(BaseModel):
    id: int
    title_vi: str
    title_en: str
    description_vi: str
    description_en: str
    is_published: bool
    stop_count: int
    created_at: datetime


class TourDetailResponse(BaseModel):
    id: int
    title_vi: str
    title_en: str
    description_vi: str
    description_en: str
    is_published: bool
    stop_count: int
    created_at: datetime
    stops: list[TourStopResponse]
