from pathlib import Path

from langchain_core.documents import Document

from app.models.item import Item
from app.modules.rag.evaluation import (
    RagEvalCase,
    evaluate_cases,
    load_eval_cases,
    report_to_dict,
)
from app.modules.rag.tracing import RagTraceContext


def test_evaluate_cases_computes_retrieval_metrics(db_session):
    item = Item(name="Bình gốm", description="Hiện vật gốm", group_id=1)
    db_session.add(item)
    db_session.commit()

    def fake_builder(db, item, message, conversation_id=None, top_k=4):
        if "không có" in message:
            return [], False, RagTraceContext(
                retrieval_query=message,
                top_k=top_k,
                confidence_score=0.2,
            )
        return [
            Document(
                page_content="Bình gốm thuộc triều Nguyễn.",
                metadata={"source": "group_doc", "document_id": 12},
            )
        ], True, RagTraceContext(
            retrieval_query=message,
            top_k=top_k,
            confidence_score=0.82,
        )

    report = evaluate_cases(
        db_session,
        [
            RagEvalCase(
                question="Hiện vật này có từ thời nào?",
                item_id=item.id,
                expected_document_ids=[12],
                expected_terms=["triều Nguyễn"],
            ),
            RagEvalCase(
                question="không có thông tin gì?",
                item_id=item.id,
                expect_no_data=True,
            ),
        ],
        context_builder=fake_builder,
    )

    assert report.total == 2
    assert report.hit_at_k == 1.0
    assert report.expected_document_hit_rate == 1.0
    assert report.expected_terms_hit_rate == 1.0
    assert report.no_data_accuracy == 1.0
    assert report.low_confidence_rate == 0.5


def test_load_eval_cases_reads_jsonl():
    dataset = Path(__file__).with_name("rag_eval_sample.jsonl")

    cases = load_eval_cases(dataset)

    assert cases == [
        RagEvalCase(
            question="Q",
            item_id=1,
            group_id=2,
            expected_document_ids=[3],
            expected_terms=["A"],
            expect_no_data=False,
        )
    ]


def test_report_to_dict_can_omit_case_details(db_session):
    item = Item(name="Bình gốm", description="Hiện vật gốm", group_id=1)
    db_session.add(item)
    db_session.commit()

    def fake_builder(db, item, message, conversation_id=None, top_k=4):
        return [], False, RagTraceContext(
            retrieval_query=message,
            top_k=top_k,
            confidence_score=0.2,
        )

    report = evaluate_cases(
        db_session,
        [RagEvalCase(question="Không có?", item_id=item.id, expect_no_data=True)],
        context_builder=fake_builder,
    )

    assert report_to_dict(report) == {
        "total": 1,
        "hit_at_k": 1.0,
        "expected_document_hit_rate": 1.0,
        "expected_terms_hit_rate": 1.0,
        "no_data_accuracy": 1.0,
        "low_confidence_rate": 1.0,
    }
    assert report_to_dict(report, include_results=True)["results"][0]["question"] == "Không có?"


def test_evaluate_cases_marks_expected_term_miss(db_session):
    item = Item(name="Bình gốm", description="Hiện vật gốm", group_id=1)
    db_session.add(item)
    db_session.commit()

    def fake_builder(db, item, message, conversation_id=None, top_k=4):
        return [Document(page_content="Không nhắc niên đại", metadata={})], True, RagTraceContext(
            retrieval_query=message,
            top_k=top_k,
            confidence_score=0.9,
        )

    report = evaluate_cases(
        db_session,
        [
            RagEvalCase(
                question="Hiện vật này có từ thời nào?",
                item_id=item.id,
                expected_terms=["triều Nguyễn"],
            )
        ],
        context_builder=fake_builder,
    )

    assert report.hit_at_k == 0.0
    assert report.expected_terms_hit_rate == 0.0
