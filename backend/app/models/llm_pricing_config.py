from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.item import Base


class LlmPricingConfig(Base):
    __tablename__ = "llm_pricing_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    input_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False)
    input_cache_hit_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    input_cache_miss_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    output_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    updated_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
