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
    session_id: str | None = Field(default=None, max_length=64)
    search_session_id: str | None = Field(default=None, max_length=64)


class CompanionChatRequest(BaseModel):
    item_id: int
    suggest_next: bool = False
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    message: str = Field(min_length=1, max_length=2000)
    visited_item_ids: list[int] = Field(default_factory=list, max_length=100)
    session_id: str | None = Field(default=None, max_length=64)



class CompanionChatResponse(BaseModel):
    content: str
    next_item_id: int | None = None

class ChatResponse(BaseModel):
    content: str


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: Literal["vi", "en"] = "vi"
    persona: Literal["Companion"] | None = None
