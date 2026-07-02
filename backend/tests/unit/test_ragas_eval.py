import sys
import types
from pathlib import Path

from app.modules.rag.ragas_eval import (
    _default_ragas_evaluator,
    RagasCaseRun,
    RagasGoldenReport,
    render_ragas_markdown,
    report_to_dict,
    run_ragas_golden_eval,
)


def test_run_ragas_golden_eval_uses_injected_evaluator(db_session, tmp_path, monkeypatch):
    dataset = tmp_path / "golden.jsonl"
    dataset.write_text(
        '{"scope":"item","question":"Q","item_id":1,"group_id":1,"ground_truth":"A"}\n',
        encoding="utf-8",
    )

    class ItemRow:
        id = 1
        name = "Item"
        description = "Description"
        group_id = 1

    class Query:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return ItemRow()

    monkeypatch.setattr(db_session, "query", lambda *_args, **_kwargs: Query())

    from langchain_core.documents import Document
    from app.modules.rag.tracing import RagTraceContext
    from app.modules.rag import ragas_eval

    monkeypatch.setattr(ragas_eval, "try_get_rag_retriever", lambda: None)
    monkeypatch.setattr(
        ragas_eval,
        "build_chat_item_context_with_trace",
        lambda **_kwargs: (
            [Document(page_content="Context A", metadata={})],
            True,
            RagTraceContext(retrieval_query="Q", top_k=8, confidence_score=0.9),
        ),
    )

    class Generator:
        def generate_chat(self, **_kwargs):
            return "A"

    monkeypatch.setattr(ragas_eval, "get_rag_generator", lambda: Generator())

    def evaluator(rows, metrics):
        assert rows[0]["question"] == "Q"
        return {metric: 0.9 for metric in metrics}

    report = run_ragas_golden_eval(db_session, dataset, evaluator=evaluator)

    assert report.total_cases == 1
    assert report.attempted_cases == 1
    assert report.metrics["faithfulness"] == 0.9
    assert all(report.gate_results.values())


def test_run_ragas_golden_eval_supports_corpus_scope(tmp_path, monkeypatch):
    dataset = tmp_path / "golden.jsonl"
    dataset.write_text(
        '{"scope":"corpus","question":"Q","group_id":2,"ground_truth":"A"}\n',
        encoding="utf-8",
    )

    from langchain_core.documents import Document
    from app.modules.rag.tracing import RetrievalTrace
    from app.modules.rag import ragas_eval

    class Retriever:
        def retrieve_with_trace(self, query, top_k=8, group_id=None):
            assert query == "Q"
            assert group_id == 2
            trace = RetrievalTrace(retrieval_query=query, top_k=top_k, dense_max_score=0.9)
            return [Document(page_content="Context A", metadata={"source": "group_doc"})], trace

    class Generator:
        def generate_answer(self, **_kwargs):
            return "A"

    monkeypatch.setattr(ragas_eval, "try_get_rag_retriever", lambda: Retriever())
    monkeypatch.setattr(ragas_eval, "get_rag_generator", lambda: Generator())

    def evaluator(rows, metrics):
        assert rows[0]["question"] == "Q"
        assert rows[0]["contexts"] == ["Context A"]
        return {metric: 0.9 for metric in metrics}

    report = run_ragas_golden_eval(None, dataset, evaluator=evaluator)

    assert report.total_cases == 1
    assert report.attempted_cases == 1
    assert report.case_runs[0].scope == "corpus"
    assert report.case_runs[0].item_id is None
    assert report.metrics["faithfulness"] == 0.9


def test_report_to_dict_counts_trustworthy_questions_from_case_scores():
    report = RagasGoldenReport(
        dataset_path="golden.jsonl",
        generated_at="2026-07-01T00:00:00Z",
        total_cases=3,
        attempted_cases=3,
        errored_cases=0,
        metrics={"faithfulness": 0.9, "answer_relevancy": 0.86},
        gate_results={"faithfulness": True, "answer_relevancy": True},
        case_scores=[
            {"case_index": 0, "scores": {"faithfulness": 0.90, "answer_relevancy": 0.90}},
            {"case_index": 1, "scores": {"faithfulness": 0.84, "answer_relevancy": 0.95}},
            {"case_index": 2, "scores": {"faithfulness": 0.91, "answer_relevancy": 0.79}},
        ],
    )

    payload = report_to_dict(report)

    assert payload["passed_questions"] == 1
    assert payload["total_questions"] == 3
    assert payload["trustworthy_answer_rate"] == 0.3333


