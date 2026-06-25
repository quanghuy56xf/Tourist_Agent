import json
import logging
from datetime import datetime

from app.core.database import SessionLocal
from app.models.analytics_event import AnalyticsEvent
from app.modules.analytics.service import record_event

logger = logging.getLogger(__name__)

CONTENT_EVENT_NO_INFORMATION = "content_no_information"
CONTENT_EVENT_TEXT_ERROR = "content_text_error"
CONTENT_EVENT_AUDIO_ERROR = "content_audio_error"

CONTENT_ISSUE_EVENT_TYPES = (
    CONTENT_EVENT_NO_INFORMATION,
    CONTENT_EVENT_TEXT_ERROR,
    CONTENT_EVENT_AUDIO_ERROR,
)


def _normalize_timestamp(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.replace(tzinfo=None)
    return value


def get_last_audio_error_event(
    db,
    item_id: int,
    persona: str,
    language: str,
) -> AnalyticsEvent | None:
    events = (
        db.query(AnalyticsEvent)
        .filter(
            AnalyticsEvent.event_type == CONTENT_EVENT_AUDIO_ERROR,
            AnalyticsEvent.item_id == item_id,
        )
        .order_by(AnalyticsEvent.id.desc())
        .limit(50)
        .all()
    )
    for event in events:
        event_persona, event_language = parse_content_metadata(event.metadata_json)
        if event_persona == persona and event_language == language:
            return event
    return None


def should_record_audio_error(
    db,
    item_id: int,
    persona: str,
    language: str,
    variant_updated_at: datetime | None,
) -> bool:
    """Skip duplicate audio-error analytics for the same variant revision."""
    last_error = get_last_audio_error_event(db, item_id, persona, language)
    if last_error is None:
        return True

    variant_ts = _normalize_timestamp(variant_updated_at)
    error_ts = _normalize_timestamp(last_error.created_at)
    if variant_ts is None or error_ts is None:
        return True
    return error_ts < variant_ts


def record_content_issue(
    *,
    event_type: str,
    item_id: int,
    group_id: int | None,
    persona: str,
    language: str,
    error_detail: str | None = None,
    item_name: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        record_event(
            db,
            event_type=event_type,
            group_id=group_id,
            item_id=item_id,
            success=False,
            error_detail=error_detail,
            metadata={
                "persona": persona,
                "language": language,
                "item_name": item_name,
            },
        )
    except Exception:
        logger.exception(
            "Failed to record content analytics for item %s (%s, %s)",
            item_id,
            persona,
            language,
        )
    finally:
        db.close()


def parse_content_metadata(metadata_json: str | None) -> tuple[str | None, str | None]:
    if not metadata_json:
        return None, None
    try:
        payload = json.loads(metadata_json)
    except json.JSONDecodeError:
        return None, None
    if not isinstance(payload, dict):
        return None, None
    persona = payload.get("persona")
    language = payload.get("language")
    return (
        persona if isinstance(persona, str) else None,
        language if isinstance(language, str) else None,
    )
