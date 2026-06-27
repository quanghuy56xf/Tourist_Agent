import hashlib
from unittest.mock import Mock

import pytest

from app.models.content_variant import ItemContentVariant
from app.models.item import Item
from app.modules.content.language_support import LANGUAGE_JA, LANGUAGE_KO, LANGUAGE_ZH
from app.modules.content.personas import DEFAULT_LANGUAGE, DEFAULT_PERSONA
from app.modules.content import router as content_router
from app.modules.content.service import (
    ItemContentResult,
    ItemContentService,
    compute_content_hash,
)
from app.modules.content.tts import TTSResult, build_audio_mime


def _tts_ok(audio: bytes = b"audio", mime: str = "audio/mpeg") -> TTSResult:
    return TTSResult(ok=True, audio=audio, mime=mime)


def _tts_fail(detail: str = "Text-to-speech synthesis failed") -> TTSResult:
    return TTSResult(ok=False, error_code="edge_tts_error", error_detail=detail)


def _add_item(db_session, **overrides) -> Item:
    item = Item(
        name=overrides.get("name", "Test item"),
        description=overrides.get("description", "Primary description"),
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


def test_compute_content_hash_changes_when_description_changes():
    assert compute_content_hash("a") != compute_content_hash("b")


def test_generation_rules_change_generated_hash_but_preserve_manual_hash():
    generated = compute_content_hash("Description", source="generated")
    manual = compute_content_hash("Description", source="manual")

    assert generated != manual
    assert manual == hashlib.sha256(b"Description").hexdigest()


def test_generated_item_content_is_preserved_before_persistence(
    db_session,
    monkeypatch,
):
    item = _add_item(db_session)
    long_text = "Word0 " + " ".join(f"word{i}" for i in range(1, 301))
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(generate_answer=Mock(return_value=long_text)),
    )
    monkeypatch.setattr(
        "app.modules.content.service.try_get_rag_retriever",
        lambda: None,
    )
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language, persona=None: _tts_fail(),
    )

    result = ItemContentService().generate_and_persist(
        db_session, item, "Mặc định", "Tiếng Việt"
    )

    assert result.content == long_text
    stored = db_session.query(ItemContentVariant).filter_by(item_id=item.id).one()
    assert stored.text_content == result.content


def test_adapted_item_content_is_preserved_before_persistence(
    db_session,
    monkeypatch,
):
    item = _add_item(db_session)
    long_text = "Word0 " + " ".join(f"word{i}" for i in range(1, 301))
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(adapt_content=Mock(return_value=long_text)),
    )

    result = ItemContentService().generate_adapted_variant(
        db_session,
        item,
        "Gen Z Explorer",
        "Tiếng Việt",
        "Base content",
    )

    assert result.content == long_text
    stored = db_session.query(ItemContentVariant).filter_by(item_id=item.id).one()
    assert stored.text_content == long_text


def test_get_or_generate_adapts_foreign_language_from_vietnamese_base(
    db_session,
    monkeypatch,
):
    item = _add_item(db_session)
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=DEFAULT_LANGUAGE,
            text_content="Nội dung tiếng Việt gốc",
            audio_data=None,
            audio_mime=None,
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="generated",
        )
    )
    db_session.commit()

    generate_and_persist = Mock()
    generate_adapted = Mock(
        return_value=ItemContentResult(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=LANGUAGE_JA,
            content="日本語の説明",
            has_audio=False,
            audio_url=None,
            audio_status="missing",
            stored=False,
            source="generated",
        )
    )
    monkeypatch.setattr(
        ItemContentService,
        "generate_and_persist",
        generate_and_persist,
    )
    monkeypatch.setattr(
        ItemContentService,
        "generate_adapted_variant",
        generate_adapted,
    )

    result = ItemContentService().get_or_generate(
        db_session,
        item,
        DEFAULT_PERSONA,
        LANGUAGE_JA,
    )

    assert result.content == "日本語の説明"
    generate_adapted.assert_called_once()
    generate_and_persist.assert_not_called()


