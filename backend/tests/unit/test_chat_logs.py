from app.modules.analytics.chat_logs import (
    compute_cost_usd,
    record_chat_turn,
    resolve_conversation_id,
)
from app.modules.llm.client import TokenUsage, estimate_token_usage, extract_token_usage


class FakeUsageResponse:
    def __init__(self, metadata: dict):
        self.response_metadata = metadata


def test_resolve_conversation_id_prefers_search_session():
    assert (
        resolve_conversation_id(
            session_id="sess-1",
            search_session_id="search-9",
            item_id=3,
            chat_mode="item",
        )
        == "search-9"
    )


def test_extract_token_usage_from_provider_metadata():
    response = FakeUsageResponse(
        {
            "usage_metadata": {
                "prompt_token_count": 120,
                "candidates_token_count": 45,
            }
        }
    )
    usage = extract_token_usage(response)
    assert usage.prompt_tokens == 120
    assert usage.prompt_cache_miss_tokens == 120
    assert usage.completion_tokens == 45
    assert usage.token_source == "provider"


def test_extract_token_usage_deepseek_cache_split():
    response = FakeUsageResponse(
        {
            "token_usage": {
                "prompt_tokens": 1000,
                "prompt_cache_hit_tokens": 800,
                "prompt_cache_miss_tokens": 200,
                "completion_tokens": 120,
            }
        }
    )
    usage = extract_token_usage(response)
    assert usage.prompt_cache_hit_tokens == 800
    assert usage.prompt_cache_miss_tokens == 200
    assert usage.prompt_tokens == 1000
    assert usage.completion_tokens == 120
    assert usage.token_source == "provider"


def test_compute_cost_usd_three_tier():
    cost = compute_cost_usd(
        prompt_cache_hit_tokens=800_000,
        prompt_cache_miss_tokens=200_000,
        completion_tokens=100_000,
        input_cache_hit_price_per_1m=0.014,
        input_cache_miss_price_per_1m=0.27,
        output_price_per_1m=1.10,
    )
    assert cost == round(0.0112 + 0.054 + 0.11, 6)


def test_estimate_token_usage_counts_as_cache_miss():
    usage = estimate_token_usage(prompt_text="hello world", completion_text="answer")
    assert usage.prompt_cache_hit_tokens == 0
    assert usage.prompt_cache_miss_tokens == usage.prompt_tokens
    assert usage.token_source == "estimated"


def test_record_chat_turn_persists_cost(db_session):
    row = record_chat_turn(
        db_session,
        conversation_id="conv-1",
        chat_mode="item",
        user_message="Xin chào",
        assistant_message="Chào bạn",
        group_id=None,
        item_id=None,
        session_id="sess-1",
        search_session_id="search-1",
        persona="Mặc định",
        language="Tiếng Việt",
        success=True,
        error_detail=None,
        duration_ms=120,
        token_usage=TokenUsage.from_parts(
            prompt_cache_hit_tokens=30,
            prompt_cache_miss_tokens=70,
            completion_tokens=50,
            token_source="estimated",
        ),
    )
    assert row is not None
    assert row.turn_code == f"CHAT-{row.id}"
    assert row.prompt_cache_hit_tokens == 30
    assert row.prompt_cache_miss_tokens == 70
    assert row.cost_usd > 0
