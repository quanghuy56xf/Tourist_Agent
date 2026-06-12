from unittest.mock import AsyncMock, Mock

import pytest
from langchain_core.documents import Document

from app.models.item import Item
from app.modules.objects import item_images
from app.modules.objects import register_router
from app.modules.rag import retriever as retriever_module


class FakeVectorStore:
    def __init__(self):
        self.deleted_ids: list[str] = []
        self.added: list[tuple[list[Document], list[str]]] = []

    def delete(self, *, ids: list[str]) -> None:
        self.deleted_ids.extend(ids)

    def add_documents(self, documents: list[Document], *, ids: list[str]) -> None:
        self.added.append((documents, ids))


@pytest.mark.anyio
async def test_image_embedding_failure_does_not_replace_existing_artifacts(
    monkeypatch: pytest.MonkeyPatch,
):
    save_image = Mock()
    delete_embedding = Mock()

    def fail_embedding(*args, **kwargs):
        raise RuntimeError("embedding failed")

    monkeypatch.setattr(
        item_images.embedding,
        "extract_vectors_augmented",
        fail_embedding,
    )
    monkeypatch.setattr(
        item_images.storage,
        "save_image_bytes",
        save_image,
    )
    monkeypatch.setattr(
        item_images.chroma,
        "delete_embedding",
        delete_embedding,
    )

    upload = Mock()
    upload.read = AsyncMock(return_value=b"image")

    with pytest.raises(RuntimeError, match="embedding failed"):
        await item_images.ingest_image(7, "front", upload)

    save_image.assert_not_called()
    delete_embedding.assert_not_called()


def test_upsert_item_document_replaces_existing_item_chunk(
    monkeypatch: pytest.MonkeyPatch,
):
    instance = retriever_module.HybridRetriever.__new__(
        retriever_module.HybridRetriever
    )
    instance.vector_store = FakeVectorStore()
    instance.chunks = [
        Document(
            page_content="old",
            metadata={"source": "item", "page": "item-7", "item_id": 7},
        ),
        Document(page_content="reference", metadata={"page": "reference-1"}),
    ]

    persist_sparse_index = Mock()
    instance._persist_sparse_index = persist_sparse_index

    instance.upsert_item_document(7, "new")

    persist_sparse_index.assert_called_once()
    assert instance.vector_store.deleted_ids == ["item-7"]
    assert instance.vector_store.added[0][1] == ["item-7"]
    assert [chunk.page_content for chunk in instance.chunks] == [
        "reference",
        "new",
    ]
    assert instance.chunks[-1].metadata == {
        "source": "item",
        "page": "item-7",
        "item_id": 7,
    }


def test_registration_failure_rolls_back_item_and_cleans_artifacts(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    delete_dir = Mock()
    delete_embeddings = Mock()

    async def broken_ingest(*args, **kwargs):
        raise RuntimeError("image ingest failed")

    monkeypatch.setattr(register_router, "ingest_image", broken_ingest)
    monkeypatch.setattr(register_router.storage, "delete_item_dir", delete_dir)
    monkeypatch.setattr(
        register_router.chroma,
        "delete_embeddings_for_item",
        delete_embeddings,
    )

    with pytest.raises(RuntimeError, match="image ingest failed"):
        client.post(
            "/api/objects/register",
            data={"name": "Item", "description": "Description"},
            files={"main_image": ("front.jpg", b"image", "image/jpeg")},
        )

    assert db_session.query(Item).count() == 0
    assert delete_dir.call_count >= 1
    assert delete_embeddings.call_count == 2


def test_registration_succeeds_when_rag_sync_fails(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fake_ingest(item_id, angle, upload_file):
        return f"/uploads/{item_id}/{angle}.jpg"

    class BrokenRetriever:
        def upsert_item_document(self, item_id: int, content: str) -> None:
            raise ValueError("rag unavailable")

    monkeypatch.setattr(register_router, "ingest_image", fake_ingest)
    monkeypatch.setattr(
        register_router,
        "try_get_rag_retriever",
        lambda: BrokenRetriever(),
        raising=False,
    )
    monkeypatch.setattr(register_router.storage, "delete_item_dir", Mock())

    response = client.post(
        "/api/objects/register",
        data={"name": "Item", "description": "Description"},
        files={"main_image": ("front.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert db_session.query(Item).count() == 1


def test_registration_clears_all_embeddings_before_ingest(
    client,
    monkeypatch: pytest.MonkeyPatch,
):
    events: list[str] = []

    async def fake_ingest(item_id, angle, upload_file):
        events.append(f"ingest:{angle}")
        return f"/uploads/{item_id}/{angle}.jpg"

    monkeypatch.setattr(register_router, "ingest_image", fake_ingest)
    monkeypatch.setattr(register_router.storage, "delete_item_dir", Mock())
    monkeypatch.setattr(
        register_router.chroma,
        "delete_embeddings_for_item",
        lambda item_id: events.append("clear"),
    )
    monkeypatch.setattr(
        register_router,
        "try_get_rag_retriever",
        lambda: None,
    )

    response = client.post(
        "/api/objects/register",
        data={"name": "Item", "description": "Description"},
        files={"main_image": ("front.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert events == ["clear", "ingest:front"]
