import pytest
from langchain_core.documents import Document

from app.modules.rag.service import (
    build_chat_item_context,
    build_item_context,
    build_verified_item_context,
    filter_group_docs_for_item,
    is_substantive_item_description,
)


class BrokenRetriever:
    def retrieve(self, query: str, top_k: int, group_id: int | None = None):
        raise MemoryError()


class GroupScopedRetriever:
    def __init__(self):
        self.query = None
        self.group_id = None

    def retrieve(self, query: str, top_k: int, group_id: int | None = None):
        self.query = query
        self.group_id = group_id
        return [
            Document(
                page_content="Supplemental fact",
                metadata={"page": "kb-1"},
            )
        ]


class WorkingRetriever:
    def __init__(self):
        self.query = None

    def retrieve(self, query: str, top_k: int, group_id: int | None = None):
        self.query = query
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
    retriever = GroupScopedRetriever()
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=retriever,
        group_id=1,
        query="Ai là người xây dựng hiện vật này?",
    )

    assert retriever.query == "Ai là người xây dựng hiện vật này?"
    assert retriever.group_id == 1
    assert [doc.page_content for doc in docs] == [
        "Primary description",
        "Supplemental fact",
    ]


def test_retrieval_skipped_without_group_id():
    retriever = GroupScopedRetriever()
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=retriever,
        group_id=None,
    )

    assert retriever.query is None
    assert [doc.page_content for doc in docs] == ["Primary description"]


def test_programming_errors_are_not_hidden():
    with pytest.raises(TypeError, match="broken invariant"):
        build_item_context(
            item_id=7,
            item_name="Test item",
            item_description="Primary description",
            retriever=InvalidRetriever(),
            group_id=1,
        )


def test_runtime_model_failures_use_item_context():
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=RuntimeFailureRetriever(),
        group_id=1,
    )

    assert [doc.page_content for doc in docs] == ["Primary description"]


def test_name_only_description_is_not_substantive():
    assert is_substantive_item_description("Chuông văn miếu", "Chuông văn miếu") is False


def test_verified_context_rejects_unrelated_group_docs():
    retriever = WorkingRetriever()
    retriever.retrieve = lambda query, top_k, group_id=None: [
        Document(
            page_content="Supplemental fact about the temple gate",
            metadata={"source": "group_doc", "page": "kb-1"},
        )
    ]
    docs, has_verified = build_verified_item_context(
        item_id=5,
        item_name="Chuông văn miếu",
        item_description="Chuông văn miếu",
        retriever=retriever,
        group_id=1,
    )

    assert has_verified is False
    assert docs == []


def test_verified_context_keeps_group_docs_that_mention_item():
    docs = [
        Document(
            page_content="Chuông văn miếu được treo tại sân đại bái.",
            metadata={"source": "group_doc", "page": "kb-bell"},
        )
    ]
    filtered = filter_group_docs_for_item(
        "Chuông văn miếu",
        "Chuông văn miếu",
        docs,
    )

    assert len(filtered) == 1


def test_chat_context_includes_query_aligned_docs_without_item_name():
    retriever = WorkingRetriever()
    retriever.retrieve = lambda query, top_k, group_id=None: [
        Document(
            page_content="Văn Miếu được xây dựng năm 1070 dưới triều Lý Thánh Tông.",
            metadata={"source": "group_doc", "page": "kb-1"},
        ),
        Document(
            page_content="Quốc Tử Giám từng là trường đại học đầu tiên của Việt Nam.",
            metadata={"source": "group_doc", "page": "kb-2"},
        ),
    ]
    chat_docs, has_verified = build_chat_item_context(
        item_id=3,
        item_name="Văn Miếu",
        item_description=(
            "Văn Miếu – Quốc Tử Giám Thăng Long tọa lạc tại 58 Quốc Tử Giám, "
            "Đống Đa, Hà Nội, là nơi thờ Khổng Tử và các bậc hiền triết Việt Nam."
        ),
        retriever=retriever,
        group_id=1,
        query="còn thông tin nào thú vị nữa",
        top_k=8,
    )

    assert has_verified is True
    assert chat_docs[0].metadata["source"] == "item"
    assert len(chat_docs) == 3
    assert "Quốc Tử Giám từng là trường đại học" in chat_docs[2].page_content

    verified_docs, _ = build_verified_item_context(
        item_id=3,
        item_name="Văn Miếu",
        item_description=(
            "Văn Miếu – Quốc Tử Giám Thăng Long tọa lạc tại 58 Quốc Tử Giám, "
            "Đống Đa, Hà Nội, là nơi thờ Khổng Tử và các bậc hiền triết Việt Nam."
        ),
        retriever=retriever,
        group_id=1,
        query="còn thông tin nào thú vị nữa",
        top_k=8,
    )
    assert len(verified_docs) == 2
    assert all(
        "Quốc Tử Giám từng là trường đại học" not in doc.page_content
        for doc in verified_docs
    )
