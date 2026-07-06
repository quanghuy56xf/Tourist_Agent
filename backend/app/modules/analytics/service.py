"""Visitor analytics aggregation utilities for the admin dashboard.

The functions in this module turn raw analytics events into group-scoped summary rows,
latency metrics, and content quality signals used by the admin UI.
"""

import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.analytics_event import SLOW_THRESHOLD_MS, AnalyticsEvent
from app.models.group import Group
from app.models.item import Item
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    ChatPerSearchStats,
    ContentIssueRow,
    DailyCount,
    GroupActivityStats,
    SessionDurationStats,
    SlowEventRow,
    TimingStats,
)

logger = logging.getLogger(__name__)

ALLOWED_CLIENT_EVENT_TYPES = frozenset(
    {
        "group_visit",
        "item_view",
        "story_scan_started",
        "story_first_meaningful_audio",
        "story_completed",
        "eval_feedback",
        "quest_started",
        "quest_completed",
        "quest_abandoned",
        "quiz_pre_submitted",
        "quiz_post_submitted",
    }
)


def get_client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return "unknown"


def record_event(
    db: Session,
    *,
    event_type: str,
    group_id: int | None = None,
    item_id: int | None = None,
    session_id: str | None = None,
    search_session_id: str | None = None,
    client_ip: str | None = None,
    duration_ms: int | None = None,
    success: bool = True,
    error_detail: str | None = None,
    metadata: dict | None = None,
) -> AnalyticsEvent:
    event = AnalyticsEvent(
        event_type=event_type,
        group_id=group_id,
        item_id=item_id,
        session_id=session_id,
        search_session_id=search_session_id,
        client_ip=client_ip,
        duration_ms=duration_ms,
        success=1 if success else 0,
        error_detail=error_detail[:500] if error_detail else None,
        metadata_json=json.dumps(metadata, ensure_ascii=False) if metadata else None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


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


def _daily_trend(
    db: Session,
    *,
    event_type: str,
    since: datetime,
    group_ids: list[int] | None,
) -> dict[int, list[DailyCount]]:
    query = db.query(
        AnalyticsEvent.group_id,
        func.date(AnalyticsEvent.created_at).label("day"),
        func.count(AnalyticsEvent.id).label("cnt"),
    ).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.event_type == event_type,
        AnalyticsEvent.group_id.isnot(None),
    )
    if group_ids is not None:
        query = query.filter(AnalyticsEvent.group_id.in_(group_ids))
    rows = query.group_by(AnalyticsEvent.group_id, "day").all()

    by_group: dict[int, dict[str, int]] = defaultdict(dict)
    for group_id, day, cnt in rows:
        if group_id is None:
            continue
        by_group[group_id][str(day)] = int(cnt)

    result: dict[int, list[DailyCount]] = {}
    for group_id, day_map in by_group.items():
        result[group_id] = [
            DailyCount(date=day, count=count)
            for day, count in sorted(day_map.items())
        ]
    return result


def _timing_stats(
    db: Session,
    *,
    event_type: str,
    error_type: str,
    since: datetime,
    group_ids: list[int] | None,
) -> TimingStats:
    base = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.event_type == event_type,
    )
    if group_ids is not None:
        base = base.filter(AnalyticsEvent.group_id.in_(group_ids))

    success_rows = base.filter(AnalyticsEvent.success == 1).all()
    error_count = (
        db.query(func.count(AnalyticsEvent.id))
        .filter(
            AnalyticsEvent.created_at >= since,
            AnalyticsEvent.event_type == error_type,
        )
        .scalar()
        or 0
    )
    if group_ids is not None:
        error_count = (
            db.query(func.count(AnalyticsEvent.id))
            .filter(
                AnalyticsEvent.created_at >= since,
                AnalyticsEvent.event_type == error_type,
                AnalyticsEvent.group_id.in_(group_ids),
            )
            .scalar()
            or 0
        )

    durations = [row.duration_ms for row in success_rows if row.duration_ms is not None]
    slow_count = sum(1 for ms in durations if ms >= SLOW_THRESHOLD_MS)
    avg_ms = sum(durations) / len(durations) if durations else 0.0
    return TimingStats(
        count=len(success_rows),
        avg_ms=round(avg_ms, 1),
        slow_count=slow_count,
        error_count=int(error_count),
    )


