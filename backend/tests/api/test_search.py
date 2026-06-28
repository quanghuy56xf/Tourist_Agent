from unittest.mock import Mock

import pytest

from app.models.group import Group
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
    monkeypatch.setattr(search_router.chroma, "search_top_items", lambda *args, **kwargs: [])

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
        lambda *args, **kwargs: [
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


def test_search_filters_results_to_requested_group(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    group_a = Group(name="Site A")
    group_b = Group(name="Site B")
    db_session.add_all([group_a, group_b])
    db_session.commit()
    db_session.refresh(group_a)
    db_session.refresh(group_b)

    item_a = Item(name="Item A", description="In site A", group_id=group_a.id)
    item_b = Item(name="Item B", description="In site B", group_id=group_b.id)
    db_session.add_all([item_a, item_b])
    db_session.commit()
    db_session.refresh(item_a)
    db_session.refresh(item_b)

    captured: dict[str, list[int] | None] = {}

    def fake_search_top_items(vectors, top_n=None, n_results=None, item_ids=None):
        captured["item_ids"] = item_ids
        return [
            chroma.SearchResult(item_id=item_b.id, angle="front", similarity=0.99),
            chroma.SearchResult(item_id=item_a.id, angle="front", similarity=0.95),
        ]

    monkeypatch.setattr(
        search_router.embedding,
        "extract_vectors_augmented",
        lambda *args, **kwargs: [[0.1, 0.2]],
    )
    monkeypatch.setattr(search_router.chroma, "search_top_items", fake_search_top_items)
    monkeypatch.setattr(search_router.storage, "list_item_images", lambda _: [])

    response = client.post(
        "/api/search",
        data={"group_id": str(group_a.id)},
        files={"search_image": ("query.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert captured["item_ids"] == [item_a.id]
    assert [result["item_id"] for result in body["results"]] == [item_a.id]
    assert body["found"] is True


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
        lambda *args, **kwargs: [
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


def test_search_returns_all_item_images_without_changing_primary_image_url(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    item = Item(name="Item", description="Description", main_image_url="/uploads/1/front.jpg")
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)

    images = [
        {"angle": "front", "url": "/uploads/1/front.jpg?v=1"},
        {"angle": "side", "url": "/uploads/1/side.jpg?v=1"},
        {"angle": "back", "url": "/uploads/1/back.jpg?v=1"},
    ]

    monkeypatch.setattr(
        search_router.embedding,
        "extract_vectors_augmented",
        lambda *args, **kwargs: [[0.1, 0.2]],
    )
    monkeypatch.setattr(
        search_router.chroma,
        "search_top_items",
        lambda *args, **kwargs: [
            chroma.SearchResult(item_id=item.id, angle="front", similarity=0.99)
        ],
    )
    monkeypatch.setattr(search_router.storage, "list_item_images", lambda _: images)

    response = client.post(
        "/api/search",
        files={"search_image": ("query.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["image_url"] == "/uploads/1/front.jpg?v=1"
    assert result["images"] == images
