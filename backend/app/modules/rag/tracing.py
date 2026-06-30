import json
from dataclasses import dataclass, field
from typing import Any

from langchain_core.documents import Document
from sqlalchemy.orm import Session

from app.models.rag_trace import RagTrace

SNIPPET_CHARS = 240


@dataclass
class RetrievalTrace:
    retrieval_query: str
    top_k: int
    fallback_used: bool = False
    fallback_reason: str | None = None
    dense_max_score: float = 0.0
    retrieved_chunks: list[dict[str, Any]] = field(default_factory=list)
    reranked_chunks: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class RagTraceContext:
    retrieval_query: str
    top_k: int
    fallback_used: bool = False
    fallback_reason: str | None = None
    dense_max_score: float = 0.0
    retrieved_chunks: list[dict[str, Any]] = field(default_factory=list)
    reranked_chunks: list[dict[str, Any]] = field(default_factory=list)
    context_chunks: list[dict[str, Any]] = field(default_factory=list)
    confidence_score: float = 0.0
    confidence_reasons: list[str] = field(default_factory=list)
    latency: dict[str, int] = field(default_factory=dict)


def chunk_id(document: Document) -> str:
    return str(document.metadata.get("page") or document.metadata.get("chunk_id") or "")


def evidence_for_document(document: Document, *, rank: int | None = None, score: float | None = None) -> dict[str, Any]:
    metadata = document.metadata or {}
    snippet = " ".join((document.page_content or "").split())[:SNIPPET_CHARS]
    evidence: dict[str, Any] = {
        "chunk_id": chunk_id(document),
        "source": metadata.get("source"),
        "document_id": metadata.get("document_id"),
        "document_title": metadata.get("document_title"),
        "item_id": metadata.get("item_id"),
        "section_title": metadata.get("section_title"),
        "chunk_index": metadata.get("chunk_index"),
        "snippet": snippet,
    }
    if rank is not None:
        evidence["rank"] = rank
    if score is not None:
        evidence["score"] = round(float(score), 6)
    if metadata.get("rerank_score") is not None:
        evidence["rerank_score"] = metadata.get("rerank_score")
    if metadata.get("rerank_reasons") is not None:
        evidence["rerank_reasons"] = metadata.get("rerank_reasons")
    return evidence


def evidence_list(documents: list[Document]) -> list[dict[str, Any]]:
    return [evidence_for_document(document, rank=index + 1) for index, document in enumerate(documents)]


def compute_confidence(
    *,
    has_substantive_description: bool,
    relevant_group_docs: list[Document],
    fallback_used: bool,
    dense_max_score: float,
    vague_follow_up: bool,
) -> tuple[float, list[str]]:
    score = 0.1
    reasons: list[str] = []
    if has_substantive_description:
        score += 0.35
        reasons.append("substantive_item_description")
    if relevant_group_docs:
        score += min(0.3, 0.16 + 0.04 * len(relevant_group_docs))
        reasons.append("matched_group_doc")
    if dense_max_score >= 0.45:
        score += 0.15
        reasons.append("strong_dense_score")
    elif dense_max_score >= 0.2:
        score += 0.08
        reasons.append("usable_dense_score")
    if fallback_used:
        score -= 0.12
        reasons.append("retrieval_fallback")
    else:
        score += 0.05
        reasons.append("no_dense_fallback")
    if vague_follow_up:
        score -= 0.03
        reasons.append("vague_follow_up")
    if not has_substantive_description and not relevant_group_docs:
        score = min(score, 0.15)
        reasons.append("no_verified_knowledge")
    return round(max(0.0, min(1.0, score)), 3), reasons


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def record_rag_trace(
    db: Session,
    *,
    chat_turn_id: int | None,
    conversation_id: str,
    group_id: int | None,
    item_id: int | None,
    query: str,
    trace: RagTraceContext,
    has_verified_knowledge: bool,
) -> RagTrace | None:
    try:
        row = RagTrace(
            chat_turn_id=chat_turn_id,
            conversation_id=conversation_id,
            group_id=group_id,
            item_id=item_id,
            query=query,
            retrieval_query=trace.retrieval_query,
            top_k=trace.top_k,
            fallback_used=1 if trace.fallback_used else 0,
            fallback_reason=trace.fallback_reason,
            dense_max_score=trace.dense_max_score,
            retrieved_chunks_json=_json(trace.retrieved_chunks),
            reranked_chunks_json=_json(trace.reranked_chunks),
            context_chunks_json=_json(
                {
                    "chunks": trace.context_chunks,
                    "confidence_reasons": trace.confidence_reasons,
                }
            ),
            has_verified_knowledge=1 if has_verified_knowledge else 0,
            confidence_score=trace.confidence_score,
            latency_json=_json(trace.latency),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    except Exception:
        db.rollback()
        return None
