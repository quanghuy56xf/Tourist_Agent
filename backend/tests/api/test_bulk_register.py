from unittest.mock import AsyncMock, Mock

import pytest

from app.main import app
from app.models.group import Group
from app.modules.auth.dependencies import require_admin_if_enabled
from app.models.item import Item
from app.modules.objects import register_router


@pytest.fixture(autouse=True)
def _disable_admin_auth_for_bulk_tests():
    app.dependency_overrides[require_admin_if_enabled] = lambda: None
    yield
    app.dependency_overrides.pop(require_admin_if_enabled, None)

def _add_group(db_session) -> Group:
    group = Group(name="Bulk test group")
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)
    return group


def _image_files(count: int):
    return [
        ("images", (f"image-{index}.jpg", f"image-{index}".encode(), "image/jpeg"))
        for index in range(1, count + 1)
    ]


def test_bulk_register_dry_run_does_not_write_anything(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    group = _add_group(db_session)
    ingest = AsyncMock()
    monkeypatch.setattr(register_router, "ingest_image", ingest)

    response = client.post(
        "/api/objects/bulk-register-item",
        data={
            "name": "Dry run item",
            "description": "Only validate this item",
            "group_id": str(group.id),
            "dry_run": "true",
        },
        files=_image_files(2),
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "success",
        "item_id": None,
        "message": "dry_run",
    }
    assert db_session.query(Item).count() == 0
    ingest.assert_not_awaited()


def test_bulk_register_skips_existing_item_in_same_group(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    group = _add_group(db_session)
    existing = Item(
        name="Existing item",
        description="Already registered",
        group_id=group.id,
    )
    db_session.add(existing)
    db_session.commit()
    ingest = AsyncMock()
    monkeypatch.setattr(register_router, "ingest_image", ingest)

    response = client.post(
        "/api/objects/bulk-register-item",
        data={
            "name": "Existing item",
            "description": "New description",
            "group_id": str(group.id),
            "skip_existing": "true",
        },
        files=_image_files(1),
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "skipped",
        "item_id": existing.id,
        "message": "already_exists",
    }
    assert db_session.query(Item).count() == 1
    ingest.assert_not_awaited()


def test_bulk_register_saves_first_three_images_and_only_indexes_extras(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    group = _add_group(db_session)
    ingest = AsyncMock(
        side_effect=[
            "/uploads/1/front.jpg",
            "/uploads/1/side.jpg",
            "/uploads/1/back.jpg",
            "",
            "",
        ]
    )
    retriever = Mock()
    monkeypatch.setattr(register_router, "ingest_image", ingest)
    monkeypatch.setattr(register_router.storage, "delete_item_dir", Mock())
    monkeypatch.setattr(
        register_router.chroma,
        "delete_embeddings_for_item",
        Mock(),
    )
    monkeypatch.setattr(
        register_router,
        "try_get_rag_retriever",
        lambda: retriever,
    )

    response = client.post(
        "/api/objects/bulk-register-item",
        data={
            "name": "Five image item",
            "description": "An item with extra training images",
            "group_id": str(group.id),
        },
        files=_image_files(5),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["message"] == "success"
    item = db_session.get(Item, body["item_id"])
    assert item is not None
    assert item.name == "Five image item"
    assert item.main_image_url == "/uploads/1/front.jpg"

    calls = ingest.await_args_list
    assert [(call.args[1], call.kwargs["save_to_db"]) for call in calls] == [
        ("front", True),
        ("side", True),
        ("back", True),
        ("extra_1", False),
        ("extra_2", False),
    ]
    retriever.upsert_item_document.assert_called_once_with(
        item.id,
        item.description,
    )
