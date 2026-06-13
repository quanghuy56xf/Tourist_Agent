from unittest.mock import Mock

import pytest

from app.models.content_variant import ItemContentVariant
from app.models.item import Item
from app.modules.content import router as content_router
from app.modules.content.service import (
    ItemContentResult,
    ItemContentService,
    compute_content_hash,
)


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
        audio_mime="audio/mpeg",
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
        audio_mime="audio/mpeg",
        source="generated",
    )
    result = service.upsert_variant(
        db_session,
        item=item,
        persona="Mặc định",
        language="Tiếng Việt",
        text_content="Second",
        audio_data=b"b",
        audio_mime="audio/mpeg",
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
            audio_mime="audio/mpeg",
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


def test_get_item_content_generates_when_missing(client, db_session, monkeypatch):
    item = _add_item(db_session)

    fake_service = Mock()
    fake_service.get_or_generate.return_value = ItemContentResult(
        item_id=item.id,
        persona="Mặc định",
        language="Tiếng Việt",
        content="Generated story",
        has_audio=True,
        audio_url=f"/api/objects/{item.id}/content/audio?persona=M%E1%BA%B7c+%C4%91%E1%BB%8Bnh&language=Ti%E1%BA%BFng+Vi%E1%BB%87t",
        stored=False,
        source="generated",
    )
    monkeypatch.setattr(content_router, "get_item_content_service", lambda: fake_service)

    response = client.get(f"/api/objects/{item.id}/content")

    assert response.status_code == 200
    assert response.json()["stored"] is False
    fake_service.get_or_generate.assert_called_once()


def test_get_item_content_audio_streams_blob(client, db_session):
    item = _add_item(db_session)
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Stored story",
            audio_data=b"audio-bytes",
            audio_mime="audio/mpeg",
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

    fake_audio = (b"new-audio", "audio/mpeg")
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
    assert payload["source"] == "manual"

    variant = (
        db_session.query(ItemContentVariant)
        .filter(ItemContentVariant.item_id == item.id)
        .one()
    )
    assert variant.text_content == "Mô tả đã chỉnh sửa thủ công"
    assert variant.audio_data == b"new-audio"
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
        lambda text, language: (b"audio", "audio/mpeg"),
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
