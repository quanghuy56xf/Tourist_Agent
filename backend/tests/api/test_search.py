from unittest.mock import Mock

import pytest

from app.models.item import Item
from app.modules.vision import chroma
from app.modules.vision import router as search_router


def test_search_rejects_empty_filename_without_loading_model(
    client,
    monkeypatch: pytest.MonkeyPatch,
):
    extract = Mock()
    monkeypatch.setattr(
        search_router.embedding,
        "extract_vectors_augmented",
        extract,
    )

    response = client.post(
        "/api/search",
        files={"search_image": ("", b"image", "image/jpeg")},
    )

    assert response.status_code == 422
    extract.assert_not_called()


def test_search_returns_not_found_without_matches(
    client,
    monkeypatch: pytest.MonkeyPatch,
):
    extract = Mock(return_value=[[0.1, 0.2]])
    monkeypatch.setattr(
        search_router.embedding,
        "extract_vectors_augmented",
        extract,
    )
    monkeypatch.setattr(search_router.chroma, "search_top_items", lambda _: [])

    response = client.post(
        "/api/search",
        files={"search_image": ("query.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["found"] is False
    extract.assert_called_once()


@pytest.mark.parametrize(
    ("similarity", "expected_found"),
    [(0.1, False), (0.99, True)],
)
def test_search_applies_similarity_threshold(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
    similarity,
    expected_found,
):
    item = Item(name="Item", description="Description")
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)

    monkeypatch.setattr(
        search_router.embedding,
        "extract_vectors_augmented",
        lambda *args, **kwargs: [[0.1, 0.2]],
    )
    monkeypatch.setattr(
        search_router.chroma,
        "search_top_items",
        lambda _: [
            chroma.SearchResult(
                item_id=item.id,
                angle="front",
                similarity=similarity,
            )
        ],
    )
    monkeypatch.setattr(search_router.storage, "list_item_images", lambda _: [])

    response = client.post(
        "/api/search",
        files={"search_image": ("query.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["found"] is expected_found


def test_search_cleans_stale_chroma_item(
    client,
    monkeypatch: pytest.MonkeyPatch,
):
    delete_embeddings = Mock()
    monkeypatch.setattr(
        search_router.embedding,
        "extract_vectors_augmented",
        lambda *args, **kwargs: [[0.1, 0.2]],
    )
    monkeypatch.setattr(
        search_router.chroma,
        "search_top_items",
        lambda _: [
            chroma.SearchResult(
                item_id=999,
                angle="front",
                similarity=0.99,
            )
        ],
    )
    monkeypatch.setattr(
        search_router.chroma,
        "delete_embeddings_for_item",
        delete_embeddings,
    )

    response = client.post(
        "/api/search",
        files={"search_image": ("query.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["found"] is False
    delete_embeddings.assert_called_once_with(999)
