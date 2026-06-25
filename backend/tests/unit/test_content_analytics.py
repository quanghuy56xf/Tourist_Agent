from unittest.mock import patch

from app.models.analytics_event import AnalyticsEvent
from app.models.item import Item
from app.modules.content.content_analytics import (
    CONTENT_EVENT_AUDIO_ERROR,
    CONTENT_EVENT_NO_INFORMATION,
    record_content_issue,
    should_record_audio_error,
)
from app.modules.content.service import ItemContentService
from app.modules.content.text_utils import document_not_found_message


def test_generate_and_persist_records_no_information_analytics(db_session, monkeypatch):
    item = Item(name="Trống", description="Trống", group_id=1)
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(
        "app.modules.content.service.build_verified_item_context",
        lambda **kwargs: ([], True),
    )
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: type(
            "Gen",
            (),
            {
                "generate_answer": staticmethod(
                    lambda *args, **kwargs: document_not_found_message("Tiếng Việt")
                )
            },
        )(),
    )

    with patch("app.modules.content.service.record_content_issue") as record_issue:
        ItemContentService().generate_and_persist(
            db_session, item, "Mặc định", "Tiếng Việt", source="generated"
        )
        record_issue.assert_called_once()
        assert record_issue.call_args.kwargs["event_type"] == CONTENT_EVENT_NO_INFORMATION


def test_record_content_issue_persists_event(db_session):
    from app.core.database import SessionLocal

    item = Item(name="Chuông", description="Mô tả", group_id=1)
    db_session.add(item)
    db_session.commit()

    record_content_issue(
        event_type=CONTENT_EVENT_NO_INFORMATION,
        item_id=item.id,
        group_id=item.group_id,
        persona="Gen Z Explorer",
        language="Tiếng Anh",
        error_detail="No docs",
        item_name=item.name,
    )

    check_db = SessionLocal()
    try:
        event = (
            check_db.query(AnalyticsEvent)
            .filter(
                AnalyticsEvent.event_type == CONTENT_EVENT_NO_INFORMATION,
                AnalyticsEvent.item_id == item.id,
            )
            .order_by(AnalyticsEvent.id.desc())
            .first()
        )
    finally:
        check_db.close()
    assert event is not None
    assert event.item_id == item.id
    assert event.success == 0


def test_should_record_audio_error_dedupes_same_variant_revision(db_session):
    from datetime import datetime, timedelta

    from app.models.content_variant import ItemContentVariant
    from app.modules.analytics.service import record_event

    item = Item(name="Chuông", description="Mô tả", group_id=1)
    db_session.add(item)
    db_session.commit()

    variant_updated_at = datetime.utcnow()
    variant = ItemContentVariant(
        item_id=item.id,
        persona="Mặc định",
        language="Tiếng Việt",
        text_content="Mô tả chuông",
        content_hash="hash",
        status="ready",
        source="generated",
        updated_at=variant_updated_at,
    )
    db_session.add(variant)
    db_session.commit()

    record_event(
        db_session,
        event_type=CONTENT_EVENT_AUDIO_ERROR,
        group_id=item.group_id,
        item_id=item.id,
        success=False,
        error_detail="Edge TTS timed out after 60s",
        metadata={
            "persona": "Mặc định",
            "language": "Tiếng Việt",
            "item_name": item.name,
        },
    )

    assert (
        should_record_audio_error(
            db_session,
            item.id,
            "Mặc định",
            "Tiếng Việt",
            variant_updated_at,
        )
        is False
    )

    variant.updated_at = datetime.utcnow() + timedelta(seconds=5)
    db_session.commit()

    assert (
        should_record_audio_error(
            db_session,
            item.id,
            "Mặc định",
            "Tiếng Việt",
            variant.updated_at,
        )
        is True
    )
