from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from statistics import mean
from typing import Any

from sqlalchemy.orm import Session

from app.models.analytics_event import AnalyticsEvent
from app.models.group import Group
from app.models.item import Item
from app.schemas.analytics import (
    ProductEvalFeedbackRow,
    ProductEvalReportResponse,
    ProductEvalReportSource,
)

ROOT_DIR = Path(__file__).resolve().parents[4]
DEFAULT_IMAGE_REPORT = ROOT_DIR / "docs" / "reports" / "image_eval_results.json"
DEFAULT_RAGAS_REPORT = ROOT_DIR / "docs" / "reports" / "ragas_golden_70_results.json"

FEEDBACK_EVENT = "eval_feedback"
QUEST_STARTED_EVENT = "quest_started"
QUEST_COMPLETED_EVENT = "quest_completed"
QUIZ_PRE_EVENT = "quiz_pre_submitted"
QUIZ_POST_EVENT = "quiz_post_submitted"
STORY_FIRST_AUDIO_EVENT = "story_first_meaningful_audio"
STORY_COMPLETED_EVENT = "story_completed"


def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


def _safe_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _round(value: float | None, digits: int = 3) -> float | None:
    return round(value, digits) if value is not None else None


def _avg(values: list[float]) -> float | None:
    return mean(values) if values else None


