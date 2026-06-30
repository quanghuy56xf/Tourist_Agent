import logging
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.core.config import (
    ADMIN_PASSWORD,
    ADMIN_USERNAME,
    BASE_DIR,
    DATABASE_URL,
    LLM_INPUT_CACHE_HIT_PRICE_PER_1M,
    LLM_INPUT_CACHE_MISS_PRICE_PER_1M,
    LLM_INPUT_PRICE_PER_1M,
    LLM_OUTPUT_PRICE_PER_1M,
)
from app.models.analytics_event import AnalyticsEvent  # noqa: F401
from app.models.chat_turn_log import ChatTurnLog  # noqa: F401
from app.models.llm_pricing_config import LlmPricingConfig  # noqa: F401
from app.models.group import Group  # noqa: F401
from app.models.content_variant import ItemContentVariant  # noqa: F401
from app.models.group_document import GroupDocument  # noqa: F401
from app.models.tour import Tour, TourStop  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.item import Base, Item  # noqa: F401
from app.modules.rag.retriever import ensure_rag_index
from app.modules.auth.passwords import hash_password

logger = logging.getLogger(__name__)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _migrate_schema() -> None:
    inspector = inspect(engine)
    if inspector.has_table("items"):
        columns = {col["name"] for col in inspector.get_columns("items")}
        if "group_id" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE items ADD COLUMN group_id INTEGER REFERENCES groups(id)")
                )
    if inspector.has_table("groups"):
        columns = {col["name"] for col in inspector.get_columns("groups")}
        if "knowledge_version" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE groups ADD COLUMN knowledge_version INTEGER NOT NULL DEFAULT 1"
                    )
                )
        if "is_public" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE groups ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT 1"
                    )
                )
        if "minimap_config" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE groups ADD COLUMN minimap_config JSON"))

    if inspector.has_table("llm_pricing_config"):
        columns = {col["name"] for col in inspector.get_columns("llm_pricing_config")}
        with engine.begin() as conn:
            if "input_cache_hit_price_per_1m" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE llm_pricing_config "
                        "ADD COLUMN input_cache_hit_price_per_1m FLOAT NOT NULL DEFAULT 0"
                    )
                )
            if "input_cache_miss_price_per_1m" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE llm_pricing_config "
                        "ADD COLUMN input_cache_miss_price_per_1m FLOAT NOT NULL DEFAULT 0"
                    )
                )
        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE llm_pricing_config "
                    "SET input_cache_miss_price_per_1m = input_price_per_1m "
                    "WHERE input_cache_miss_price_per_1m = 0 "
                    "AND input_price_per_1m > 0"
                )
            )
            conn.execute(
                text(
                    "UPDATE llm_pricing_config "
                    f"SET input_cache_hit_price_per_1m = {LLM_INPUT_CACHE_HIT_PRICE_PER_1M} "
                    "WHERE input_cache_hit_price_per_1m = 0"
                )
            )

    if inspector.has_table("chat_turn_logs"):
        columns = {col["name"] for col in inspector.get_columns("chat_turn_logs")}
        additions = {
            "prompt_cache_hit_tokens": "INTEGER NOT NULL DEFAULT 0",
            "prompt_cache_miss_tokens": "INTEGER NOT NULL DEFAULT 0",
            "input_cache_hit_price_per_1m": "FLOAT NOT NULL DEFAULT 0",
            "input_cache_miss_price_per_1m": "FLOAT NOT NULL DEFAULT 0",
        }
        with engine.begin() as conn:
            for name, ddl in additions.items():
                if name not in columns:
                    conn.execute(
                        text(f"ALTER TABLE chat_turn_logs ADD COLUMN {name} {ddl}")
                    )
            conn.execute(
                text(
                    "UPDATE chat_turn_logs "
                    "SET prompt_cache_miss_tokens = prompt_tokens "
                    "WHERE prompt_cache_miss_tokens = 0 AND prompt_tokens > 0"
                )
            )
            conn.execute(
                text(
                    "UPDATE chat_turn_logs "
                    "SET input_cache_miss_price_per_1m = input_price_per_1m "
                    "WHERE input_cache_miss_price_per_1m = 0 AND input_price_per_1m > 0"
                )
            )


def _seed_llm_pricing() -> None:
    db = SessionLocal()
    try:
        existing = db.query(LlmPricingConfig).first()
        if existing is None:
            db.add(
                LlmPricingConfig(
                    input_price_per_1m=LLM_INPUT_CACHE_MISS_PRICE_PER_1M,
                    input_cache_hit_price_per_1m=LLM_INPUT_CACHE_HIT_PRICE_PER_1M,
                    input_cache_miss_price_per_1m=LLM_INPUT_CACHE_MISS_PRICE_PER_1M,
                    output_price_per_1m=LLM_OUTPUT_PRICE_PER_1M,
                    currency="USD",
                )
            )
            db.commit()
    finally:
        db.close()


def _seed_admin_user() -> None:
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        return
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if existing is None:
            db.add(
                User(
                    username=ADMIN_USERNAME,
                    password_hash=hash_password(ADMIN_PASSWORD),
                    role="admin",
                    is_active=True,
                )
            )
            db.commit()
            logger.info("Seeded admin user=%r from environment config", ADMIN_USERNAME)
    finally:
        db.close()


def init_db() -> None:
    data_dir = BASE_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    _seed_llm_pricing()
    _seed_admin_user()
    ensure_rag_index()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
