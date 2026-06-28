from pydantic import BaseModel, Field


class SearchImage(BaseModel):
    angle: str
    url: str


class SearchMatch(BaseModel):
    item_id: int
    name: str
    description: str
    similarity: float
    image_url: str | None = None
    images: list[SearchImage] = Field(default_factory=list)


class SearchResponse(BaseModel):
    found: bool
    results: list[SearchMatch] = []
    message: str | None = None
