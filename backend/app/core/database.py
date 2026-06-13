from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.core.config import BASE_DIR, DATABASE_URL
from app.models.group import Group  # noqa: F401
from app.models.content_variant import ItemContentVariant  # noqa: F401
from app.models.group_document import GroupDocument  # noqa: F401
from app.models.item import Base, Item  # noqa: F401
from app.modules.rag.retriever import ensure_rag_index

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


def init_db() -> None:
    data_dir = BASE_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    ensure_rag_index()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
