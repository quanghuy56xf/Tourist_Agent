import logging
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.core.config import ADMIN_PASSWORD, ADMIN_USERNAME, BASE_DIR, DATABASE_URL
from app.models.analytics_event import AnalyticsEvent  # noqa: F401
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
    _seed_admin_user()
    ensure_rag_index()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
