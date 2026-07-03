import logging
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import STT_INPUT_PRICE_PER_1M, STT_MODEL, STT_OUTPUT_PRICE_PER_1M, STT_PROVIDER
from app.models.group import Group
from app.models.stt_usage_log import SttUsageLog
from app.schemas.analytics import (
    SttCostDailyRow,
    SttCostSummaryResponse,
    SttSessionCostRow,
)

logger = logging.getLogger(__name__)


def compute_stt_cost_usd(
    *,
    input_tokens: int,
    output_tokens: int,
    input_price_per_1m: float = STT_INPUT_PRICE_PER_1M,
    output_price_per_1m: float = STT_OUTPUT_PRICE_PER_1M,
) -> float:
    return round(
        (input_tokens / 1_000_000) * input_price_per_1m
        + (output_tokens / 1_000_000) * output_price_per_1m,
        6,
    )


def record_stt_usage(
    db: Session,
    *,
    session_id: str | None,
    group_id: int | None,
    provider: str = STT_PROVIDER,
    model: str = STT_MODEL,
    mime_type: str,
    audio_bytes: int,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    token_source: str = "missing",
    success: bool,
    error_detail: str | None = None,
    duration_ms: int | None = None,
) -> SttUsageLog | None:
    try:
        total = total_tokens if total_tokens > 0 else input_tokens + output_tokens
        row = SttUsageLog(
            session_id=session_id,
            group_id=group_id,
            provider=provider,
            model=model,
            mime_type=mime_type,
            audio_bytes=audio_bytes,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total,
            token_source=token_source,
            input_price_per_1m=STT_INPUT_PRICE_PER_1M,
            output_price_per_1m=STT_OUTPUT_PRICE_PER_1M,
            cost_usd=compute_stt_cost_usd(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            ),
            success=1 if success else 0,
            error_detail=error_detail[:500] if error_detail else None,
            duration_ms=duration_ms,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    except Exception:
        logger.exception("Failed to record STT usage log")
        db.rollback()
        return None


def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


def _base_stt_query(
    db: Session,
    *,
    since: datetime,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
):
    query = db.query(SttUsageLog).filter(SttUsageLog.created_at >= since)
    if allowed_group_ids is not None:
        if not allowed_group_ids:
            return query.filter(False)
        query = query.filter(SttUsageLog.group_id.in_(allowed_group_ids))
    if group_id is not None:
        query = query.filter(SttUsageLog.group_id == group_id)
    return query


def _group_name_map(db: Session, group_ids: set[int]) -> dict[int, str]:
    if not group_ids:
        return {}
    rows = db.query(Group.id, Group.name).filter(Group.id.in_(group_ids)).all()
    return {row.id: row.name for row in rows}


def build_stt_cost_summary(
    db: Session,
    *,
    days: int,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
) -> SttCostSummaryResponse:
    since = _since(days)
    query = _base_stt_query(
        db,
        since=since,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
    )

    totals = query.with_entities(
        func.count(SttUsageLog.id),
        func.coalesce(func.sum(SttUsageLog.success), 0),
        func.coalesce(func.sum(SttUsageLog.input_tokens), 0),
        func.coalesce(func.sum(SttUsageLog.output_tokens), 0),
        func.coalesce(func.sum(SttUsageLog.total_tokens), 0),
        func.coalesce(func.sum(SttUsageLog.cost_usd), 0.0),
    ).one()
    total_requests = int(totals[0] or 0)
    success_count = int(totals[1] or 0)

    daily_rows = (
        query.with_entities(
            func.date(SttUsageLog.created_at).label("day"),
            func.count(SttUsageLog.id).label("request_count"),
            func.coalesce(func.sum(SttUsageLog.success), 0),
            func.coalesce(func.sum(SttUsageLog.input_tokens), 0),
            func.coalesce(func.sum(SttUsageLog.output_tokens), 0),
            func.coalesce(func.sum(SttUsageLog.total_tokens), 0),
            func.coalesce(func.sum(SttUsageLog.cost_usd), 0.0),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )

    session_rows = (
        query.with_entities(
            SttUsageLog.session_id,
            SttUsageLog.group_id,
            func.count(SttUsageLog.id).label("request_count"),
            func.coalesce(func.sum(SttUsageLog.success), 0),
            func.coalesce(func.sum(SttUsageLog.input_tokens), 0),
            func.coalesce(func.sum(SttUsageLog.output_tokens), 0),
            func.coalesce(func.sum(SttUsageLog.total_tokens), 0),
            func.coalesce(func.sum(SttUsageLog.cost_usd), 0.0),
            func.min(SttUsageLog.created_at),
            func.max(SttUsageLog.created_at),
        )
        .group_by(SttUsageLog.session_id, SttUsageLog.group_id)
        .order_by(func.max(SttUsageLog.created_at).desc())
        .limit(50)
        .all()
    )
    group_ids = {group_id for _, group_id, *_ in session_rows if group_id is not None}
    group_names = _group_name_map(db, group_ids)

    return SttCostSummaryResponse(
        range_days=days,
        total_requests=total_requests,
        success_count=success_count,
        error_count=max(0, total_requests - success_count),
        total_input_tokens=int(totals[2] or 0),
        total_output_tokens=int(totals[3] or 0),
        total_tokens=int(totals[4] or 0),
        total_cost_usd=round(float(totals[5] or 0.0), 6),
        daily=[
            SttCostDailyRow(
                date=str(day),
                request_count=int(request_count or 0),
                success_count=int(success_count or 0),
                error_count=max(0, int(request_count or 0) - int(success_count or 0)),
                input_tokens=int(input_tokens or 0),
                output_tokens=int(output_tokens or 0),
                total_tokens=int(total_tokens or 0),
                cost_usd=round(float(cost_usd or 0.0), 6),
            )
            for (
                day,
                request_count,
                success_count,
                input_tokens,
                output_tokens,
                total_tokens,
                cost_usd,
            ) in daily_rows
        ],
        sessions=[
            SttSessionCostRow(
                session_id=session_id,
                group_id=group_id,
                group_name=group_names.get(group_id) if group_id else None,
                request_count=int(request_count or 0),
                success_count=int(success_count or 0),
                error_count=max(0, int(request_count or 0) - int(success_count or 0)),
                input_tokens=int(input_tokens or 0),
                output_tokens=int(output_tokens or 0),
                total_tokens=int(total_tokens or 0),
                cost_usd=round(float(cost_usd or 0.0), 6),
                first_at=first_at.isoformat(),
                last_at=last_at.isoformat(),
            )
            for (
                session_id,
                group_id,
                request_count,
                success_count,
                input_tokens,
                output_tokens,
                total_tokens,
                cost_usd,
                first_at,
                last_at,
            ) in session_rows
        ],
    )
