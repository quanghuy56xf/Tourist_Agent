from datetime import datetime, timedelta

from app.models.group import Group
from app.models.stt_usage_log import SttUsageLog


def test_stt_cost_summary_aggregates_by_day_and_session(client, db_session):
    group = Group(name="Văn Miếu")
    db_session.add(group)
    db_session.flush()

    now = datetime.utcnow()
    rows = [
        SttUsageLog(
            session_id="sess-1",
            group_id=group.id,
            provider="gemini",
            model="gemini-2.5-flash-lite",
            mime_type="audio/webm",
            audio_bytes=1000,
            input_tokens=100,
            output_tokens=10,
            total_tokens=110,
            token_source="gemini",
            input_price_per_1m=0.10,
            output_price_per_1m=0.40,
            cost_usd=0.000014,
            success=1,
            duration_ms=120,
            created_at=now - timedelta(days=1),
        ),
        SttUsageLog(
            session_id="sess-1",
            group_id=group.id,
            provider="gemini",
            model="gemini-2.5-flash-lite",
            mime_type="audio/webm",
            audio_bytes=900,
            input_tokens=80,
            output_tokens=8,
            total_tokens=88,
            token_source="gemini",
            input_price_per_1m=0.10,
            output_price_per_1m=0.40,
            cost_usd=0.000011,
            success=0,
            error_detail="temporary error",
            duration_ms=80,
            created_at=now - timedelta(days=1, minutes=5),
        ),
        SttUsageLog(
            session_id="sess-2",
            group_id=group.id,
            provider="gemini",
            model="gemini-2.5-flash-lite",
            mime_type="audio/mp4",
            audio_bytes=800,
            input_tokens=50,
            output_tokens=5,
            total_tokens=55,
            token_source="gemini",
            input_price_per_1m=0.10,
            output_price_per_1m=0.40,
            cost_usd=0.000007,
            success=1,
            duration_ms=60,
            created_at=now,
        ),
    ]
    db_session.add_all(rows)
    db_session.commit()

    response = client.get(f"/api/analytics/stt-cost/summary?days=7&group_id={group.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["total_requests"] == 3
    assert data["success_count"] == 2
    assert data["error_count"] == 1
    assert data["total_input_tokens"] == 230
    assert data["total_output_tokens"] == 23
    assert data["total_tokens"] == 253
    assert data["total_cost_usd"] == 0.000032
    assert len(data["daily"]) == 2

    sess_1 = next(row for row in data["sessions"] if row["session_id"] == "sess-1")
    assert sess_1["group_name"] == "Văn Miếu"
    assert sess_1["request_count"] == 2
    assert sess_1["success_count"] == 1
    assert sess_1["error_count"] == 1
    assert sess_1["total_tokens"] == 198
    assert sess_1["cost_usd"] == 0.000025
