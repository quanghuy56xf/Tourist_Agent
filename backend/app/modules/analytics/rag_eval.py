import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.item import Item
from app.models.rag_trace import RagTrace
from app.modules.rag.index_lifecycle import get_group_index_health
from app.schemas.analytics import (
    RagConfidenceBucket,
    RagEvalReportResponse,
    RagIndexHealthGroupRow,
    RagTraceRow,
)

LOW_CONFIDENCE_THRESHOLD = 0.45
CONFIDENCE_BUCKETS = (
    ("0–0.25", 0.0, 0.25),
    ("0.25–0.45", 0.25, 0.45),
    ("0.45–0.7", 0.45, 0.7),
    ("0.7–1.0", 0.7, 1.0),
)


def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


def _safe_json(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return fallback
    return parsed


def _list_len(value: Any) -> int:
    return len(value) if isinstance(value, list) else 0


def _context_count(value: Any) -> int:
    if isinstance(value, dict):
        return _list_len(value.get("chunks"))
    return _list_len(value)


def _latency_ms(value: Any) -> int | None:
    if not isinstance(value, dict):
        return None
    for key in ("total_ms", "total"):
        raw = value.get(key)
        if isinstance(raw, (int, float)):
            return int(raw)
    numeric_values = [item for item in value.values() if isinstance(item, (int, float))]
    return int(sum(numeric_values)) if numeric_values else None


def _group_name_map(db: Session, group_ids: set[int]) -> dict[int, str]:
    if not group_ids:
        return {}
    rows = db.query(Group.id, Group.name).filter(Group.id.in_(group_ids)).all()
    return {row.id: row.name for row in rows}


def _item_name_map(db: Session, item_ids: set[int]) -> dict[int, str]:
    if not item_ids:
        return {}
    rows = db.query(Item.id, Item.name).filter(Item.id.in_(item_ids)).all()
    return {row.id: row.name for row in rows}


def _trace_to_row(
    trace: RagTrace,
    *,
    group_names: dict[int, str],
    item_names: dict[int, str],
) -> RagTraceRow:
    retrieved = _safe_json(trace.retrieved_chunks_json, [])
    reranked = _safe_json(trace.reranked_chunks_json, [])
    context = _safe_json(trace.context_chunks_json, {})
    latency = _latency_ms(_safe_json(trace.latency_json, {}))
    return RagTraceRow(
        id=trace.id,
        chat_turn_id=trace.chat_turn_id,
        conversation_id=trace.conversation_id,
        group_id=trace.group_id,
        group_name=group_names.get(trace.group_id) if trace.group_id else None,
        item_id=trace.item_id,
        item_name=item_names.get(trace.item_id) if trace.item_id else None,
        query=trace.query,
        retrieval_query=trace.retrieval_query,
        confidence_score=round(float(trace.confidence_score or 0.0), 3),
        dense_max_score=round(float(trace.dense_max_score or 0.0), 3),
        fallback_used=bool(trace.fallback_used),
        fallback_reason=trace.fallback_reason,
        has_verified_knowledge=bool(trace.has_verified_knowledge),
        retrieved_count=_list_len(retrieved),
        reranked_count=_list_len(reranked),
        context_count=_context_count(context),
        latency_ms=latency,
        created_at=trace.created_at.isoformat(),
    )


def _bucket_rows(traces: list[RagTrace]) -> list[RagConfidenceBucket]:
    rows: list[RagConfidenceBucket] = []
    for label, minimum, maximum in CONFIDENCE_BUCKETS:
        count = sum(
            1
            for trace in traces
            if float(trace.confidence_score or 0.0) >= minimum
            and (
                float(trace.confidence_score or 0.0) < maximum
                or (maximum == 1.0 and float(trace.confidence_score or 0.0) <= maximum)
            )
        )
        rows.append(
            RagConfidenceBucket(
                label=label,
                min_score=minimum,
                max_score=maximum,
                count=count,
            )
        )
    return rows


def _index_health_rows(db: Session, groups: list[Group]) -> list[RagIndexHealthGroupRow]:
    rows: list[RagIndexHealthGroupRow] = []
    for group in groups:
        health = get_group_index_health(db, group.id)
        rows.append(
            RagIndexHealthGroupRow(
                group_id=group.id,
                group_name=group.name,
                document_count=health.document_count,
                healthy=health.healthy,
                unhealthy_document_count=sum(1 for document in health.documents if not document.healthy),
                missing_chunk_count=sum(len(document.missing_chunk_ids) for document in health.documents),
                stale_chunk_count=sum(len(document.stale_chunk_ids) for document in health.documents),
                surplus_chunk_count=sum(len(document.surplus_chunk_ids) for document in health.documents),
                orphan_chunk_count=len(health.orphan_chunk_ids),
            )
        )
    return rows


def build_rag_eval_report(
    db: Session,
    *,
    days: int = 30,
    allowed_group_ids: list[int] | None = None,
    limit: int = 50,
) -> RagEvalReportResponse:
    since = _since(days)

    group_query = db.query(Group)
    if allowed_group_ids is not None:
        group_query = group_query.filter(Group.id.in_(allowed_group_ids))
    groups = group_query.order_by(Group.name).all()

    trace_query = db.query(RagTrace).filter(RagTrace.created_at >= since)
    if allowed_group_ids is not None:
        trace_query = trace_query.filter(RagTrace.group_id.in_(allowed_group_ids))
    traces = trace_query.order_by(RagTrace.created_at.desc()).all()
    recent = traces[:limit]

    total = len(traces)
    confidence_scores = [float(trace.confidence_score or 0.0) for trace in traces]
    dense_scores = [float(trace.dense_max_score or 0.0) for trace in traces]
    fallback_count = sum(1 for trace in traces if trace.fallback_used)
    verified_count = sum(1 for trace in traces if trace.has_verified_knowledge)
    low_confidence_count = sum(
        1 for score in confidence_scores if score < LOW_CONFIDENCE_THRESHOLD
    )

    latencies = [
        latency
        for trace in traces
        if (latency := _latency_ms(_safe_json(trace.latency_json, {}))) is not None
    ]

    group_ids = {trace.group_id for trace in recent if trace.group_id is not None}
    item_ids = {trace.item_id for trace in recent if trace.item_id is not None}
    group_names = _group_name_map(db, group_ids)
    item_names = _item_name_map(db, item_ids)

    return RagEvalReportResponse(
        range_days=days,
        total_traces=total,
        avg_confidence_score=round(sum(confidence_scores) / total, 3) if total else 0.0,
        avg_dense_max_score=round(sum(dense_scores) / total, 3) if total else 0.0,
        low_confidence_count=low_confidence_count,
        low_confidence_rate=round(low_confidence_count / total, 4) if total else 0.0,
        fallback_count=fallback_count,
        fallback_rate=round(fallback_count / total, 4) if total else 0.0,
        verified_knowledge_count=verified_count,
        verified_knowledge_rate=round(verified_count / total, 4) if total else 0.0,
        avg_latency_ms=round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
        confidence_buckets=_bucket_rows(traces),
        index_health=_index_health_rows(db, groups),
        recent_traces=[
            _trace_to_row(trace, group_names=group_names, item_names=item_names)
            for trace in recent
        ],
    )
