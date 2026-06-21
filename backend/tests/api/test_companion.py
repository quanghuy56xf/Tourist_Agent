from langchain_core.documents import Document

from app.models.item import Item
from app.modules.llm import chat_router


class FakeCompanionGenerator:
    def generate_companion_chat(self, **kwargs):
        assert kwargs["current_item"] == "Khuê Văn Các"
        assert kwargs["visited_items"] == ["Cổng chính", "Khuê Văn Các"]
        assert kwargs["retrieved_docs"][0].page_content == "Primary description"
        return "Ta nhớ bạn đã ghé Cổng chính."


def test_companion_chat_resolves_visited_items_in_current_group(
    client,
    db_session,
    monkeypatch,
):
    current = Item(name="Khuê Văn Các", description="Primary description", group_id=1)
    visited = Item(name="Cổng chính", description="Gate", group_id=1)
    other_group = Item(name="Không được lộ", description="Other", group_id=2)
    db_session.add_all([current, visited, other_group])
    db_session.commit()

    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(
        chat_router,
        "build_chat_item_context",
        lambda **kwargs: ([Document(page_content="Primary description")], True),
    )
    monkeypatch.setattr(chat_router, "get_rag_generator", lambda: FakeCompanionGenerator())

    response = client.post(
        "/api/companion/chat",
        json={
            "item_id": current.id,
            "message": "Ta vừa đi qua đâu?",
            "history": [],
            "visited_item_ids": [visited.id, current.id, other_group.id],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "content": "Ta nhớ bạn đã ghé Cổng chính.",
        "next_item_id": None,
    }


def test_companion_chat_rejects_empty_message(client):
    response = client.post(
        "/api/companion/chat",
        json={
            "item_id": 1,
            "message": "",
            "history": [],
            "visited_item_ids": [],
        },
    )

    assert response.status_code == 422


def test_companion_can_suggest_next_unvisited_item(client, db_session, monkeypatch):
    current = Item(name="Cổng chính", description="Gate", group_id=1)
    visited = Item(name="Khuê Văn Các", description="Visited", group_id=1)
    class SuggestionGenerator:
        def generate_companion_chat(self, **kwargs):
            return "Ta đề nghị bạn ghé Đại Trung Môn."

    next_item = Item(name="Đại Trung Môn", description="Next", group_id=1)
    db_session.add_all([current, visited, next_item])
    db_session.commit()

    monkeypatch.setattr(
        chat_router,
        "build_chat_item_context",
        lambda **kwargs: ([Document(page_content="Verified")], True),
    )
    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(chat_router, "get_rag_generator", lambda: SuggestionGenerator())

    response = client.post(
        "/api/companion/chat",
        json={
            "item_id": current.id,
            "message": "Gợi ý điểm tiếp theo",
            "history": [],
            "visited_item_ids": [current.id, visited.id],
            "suggest_next": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["next_item_id"] == next_item.id
