from collections.abc import Generator
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
import app.main as main_module
from app.main import app
from app.models.item import Base
from app.models.content_variant import ItemContentVariant  # noqa: F401
from app.models.group_document import GroupDocument  # noqa: F401
from app.models.tour import Tour, TourStop  # noqa: F401
from app.models.user import User  # noqa: F401
from app.modules.vision import embedding


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db_session

    test_session_local = sessionmaker(
        bind=db_session.get_bind(),
        autocommit=False,
        autoflush=False,
    )
    monkeypatch.setattr(embedding, "warmup", Mock())
    monkeypatch.setattr(main_module, "init_db", Mock())
    monkeypatch.setattr("app.core.database.SessionLocal", test_session_local)
    monkeypatch.setattr("app.modules.content.prewarm.SessionLocal", test_session_local)
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
