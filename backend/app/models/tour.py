from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.item import Base

if TYPE_CHECKING:
    from app.models.item import Item


class Tour(Base):
    __tablename__ = "tours"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title_vi: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    description_vi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_en: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    stops: Mapped[list["TourStop"]] = relationship(
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourStop.sort_order",
    )


class TourStop(Base):
    __tablename__ = "tour_stops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tour_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tours.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hint_vi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hint_en: Mapped[str] = mapped_column(Text, nullable=False, default="")

    tour: Mapped["Tour"] = relationship(back_populates="stops")
    item: Mapped["Item"] = relationship()
