from langchain_core.documents import Document

from app.modules.rag.retriever import HybridRetriever


def test_group_scope_accepts_matching_group_docs():
    doc = Document(
        page_content="Fact",
        metadata={"source": "group_doc", "group_id": 2},
    )
    assert HybridRetriever._matches_group_scope(doc, group_id=2) is True


def test_group_scope_rejects_other_group_docs():
    doc = Document(
        page_content="Fact",
        metadata={"source": "group_doc", "group_id": 3},
    )
    assert HybridRetriever._matches_group_scope(doc, group_id=2) is False


def test_group_scope_rejects_item_chunks_when_group_set():
    doc = Document(
        page_content="Item description",
        metadata={"source": "item", "item_id": 5},
    )
    assert HybridRetriever._matches_group_scope(doc, group_id=2) is False


def test_group_scope_allows_all_sources_when_unscoped():
    group_doc = Document(
        page_content="Fact",
        metadata={"source": "group_doc", "group_id": 2},
    )
    item_doc = Document(
        page_content="Item description",
        metadata={"source": "item", "item_id": 5},
    )
    assert HybridRetriever._matches_group_scope(group_doc, group_id=None) is True
    assert HybridRetriever._matches_group_scope(item_doc, group_id=None) is True
