import pytest
from langchain_core.documents import Document

from app.modules.rag.service import (
    build_chat_context,
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


def test_chat_context_keeps_query_relevant_group_docs_without_item_mention():
    retriever = WorkingRetriever()
    retriever.retrieve = lambda query, top_k, group_id=None: [
        Document(
            page_content="Văn Miếu được xây dựng năm 1070.",
            metadata={"source": "group_doc", "page": "kb-history"},
        )
    ]

    docs, has_verified = build_chat_context(
        item_id=9,
        item_name="Cổng Đại Trung",
        item_description="Cổng Đại Trung là cổng thuộc khu Văn Miếu.",
        retriever=retriever,
        group_id=1,
        query="Văn Miếu xây năm nào?",
        top_k=6,
    )

    assert has_verified is True
    assert docs[-1].page_content == "Văn Miếu được xây dựng năm 1070."


def test_chat_context_prioritizes_docs_that_mention_item():
    retriever = WorkingRetriever()
    retriever.retrieve = lambda query, top_k, group_id=None: [
        Document(
            page_content="Văn Miếu được xây dựng năm 1070.",
            metadata={"source": "group_doc", "page": "kb-history"},
        ),
        Document(
            page_content="Cổng Đại Trung nằm trên trục chính của Văn Miếu.",
            metadata={"source": "group_doc", "page": "kb-gate"},
        ),
    ]

    docs, _ = build_chat_context(
        item_id=9,
        item_name="Cổng Đại Trung",
        item_description="Cổng Đại Trung",
        retriever=retriever,
        group_id=1,
        query="Văn Miếu xây năm nào?",
        top_k=6,
    )

    assert [doc.metadata["page"] for doc in docs] == ["kb-gate", "kb-history"]

