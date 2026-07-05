import logging
from typing import Protocol

from langchain_core.documents import Document

from app.core.config import RAG_ENABLE_RERANKER, RAG_MAX_CONTEXT_CHARS, RAG_RERANK_CANDIDATE_MULTIPLIER
from app.modules.content.language_support import (
    no_item_knowledge_message as supported_no_item_knowledge_message,
)
from app.modules.rag.reranker import rerank_documents
from app.modules.rag.tracing import RagTraceContext, compute_confidence, evidence_list

logger = logging.getLogger(__name__)

NO_ITEM_KNOWLEDGE_VI = (
    "Hiện chưa có đủ thông tin xác thực về hiện vật này trong tài liệu. "
    "Vui lòng bổ sung mô tả hoặc tài liệu khu di tích có nhắc đến hiện vật."
)
NO_ITEM_KNOWLEDGE_EN = (
    "There is not enough verified information about this artifact in the documents. "
    "Please add a description or heritage-site documents that mention this artifact."
)

ITEM_REGISTRATION_SOURCE = "item"
ITEM_REGISTRATION_SECTION = "Thông tin đăng ký hiện vật"


class Retriever(Protocol):
    def retrieve(
        self,
        query: str,
        top_k: int,
        group_id: int | None = ...,
    ) -> list[Document]: ...


def normalize_text(value: str) -> str:
    return " ".join((value or "").split()).strip().lower()


GENERIC_ITEM_TERMS = {
    "các",
    "cổng",
    "giám",
    "hiện",
    "khu",
    "miếu",
    "môn",
    "quốc",
    "tử",
    "văn",
    "vật",
}


def _primary_item_terms(item_name: str) -> set[str]:
    words = normalize_text(item_name).split()
    terms: set[str] = set()

    for word in words:
        if len(word) >= 3 and word not in GENERIC_ITEM_TERMS:
            terms.add(word)

    for left, right in zip(words, words[1:]):
        if len(left) < 2 or len(right) < 2:
            continue
        if left in GENERIC_ITEM_TERMS and right in GENERIC_ITEM_TERMS:
            continue
        terms.add(f"{left} {right}")

    return terms


def is_substantive_item_description(description: str, item_name: str) -> bool:
    desc = " ".join((description or "").split()).strip()
    name = " ".join((item_name or "").split()).strip()
    if not desc:
        return False
    if normalize_text(desc) == normalize_text(name):
        return False

    remainder = normalize_text(desc)
    for word in normalize_text(name).split():
        remainder = remainder.replace(word, " ", 1).strip()
    remainder = " ".join(remainder.split())

    if len(remainder) < 15:
        return False
    return True


def text_mentions_item(item_name: str, item_description: str, text: str) -> bool:
    lowered = normalize_text(text)
    name = normalize_text(item_name)
    if name and name in lowered:
        return True
    description = normalize_text(item_description)
    if description and len(description) >= 8 and description in lowered:
        return True
    return any(term in lowered for term in _primary_item_terms(item_name))


def _group_documents(documents: list[Document]) -> list[Document]:
    return [
        document
        for document in documents
        if document.metadata.get("source") == "group_doc"
    ]


def no_item_knowledge_message(language: str) -> str:
    return supported_no_item_knowledge_message(language)


def is_item_registration_document(document: Document) -> bool:
    return document.metadata.get("source") == ITEM_REGISTRATION_SOURCE


def build_item_registration_document(item_id: int, item_description: str) -> Document:
    return Document(
        page_content=item_description,
        metadata={
            "source": ITEM_REGISTRATION_SOURCE,
            "page": f"item-{item_id}",
            "section_title": ITEM_REGISTRATION_SECTION,
        },
    )


def build_item_retrieval_query(item_name: str, item_description: str) -> str:
    name = " ".join((item_name or "").split()).strip()
    description = " ".join((item_description or "").split()).strip()
    if description:
        return f"Giới thiệu chi tiết về {name}. {description}"
    return f"Giới thiệu chi tiết về {name}."


