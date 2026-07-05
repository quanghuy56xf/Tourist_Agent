import pytest
from langchain_core.documents import Document

from app.modules.rag.service import (
    ITEM_REGISTRATION_SECTION,
    ITEM_REGISTRATION_SOURCE,
    build_chat_item_context,
    build_chat_retrieval_query,
    build_item_context,
    build_item_retrieval_query,
    build_verified_item_context,
    filter_group_docs_for_item,
    is_substantive_item_description,
    is_vague_follow_up,
    _preserve_sparse_winners,
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


def test_preserve_sparse_winners_moves_bm25_winner_first():
    documents = [
        Document(page_content="Dense winner", metadata={"page": "dense", "rerank_score": 0.9}),
        Document(
            page_content="BM25 winner",
            metadata={"page": "sparse", "sparse_rank": 1, "rerank_score": 0.2},
        ),
    ]

    preserved = _preserve_sparse_winners(documents)

    assert [document.metadata["page"] for document in preserved] == ["sparse", "dense"]


def test_retrieval_query_includes_registered_description():
    retriever = GroupScopedRetriever()
    build_item_context(
        item_id=7,
        item_name="Trống Văn Miếu",
        item_description="Trống dùng trong nghi lễ khai giảng và báo giờ học.",
        retriever=retriever,
        group_id=1,
    )

    assert retriever.query == (
        "Giới thiệu chi tiết về Trống Văn Miếu. "
        "Trống dùng trong nghi lễ khai giảng và báo giờ học."
    )


def test_retrieval_query_uses_name_only_when_description_empty():
    retriever = GroupScopedRetriever()
    build_item_context(
        item_id=7,
        item_name="Trống Văn Miếu",
        item_description="",
        retriever=retriever,
        group_id=1,
    )

    assert retriever.query == "Giới thiệu chi tiết về Trống Văn Miếu."


def test_build_item_retrieval_query_normalizes_whitespace():
    assert build_item_retrieval_query(
        "  Trống  ",
        "  Nghi lễ   khai giảng  ",
    ) == "Giới thiệu chi tiết về Trống. Nghi lễ khai giảng"


def test_is_vague_follow_up_detects_generic_requests():
    assert is_vague_follow_up("cho biết thêm thông tin đi", "Bia Tiến sĩ") is True
    assert is_vague_follow_up("còn thông tin nào thú vị nữa", "Văn Miếu") is True


def test_is_vague_follow_up_allows_specific_questions():
    assert (
        is_vague_follow_up(
            "Hoa văn trên bia tiến sĩ có ý nghĩa gì?",
            "Bia Tiến sĩ",
        )
        is False
    )


def test_build_chat_retrieval_query_anchors_vague_follow_up_to_item():
    assert build_chat_retrieval_query(
        "Bia Tiến sĩ",
        "82 tấm bia đá tại vườn bia thứ ba.",
        "cho biết thêm thông tin đi",
    ) == (
        "Giới thiệu chi tiết về Bia Tiến sĩ. "
        "82 tấm bia đá tại vườn bia thứ ba."
    )


def test_build_chat_retrieval_query_includes_specific_user_question():
    query = build_chat_retrieval_query(
        "Bia Tiến sĩ",
        "82 tấm bia đá tại vườn bia thứ ba.",
        "Ai là người khắc chữ trên bia?",
    )
    assert query.startswith("Giới thiệu chi tiết về Bia Tiến sĩ.")
    assert "Câu hỏi của khách: Ai là người khắc chữ trên bia?" in query


def test_item_description_is_always_grounding_context():
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=BrokenRetriever(),
    )

    assert docs[0].page_content == "Primary description"
    assert docs[0].metadata == {
        "source": ITEM_REGISTRATION_SOURCE,
        "page": "item-7",
        "section_title": ITEM_REGISTRATION_SECTION,
    }


def test_registration_document_is_reference_chunk():
    from app.modules.rag.service import build_item_registration_document

    doc = build_item_registration_document(
        9,
        "Cổng chính dẫn vào khu Văn Miếu, xây dưới triều Lý.",
    )
    assert doc.metadata["section_title"] == ITEM_REGISTRATION_SECTION
    assert doc.metadata["source"] == ITEM_REGISTRATION_SOURCE


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


def test_verified_context_keeps_group_docs_that_match_primary_keywords():
    retriever = WorkingRetriever()
    retriever.retrieve = lambda query, top_k, group_id=None: [
        Document(
            page_content="Tiếng trống báo hiệu giờ học và các nghi thức quan trọng.",
            metadata={"source": "group_doc", "page": "kb-drum"},
        )
    ]

    docs, has_verified = build_verified_item_context(
        item_id=13,
        item_name="Trống Văn Miếu",
        item_description="Trống Văn Miếu",
        retriever=retriever,
        group_id=2,
    )

    assert has_verified is True
    assert len(docs) == 1
    assert docs[0].metadata["page"] == "kb-drum"


def test_verified_context_includes_retrieved_group_docs_for_substantive_description():
    retriever = WorkingRetriever()
    retriever.retrieve = lambda query, top_k, group_id=None: [
        Document(
            page_content="Đại Trung là cách gọi đề cao đạo Trung dung.",
            metadata={"source": "group_doc", "page": "kb-dai-trung"},
        )
    ]

    docs, has_verified = build_verified_item_context(
        item_id=8,
        item_name="Đại Trung Môn",
        item_description=(
            "Cổng nằm sau khu vực nhập môn, dẫn vào không gian trung tâm "
            "của Văn Miếu. Tên gọi Đại Trung thể hiện tư tưởng trung dung."
        ),
        retriever=retriever,
        group_id=2,
    )

    assert has_verified is True
    assert [doc.metadata["source"] for doc in docs] == [ITEM_REGISTRATION_SOURCE, "group_doc"]


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
    assert chat_docs[0].metadata["source"] == ITEM_REGISTRATION_SOURCE
    assert len(chat_docs) == 2
    assert "Văn Miếu được xây dựng năm 1070" in chat_docs[1].page_content

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
    assert verified_docs[1].metadata["page"] == "kb-1"


def test_verified_context_excludes_unrelated_group_docs_with_substantive_description():
    retriever = WorkingRetriever()
    retriever.retrieve = lambda query, top_k, group_id=None: [
        Document(
            page_content="Đại Thành Môn dẫn vào khu thờ Khổng Tử.",
            metadata={"source": "group_doc", "page": "kb-dai-thanh"},
        ),
        Document(
            page_content="Khuê Văn Các là biểu tượng của Hà Nội.",
            metadata={"source": "group_doc", "page": "kb-khue-van"},
        ),
    ]

    docs, has_verified = build_verified_item_context(
        item_id=13,
        item_name="Đại Thành Môn",
        item_description="Đại Thành Môn là cổng dẫn vào khu vực thờ Khổng Tử và các bậc hiền triết.",
        retriever=retriever,
        group_id=2,
    )

    assert has_verified is True
    assert [doc.metadata["page"] for doc in docs] == ["item-13", "kb-dai-thanh"]