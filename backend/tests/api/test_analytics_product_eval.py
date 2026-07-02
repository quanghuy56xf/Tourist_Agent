import json

from app.models.analytics_event import AnalyticsEvent
from app.modules.analytics.product_eval import _trustworthy_rate_from_report
from app.models.group import Group
from app.models.item import Item


def test_product_eval_report_summarizes_events(client, db_session):
    group = Group(name="Product Eval group")
    item = Item(name="Tượng Lê Quý Đôn", description="desc", group=group)
    db_session.add_all([group, item])
    db_session.commit()

    db_session.add_all(
        [
            AnalyticsEvent(
                event_type="search",
                group_id=group.id,
                item_id=item.id,
                session_id="sess-1",
                duration_ms=1200,
                success=1,
            ),
            AnalyticsEvent(
                event_type="story_first_meaningful_audio",
                group_id=group.id,
                item_id=item.id,
                session_id="sess-1",
                duration_ms=3200,
                success=1,
            ),
            AnalyticsEvent(
                event_type="story_completed",
                group_id=group.id,
                item_id=item.id,
                session_id="sess-1",
                duration_ms=6400,
                success=1,
            ),
            AnalyticsEvent(
                event_type="eval_feedback",
                group_id=group.id,
                item_id=item.id,
                session_id="sess-1",
                metadata_json=json.dumps(
                    {
                        "persona_score": 4,
                        "storytelling_score": 5,
                        "voice_naturalness_score": 4,
                        "replay_intent_score": 5,
                        "comment": "Hay",
                    },
                    ensure_ascii=False,
                ),
            ),
            AnalyticsEvent(
                event_type="quest_started",
                group_id=group.id,
                session_id="sess-1",
                metadata_json=json.dumps({"quest_id": "q1"}),
            ),
            AnalyticsEvent(
                event_type="quest_completed",
                group_id=group.id,
                session_id="sess-1",
                metadata_json=json.dumps({"quest_id": "q1"}),
            ),
            AnalyticsEvent(
                event_type="quiz_pre_submitted",
                group_id=group.id,
                session_id="sess-1",
                metadata_json=json.dumps({"quiz_id": "quiz", "score": 2, "max_score": 5}),
            ),
            AnalyticsEvent(
                event_type="quiz_post_submitted",
                group_id=group.id,
                session_id="sess-1",
                metadata_json=json.dumps({"quiz_id": "quiz", "score": 4, "max_score": 5}),
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/analytics/product-eval?days=30")

    assert response.status_code == 200
    payload = response.json()
    assert payload["time_to_first_story_p95_ms"] == 3200
    assert payload["p95_e2e_latency_ms"] == 6400
    assert payload["persona_storytelling_score"] == 4.5
    assert payload["voice_mos"] == 4.0
    assert payload["quest_completion_rate"] == 1.0
    assert payload["learning_gain_avg"] == 2.0
    assert payload["normalized_learning_gain_avg"] == 0.667
    assert payload["replay_intent_score"] == 5.0
    assert payload["recent_feedback"][0]["item_name"] == "Tượng Lê Quý Đôn"


def test_trustworthy_rate_prefers_case_scores_over_global_rate():
    report = {
        "trustworthy_answer_rate": 1.0,
        "passed_questions": 3,
        "total_questions": 3,
        "targets": {"faithfulness": 0.85, "answer_relevancy": 0.80},
        "case_scores": [
            {"scores": {"faithfulness": 0.90, "answer_relevancy": 0.90}},
            {"scores": {"faithfulness": 0.84, "answer_relevancy": 0.95}},
            {"scores": {"faithfulness": 0.91, "answer_relevancy": 0.79}},
        ],
    }

    assert _trustworthy_rate_from_report(report) == 0.3333


def test_eval_event_ingest_accepts_duration(client):
    response = client.post(
        "/api/analytics/events",
        json={
            "events": [
                {
                    "event_type": "story_first_meaningful_audio",
                    "session_id": "sess-duration",
                    "duration_ms": 1234,
                    "metadata": {"source": "test"},
                }
            ]
        },
    )

    assert response.status_code == 204