def test_get_or_generate_ignores_stale_foreign_variant_copied_from_vietnamese(
    db_session,
    monkeypatch,
):
    item = _add_item(db_session)
    vietnamese_text = "Nội dung tiếng Việt gốc"
    for language in (DEFAULT_LANGUAGE, LANGUAGE_ZH):
        db_session.add(
            ItemContentVariant(
                item_id=item.id,
                persona=DEFAULT_PERSONA,
                language=language,
                text_content=vietnamese_text,
                audio_data=None,
                audio_mime=None,
                content_hash=compute_content_hash(item.description),
                status="ready",
                source="generated",
            )
        )
    db_session.commit()

    generate_and_persist = Mock(
        return_value=ItemContentResult(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=LANGUAGE_ZH,
            content="中文说明",
            has_audio=False,
            audio_url=None,
            audio_status="missing",
            stored=False,
            source="generated",
        )
    )
    generate_adapted = Mock(
        return_value=ItemContentResult(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=LANGUAGE_ZH,
            content="中文说明",
            has_audio=False,
            audio_url=None,
            audio_status="missing",
            stored=False,
            source="generated",
        )
    )
    monkeypatch.setattr(
        ItemContentService,
        "generate_and_persist",
        generate_and_persist,
    )
    monkeypatch.setattr(
        ItemContentService,
        "generate_adapted_variant",
        generate_adapted,
    )

    result = ItemContentService().get_or_generate(
        db_session,
        item,
        DEFAULT_PERSONA,
        LANGUAGE_ZH,
    )

    assert result.content == "中文说明"
    generate_adapted.assert_called_once()
    generate_and_persist.assert_not_called()


def test_get_or_generate_invalidates_foreign_variant_matching_item_description(
    db_session,
    monkeypatch,
):
    item = _add_item(db_session, description="Mô tả tiếng Việt gốc")
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=DEFAULT_LANGUAGE,
            text_content="Nội dung tiếng Việt gốc",
            audio_data=None,
            audio_mime=None,
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="generated",
        )
    )
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=LANGUAGE_KO,
            text_content=item.description,
            audio_data=None,
            audio_mime=None,
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="fallback_description",
        )
    )
    db_session.commit()

    generate_adapted = Mock(
        return_value=ItemContentResult(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=LANGUAGE_KO,
            content="한국어 설명",
            has_audio=False,
            audio_url=None,
            audio_status="missing",
            stored=False,
            source="generated",
        )
    )
    monkeypatch.setattr(
        ItemContentService,
        "generate_adapted_variant",
        generate_adapted,
    )

    result = ItemContentService().get_or_generate(
        db_session,
        item,
        DEFAULT_PERSONA,
        LANGUAGE_KO,
    )

    assert result.content == "한국어 설명"
    generate_adapted.assert_called_once()


def test_generate_text_does_not_return_vietnamese_for_korean_on_rag_error(
    db_session,
    monkeypatch,
):
    item = _add_item(db_session, description="Mô tả tiếng Việt gốc")
    adapt_content = Mock(return_value="한국어 설명")
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(
            generate_answer=Mock(side_effect=RuntimeError("llm down")),
            adapt_content=adapt_content,
        ),
    )
    monkeypatch.setattr(
        "app.modules.content.service.build_verified_item_context",
        lambda **kwargs: ([Mock(page_content="fact")], True),
    )

    text, source = ItemContentService().generate_text(
        item, DEFAULT_PERSONA, LANGUAGE_KO
    )

    assert text == "한국어 설명"
    assert source == "generated"
    adapt_content.assert_called_once()


def test_adapted_variant_skips_llm_when_base_not_found(db_session, monkeypatch):
    from app.modules.content.text_utils import document_not_found_message

    item = _add_item(db_session)
    adapt_content = Mock()
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(adapt_content=adapt_content),
    )

    result = ItemContentService().generate_adapted_variant(
        db_session,
        item,
        "Family Visitor",
        "Tiếng Việt",
        "Tôi không tìm thấy thông tin trong tài liệu.",
    )

    adapt_content.assert_not_called()
    assert result.content == document_not_found_message("Tiếng Việt")


def test_manual_content_is_not_truncated(db_session, monkeypatch):
    item = _add_item(db_session)
    long_text = " ".join(f"word{i}" for i in range(350))
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language, persona=None: _tts_fail(),
    )

    result = ItemContentService().update_content(
        db_session, item, "Mặc định", "Tiếng Việt", long_text
    )

    assert len(result.content.split()) == 350


def test_generate_text_skips_llm_without_verified_knowledge(db_session, monkeypatch):
    item = Item(name="Chuông văn miếu", description="Chuông văn miếu", group_id=1)
    db_session.add(item)
    db_session.commit()

    generator = Mock()
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: generator,
    )
    monkeypatch.setattr(
        "app.modules.content.service.build_verified_item_context",
        lambda **kwargs: ([], False),
    )

    text, source = ItemContentService().generate_text(item, "Mặc định", "Tiếng Việt")

    assert "chưa có đủ thông tin xác thực" in text.lower()
    assert source == "no_knowledge"
    generator.generate_answer.assert_not_called()


def test_get_valid_variant_requires_matching_hash(db_session):
    item = _add_item(db_session, description="Old")
    variant = ItemContentVariant(
        item_id=item.id,
        persona="Mặc định",
        language="Tiếng Việt",
        text_content="Stored text",
        content_hash=compute_content_hash("Old"),
        status="ready",
        source="pregenerated",
    )
    db_session.add(variant)
    db_session.commit()

    item.description = "New"
    db_session.commit()

    service = ItemContentService()
    assert service.get_valid_variant(db_session, item, "Mặc định", "Tiếng Việt") is None


