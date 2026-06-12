from pydantic import BaseModel


class SearchMatch(BaseModel):
    item_id: int
    name: str
    description: str
    similarity: float
    image_url: str | None = None


class SearchResponse(BaseModel):
    found: bool
    results: list[SearchMatch] = []
    message: str | None = None
