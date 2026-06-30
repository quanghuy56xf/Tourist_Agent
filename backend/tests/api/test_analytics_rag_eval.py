import json
from dataclasses import dataclass, field

from app.models.group import Group
from app.models.item import Item
from app.models.rag_trace import RagTrace
from app.modules.analytics import rag_eval


@dataclass(frozen=True)
class FakeDocumentStatus:
    healthy: bool
    missing_chunk_ids: list[str] = field(default_factory=list)
    stale_chunk_ids: list[str] = field(default_factory=list)
    surplus_chunk_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class FakeIndexHealth:
    group_id: int
    document_count: int
    healthy: bool
    documents: list[FakeDocumentStatus]
    orphan_chunk_ids: list[str] = field(default_factory=list)


def test_rag_eval_report_summarizes_traces_and_index_health(client, db_session, monkeypatch):
    group = Group(name="RAG Eval group")
    item = Item(name="Bia tiến sĩ", description="desc", group=group)
    db_session.add_all([group, item])
    db_session.commit()

    db_session.add_all(
        [
            RagTrace(
                chat_turn_id=None,
                conversation_id="conv-a",
                group_id=group.id,
                item_id=item.id,
                query="Ai dựng bia?",
                retrieval_query="Ai dựng bia?",
                top_k=4,
                fallback_used=0,
                dense_max_score=0.72,
                retrieved_chunks_json=json.dumps([{"chunk_id": "a"}]),
                reranked_chunks_json=json.dumps([{"chunk_id": "a"}]),
                context_chunks_json=json.dumps({"chunks": [{"chunk_id": "a"}]}),
                has_verified_knowledge=1,
                confidence_score=0.82,
                latency_json=json.dumps({"retrieval_ms": 40, "generation_ms": 60}),
            ),
            RagTrace(
                chat_turn_id=None,
                conversation_id="conv-b",
                group_id=group.id,
                item_id=item.id,
                query="Có khủng long không?",
                retrieval_query="Có khủng long không?",
                top_k=4,
                fallback_used=1,
                fallback_reason="low_dense_score",
                dense_max_score=0.1,
                retrieved_chunks_json="[]",
                reranked_chunks_json="[]",
                context_chunks_json=json.dumps({"chunks": []}),
                has_verified_knowledge=0,
                confidence_score=0.2,
                latency_json=json.dumps({"total_ms": 20}),
            ),
        ]
    )
    db_session.commit()

    monkeypatch.setattr(
        rag_eval,
        "get_group_index_health",
        lambda db, group_id: FakeIndexHealth(
            group_id=group_id,
            document_count=2,
            healthy=False,
            documents=[
                FakeDocumentStatus(healthy=True),
                FakeDocumentStatus(
                    healthy=False,
                    missing_chunk_ids=["missing"],
                    stale_chunk_ids=["stale"],
                ),
            ],
            orphan_chunk_ids=["orphan"],
        ),
    )

    response = client.get("/api/analytics/rag-eval?days=30")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_traces"] == 2
    assert payload["avg_confidence_score"] == 0.51
    assert payload["low_confidence_count"] == 1
    assert payload["fallback_rate"] == 0.5
    assert payload["verified_knowledge_rate"] == 0.5
    assert payload["avg_latency_ms"] == 60.0
    assert payload["confidence_buckets"][0]["count"] == 1
    assert payload["confidence_buckets"][3]["count"] == 1
    assert payload["index_health"][0]["healthy"] is False
    assert payload["index_health"][0]["missing_chunk_count"] == 1
    assert payload["index_health"][0]["orphan_chunk_count"] == 1
    assert payload["recent_traces"][0]["fallback_used"] is True
    assert payload["recent_traces"][0]["context_count"] == 0
    assert payload["recent_traces"][1]["group_name"] == "RAG Eval group"
    assert payload["recent_traces"][1]["item_name"] == "Bia tiến sĩ"
