import pytest
from langchain_core.documents import Document

from app.modules.rag.service import build_item_context


class BrokenRetriever:
    def retrieve(self, query: str, top_k: int, group_id: int | None = None):
        raise MemoryError()


class WorkingRetriever:
    def retrieve(self, query: str, top_k: int, group_id: int | None = None):
        return [
            Document(
                page_content="Supplemental fact",
                metadata={"page": "kb-1"},
            )
        ]


class InvalidRetriever:
    def retrieve(self, query: str, top_k: int, group_id: int | None = None):
        raise TypeError("broken invariant")


class RuntimeFailureRetriever:
    def retrieve(self, query: str, top_k: int, group_id: int | None = None):
        raise RuntimeError("model out of memory")


def test_item_description_is_always_grounding_context():
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=BrokenRetriever(),
    )

    assert docs[0].page_content == "Primary description"
    assert docs[0].metadata == {"source": "item", "page": "item-7"}


def test_retrieval_documents_are_appended():
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=WorkingRetriever(),
    )

    assert [doc.page_content for doc in docs] == [
        "Primary description",
        "Supplemental fact",
    ]


def test_programming_errors_are_not_hidden():
    with pytest.raises(TypeError, match="broken invariant"):
        build_item_context(
            item_id=7,
            item_name="Test item",
            item_description="Primary description",
            retriever=InvalidRetriever(),
        )


def test_runtime_model_failures_use_item_context():
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=RuntimeFailureRetriever(),
    )

    assert [doc.page_content for doc in docs] == ["Primary description"]