def test_report_to_dict_falls_back_to_global_gate_without_case_scores():
    report = RagasGoldenReport(
        dataset_path="golden.jsonl",
        generated_at="2026-07-01T00:00:00Z",
        total_cases=100,
        attempted_cases=0,
        errored_cases=0,
        metrics={"faithfulness": None},
        gate_results={"faithfulness": None},
        case_runs=[
            RagasCaseRun(
                question="Q",
                item_id=1,
                group_id=1,
                answer="",
                contexts=[],
                ground_truth="A",
                has_verified_knowledge=False,
                confidence_score=0.0,
                fallback_used=True,
            )
        ],
        notes=["ragas_evaluation_failed:RuntimeError"],
    )

    markdown = render_ragas_markdown(report)

    assert "not run" in markdown
    assert "NO-GO" in markdown
    assert "ragas_evaluation_failed" in markdown
    assert report_to_dict(report, include_cases=True)["cases"][0]["question"] == "Q"


def test_default_ragas_evaluator_uses_async_api(monkeypatch):
    calls = []

    class Dataset:
        @classmethod
        def from_list(cls, rows):
            calls.append(("dataset", rows))
            return rows

    class MeanResult:
        def to_dict(self):
            return {"faithfulness": 0.91}

    class PandasResult:
        def mean(self, numeric_only=True):
            calls.append(("mean", numeric_only))
            return MeanResult()

    class RagasResult:
        def to_pandas(self):
            return PandasResult()

    async def aevaluate(dataset, metrics):
        calls.append(("aevaluate", dataset, metrics))
        return RagasResult()

    datasets_module = types.SimpleNamespace(Dataset=Dataset)
    metrics_module = types.SimpleNamespace(
        faithfulness="faithfulness_metric",
        answer_relevancy="answer_relevancy_metric",
        context_recall="context_recall_metric",
        context_precision="context_precision_metric",
    )
    ragas_module = types.SimpleNamespace(aevaluate=aevaluate)
    monkeypatch.setitem(sys.modules, "datasets", datasets_module)
    monkeypatch.setitem(sys.modules, "ragas", ragas_module)
    monkeypatch.setitem(sys.modules, "ragas.metrics", metrics_module)

    scores = _default_ragas_evaluator(
        [{"question": "Q", "answer": "A", "contexts": ["C"], "ground_truth": "A"}],
        ["faithfulness"],
    )

    assert scores["faithfulness"] == 0.91
    assert "case_scores" not in scores
    assert calls[0][0] == "dataset"
    assert calls[1][0] == "aevaluate"


def test_run_ragas_golden_eval_normalizes_nan_scores(db_session, tmp_path, monkeypatch):
    dataset = tmp_path / "golden.jsonl"
    dataset.write_text(
        '{"scope":"corpus","question":"Q","group_id":2,"ground_truth":"A"}\n',
        encoding="utf-8",
    )

    from langchain_core.documents import Document
    from app.modules.rag import ragas_eval

    class Retriever:
        def retrieve(self, *_args, **_kwargs):
            return [Document(page_content="Context A", metadata={})]

    class Generator:
        def generate_answer(self, **_kwargs):
            return "A"

    monkeypatch.setattr(ragas_eval, "try_get_rag_retriever", lambda: Retriever())
    monkeypatch.setattr(ragas_eval, "get_rag_generator", lambda: Generator())

    report = run_ragas_golden_eval(
        db_session,
        dataset,
        evaluator=lambda _rows, metrics: {metric: float("nan") for metric in metrics},
    )

    assert report.metrics["faithfulness"] is None
    assert report.gate_results["faithfulness"] is None
    assert "ragas_metric_not_finite:faithfulness" in report.notes
