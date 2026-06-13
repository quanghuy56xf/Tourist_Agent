from datetime import datetime

from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.item import Base

if TYPE_CHECKING:
    from app.models.group_document import GroupDocument
    from app.models.item import Item


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    knowledge_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    items: Mapped[list["Item"]] = relationship(back_populates="group")
    documents: Mapped[list["GroupDocument"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )
