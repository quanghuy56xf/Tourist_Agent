from unittest.mock import Mock

import pytest

from app.models.item import Item
from app.modules.objects import objects_router


def _add_item(db_session, **overrides) -> Item:
    item = Item(
        name=overrides.get("name", "Old name"),
        description=overrides.get("description", "Old description"),
        main_image_url="/uploads/1/front.jpg",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


def test_update_description_upserts_stable_rag_document(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    item = _add_item(db_session)
    retriever = Mock()
    monkeypatch.setattr(
        objects_router,
        "try_get_rag_retriever",
        lambda: retriever,
        raising=False,
    )

    response = client.put(
        f"/api/objects/{item.id}",
        json={"description": "New description"},
    )

    assert response.status_code == 200
    retriever.upsert_item_document.assert_called_once_with(
        item.id,
        "New description",
    )
    db_session.refresh(item)
    assert item.description == "New description"


def test_update_succeeds_when_rag_sync_fails(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    item = _add_item(db_session)
    retriever = Mock()
    retriever.upsert_item_document.side_effect = OSError("rag unavailable")
    monkeypatch.setattr(
        objects_router,
        "try_get_rag_retriever",
        lambda: retriever,
        raising=False,
    )

    response = client.put(
        f"/api/objects/{item.id}",
        json={"description": "Saved in SQLite"},
    )

    assert response.status_code == 200
    db_session.refresh(item)
    assert item.description == "Saved in SQLite"


def test_delete_removes_all_indexes_when_available(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    item = _add_item(db_session)
    retriever = Mock()
    delete_dir = Mock()
    delete_image_embeddings = Mock()
    monkeypatch.setattr(
        objects_router,
        "try_get_rag_retriever",
        lambda: retriever,
        raising=False,
    )
    monkeypatch.setattr(objects_router.storage, "delete_item_dir", delete_dir)
    monkeypatch.setattr(
        objects_router.chroma,
        "delete_embeddings_for_item",
        delete_image_embeddings,
    )

    response = client.delete(f"/api/objects/{item.id}")

    assert response.status_code == 200
    assert db_session.get(Item, item.id) is None
    delete_dir.assert_called_once_with(item.id)
    delete_image_embeddings.assert_called_once_with(item.id)
    retriever.delete_item_document.assert_called_once_with(item.id)


def test_delete_succeeds_when_rag_is_unavailable(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    item = _add_item(db_session)
    monkeypatch.setattr(
        objects_router,
        "try_get_rag_retriever",
        lambda: None,
        raising=False,
    )
    monkeypatch.setattr(objects_router.storage, "delete_item_dir", Mock())
    monkeypatch.setattr(
        objects_router.chroma,
        "delete_embeddings_for_item",
        Mock(),
    )

    response = client.delete(f"/api/objects/{item.id}")

    assert response.status_code == 200
    assert db_session.get(Item, item.id) is None


def test_delete_does_not_remove_artifacts_when_commit_fails(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    item = _add_item(db_session)
    delete_dir = Mock()
    delete_embeddings = Mock()
    monkeypatch.setattr(objects_router.storage, "delete_item_dir", delete_dir)
    monkeypatch.setattr(
        objects_router.chroma,
        "delete_embeddings_for_item",
        delete_embeddings,
    )
    monkeypatch.setattr(
        db_session,
        "commit",
        Mock(side_effect=RuntimeError("commit failed")),
    )

    with pytest.raises(RuntimeError, match="commit failed"):
        client.delete(f"/api/objects/{item.id}")

    delete_dir.assert_not_called()
    delete_embeddings.assert_not_called()


def test_delete_succeeds_when_external_cleanup_fails(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    item = _add_item(db_session)
    monkeypatch.setattr(
        objects_router.storage,
        "delete_item_dir",
        Mock(side_effect=PermissionError("locked")),
    )
    monkeypatch.setattr(
        objects_router.chroma,
        "delete_embeddings_for_item",
        Mock(side_effect=ValueError("broken index")),
    )
    monkeypatch.setattr(
        objects_router,
        "try_get_rag_retriever",
        Mock(side_effect=ValueError("broken rag")),
    )

    response = client.delete(f"/api/objects/{item.id}")

    assert response.status_code == 200
    assert db_session.get(Item, item.id) is None


@pytest.mark.parametrize(
    ("payload", "detail_fragment"),
    [
        ({"name": "  "}, "kh"),
        ({"description": "  "}, "kh"),
    ],
)
def test_update_rejects_blank_fields(
    client,
    db_session,
    payload,
    detail_fragment,
):
    item = _add_item(db_session)

    response = client.put(f"/api/objects/{item.id}", json=payload)

    assert response.status_code == 400
    assert detail_fragment in response.json()["detail"]
