from unittest.mock import Mock

from app.models.content_variant import ItemContentVariant
from app.models.group import Group
from app.models.item import Item
from app.modules.content.personas import DEFAULT_LANGUAGE, DEFAULT_PERSONA
from app.modules.content.service import compute_content_hash
from app.modules.content.sync_status import (
    evaluate_item_content_status,
    find_items_needing_regeneration,
    mark_group_sync_finished,
    mark_group_sync_started,
)
from app.modules.content.text_utils import (
    document_not_found_message,
    is_no_information_content,
)


def test_is_no_information_content_detects_fallbacks():
    assert is_no_information_content("Tôi không tìm thấy thông tin trong tài liệu.")
    assert is_no_information_content("")
    assert not is_no_information_content("Bia tiến sĩ là di sản quan trọng của Văn Miếu.")


def test_evaluate_item_content_status_synced_when_all_variants_ready(db_session):
    group = Group(name="Sync group")
    db_session.add(group)
    db_session.flush()
    item = Item(name="Chuông", description="Mô tả đủ dài về chuông", group_id=group.id)
    db_session.add(item)
    db_session.flush()

    for persona in ("Mặc định", "Gen Z Explorer", "Family Visitor"):
        for language in ("Tiếng Việt", "Tiếng Anh"):
            db_session.add(
                ItemContentVariant(
                    item_id=item.id,
                    persona=persona,
                    language=language,
                    text_content="Nội dung thuyết minh đủ dài.",
                    audio_data=b"audio",
                    audio_mime="audio/mpeg;engine=edge-tts/vi-VN-HoaiMyNeural-speech-v2",
                    content_hash=compute_content_hash(item.description, source="generated"),
                    status="ready",
                    source="generated",
                )
            )
    db_session.commit()

    status = evaluate_item_content_status(item, db_session.query(ItemContentVariant).filter_by(item_id=item.id).all())
    assert status["state"] == "synced"
    assert status["variants_ready"] == 6
    assert status["needs_regeneration"] is False


def test_evaluate_item_content_status_synced_without_audio_for_no_information(db_session):
    group = Group(name="No audio group")
    db_session.add(group)
    db_session.flush()
    item = Item(name="Trống", description="Trống", group_id=group.id)
    db_session.add(item)
    db_session.flush()

    from app.modules.content.text_utils import document_not_found_message

    text = document_not_found_message("Tiếng Việt")
    for persona in ("Mặc định", "Gen Z Explorer", "Family Visitor"):
        for language in ("Tiếng Việt", "Tiếng Anh"):
            content = document_not_found_message(language)
            db_session.add(
                ItemContentVariant(
                    item_id=item.id,
                    persona=persona,
                    language=language,
                    text_content=content,
                    audio_data=None,
                    audio_mime=None,
                    content_hash=compute_content_hash(item.description, source="generated"),
                    status="ready",
                    source="generated",
                )
            )
    db_session.commit()

    status = evaluate_item_content_status(item, db_session.query(ItemContentVariant).filter_by(item_id=item.id).all())
    assert status["state"] == "synced"
    assert status["needs_regeneration"] is False


def test_ensure_audio_skips_no_information_content(db_session, monkeypatch):
    from app.modules.content.service import ItemContentService
    from app.modules.content.text_utils import document_not_found_message

    item = Item(name="Trống", description="Trống", group_id=1)
    db_session.add(item)
    db_session.flush()
    text = document_not_found_message("Tiếng Việt")
    variant = ItemContentVariant(
        item_id=item.id,
        persona=DEFAULT_PERSONA,
        language=DEFAULT_LANGUAGE,
        text_content=text,
        audio_data=None,
        audio_mime=None,
        content_hash=compute_content_hash(item.description, source="generated"),
        status="ready",
        source="generated",
    )
    db_session.add(variant)
    db_session.commit()

    synthesize = Mock()
    monkeypatch.setattr("app.modules.content.service.synthesize_speech", synthesize)

    result = ItemContentService().ensure_audio(
        db_session, item, DEFAULT_PERSONA, DEFAULT_LANGUAGE
    )

    synthesize.assert_not_called()
    assert result is not None
    assert result.audio_data is None
    item = Item(name="Trống", description="Trống", group_id=1)
    db_session.add(item)
    db_session.commit()

    status = evaluate_item_content_status(item, [])
    assert status["state"] == "missing"
    assert status["needs_regeneration"] is True


def test_find_items_needing_regeneration(db_session):
    group = Group(name="Need sync")
    db_session.add(group)
    db_session.flush()
    ready_item = Item(name="A", description="Mô tả A đủ chi tiết", group_id=group.id)
    missing_item = Item(name="B", description="Mô tả B đủ chi tiết", group_id=group.id)
    db_session.add_all([ready_item, missing_item])
    db_session.flush()

    db_session.add(
        ItemContentVariant(
            item_id=ready_item.id,
            persona=DEFAULT_PERSONA,
            language=DEFAULT_LANGUAGE,
            text_content="Đủ nội dung",
            audio_data=b"audio",
            audio_mime="audio/mpeg;engine=edge-tts/vi-VN-HoaiMyNeural-speech-v2",
            content_hash=compute_content_hash(ready_item.description, source="generated"),
            status="ready",
            source="generated",
        )
    )
    db_session.commit()

    item_ids = find_items_needing_regeneration(db_session, group.id)
    assert missing_item.id in item_ids
    assert ready_item.id in item_ids


def test_generate_adapted_variant_propagates_not_found_without_llm(db_session, monkeypatch):
    from unittest.mock import Mock

    from app.modules.content.service import ItemContentService

    item = Item(name="Trống", description="Trống", group_id=1)
    db_session.add(item)
    db_session.commit()

    service = ItemContentService()
    adapt_content = Mock()
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(adapt_content=adapt_content),
    )

    result = service.generate_adapted_variant(
        db_session,
        item,
        "Gen Z Explorer",
        "Tiếng Anh",
        "Tôi không tìm thấy thông tin trong tài liệu.",
    )

    adapt_content.assert_not_called()
    assert result.content == document_not_found_message("Tiếng Anh")
    assert result.persona == "Gen Z Explorer"


def test_evaluate_item_content_status_accepts_legacy_audio_mime(db_session):
    group = Group(name="Legacy audio")
    db_session.add(group)
    db_session.flush()
    item = Item(name="Chuông", description="Mô tả đủ dài về chuông", group_id=group.id)
    db_session.add(item)
    db_session.flush()

    for persona in ("Mặc định", "Gen Z Explorer", "Family Visitor"):
        for language in ("Tiếng Việt", "Tiếng Anh"):
            db_session.add(
                ItemContentVariant(
                    item_id=item.id,
                    persona=persona,
                    language=language,
                    text_content="Nội dung thuyết minh đủ dài.",
                    audio_data=b"audio",
                    audio_mime="audio/mpeg",
                    content_hash=compute_content_hash(
                        item.description,
                        group_knowledge_version=group.knowledge_version,
                        source="generated",
                    ),
                    status="ready",
                    source="generated",
                )
            )
    db_session.commit()

    status = evaluate_item_content_status(
        item,
        db_session.query(ItemContentVariant).filter_by(item_id=item.id).all(),
        group_knowledge_version=group.knowledge_version,
    )
    assert status["state"] == "synced"


def test_group_sync_active_flag():
    mark_group_sync_started(99)
    mark_group_sync_started(99)
    mark_group_sync_finished(99)
    mark_group_sync_finished(99)
