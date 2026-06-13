from app.models.item import Item
from app.modules.llm import story_router
from app.modules.llm import client as llm_client
from app.modules.content.service import ItemContentResult


class FakeContentService:
    def get_or_generate(self, db, item, persona, language):
        return ItemContentResult(
            item_id=item.id,
            persona=persona,
            language=language,
            content="Generated story [Trang item-1]",
            has_audio=False,
            audio_url=None,
            stored=True,
            source="generated",
        )


def test_generate_uses_item_description_when_rag_is_unavailable(
    client,
    db_session,
    monkeypatch,
):
    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(
        story_router,
        "get_item_content_service",
        lambda: FakeContentService(),
    )

    response = client.post(
        "/api/generate",
        json={
            "item_id": item.id,
            "persona": "Mặc định",
            "language": "Tiếng Việt",
        },
    )

    assert response.status_code == 200
    assert response.json()["content"] == "Generated story [Trang item-1]"


def test_generate_returns_404_for_missing_item(client):
    response = client.post("/api/generate", json={"item_id": 999999})

    assert response.status_code == 404


def test_generate_returns_stable_error_when_llm_fails(
    client,
    db_session,
    monkeypatch,
):
    class BrokenService:
        def get_or_generate(self, db, item, persona, language):
            raise RuntimeError("provider details")

    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(story_router, "get_item_content_service", lambda: BrokenService())

    response = client.post("/api/generate", json={"item_id": item.id})

    assert response.status_code == 502
    assert response.json()["detail"] == "Không thể sinh nội dung lúc này"


def test_generate_returns_503_when_llm_provider_is_unavailable(
    client,
    db_session,
    monkeypatch,
):
    class UnavailableService:
        def get_or_generate(self, db, item, persona, language):
            raise llm_client.LLMServiceUnavailableError("provider overloaded")

    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(
        story_router,
        "get_item_content_service",
        lambda: UnavailableService(),
    )

    response = client.post("/api/generate", json={"item_id": item.id})

    assert response.status_code == 503
    assert response.json()["detail"] == "Dịch vụ AI tạm thời không khả dụng"