_VAGUE_FOLLOW_UP_PATTERNS = (
    "cho biết thêm",
    "thêm thông tin",
    "kể thêm",
    "nói thêm",
    "còn gì",
    "còn thông tin",
    "thú vị",
    "chi tiết hơn",
    "tell me more",
    "more info",
    "more information",
)


def is_vague_follow_up(user_message: str, item_name: str) -> bool:
    normalized = normalize_text(user_message)
    if not normalized:
        return True

    name = normalize_text(item_name)
    if name and name in normalized:
        return False
    if any(term in normalized for term in _primary_item_terms(item_name)):
        return False

    if any(pattern in normalized for pattern in _VAGUE_FOLLOW_UP_PATTERNS):
        return True

    return len(normalized.split()) <= 6


def build_chat_retrieval_query(
    item_name: str,
    item_description: str,
    user_message: str,
) -> str:
    base = build_item_retrieval_query(item_name, item_description)
    message = " ".join((user_message or "").split()).strip()
    if not message:
        return base
    if is_vague_follow_up(message, item_name):
        return base
    return f"{base} Câu hỏi của khách: {message}"


def _order_chat_documents(
    *,
    item_name: str,
    item_description: str,
    documents: list[Document],
    vague_follow_up: bool,
) -> list[Document]:
    registration = [doc for doc in documents if is_item_registration_document(doc)]
    item_group_docs = filter_group_docs_for_item(
        item_name,
        item_description,
        documents,
    )
    if vague_follow_up:
        return registration + item_group_docs

    item_group_set = set(id(doc) for doc in item_group_docs)
    registration_set = set(id(doc) for doc in registration)
    other_group_docs = [
        doc
        for doc in documents
        if id(doc) not in registration_set and id(doc) not in item_group_set
    ]
    return registration + item_group_docs + other_group_docs


def build_item_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 5,
    group_id: int | None = None,
    query: str | None = None,
) -> list[Document]:
    docs = [build_item_registration_document(item_id, item_description)]
    if retriever is None or group_id is None:
        return docs

    try:
        retrieved = retriever.retrieve(
            query or build_item_retrieval_query(item_name, item_description),
            top_k=top_k,
            group_id=group_id,
        )
    except (MemoryError, OSError, RuntimeError, FileNotFoundError) as exc:
        logger.warning("RAG unavailable; using item description: %s", exc)
        return docs

    seen = {item_description.strip()}
    for document in retrieved:
        content = document.page_content.strip()
        if content and content not in seen:
            docs.append(document)
            seen.add(content)
    return docs


def filter_group_docs_for_item(
    item_name: str,
    item_description: str,
    documents: list[Document],
) -> list[Document]:
    return [
        document
        for document in documents
        if document.metadata.get("source") == "group_doc"
        and text_mentions_item(item_name, item_description, document.page_content)
    ]


def build_verified_item_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 5,
    group_id: int | None = None,
    query: str | None = None,
) -> tuple[list[Document], bool]:
    all_docs = build_item_context(
        item_id=item_id,
        item_name=item_name,
        item_description=item_description,
        retriever=retriever,
        top_k=top_k,
        group_id=group_id,
        query=query,
    )
    relevant_group_docs = filter_group_docs_for_item(
        item_name,
        item_description,
        all_docs,
    )
    has_substantive_description = is_substantive_item_description(
        item_description,
        item_name,
    )
    has_verified_knowledge = has_substantive_description or bool(relevant_group_docs)

    verified_docs: list[Document] = []
    if has_substantive_description and all_docs:
        verified_docs.append(all_docs[0])
        verified_docs.extend(relevant_group_docs)
    else:
        verified_docs.extend(relevant_group_docs)
    return verified_docs, has_verified_knowledge