def test_upsert_variant_persists_audio_blob(db_session):
    item = _add_item(db_session)
    service = ItemContentService()
    service.upsert_variant(
        db_session,
        item=item,
        persona="Mặc định",
        language="Tiếng Việt",
        text_content="Hello",
        audio_data=b"fake-mp3",
        audio_mime=build_audio_mime(),
        source="generated",
    )

    variant = service.get_valid_variant(db_session, item, "Mặc định", "Tiếng Việt")
    assert variant is not None
    assert variant.text_content == "Hello"
    assert variant.audio_data == b"fake-mp3"


def test_upsert_variant_updates_existing_row(db_session):
    item = _add_item(db_session)
    service = ItemContentService()
    service.upsert_variant(
        db_session,
        item=item,
        persona="Mặc định",
        language="Tiếng Việt",
        text_content="First",
        audio_data=b"a",
        audio_mime=build_audio_mime(),
        source="generated",
    )
    result = service.upsert_variant(
        db_session,
        item=item,
        persona="Mặc định",
        language="Tiếng Việt",
        text_content="Second",
        audio_data=b"b",
        audio_mime=build_audio_mime(),
        source="manual",
    )

    assert result.text_content == "Second"
    assert result.audio_data == b"b"
    assert (
        db_session.query(ItemContentVariant)
        .filter(ItemContentVariant.item_id == item.id)
        .count()
        == 1
    )


def test_get_item_content_returns_stored_variant(client, db_session):
    item = _add_item(db_session)
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Stored story",
            audio_data=b"audio-bytes",
            audio_mime=build_audio_mime(),
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="pregenerated",
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/objects/{item.id}/content",
        params={"persona": "Mặc định", "language": "Tiếng Việt"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["content"] == "Stored story"
    assert payload["stored"] is True
    assert payload["has_audio"] is True
    assert payload["audio_url"].startswith(f"/api/objects/{item.id}/content/audio")


def test_get_or_generate_repairs_stored_variant_without_audio(
    db_session,
    monkeypatch,
):
    item = _add_item(db_session)
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Stored LLM story",
            audio_data=None,
            audio_mime=None,
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="generated",
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language, persona=None: _tts_ok(b"repaired-audio", "audio/mpeg"),
    )
    service = ItemContentService()

    result = service.get_or_generate(
        db_session,
        item,
        "Mặc định",
        "Tiếng Việt",
    )

    assert result.stored is True
    assert result.has_audio is False
    assert result.audio_url is None

    variant = service.ensure_audio(
        db_session,
        item,
        "Mặc định",
        "Tiếng Việt",
    )
    assert variant is not None
    assert variant.audio_data == b"repaired-audio"
    assert variant.audio_mime == build_audio_mime()


def test_get_item_content_generates_when_missing(client, db_session, monkeypatch):
    item = _add_item(db_session)

    fake_service = Mock()
    generated = ItemContentResult(
        item_id=item.id,
        persona="Mặc định",
        language="Tiếng Việt",
        content="Generated story",
        has_audio=True,
        audio_url=f"/api/objects/{item.id}/content/audio?persona=M%E1%BA%B7c+%C4%91%E1%BB%8Bnh&language=Ti%E1%BA%BFng+Vi%E1%BB%87t&v=abc",
        stored=False,
        source="generated",
    )
    fake_service.get_or_generate.return_value = generated
    monkeypatch.setattr(content_router, "get_item_content_service", lambda: fake_service)

    response = client.get(f"/api/objects/{item.id}/content")

    assert response.status_code == 200
    assert response.json()["stored"] is False
    fake_service.get_or_generate.assert_called_once()
    fake_service.finalize_with_audio.assert_not_called()


def test_get_item_content_defers_tts_until_audio_endpoint_is_requested(
    client,
    db_session,
    monkeypatch,
):
    item = _add_item(db_session)
    fake_service = Mock()
    fake_service.get_or_generate.return_value = ItemContentResult(
        item_id=item.id,
        persona="Mặc định",
        language="Tiếng Việt",
        content="Generated story",
        has_audio=False,
        audio_url=None,
        stored=False,
        source="generated",
    )
    background_tts_calls = []
    monkeypatch.setattr(content_router, "get_item_content_service", lambda: fake_service)
    monkeypatch.setattr(
        content_router,
        "_ensure_audio_task",
        lambda *args: background_tts_calls.append(args),
    )

    response = client.get(f"/api/objects/{item.id}/content")

    assert response.status_code == 200
    assert response.json()["has_audio"] is False
    assert response.json()["audio_url"] is not None
    assert background_tts_calls == []


