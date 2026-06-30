from app.models.item import Item
from app.modules.llm import chat_router


class FakeGenerator:
    def __init__(self):
        self.last_token_usage = None

    def generate_chat(self, **kwargs):
        return "Chat answer for analytics"


def test_chat_creates_turn_log(client, db_session, monkeypatch):
    item = Item(name="Test item", description="Primary description")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(chat_router, "get_rag_generator", lambda: FakeGenerator())

    response = client.post(
        "/api/chat",
        json={
            "item_id": item.id,
            "message": "Đây là gì?",
            "history": [],
            "session_id": "sess-analytics",
            "search_session_id": "search-analytics",
        },
    )

    assert response.status_code == 200

    logs = client.get("/api/analytics/chat-logs?days=30")
    assert logs.status_code == 200
    payload = logs.json()
    assert payload["total"] >= 1
    assert payload["items"][0]["user_message"] == "Đây là gì?"
    assert payload["items"][0]["assistant_message"] == "Chat answer for analytics"
    assert payload["items"][0]["turn_code"].startswith("CHAT-")


def test_llm_pricing_can_be_updated(client):
    read = client.get("/api/analytics/llm-pricing")
    assert read.status_code == 200

    save = client.put(
        "/api/analytics/llm-pricing",
        json={
            "input_cache_hit_price_per_1m": 0.014,
            "input_cache_miss_price_per_1m": 0.05,
            "output_price_per_1m": 0.15,
        },
    )
    assert save.status_code == 200
    body = save.json()
    assert body["input_cache_hit_price_per_1m"] == 0.014
    assert body["input_cache_miss_price_per_1m"] == 0.05
    assert body["output_price_per_1m"] == 0.15


def test_chat_logs_export_csv(client, db_session, monkeypatch):
    item = Item(name="CSV item", description="desc")
    db_session.add(item)
    db_session.commit()

    monkeypatch.setattr(chat_router, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(chat_router, "get_rag_generator", lambda: FakeGenerator())

    client.post(
        "/api/chat",
        json={"item_id": item.id, "message": "Export test?", "history": []},
    )

    response = client.get("/api/analytics/chat-logs/export.csv?days=30")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "turn_code" in response.text
    assert "Export test?" in response.text