def build_chat_item_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 8,
    group_id: int | None = None,
    query: str | None = None,
) -> tuple[list[Document], bool]:
    """Wider retrieval for chat: pass query-aligned group docs to the LLM.

    ``has_verified`` still requires a substantive item description or at least
    one group document that mentions the item. Once verified, the LLM receives
    all retrieved group chunks (including lower-ranked matches), not only those
    that explicitly name the artifact.
    """
    user_message = query or ""
    retrieval_query = build_chat_retrieval_query(
        item_name,
        item_description,
        user_message,
    )
    all_docs = build_item_context(
        item_id=item_id,
        item_name=item_name,
        item_description=item_description,
        retriever=retriever,
        top_k=top_k,
        group_id=group_id,
        query=retrieval_query,
    )
    relevant_group_docs = filter_group_docs_for_item(
        item_name,
        item_description,
        all_docs,
    )
    has_substantive_description = is_substantive_item_description(
        item_description,
        item_name,
    )
    has_verified_knowledge = has_substantive_description or bool(relevant_group_docs)

    chat_docs = _order_chat_documents(
        item_name=item_name,
        item_description=item_description,
        documents=all_docs,
        vague_follow_up=is_vague_follow_up(user_message, item_name),
    )
    return chat_docs, has_verified_knowledge


def _preserve_sparse_winners(documents: list[Document], *, top_n: int = 1) -> list[Document]:
    sparse_winners = [
        document
        for document in documents
        if isinstance(document.metadata.get("sparse_rank"), int)
        and document.metadata["sparse_rank"] <= top_n
    ]
    if not sparse_winners:
        return documents

    winner_keys = {
        str(document.metadata.get("page") or document.page_content)
        for document in sparse_winners
    }
    others = [
        document
        for document in documents
        if str(document.metadata.get("page") or document.page_content) not in winner_keys
    ]
    sparse_winners.sort(key=lambda document: document.metadata["sparse_rank"])
    return sparse_winners + others


def _trim_context_documents(documents: list[Document]) -> list[Document]:
    if RAG_MAX_CONTEXT_CHARS <= 0:
        return documents
    kept: list[Document] = []
    total = 0
    for document in documents:
        length = len(document.page_content or "")
        if kept and total + length > RAG_MAX_CONTEXT_CHARS:
            break
        kept.append(document)
        total += length
    return kept


def build_chat_item_context_with_trace(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 8,
    group_id: int | None = None,
    query: str | None = None,
) -> tuple[list[Document], bool, RagTraceContext]:
    user_message = query or ""
    retrieval_query = build_chat_retrieval_query(
        item_name,
        item_description,
        user_message,
    )
    trace = RagTraceContext(retrieval_query=retrieval_query, top_k=top_k)
    docs = [build_item_registration_document(item_id, item_description)]

    if retriever is not None and group_id is not None:
        try:
            candidate_top_k = top_k * max(1, RAG_RERANK_CANDIDATE_MULTIPLIER)
            if hasattr(retriever, "retrieve_with_trace"):
                retrieved, retrieval_trace = retriever.retrieve_with_trace(
                    retrieval_query,
                    top_k=candidate_top_k,
                    group_id=group_id,
                )
                trace.fallback_used = retrieval_trace.fallback_used
                trace.fallback_reason = retrieval_trace.fallback_reason
                trace.dense_max_score = retrieval_trace.dense_max_score
                trace.retrieved_chunks = retrieval_trace.retrieved_chunks
                trace.reranked_chunks = retrieval_trace.reranked_chunks
            else:
                retrieved = retriever.retrieve(
                    retrieval_query,
                    top_k=candidate_top_k,
                    group_id=group_id,
                )
                trace.retrieved_chunks = evidence_list(retrieved)
        except (MemoryError, OSError, RuntimeError, FileNotFoundError) as exc:
            logger.warning("RAG unavailable; using item description: %s", exc)
            trace.fallback_used = True
            trace.fallback_reason = type(exc).__name__
            retrieved = []

        if RAG_ENABLE_RERANKER and retrieved:
            retrieved = rerank_documents(
                query=retrieval_query,
                item_name=item_name,
                item_description=item_description,
                documents=retrieved,
            )
            retrieved = _preserve_sparse_winners(retrieved)
            trace.reranked_chunks = evidence_list(retrieved)

        seen = {item_description.strip()}
        for document in retrieved:
            content = document.page_content.strip()
            if content and content not in seen:
                docs.append(document)
                seen.add(content)

    relevant_group_docs = filter_group_docs_for_item(
        item_name,
        item_description,
        docs,
    )
    has_substantive_description = is_substantive_item_description(
        item_description,
        item_name,
    )
    has_verified_knowledge = has_substantive_description or bool(relevant_group_docs)
    vague_follow_up = is_vague_follow_up(user_message, item_name)
    chat_docs = _order_chat_documents(
        item_name=item_name,
        item_description=item_description,
        documents=docs,
        vague_follow_up=vague_follow_up,
    )[:top_k]
    chat_docs = _trim_context_documents(chat_docs)
    trace.context_chunks = evidence_list(chat_docs)
    trace.confidence_score, trace.confidence_reasons = compute_confidence(
        has_substantive_description=has_substantive_description,
        relevant_group_docs=relevant_group_docs,
        fallback_used=trace.fallback_used,
        dense_max_score=trace.dense_max_score,
        vague_follow_up=vague_follow_up,
    )
    return chat_docs, has_verified_knowledge, trace


