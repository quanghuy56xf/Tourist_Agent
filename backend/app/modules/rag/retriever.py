import logging
import pickle
import threading
from pathlib import Path
from typing import Dict, List, Tuple

from langchain_core.documents import Document
from rank_bm25 import BM25Okapi

from app.core.config import (
    RAG_BM25_PATH,
    RAG_CHROMA_PATH,
    RAG_CHUNKS_PATH,
    RAG_EMBEDDING_MODEL,
    RAG_SCHEMA_VERSION,
)
from app.modules.rag.types import ChunkDraft

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = RAG_EMBEDDING_MODEL


def ensure_rag_index() -> None:
    chunks_path = Path(RAG_CHUNKS_PATH)
    bm25_path = Path(RAG_BM25_PATH)
    chroma_path = Path(RAG_CHROMA_PATH)

    chunks_path.parent.mkdir(parents=True, exist_ok=True)
    chroma_path.mkdir(parents=True, exist_ok=True)

    if not chunks_path.exists():
        with chunks_path.open("wb") as file:
            pickle.dump([], file)

    if not bm25_path.exists():
        with bm25_path.open("wb") as file:
            pickle.dump(BM25Okapi([[""]]), file)


class HybridRetriever:
    def __init__(self, vector_store_path: str, bm25_path: str, chunks_path: str):
        with open(chunks_path, "rb") as file:
            self.chunks = pickle.load(file)

        with open(bm25_path, "rb") as file:
            self.bm25 = pickle.load(file)

        self._vector_store_path = vector_store_path
        self._embeddings = None
        self._vector_store = None
        self._dense_available: bool | None = None
        self._index_lock = threading.RLock()

    def _ensure_dense(self) -> bool:
        if self._dense_available is not None:
            return self._dense_available

        try:
            from langchain_community.embeddings import HuggingFaceEmbeddings
            from langchain_community.vectorstores import Chroma

            self._embeddings = HuggingFaceEmbeddings(
                model_name=EMBEDDING_MODEL,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
            )
            self._vector_store = Chroma(
                persist_directory=self._vector_store_path,
                embedding_function=self._embeddings,
            )
            self._dense_available = True
        except (MemoryError, OSError, RuntimeError, ImportError) as exc:
            logger.warning(
                "Dense RAG unavailable; continuing with BM25-only retrieval: %s",
                exc,
            )
            self._dense_available = False

        return self._dense_available

    def _dense_search(
        self,
        query: str,
        top_k: int = 5,
    ) -> Tuple[List[Document], float]:
        if not self._ensure_dense() or self._vector_store is None:
            return [], 0.0

        results_with_scores = (
            self._vector_store.similarity_search_with_relevance_scores(
                query,
                k=top_k,
            )
        )
        if not results_with_scores:
            return [], 0.0

        max_score = results_with_scores[0][1]
        docs = [result[0] for result in results_with_scores]
        return docs, max_score

    def _sparse_search(
        self,
        query: str,
        top_k: int = 5,
    ) -> List[Document]:
        tokenized_query = query.lower().split()
        scores = self.bm25.get_scores(tokenized_query)
        top_indices = sorted(
            range(len(scores)),
            key=lambda index: scores[index],
            reverse=True,
        )[:top_k]
        return [self.chunks[index] for index in top_indices]

    def _rrf(
        self,
        dense_docs: List[Document],
        sparse_docs: List[Document],
        k: int = 60,
    ) -> List[Document]:
        rrf_scores: Dict[str, float] = {}
        content_to_doc = {}

        for rank, doc in enumerate(dense_docs):
            content = doc.page_content
            content_to_doc[content] = doc
            rrf_scores[content] = (
                rrf_scores.get(content, 0.0) + 1.0 / (k + rank + 1)
            )

        for rank, doc in enumerate(sparse_docs):
            content = doc.page_content
            content_to_doc[content] = doc
            rrf_scores[content] = (
                rrf_scores.get(content, 0.0) + 1.0 / (k + rank + 1)
            )

        sorted_contents = sorted(
            rrf_scores,
            key=lambda content: rrf_scores[content],
            reverse=True,
        )
        return [content_to_doc[content] for content in sorted_contents]

    @staticmethod
    def _matches_group_scope(document: Document, group_id: int | None) -> bool:
        if group_id is None:
            return True
        source = document.metadata.get("source")
        if source != "group_doc":
            return False
        if document.metadata.get("visibility") == "draft":
            return False
        return document.metadata.get("group_id") == group_id

    def _filter_group_scope(
        self,
        documents: List[Document],
        group_id: int | None,
    ) -> List[Document]:
        if group_id is None:
            return documents
        return [
            document
            for document in documents
            if self._matches_group_scope(document, group_id)
        ]

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        fallback_threshold: float = 0.2,
        group_id: int | None = None,
    ) -> List[Document]:
        docs, _trace = self.retrieve_with_trace(
            query,
            top_k=top_k,
            fallback_threshold=fallback_threshold,
            group_id=group_id,
        )
        return docs

    def retrieve_with_trace(
        self,
        query: str,
        top_k: int = 5,
        fallback_threshold: float = 0.2,
        group_id: int | None = None,
    ):
        from app.modules.rag.tracing import RetrievalTrace, evidence_list

        with self._index_lock:
            search_k = top_k * 3 if group_id is not None else top_k
            dense_docs, max_dense_score = self._dense_search(
                query,
                top_k=search_k,
            )
            sparse_docs = self._sparse_search(query, top_k=search_k)

            dense_docs = self._filter_group_scope(dense_docs, group_id)
            sparse_docs = self._filter_group_scope(sparse_docs, group_id)

            trace = RetrievalTrace(
                retrieval_query=query,
                top_k=top_k,
                dense_max_score=max_dense_score,
                retrieved_chunks=evidence_list(dense_docs + sparse_docs),
            )

            if not dense_docs or max_dense_score < fallback_threshold:
                trace.fallback_used = True
                trace.fallback_reason = "dense_unavailable_or_below_threshold"
                docs = sparse_docs[:top_k]
                trace.reranked_chunks = evidence_list(docs)
                return docs, trace

            docs = self._rrf(dense_docs, sparse_docs)[:top_k]
            trace.reranked_chunks = evidence_list(docs)
            return docs, trace

    def _persist_sparse_index(self) -> None:
        with open(RAG_CHUNKS_PATH, "wb") as file:
            pickle.dump(self.chunks, file)

        tokenized_corpus = [
            chunk.page_content.lower().split()
            for chunk in self.chunks
        ]
        self.bm25 = (
            BM25Okapi(tokenized_corpus)
            if tokenized_corpus
            else BM25Okapi([[""]])
        )
        with open(RAG_BM25_PATH, "wb") as file:
            pickle.dump(self.bm25, file)

    def _group_doc_chunk_ids(self, document_id: int) -> list[str]:
        prefix = f"group-doc-{document_id}-chunk-"
        return [
            chunk.metadata.get("page")
            for chunk in self.chunks
            if str(chunk.metadata.get("page", "")).startswith(prefix)
        ]

    def _remove_group_document_chunks(self, document_id: int) -> None:
        ids = self._group_doc_chunk_ids(document_id)
        if ids and self._ensure_dense() and self._vector_store is not None:
            self._vector_store.delete(ids=ids)
        self.chunks = [
            chunk
            for chunk in self.chunks
            if chunk.metadata.get("document_id") != document_id
        ]

    def upsert_group_document(
        self,
        document_id: int,
        group_id: int,
        document_title: str,
        chunk_drafts: List[ChunkDraft],
        *,
        document_version: int = 1,
        source_type: str | None = None,
        content_hash: str | None = None,
        normalized_hash: str | None = None,
        quality_score: float | None = None,
        visibility: str | None = None,
        trust_level: str | None = None,
    ) -> None:
        with self._index_lock:
            self._remove_group_document_chunks(document_id)

            documents: list[Document] = []
            ids: list[str] = []
            for index, draft in enumerate(chunk_drafts):
                chunk_id = f"group-doc-{document_id}-chunk-{index}"
                metadata = {
                    "source": "group_doc",
                    "group_id": group_id,
                    "document_id": document_id,
                    "document_title": document_title,
                    "document_version": document_version,
                    "source_type": source_type or "unknown",
                    "section_title": draft.section_title or "",
                    "heading_level": draft.heading_level or 0,
                    "chunk_index": index,
                    "chunk_strategy": draft.chunk_strategy,
                    "content_hash": content_hash or "",
                    "normalized_hash": normalized_hash or "",
                    "quality_score": quality_score if quality_score is not None else 1.0,
                    "visibility": visibility or "internal",
                    "trust_level": trust_level or "uploaded",
                    "schema_version": RAG_SCHEMA_VERSION,
                    "embedding_model": EMBEDDING_MODEL,
                    "page": chunk_id,
                }
                documents.append(Document(page_content=draft.text, metadata=metadata))
                ids.append(chunk_id)

            if documents:
                if self._ensure_dense() and self._vector_store is not None:
                    self._vector_store.add_documents(documents, ids=ids)
                else:
                    logger.warning(
                        "Skipping Chroma upsert for group document %s; BM25 index updated only",
                        document_id,
                    )
                self.chunks.extend(documents)
            self._persist_sparse_index()

    def delete_group_document(self, document_id: int) -> None:
        with self._index_lock:
            self._remove_group_document_chunks(document_id)
            self._persist_sparse_index()

    def delete_group_documents(self, group_id: int) -> None:
        with self._index_lock:
            document_ids = {
                chunk.metadata.get("document_id")
                for chunk in self.chunks
                if chunk.metadata.get("source") == "group_doc"
                and chunk.metadata.get("group_id") == group_id
            }
            for document_id in document_ids:
                if document_id is not None:
                    self._remove_group_document_chunks(int(document_id))
            self._persist_sparse_index()

    def _replace_item_chunk(self, document: Document) -> None:
        item_id = document.metadata["item_id"]
        self.chunks = [
            chunk
            for chunk in self.chunks
            if chunk.metadata.get("item_id") != item_id
        ]
        self.chunks.append(document)
        self._persist_sparse_index()

    def upsert_item_document(self, item_id: int, content: str) -> None:
        with self._index_lock:
            document_id = f"item-{item_id}"
            document = Document(
                page_content=content,
                metadata={
                    "source": "item",
                    "source_type": "item_registration",
                    "trust_level": "official",
                    "page": document_id,
                    "item_id": item_id,
                    "schema_version": RAG_SCHEMA_VERSION,
                    "embedding_model": EMBEDDING_MODEL,
                },
            )
            if self._ensure_dense() and self._vector_store is not None:
                self._vector_store.delete(ids=[document_id])
                self._vector_store.add_documents([document], ids=[document_id])
            self._replace_item_chunk(document)

    def delete_item_document(self, item_id: int) -> None:
        with self._index_lock:
            document_id = f"item-{item_id}"
            if self._ensure_dense() and self._vector_store is not None:
                self._vector_store.delete(ids=[document_id])
            self.chunks = [
                chunk
                for chunk in self.chunks
                if chunk.metadata.get("item_id") != item_id
            ]
            self._persist_sparse_index()


_retriever_instance = None


def get_rag_retriever() -> HybridRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        ensure_rag_index()
        _retriever_instance = HybridRetriever(
            vector_store_path=RAG_CHROMA_PATH,
            bm25_path=RAG_BM25_PATH,
            chunks_path=RAG_CHUNKS_PATH,
        )
    return _retriever_instance


def try_get_rag_retriever() -> HybridRetriever | None:
    try:
        return get_rag_retriever()
    except (MemoryError, OSError, RuntimeError, FileNotFoundError):
        return None


def reset_rag_retriever_for_tests() -> None:
    global _retriever_instance
    _retriever_instance = None
