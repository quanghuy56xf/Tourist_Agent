import pickle
from typing import Dict, List, Tuple

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from rank_bm25 import BM25Okapi

from app.core.config import RAG_BM25_PATH, RAG_CHROMA_PATH, RAG_CHUNKS_PATH


class HybridRetriever:
    def __init__(self, vector_store_path: str, bm25_path: str, chunks_path: str):
        with open(chunks_path, "rb") as file:
            self.chunks = pickle.load(file)

        with open(bm25_path, "rb") as file:
            self.bm25 = pickle.load(file)

        self.embeddings = HuggingFaceEmbeddings(
            model_name="bkai-foundation-models/vietnamese-bi-encoder",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        self.vector_store = Chroma(
            persist_directory=vector_store_path,
            embedding_function=self.embeddings,
        )

    def _dense_search(
        self,
        query: str,
        top_k: int = 5,
    ) -> Tuple[List[Document], float]:
        results_with_scores = (
            self.vector_store.similarity_search_with_relevance_scores(
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

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        fallback_threshold: float = 0.2,
    ) -> List[Document]:
        dense_docs, max_dense_score = self._dense_search(
            query,
            top_k=top_k,
        )
        sparse_docs = self._sparse_search(query, top_k=top_k)

        if max_dense_score < fallback_threshold:
            return sparse_docs

        return self._rrf(dense_docs, sparse_docs)[:top_k]

    def _persist_sparse_index(self) -> None:
        with open(RAG_CHUNKS_PATH, "wb") as file:
            pickle.dump(self.chunks, file)

        tokenized_corpus = [
            chunk.page_content.lower().split()
            for chunk in self.chunks
        ]
        self.bm25 = BM25Okapi(tokenized_corpus)
        with open(RAG_BM25_PATH, "wb") as file:
            pickle.dump(self.bm25, file)

    def _replace_chunk(self, document: Document) -> None:
        item_id = document.metadata["item_id"]
        self.chunks = [
            chunk
            for chunk in self.chunks
            if chunk.metadata.get("item_id") != item_id
        ]
        self.chunks.append(document)
        self._persist_sparse_index()

    def upsert_item_document(self, item_id: int, content: str) -> None:
        document_id = f"item-{item_id}"
        document = Document(
            page_content=content,
            metadata={
                "source": "item",
                "page": document_id,
                "item_id": item_id,
            },
        )
        self.vector_store.delete(ids=[document_id])
        self.vector_store.add_documents([document], ids=[document_id])
        self._replace_chunk(document)

    def delete_item_document(self, item_id: int) -> None:
        document_id = f"item-{item_id}"
        self.vector_store.delete(ids=[document_id])
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