def build_summary(
    db: Session,
    *,
    days: int = 30,
    allowed_group_ids: list[int] | None = None,
) -> AnalyticsSummaryResponse:
    """Aggregate visitor analytics for the admin overview page.

    The summary intentionally spans multiple event families in one response: group visits,
    searches, chat-per-search, latency, slow events, and content issue rows. Preserve the
    optional group filter across every query to enforce manager-scoped analytics.
    """
    since = _since(days)
    group_filter = allowed_group_ids

    groups_query = db.query(Group)
    if group_filter is not None:
        groups_query = groups_query.filter(Group.id.in_(group_filter))
    groups = groups_query.order_by(Group.name).all()
    group_ids = [group.id for group in groups]
    group_names = {group.id: group.name for group in groups}

    visit_trends = _daily_trend(
        db, event_type="group_visit", since=since, group_ids=group_filter
    )
    search_trends = _daily_trend(
        db, event_type="search", since=since, group_ids=group_filter
    )

    visit_counts: dict[int, int] = {}
    search_counts: dict[int, int] = {}
    for group_id in group_ids:
        visit_q = db.query(func.count(AnalyticsEvent.id)).filter(
            AnalyticsEvent.created_at >= since,
            AnalyticsEvent.event_type == "group_visit",
            AnalyticsEvent.group_id == group_id,
        )
        search_q = db.query(func.count(AnalyticsEvent.id)).filter(
            AnalyticsEvent.created_at >= since,
            AnalyticsEvent.event_type == "search",
            AnalyticsEvent.group_id == group_id,
        )
        visit_counts[group_id] = int(visit_q.scalar() or 0)
        search_counts[group_id] = int(search_q.scalar() or 0)

    group_stats = [
        GroupActivityStats(
            group_id=group_id,
            group_name=group_names[group_id],
            visits=visit_counts.get(group_id, 0),
            searches=search_counts.get(group_id, 0),
            visit_trend=visit_trends.get(group_id, []),
            search_trend=search_trends.get(group_id, []),
        )
        for group_id in group_ids
    ]

    chat_rows = db.query(
        AnalyticsEvent.search_session_id,
        func.count(AnalyticsEvent.id).label("cnt"),
    ).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.event_type == "chat",
        AnalyticsEvent.search_session_id.isnot(None),
        AnalyticsEvent.success == 1,
    )
    if group_filter is not None:
        chat_rows = chat_rows.filter(AnalyticsEvent.group_id.in_(group_filter))
    chat_rows = chat_rows.group_by(AnalyticsEvent.search_session_id).all()

    search_session_rows = db.query(AnalyticsEvent.search_session_id).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.event_type == "search",
        AnalyticsEvent.search_session_id.isnot(None),
        AnalyticsEvent.success == 1,
    )
    if group_filter is not None:
        search_session_rows = search_session_rows.filter(
            AnalyticsEvent.group_id.in_(group_filter)
        )
    search_sessions = {row.search_session_id for row in search_session_rows.all()}

    chat_counts_by_session = {sid: int(cnt) for sid, cnt in chat_rows}
    distribution_map: dict[int, int] = defaultdict(int)
    for sid in search_sessions:
        distribution_map[chat_counts_by_session.get(sid, 0)] += 1

    avg_questions = (
        sum(chat_counts_by_session.get(sid, 0) for sid in search_sessions)
        / len(search_sessions)
        if search_sessions
        else 0.0
    )
    chat_per_search = ChatPerSearchStats(
        avg_questions=round(avg_questions, 2),
        sessions_with_search=len(search_sessions),
        distribution=[
            {"questions": questions, "sessions": sessions}
            for questions, sessions in sorted(distribution_map.items())
        ],
    )

    session_rows = db.query(
        AnalyticsEvent.session_id,
        AnalyticsEvent.group_id,
        AnalyticsEvent.client_ip,
        func.min(AnalyticsEvent.created_at).label("started"),
        func.max(AnalyticsEvent.created_at).label("ended"),
        func.count(AnalyticsEvent.id).label("event_count"),
    ).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.group_id.isnot(None),
        AnalyticsEvent.session_id.isnot(None),
        AnalyticsEvent.client_ip.isnot(None),
    )
    if group_filter is not None:
        session_rows = session_rows.filter(AnalyticsEvent.group_id.in_(group_filter))
    session_rows = (
        session_rows.group_by(
            AnalyticsEvent.session_id,
            AnalyticsEvent.group_id,
            AnalyticsEvent.client_ip,
        )
        .order_by(func.max(AnalyticsEvent.created_at).desc())
        .limit(50)
        .all()
    )

    session_durations = [
        SessionDurationStats(
            group_id=row.group_id,
            group_name=group_names.get(row.group_id, f"#{row.group_id}"),
            client_ip=row.client_ip or "unknown",
            session_id=row.session_id or "",
            duration_seconds=max(
                0, int((row.ended - row.started).total_seconds())
            ),
            event_count=int(row.event_count),
            last_seen=row.ended.isoformat(),
        )
        for row in session_rows
    ]

    search_timing = _timing_stats(
        db,
        event_type="search",
        error_type="search_error",
        since=since,
        group_ids=group_filter,
    )
    chat_timing = _timing_stats(
        db,
        event_type="chat",
        error_type="chat_error",
        since=since,
        group_ids=group_filter,
    )

    slow_query = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.duration_ms.isnot(None),
        AnalyticsEvent.duration_ms >= SLOW_THRESHOLD_MS,
        AnalyticsEvent.event_type.in_(("search", "chat")),
    )
    if group_filter is not None:
        slow_query = slow_query.filter(AnalyticsEvent.group_id.in_(group_filter))
    slow_rows = slow_query.order_by(AnalyticsEvent.created_at.desc()).limit(20).all()

    error_query = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.event_type.in_(("search_error", "chat_error")),
    )
    if group_filter is not None:
        error_query = error_query.filter(AnalyticsEvent.group_id.in_(group_filter))
    error_rows = error_query.order_by(AnalyticsEvent.created_at.desc()).limit(20).all()

    from app.modules.content.content_analytics import (
        CONTENT_EVENT_AUDIO_ERROR,
        CONTENT_EVENT_NO_INFORMATION,
        CONTENT_EVENT_TEXT_ERROR,
        CONTENT_ISSUE_EVENT_TYPES,
        parse_content_metadata,
    )

    content_issue_query = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.event_type.in_(CONTENT_ISSUE_EVENT_TYPES),
    )
    if group_filter is not None:
        content_issue_query = content_issue_query.filter(
            AnalyticsEvent.group_id.in_(group_filter)
        )
    content_issue_rows = (
        content_issue_query.order_by(AnalyticsEvent.created_at.desc()).limit(50).all()
    )

    content_no_information_count = sum(
        1 for row in content_issue_rows if row.event_type == CONTENT_EVENT_NO_INFORMATION
    )
    content_text_error_count = sum(
        1 for row in content_issue_rows if row.event_type == CONTENT_EVENT_TEXT_ERROR
    )
    content_audio_error_count = sum(
        1 for row in content_issue_rows if row.event_type == CONTENT_EVENT_AUDIO_ERROR
    )

    related_group_ids = {
        row.group_id for row in slow_rows + error_rows + content_issue_rows if row.group_id is not None
    }
    related_item_ids = {
        row.item_id for row in slow_rows + error_rows + content_issue_rows if row.item_id is not None
    }
    group_name_lookup = _group_name_map(db, related_group_ids)
    item_name_lookup = _item_name_map(db, related_item_ids)

    def to_slow_row(row: AnalyticsEvent) -> SlowEventRow:
        return SlowEventRow(
            event_type=row.event_type,
            duration_ms=row.duration_ms,
            group_name=group_name_lookup.get(row.group_id) if row.group_id else None,
            item_name=item_name_lookup.get(row.item_id) if row.item_id else None,
            client_ip=row.client_ip,
            error_detail=row.error_detail,
            created_at=row.created_at.isoformat(),
        )

    def to_content_issue_row(row: AnalyticsEvent) -> ContentIssueRow:
        persona, language = parse_content_metadata(row.metadata_json)
        item_name = item_name_lookup.get(row.item_id) if row.item_id else None
        if item_name is None and row.metadata_json:
            try:
                payload = json.loads(row.metadata_json)
                if isinstance(payload, dict) and isinstance(payload.get("item_name"), str):
                    item_name = payload["item_name"]
            except json.JSONDecodeError:
                pass
        return ContentIssueRow(
            event_type=row.event_type,
            group_name=group_name_lookup.get(row.group_id) if row.group_id else None,
            item_name=item_name,
            persona=persona,
            language=language,
            error_detail=row.error_detail,
            created_at=row.created_at.isoformat(),
        )

    total_visits = sum(visit_counts.values())
    total_searches = sum(search_counts.values())

    return AnalyticsSummaryResponse(
        range_days=days,
        total_visits=total_visits,
        total_searches=total_searches,
        groups=group_stats,
        chat_per_search=chat_per_search,
        session_durations=session_durations,
        search_timing=search_timing,
        chat_timing=chat_timing,
        slow_events=[to_slow_row(row) for row in slow_rows],
        recent_errors=[to_slow_row(row) for row in error_rows],
        content_no_information_count=content_no_information_count,
        content_text_error_count=content_text_error_count,
        content_audio_error_count=content_audio_error_count,
        content_issues=[to_content_issue_row(row) for row in content_issue_rows],
    )
