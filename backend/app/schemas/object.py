from pydantic import BaseModel


class ItemUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    group_id: int | None = None
    remove_from_group: bool = False


class ItemUpdateResponse(BaseModel):
    item_id: int
    message: str


class ItemDeleteResponse(BaseModel):
    item_id: int
    message: str


class ImageUpdateResponse(BaseModel):
    item_id: int
    angle: str
    image_url: str
    message: str


class ImageDeleteResponse(BaseModel):
    item_id: int
    angle: str
    message: str