def _p95(values: list[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, int(len(ordered) * 0.95 + 0.999999) - 1)
    return ordered[min(index, len(ordered) - 1)]


def _rate(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round(numerator / denominator, 4)


def _load_json_report(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _report_source(path: Path, exists: bool) -> ProductEvalReportSource:
    return ProductEvalReportSource(
        path=str(path),
        exists=exists,
    )


def _image_accuracy_from_report(report: dict[str, Any] | None) -> float | None:
    if not report:
        return None
    for key in ("top1_accuracy", "accuracy", "top_1_accuracy"):
        value = _as_float(report.get(key))
        if value is not None:
            return round(value, 4)
    correct = _as_float(report.get("correct"))
    total = _as_float(report.get("total_images") or report.get("total"))
    if correct is not None and total:
        return round(correct / total, 4)
    return None


def _trustworthy_rate_from_report(report: dict[str, Any] | None) -> float | None:
    if not report:
        return None
    detailed_rate = _trustworthy_rate_from_case_scores(report)
    if detailed_rate is not None:
        return detailed_rate

    passed = _as_float(report.get("passed_questions") or report.get("passed_cases"))
    total = _as_float(report.get("total_questions") or report.get("total_cases"))
    if passed is not None and total:
        return round(passed / total, 4)

    for key in ("trustworthy_answer_rate", "pass_rate", "passed_rate"):
        value = _as_float(report.get(key))
        if value is not None:
            return round(value, 4)

    metrics = report.get("metrics")
    targets = report.get("targets")
    if isinstance(metrics, dict) and isinstance(targets, dict):
        keys = ("faithfulness", "answer_relevancy")
        if all(_as_float(metrics.get(key)) is not None for key in keys):
            passed_all = all(
                (_as_float(metrics.get(key)) or 0) >= (_as_float(targets.get(key)) or 0)
                for key in keys
            )
            return 1.0 if passed_all else 0.0
    return None


def _trustworthy_rate_from_case_scores(report: dict[str, Any]) -> float | None:
    targets = report.get("targets") or {}
    if not isinstance(targets, dict):
        targets = {}
    faithfulness_target = _as_float(targets.get("faithfulness")) or 0.85
    answer_relevancy_target = _as_float(targets.get("answer_relevancy")) or 0.80

    cases = report.get("case_scores") or report.get("cases") or report.get("results")
    if not isinstance(cases, list):
        return None

    total = 0
    passed = 0
    for row in cases:
        if not isinstance(row, dict):
            continue
        faithfulness = _case_metric(row, "faithfulness")
        answer_relevancy = _case_metric(row, "answer_relevancy")
        if faithfulness is None or answer_relevancy is None:
            continue
        total += 1
        if faithfulness >= faithfulness_target and answer_relevancy >= answer_relevancy_target:
            passed += 1

    if total == 0:
        return None
    return round(passed / total, 4)


def _case_metric(row: dict[str, Any], metric: str) -> float | None:
    value = row.get(metric)
    if value is None and isinstance(row.get("scores"), dict):
        value = row["scores"].get(metric)
    return _as_float(value)


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


def _feedback_rows(db: Session, since: datetime, group_ids: list[int] | None, limit: int) -> list[AnalyticsEvent]:
    query = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.created_at >= since,
        AnalyticsEvent.event_type == FEEDBACK_EVENT,
    )
    if group_ids is not None:
        query = query.filter(AnalyticsEvent.group_id.in_(group_ids))
    return query.order_by(AnalyticsEvent.created_at.desc()).limit(limit).all()


def build_product_eval_report(
    db: Session,
    *,
    days: int = 30,
    allowed_group_ids: list[int] | None = None,
    limit: int = 50,
    image_report_path: Path | None = None,
    ragas_report_path: Path | None = None,
) -> ProductEvalReportResponse:
    since = _since(days)
    group_filter = allowed_group_ids
    image_path = image_report_path or DEFAULT_IMAGE_REPORT
    ragas_path = ragas_report_path or DEFAULT_RAGAS_REPORT
    image_report = _load_json_report(image_path)
    ragas_report = _load_json_report(ragas_path)

    base = db.query(AnalyticsEvent).filter(AnalyticsEvent.created_at >= since)
    if group_filter is not None:
        base = base.filter(AnalyticsEvent.group_id.in_(group_filter))
    events = base.all()

    def event_rows(event_type: str) -> list[AnalyticsEvent]:
        return [row for row in events if row.event_type == event_type]

    def durations(event_type: str) -> list[int]:
        return [
            int(row.duration_ms)
            for row in event_rows(event_type)
            if row.duration_ms is not None and row.duration_ms >= 0
        ]

    story_first_audio = durations(STORY_FIRST_AUDIO_EVENT)
    story_completed = durations(STORY_COMPLETED_EVENT)
    search_latencies = durations("search")
    chat_latencies = durations("chat")
    e2e_latencies = story_completed or story_first_audio or chat_latencies

    feedback = event_rows(FEEDBACK_EVENT)
    metadata = [_safe_json(row.metadata_json) for row in feedback]
    voice_scores = [
        value
        for payload in metadata
        if (value := _as_float(payload.get("voice_naturalness_score"))) is not None
    ]
    replay_scores = [
        value
        for payload in metadata
        if (value := _as_float(payload.get("replay_intent_score"))) is not None
    ]

    combined_story_scores: list[float] = []
    for payload in metadata:
        values = [
            value
            for key in ("persona_score", "storytelling_score")
            if (value := _as_float(payload.get(key))) is not None
        ]
        if values:
            combined_story_scores.append(mean(values))

    quest_started = len(event_rows(QUEST_STARTED_EVENT))
    quest_completed = len(event_rows(QUEST_COMPLETED_EVENT))

    pre_scores: dict[tuple[str, str], tuple[float, float]] = {}
    post_scores: dict[tuple[str, str], tuple[float, float]] = {}
    for row in event_rows(QUIZ_PRE_EVENT) + event_rows(QUIZ_POST_EVENT):
        payload = _safe_json(row.metadata_json)
        score = _as_float(payload.get("score"))
        max_score = _as_float(payload.get("max_score"))
        if score is None or max_score is None:
            continue
        key = (row.session_id or "", str(payload.get("quiz_id") or "default"))
        if row.event_type == QUIZ_PRE_EVENT:
            pre_scores[key] = (score, max_score)
        else:
            post_scores[key] = (score, max_score)

    raw_gains: list[float] = []
    normalized_gains: list[float] = []
    for key, (pre_score, pre_max) in pre_scores.items():
        if key not in post_scores:
            continue
        post_score, post_max = post_scores[key]
        max_score = post_max or pre_max
        raw_gains.append(post_score - pre_score)
        denominator = max_score - pre_score
        if denominator > 0:
            normalized_gains.append((post_score - pre_score) / denominator)

    sessions = {row.session_id for row in events if row.session_id}
    item_views = {
        (row.session_id, row.item_id)
        for row in events
        if row.session_id and row.item_id and row.event_type in {"item_view", "search"}
    }
    avg_artifacts = len(item_views) / len(sessions) if sessions else None

    recent_feedback_rows = _feedback_rows(db, since, group_filter, limit)
    group_names = _group_name_map(
        db, {row.group_id for row in recent_feedback_rows if row.group_id is not None}
    )
    item_names = _item_name_map(
        db, {row.item_id for row in recent_feedback_rows if row.item_id is not None}
    )

    notes: list[str] = []
    if image_report is None:
        notes.append(f"Chưa có image eval report tại {image_path}.")
    if ragas_report is None:
        notes.append(f"Chưa có RAGAS/golden eval report tại {ragas_path}.")
    if not feedback:
        notes.append("Chưa có feedback eval; hãy bật form storytelling/voice/replay intent trong visitor flow.")
    if not story_first_audio:
        notes.append("Chưa có event story_first_meaningful_audio để tính Time to First Story.")
    if quest_started == 0:
        notes.append("Chưa có quest_started để tính Quest Completion Rate.")
    if not raw_gains:
        notes.append("Chưa có cặp quiz_pre_submitted/quiz_post_submitted để tính Learning Gain.")

    return ProductEvalReportResponse(
        range_days=days,
        top1_image_accuracy=_image_accuracy_from_report(image_report),
        trustworthy_answer_rate=_trustworthy_rate_from_report(ragas_report),
        time_to_first_story_avg_ms=int(_avg(story_first_audio) or 0) if story_first_audio else None,
        time_to_first_story_p95_ms=_p95(story_first_audio),
        persona_storytelling_score=_round(_avg(combined_story_scores), 2),
        voice_mos=_round(_avg(voice_scores), 2),
        quest_started_count=quest_started,
        quest_completed_count=quest_completed,
        quest_completion_rate=_rate(quest_completed, quest_started),
        learning_gain_avg=_round(_avg(raw_gains), 2),
        normalized_learning_gain_avg=_round(_avg(normalized_gains), 3),
        replay_intent_score=_round(_avg(replay_scores), 2),
        avg_artifacts_per_session=_round(avg_artifacts, 2),
        p95_search_latency_ms=_p95(search_latencies),
        p95_chat_latency_ms=_p95(chat_latencies),
        p95_e2e_latency_ms=_p95(e2e_latencies),
        feedback_count=len(feedback),
        session_count=len(sessions),
        report_sources=[
            _report_source(image_path, image_report is not None),
            _report_source(ragas_path, ragas_report is not None),
        ],
        recent_feedback=[
            ProductEvalFeedbackRow(
                created_at=row.created_at.isoformat(),
                session_id=row.session_id,
                group_name=group_names.get(row.group_id) if row.group_id else None,
                item_name=item_names.get(row.item_id) if row.item_id else None,
                persona_score=_as_float((payload := _safe_json(row.metadata_json)).get("persona_score")),
                storytelling_score=_as_float(payload.get("storytelling_score")),
                voice_naturalness_score=_as_float(payload.get("voice_naturalness_score")),
                replay_intent_score=_as_float(payload.get("replay_intent_score")),
                comment=str(payload.get("comment"))[:300] if payload.get("comment") else None,
            )
            for row in recent_feedback_rows
        ],
        notes=notes,
    )
