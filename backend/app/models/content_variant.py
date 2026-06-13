from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.item import Base

if TYPE_CHECKING:
    from app.models.item import Item


class ItemContentVariant(Base):
    __tablename__ = "item_content_variants"
    __table_args__ = (
        UniqueConstraint("item_id", "persona", "language", name="uq_item_persona_language"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    persona: Mapped[str] = mapped_column(String(64), nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    audio_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    audio_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ready")
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="generated")
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    item: Mapped["Item"] = relationship(back_populates="content_variants")
