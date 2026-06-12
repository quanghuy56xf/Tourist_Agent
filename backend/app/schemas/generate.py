from typing import Literal

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    item_id: int
    persona: str = "Mặc định"
    language: str = "Tiếng Việt"


class GenerateResponse(BaseModel):
    item_id: int
    content: str
    persona: str
    language: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    item_id: int
    persona: str = "Mặc định"
    language: str = "Tiếng Việt"
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    content: str


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: Literal["vi", "en"] = "vi"
