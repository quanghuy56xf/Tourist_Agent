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


def test_retrieve_falls_back_to_bm25_when_dense_unavailable():
    retriever = HybridRetriever.__new__(HybridRetriever)
    retriever._dense_available = False
    retriever._embeddings = None
    retriever._vector_store = None
    retriever._index_lock = __import__("threading").RLock()
    retriever.chunks = [
        Document(
            page_content="Văn Miếu Quốc Tử Giám tại Hà Nội",
            metadata={"source": "group_doc", "group_id": 1},
        ),
        Document(
            page_content="Unrelated museum fact",
            metadata={"source": "group_doc", "group_id": 2},
        ),
    ]
    retriever.bm25 = __import__("rank_bm25").BM25Okapi(
        [chunk.page_content.lower().split() for chunk in retriever.chunks]
    )

    results = retriever.retrieve("văn miếu", top_k=1, group_id=1)

    assert len(results) == 1
    assert "Văn Miếu" in results[0].page_content