def build_group_chat_context_with_trace(
    *,
    query: str,
    group_id: int,
    retriever: Retriever | None,
    top_k: int = 8,
) -> tuple[list[Document], bool, RagTraceContext]:
    retrieval_query = query or ""
    trace = RagTraceContext(retrieval_query=retrieval_query, top_k=top_k)
    retrieved: list[Document] = []

    if retriever is not None:
        try:
            candidate_top_k = top_k * max(1, RAG_RERANK_CANDIDATE_MULTIPLIER)
            if hasattr(retriever, "retrieve_with_trace"):
                retrieved, retrieval_trace = retriever.retrieve_with_trace(
                    retrieval_query,
                    top_k=candidate_top_k,
                    group_id=group_id,
                )
                trace.fallback_used = retrieval_trace.fallback_used
                trace.fallback_reason = retrieval_trace.fallback_reason
                trace.dense_max_score = retrieval_trace.dense_max_score
                trace.retrieved_chunks = retrieval_trace.retrieved_chunks
                trace.reranked_chunks = retrieval_trace.reranked_chunks
            else:
                retrieved = retriever.retrieve(
                    retrieval_query,
                    top_k=candidate_top_k,
                    group_id=group_id,
                )
                trace.retrieved_chunks = evidence_list(retrieved)
        except (MemoryError, OSError, RuntimeError, FileNotFoundError) as exc:
            logger.warning("Group RAG unavailable; using empty context: %s", exc)
            trace.fallback_used = True
            trace.fallback_reason = type(exc).__name__
            retrieved = []

        if RAG_ENABLE_RERANKER and retrieved:
            retrieved = rerank_documents(
                query=retrieval_query,
                item_name="",
                item_description="",
                documents=retrieved,
            )
            retrieved = _preserve_sparse_winners(retrieved)
            trace.reranked_chunks = evidence_list(retrieved)

    docs: list[Document] = []
    seen: set[str] = set()
    for document in retrieved:
        content = document.page_content.strip()
        if content and content not in seen:
            docs.append(document)
            seen.add(content)
        if len(docs) >= top_k:
            break

    docs = _trim_context_documents(docs)
    has_verified_knowledge = bool(docs)
    trace.context_chunks = evidence_list(docs)
    trace.confidence_score, trace.confidence_reasons = compute_confidence(
        has_substantive_description=False,
        relevant_group_docs=docs,
        fallback_used=trace.fallback_used,
        dense_max_score=trace.dense_max_score,
        vague_follow_up=False,
    )
    return docs, has_verified_knowledge, trace
