from unittest.mock import AsyncMock, Mock

import pytest

from app.models.content_variant import ItemContentVariant
from app.models.item import Item
from app.modules.content.service import compute_content_hash
from app.modules.objects import objects_router, register_router


def _variant(item_id: int) -> ItemContentVariant:
    return ItemContentVariant(
        item_id=item_id,
        persona="Mặc định",
        language="Tiếng Việt",
        text_content="Cached content.",
        content_hash=compute_content_hash("Description"),
        status="ready",
        source="generated",
    )


def test_updating_one_image_deletes_all_cached_variants(client, db_session, monkeypatch):
    first = Item(name="First", description="Description")
    second = Item(name="Second", description="Description")
    db_session.add_all([first, second])
    db_session.flush()
    db_session.add_all([_variant(first.id), _variant(second.id)])
    db_session.commit()

    monkeypatch.setattr(objects_router, "ingest_image", AsyncMock(return_value="/uploads/1/front.jpg"))

    response = client.put(
        f"/api/objects/{first.id}/images/front",
        files={"image": ("front.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert db_session.query(ItemContentVariant).count() == 0


def test_registration_removes_orphaned_cache_for_reused_item_id(client, db_session, monkeypatch):
    db_session.add(_variant(1))
    db_session.commit()
    monkeypatch.setattr(register_router, "ingest_image", AsyncMock(return_value="/uploads/1/front.jpg"))
    monkeypatch.setattr(register_router.storage, "delete_item_dir", Mock())
    monkeypatch.setattr(register_router.chroma, "delete_embeddings_for_item", Mock())
    monkeypatch.setattr(register_router, "try_get_rag_retriever", lambda: None)

    response = client.post(
        "/api/objects/register",
        data={"name": "New item", "description": "Description"},
        files={"main_image": ("front.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["item_id"] == 1
    assert db_session.query(ItemContentVariant).filter_by(item_id=1).count() == 0
