from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.item import Base


class ChatTurnLog(Base):
    __tablename__ = "chat_turn_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    turn_code: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True, index=True)
    conversation_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    chat_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="item")
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("groups.id"), nullable=True, index=True
    )
    item_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("items.id"), nullable=True, index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    search_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    assistant_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    persona: Mapped[str | None] = mapped_column(String(64), nullable=True)
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    success: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    error_detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prompt_cache_hit_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prompt_cache_miss_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    token_source: Mapped[str] = mapped_column(String(16), nullable=False, default="estimated")
    input_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    input_cache_hit_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    input_cache_miss_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    output_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    llm_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )
