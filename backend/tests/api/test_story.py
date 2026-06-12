from app.models.item import Item
from app.modules.llm import story_router
from app.modules.llm import client as llm_client


class FakeGenerator:
    def generate_answer(
        self,
        *,
        query,
        retrieved_docs,
        persona,
        language,
    ):
        assert retrieved_docs[0].page_content == "Primary description"
        return "Generated story [Trang item-1]"


def test_generate_uses_item_description_when_rag_is_unavailable(
    client,
    db_session,
    monkeypatch,
):
    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(story_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(
        story_router,
        "get_rag_generator",
        lambda: FakeGenerator(),
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
    class BrokenGenerator:
        def generate_answer(self, **kwargs):
            raise RuntimeError("provider details")

    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(story_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(
        story_router,
        "get_rag_generator",
        lambda: BrokenGenerator(),
    )

    response = client.post("/api/generate", json={"item_id": item.id})

    assert response.status_code == 502
    assert response.json()["detail"] == "Không thể sinh nội dung lúc này"


def test_generate_returns_503_when_llm_provider_is_unavailable(
    client,
    db_session,
    monkeypatch,
):
    class UnavailableGenerator:
        def generate_answer(self, **kwargs):
            error_type = getattr(
                llm_client,
                "LLMServiceUnavailableError",
                RuntimeError,
            )
            raise error_type("provider overloaded")

    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(story_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(
        story_router,
        "get_rag_generator",
        lambda: UnavailableGenerator(),
    )

    response = client.post("/api/generate", json={"item_id": item.id})

    assert response.status_code == 503
    assert response.json()["detail"] == "Dịch vụ AI tạm thời không khả dụng"