def test_get_item_content_audio_generates_when_missing(client, db_session, monkeypatch):
    item = _add_item(db_session)
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Stored story",
            audio_data=None,
            audio_mime=None,
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="generated",
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language, persona=None: _tts_ok(b"generated-audio", "audio/mpeg"),
    )

    response = client.get(
        f"/api/objects/{item.id}/content/audio",
        params={"persona": "Mặc định", "language": "Tiếng Việt"},
    )

    assert response.status_code == 200
    assert response.content == b"generated-audio"


def test_ensure_audio_ignores_empty_tts_result(db_session, monkeypatch):
    item = _add_item(db_session)
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona=DEFAULT_PERSONA,
            language=DEFAULT_LANGUAGE,
            text_content="Stored story",
            audio_data=None,
            audio_mime=None,
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="generated",
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language, persona=None: _tts_ok(b"", "audio/mpeg"),
    )

    variant = ItemContentService().ensure_audio(
        db_session,
        item,
        DEFAULT_PERSONA,
        DEFAULT_LANGUAGE,
    )

    assert variant is not None
    assert variant.audio_data is None
    assert variant.audio_mime is None


def test_get_item_content_audio_streams_blob(client, db_session):
    item = _add_item(db_session)
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Stored story",
            audio_data=b"audio-bytes",
            audio_mime=build_audio_mime(),
            content_hash=compute_content_hash(item.description),
            status="ready",
            source="pregenerated",
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/objects/{item.id}/content/audio",
        params={"persona": "Mặc định", "language": "Tiếng Việt"},
    )

    assert response.status_code == 200
    assert response.content == b"audio-bytes"
    assert response.headers["content-type"].startswith("audio/mpeg")


def test_update_item_content_persists_text_and_audio(client, db_session, monkeypatch):
    item = _add_item(db_session)

    fake_audio = _tts_ok(b"new-audio", "audio/mpeg")
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language: fake_audio,
    )

    response = client.put(
        f"/api/objects/{item.id}/content",
        json={
            "content": "Mô tả đã chỉnh sửa thủ công",
            "persona": "Mặc định",
            "language": "Tiếng Việt",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["content"] == "Mô tả đã chỉnh sửa thủ công"
    assert payload["has_audio"] is True
    assert payload["audio_url"] is not None
    assert "v=" in payload["audio_url"]
    assert payload["source"] == "manual"

    variant = (
        db_session.query(ItemContentVariant)
        .filter(ItemContentVariant.item_id == item.id)
        .one()
    )
    assert variant.text_content == "Mô tả đã chỉnh sửa thủ công"
    assert variant.source == "manual"


def test_update_item_content_rejects_empty(client, db_session):
    item = _add_item(db_session)

    response = client.put(
        f"/api/objects/{item.id}/content",
        json={"content": "   "},
    )

    assert response.status_code == 400


def test_update_item_content_rejects_non_default_variant(client, db_session):
    item = _add_item(db_session)

    response = client.put(
        f"/api/objects/{item.id}/content",
        json={
            "content": "Không được sửa persona này",
            "persona": "Gen Z Explorer",
            "language": "Tiếng Việt",
        },
    )

    assert response.status_code == 403


def test_update_item_content_regenerates_other_variants(
    client, db_session, monkeypatch
):
    item = _add_item(db_session)
    captured: list[str] = []

    def fake_regenerate(_db, _item, base_content):
        captured.append(base_content)

    monkeypatch.setattr(
        "app.modules.content.router._regenerate_other_variants_task",
        lambda item_id, base_content: captured.append(base_content),
    )
    monkeypatch.setattr(
        "app.modules.content.service.synthesize_speech",
        lambda text, language, persona=None: _tts_ok(b"audio", "audio/mpeg"),
    )

    response = client.put(
        f"/api/objects/{item.id}/content",
        json={"content": "Mô tả mới [Trang 1]"},
    )

    assert response.status_code == 200
    assert response.json()["content"] == "Mô tả mới"
    assert captured == ["Mô tả mới"]


def test_generate_item_content_draft(client, db_session, monkeypatch):
    item = _add_item(db_session)

    monkeypatch.setattr(
        "app.modules.content.service.try_get_rag_retriever",
        lambda: None,
    )
    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: Mock(
            generate_answer=Mock(return_value="Draft story [Trang 1]")
        ),
    )

    response = client.post(
        f"/api/objects/{item.id}/content/draft",
        json={"persona": "Mặc định", "language": "Tiếng Việt"},
    )

    assert response.status_code == 200
    assert response.json()["content"] == "Draft story"
    from app.modules.content.service import get_item_content_service

    variant = get_item_content_service().get_valid_variant(
        db_session, item, "Mặc định", "Tiếng Việt"
    )
    assert variant is None
