from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.item import Base


class RagTrace(Base):
    __tablename__ = "rag_traces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_turn_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("chat_turn_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    group_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("groups.id"), nullable=True, index=True)
    item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("items.id"), nullable=True, index=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    retrieval_query: Mapped[str] = mapped_column(Text, nullable=False)
    top_k: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fallback_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fallback_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dense_max_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    retrieved_chunks_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    reranked_chunks_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    context_chunks_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    has_verified_knowledge: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    latency_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True,
    )
