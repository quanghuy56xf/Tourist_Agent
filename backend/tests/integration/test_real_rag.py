import os
from pathlib import Path

import pytest
from langchain_core.documents import Document

from app.core.config import (
    RAG_BM25_PATH,
    RAG_CHROMA_PATH,
    RAG_CHUNKS_PATH,
)
from app.modules.rag.retriever import get_rag_retriever

pytestmark = pytest.mark.integration


@pytest.mark.skipif(
    os.getenv("RUN_REAL_RAG_TESTS") != "true",
    reason="Real RAG test is opt-in",
)
def test_real_rag_index_returns_documents():
    assert Path(RAG_BM25_PATH).is_file()
    assert Path(RAG_CHUNKS_PATH).is_file()
    assert Path(RAG_CHROMA_PATH).is_dir()

    documents = get_rag_retriever().retrieve(
        "Giới thiệu Văn Miếu Quốc Tử Giám",
        top_k=3,
    )

    assert documents
    assert all(isinstance(document, Document) for document in documents)
