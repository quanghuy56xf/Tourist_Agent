from datetime import datetime

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str


class GroupResponse(BaseModel):
    id: int
    name: str
    item_count: int
    created_at: datetime


class ItemImageResponse(BaseModel):
    angle: str
    url: str


class GroupItemResponse(BaseModel):
    id: int
    name: str
    description: str
    main_image_url: str | None
    group_id: int | None = None
    images: list[ItemImageResponse]
    created_at: datetime


class GroupItemsResponse(BaseModel):
    group_id: int
    group_name: str
    items: list[GroupItemResponse]


class UngroupedItemsResponse(BaseModel):
    items: list[GroupItemResponse]
