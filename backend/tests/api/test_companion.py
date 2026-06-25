from langchain_core.documents import Document

from app.models.item import Item
from app.modules.llm import chat_router


class FakeStreamingCompanionGenerator:
    async def generate_companion_chat_stream(self, **kwargs):
        yield "Xin ch?o."


async def fake_synthesize_speech_async(*args, **kwargs):
    return b"audio", "audio/mpeg"


class FakeCompanionGenerator:
    async def generate_companion_chat_stream(self, **kwargs):
        assert kwargs["current_item"] == "Khu? V?n C?c"
        assert kwargs["visited_items"] == ["C?ng ch?nh", "Khu? V?n C?c"]
        assert kwargs["retrieved_docs"][0].page_content == "Primary description"
        yield "Ta nh? b?n ?? gh? C?ng ch?nh."


def test_companion_chat_resolves_visited_items_in_current_group(
    client,
    db_session,
    monkeypatch,
):
    current = Item(name="Khu? V?n C?c", description="Primary description", group_id=1)
    visited = Item(name="C?ng ch?nh", description="Gate", group_id=1)
    other_group = Item(name="Kh?ng ???c l?", description="Other", group_id=2)
    db_session.add_all([current, visited, other_group])
    db_session.commit()

    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(
        chat_router,
        "build_chat_item_context",
        lambda **kwargs: ([Document(page_content="Primary description")], True),
    )
    monkeypatch.setattr(chat_router, "get_rag_generator", lambda: FakeCompanionGenerator())
    monkeypatch.setattr(
        chat_router,
        "_synthesize_speech_async",
        fake_synthesize_speech_async,
    )

    response = client.post(
        "/api/companion/chat/stream",
        json={
            "item_id": current.id,
            "message": "Ta v?a ?i qua ??u?",
            "history": [],
            "visited_item_ids": [visited.id, current.id, other_group.id],
        },
    )

    assert response.status_code == 200
    assert "event: chunk" in response.text
    assert "Ta nh? b?n ?? gh? C?ng ch?nh." in response.text
    assert "event: audio" in response.text
    assert "event: done" in response.text


def test_companion_chat_rejects_empty_message(client):
    response = client.post(
        "/api/companion/chat/stream",
        json={
            "item_id": 1,
            "message": "",
            "history": [],
            "visited_item_ids": [],
        },
    )

    assert response.status_code == 422


def test_companion_can_suggest_next_unvisited_item(client, db_session, monkeypatch):
    current = Item(name="C?ng ch?nh", description="Gate", group_id=1)
    visited = Item(name="Khu? V?n C?c", description="Visited", group_id=1)
    next_item = Item(name="??i Trung M?n", description="Next", group_id=1)
    db_session.add_all([current, visited, next_item])
    db_session.commit()

    class SuggestionGenerator:
        async def generate_companion_chat_stream(self, **kwargs):
            yield "Ta ?? ngh? b?n gh? ??i Trung M?n."

    monkeypatch.setattr(
        chat_router,
        "build_chat_item_context",
        lambda **kwargs: ([Document(page_content="Verified")], True),
    )
    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(chat_router, "get_rag_generator", lambda: SuggestionGenerator())
    monkeypatch.setattr(
        chat_router,
        "_synthesize_speech_async",
        fake_synthesize_speech_async,
    )

    response = client.post(
        "/api/companion/chat/stream",
        json={
            "item_id": current.id,
            "message": "G?i ? ?i?m ti?p theo",
            "history": [],
            "visited_item_ids": [current.id, visited.id],
            "suggest_next": True,
        },
    )

    assert response.status_code == 200
    assert "event: metadata" in response.text
    assert f'"next_item_id": {next_item.id}' in response.text
    assert "event: chunk" in response.text
    assert "event: audio" in response.text


def test_companion_stream_emits_open_camera_action_for_app_opened(
    client,
    monkeypatch,
):
    monkeypatch.setattr(
        chat_router,
        "get_rag_generator",
        lambda: FakeStreamingCompanionGenerator(),
    )
    monkeypatch.setattr(
        chat_router,
        "_synthesize_speech_async",
        fake_synthesize_speech_async,
    )

    response = client.post(
        "/api/companion/chat/stream",
        json={
            "message": "[SYSTEM_EVENT]: APP_OPENED",
            "history": [],
            "visited_item_ids": [],
        },
    )

    assert response.status_code == 200
    assert "event: actions" in response.text
    assert '"type": "open_camera"' in response.text


def test_companion_stream_emits_tour_completed_when_no_next_item(
    client,
    db_session,
    monkeypatch,
):
    only_item = Item(name="Khuê Văn Các", description="Primary", group_id=1)
    db_session.add(only_item)
    db_session.commit()

    monkeypatch.setattr(
        chat_router,
        "build_chat_item_context",
        lambda **kwargs: ([Document(page_content="Verified")], True),
    )
    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(
        chat_router,
        "get_rag_generator",
        lambda: FakeStreamingCompanionGenerator(),
    )
    monkeypatch.setattr(
        chat_router,
        "_synthesize_speech_async",
        fake_synthesize_speech_async,
    )

    response = client.post(
        "/api/companion/chat/stream",
        json={
            "item_id": only_item.id,
            "message": "Gợi ý điểm tiếp theo",
            "history": [],
            "visited_item_ids": [only_item.id],
            "suggest_next": True,
        },
    )

    assert response.status_code == 200
    assert "event: metadata" in response.text
    assert '"tour_completed": true' in response.text
    assert "event: actions" in response.text
    assert '"type": "restart_tour"' in response.text