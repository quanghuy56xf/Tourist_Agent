from __future__ import annotations

import asyncio
import json
import math
import threading
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from langchain_core.documents import Document
from sqlalchemy.orm import Session

from app.models.item import Item
from app.modules.llm.generator import get_rag_generator
from app.modules.rag.evaluation import RagEvalCase, load_eval_cases
from app.modules.rag.retriever import try_get_rag_retriever
from app.modules.rag.security import apply_output_guardrails
from app.modules.rag.service import build_chat_item_context_with_trace, no_item_knowledge_message

RAGAS_TARGETS = {
    "faithfulness": 0.85,
    "answer_relevancy": 0.80,
    "context_recall": 0.75,
    "context_precision": 0.70,
}


@dataclass(frozen=True)
class RagasCaseRun:
    question: str
    item_id: int | None
    group_id: int | None
    answer: str
    contexts: list[str]
    ground_truth: str
    has_verified_knowledge: bool
    confidence_score: float
    fallback_used: bool
    scope: str = "item"
    retrieval_query: str | None = None
    fallback_reason: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class RagasGoldenReport:
    dataset_path: str
    generated_at: str
    total_cases: int
    attempted_cases: int
    errored_cases: int
    metrics: dict[str, float | None]
    targets: dict[str, float] = field(default_factory=lambda: dict(RAGAS_TARGETS))
    gate_results: dict[str, bool | None] = field(default_factory=dict)
    case_runs: list[RagasCaseRun] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


class RagasEvaluator(Protocol):
    def __call__(self, rows: list[dict[str, Any]], metrics: list[str]) -> dict[str, float]: ...


def _contexts(documents: list[Document]) -> list[str]:
    return [document.page_content for document in documents if (document.page_content or "").strip()]


def _case_answer(
    *,
    item: Item,
    case: RagEvalCase,
    docs: list[Document],
    has_verified: bool,
    confidence_score: float,
    language: str,
) -> str:
    if not has_verified:
        return no_item_knowledge_message(language)
    generator = get_rag_generator()
    answer = generator.generate_chat(
        message=case.question,
        history=[],
        retrieved_docs=docs,
        persona="Mặc định",
        language=language,
        item_name=item.name,
    )
    output_decision = apply_output_guardrails(
        answer,
        has_verified_knowledge=has_verified,
        confidence_score=confidence_score,
        context_count=len(docs),
        language=language,
    )
    return output_decision.sanitized_text


def _collect_item_case_run(
    *,
    db: Session,
    retriever: Any,
    case: RagEvalCase,
    top_k: int,
    language: str,
) -> RagasCaseRun:
    if case.item_id is None:
        return RagasCaseRun(
            question=case.question,
            item_id=None,
            group_id=case.group_id,
            answer="",
            contexts=[],
            ground_truth=case.ground_truth,
            has_verified_knowledge=False,
            confidence_score=0.0,
            fallback_used=True,
            scope=case.scope,
            error="missing_item_id",
        )

    item = db.query(Item).filter(Item.id == case.item_id).first()
    if item is None:
        return RagasCaseRun(
            question=case.question,
            item_id=case.item_id,
            group_id=case.group_id,
            answer="",
            contexts=[],
            ground_truth=case.ground_truth,
            has_verified_knowledge=False,
            confidence_score=0.0,
            fallback_used=True,
            scope=case.scope,
            error=f"item_not_found:{case.item_id}",
        )

    docs, has_verified, trace = build_chat_item_context_with_trace(
        item_id=item.id,
        item_name=item.name,
        item_description=item.description,
        retriever=retriever,
        top_k=top_k,
        group_id=case.group_id if case.group_id is not None else item.group_id,
        query=case.question,
    )
    answer = _case_answer(
        item=item,
        case=case,
        docs=docs,
        has_verified=has_verified,
        confidence_score=trace.confidence_score,
        language=language,
    )
    return RagasCaseRun(
        question=case.question,
        item_id=case.item_id,
        group_id=case.group_id if case.group_id is not None else item.group_id,
        answer=answer,
        contexts=_contexts(docs),
        ground_truth=case.ground_truth,
        has_verified_knowledge=has_verified,
        confidence_score=trace.confidence_score,
        fallback_used=trace.fallback_used,
        scope=case.scope,
        retrieval_query=trace.retrieval_query,
        fallback_reason=trace.fallback_reason,
    )


def _collect_corpus_case_run(
    *,
    retriever: Any,
    case: RagEvalCase,
    top_k: int,
    language: str,
) -> RagasCaseRun:
    if retriever is None:
        return RagasCaseRun(
            question=case.question,
            item_id=case.item_id,
            group_id=case.group_id,
            answer="",
            contexts=[],
            ground_truth=case.ground_truth,
            has_verified_knowledge=False,
            confidence_score=0.0,
            fallback_used=True,
            scope=case.scope,
            retrieval_query=case.question,
            fallback_reason="retriever_unavailable",
            error="retriever_unavailable",
        )

    fallback_used = False
    fallback_reason: str | None = None
    dense_max_score = 0.0
    if hasattr(retriever, "retrieve_with_trace"):
        docs, trace = retriever.retrieve_with_trace(
            case.question,
            top_k=top_k,
            group_id=case.group_id,
        )
        fallback_used = trace.fallback_used
        fallback_reason = trace.fallback_reason
        dense_max_score = trace.dense_max_score
        retrieval_query = trace.retrieval_query
    else:
        docs = retriever.retrieve(case.question, top_k=top_k, group_id=case.group_id)
        retrieval_query = case.question

    contexts = _contexts(docs)
    has_verified = bool(contexts)
    confidence_score = 0.7 if has_verified else 0.0
    if dense_max_score > 0:
        confidence_score = max(confidence_score, min(float(dense_max_score), 1.0))

    answer = ""
    if has_verified:
        generator = get_rag_generator()
        answer = generator.generate_answer(
            query=case.question,
            retrieved_docs=docs,
            persona="Mặc định",
            language=language,
        )
        output_decision = apply_output_guardrails(
            answer,
            has_verified_knowledge=True,
            confidence_score=confidence_score,
            context_count=len(contexts),
            language=language,
        )
        answer = output_decision.sanitized_text
    else:
        answer = no_item_knowledge_message(language)

    return RagasCaseRun(
        question=case.question,
        item_id=case.item_id,
        group_id=case.group_id,
        answer=answer,
        contexts=contexts,
        ground_truth=case.ground_truth,
        has_verified_knowledge=has_verified,
        confidence_score=confidence_score,
        fallback_used=fallback_used,
        scope=case.scope,
        retrieval_query=retrieval_query,
        fallback_reason=fallback_reason,
    )


def collect_golden_case_runs(
    db: Session,
    cases: list[RagEvalCase],
    *,
    top_k: int = 8,
    language: str = "Tiếng Việt",
    limit: int | None = None,
) -> list[RagasCaseRun]:
    retriever = try_get_rag_retriever()
    selected_cases = cases[:limit] if limit is not None else cases
    runs: list[RagasCaseRun] = []
    for case in selected_cases:
        try:
            if case.scope == "corpus":
                runs.append(
                    _collect_corpus_case_run(
                        retriever=retriever,
                        case=case,
                        top_k=top_k,
                        language=language,
                    )
                )
            else:
                runs.append(
                    _collect_item_case_run(
                        db=db,
                        retriever=retriever,
                        case=case,
                        top_k=top_k,
                        language=language,
                    )
                )
        except Exception as exc:
            runs.append(
                RagasCaseRun(
                    question=case.question,
                    item_id=case.item_id,
                    group_id=case.group_id,
                    answer="",
                    contexts=[],
                    ground_truth=case.ground_truth,
                    has_verified_knowledge=False,
                    confidence_score=0.0,
                    fallback_used=True,
                    scope=case.scope,
                    error=type(exc).__name__,
                )
            )
    return runs


def _rows_for_ragas(runs: list[RagasCaseRun]) -> list[dict[str, Any]]:
    return [
        {
            "question": run.question,
            "answer": run.answer,
            "contexts": run.contexts,
            "ground_truth": run.ground_truth,
            "reference": run.ground_truth,
        }
        for run in runs
        if not run.error and run.ground_truth.strip()
    ]


def _normalize_scores(
    raw_scores: dict[str, float],
    metrics: list[str],
    notes: list[str],
) -> dict[str, float | None]:
    scores: dict[str, float | None] = {}
    for name in metrics:
        value = raw_scores.get(name)
        if value is None:
            continue
        numeric = float(value)
        if not math.isfinite(numeric):
            scores[name] = None
            notes.append(f"ragas_metric_not_finite:{name}")
        else:
            scores[name] = round(numeric, 4)
    return scores


@contextmanager
def _without_nest_asyncio_patch() -> Any:
    try:
        import nest_asyncio
    except ImportError:
        yield
        return

    original_apply = nest_asyncio.apply
    nest_asyncio.apply = lambda *args, **kwargs: None
    try:
        yield
    finally:
        nest_asyncio.apply = original_apply


async def _run_ragas_evaluate(dataset: Any, selected_metrics: list[Any]) -> Any:
    with _without_nest_asyncio_patch():
        try:
            from ragas import aevaluate
        except ImportError:
            from ragas import evaluate

            task = asyncio.create_task(asyncio.to_thread(evaluate, dataset, metrics=selected_metrics))
            return await task

        task = asyncio.create_task(aevaluate(dataset, metrics=selected_metrics))
        return await task


def _run_coroutine_sync(coro: Any) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    result: dict[str, Any] = {}

    def runner() -> None:
        try:
            result["value"] = asyncio.run(coro)
        except BaseException as exc:  # pragma: no cover - re-raised in caller thread
            result["error"] = exc

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    thread.join()
    if "error" in result:
        raise result["error"]
    return result.get("value")


def _default_ragas_evaluator(rows: list[dict[str, Any]], metrics: list[str]) -> dict[str, float]:
    try:
        from datasets import Dataset
        with _without_nest_asyncio_patch():
            from ragas.metrics import answer_relevancy, context_precision, context_recall, faithfulness
    except ImportError as exc:
        raise RuntimeError(
            "RAGAS dependencies are not installed. Install backend requirements: ragas and datasets."
        ) from exc

    metric_map = {
        "faithfulness": faithfulness,
        "answer_relevancy": answer_relevancy,
        "context_recall": context_recall,
        "context_precision": context_precision,
    }
    selected_metrics = [metric_map[name] for name in metrics]
    dataset = Dataset.from_list(rows)
    result = _run_coroutine_sync(_run_ragas_evaluate(dataset, selected_metrics))
    raw = result.to_pandas().mean(numeric_only=True).to_dict()
    return {name: round(float(raw[name]), 4) for name in metrics if name in raw}


def run_ragas_golden_eval(
    db: Session,
    dataset_path: str | Path,
    *,
    top_k: int = 8,
    language: str = "Tiếng Việt",
    limit: int | None = None,
    metrics: list[str] | None = None,
    evaluator: RagasEvaluator | None = None,
) -> RagasGoldenReport:
    dataset_path = Path(dataset_path)
    cases = load_eval_cases(dataset_path)
    runs = collect_golden_case_runs(
        db,
        cases,
        top_k=top_k,
        language=language,
        limit=limit,
    )
    rows = _rows_for_ragas(runs)
    selected_metrics = metrics or list(RAGAS_TARGETS)
    notes: list[str] = []
    scores: dict[str, float | None] = {name: None for name in selected_metrics}
    if rows:
        eval_fn = evaluator or _default_ragas_evaluator
        try:
            scores.update(_normalize_scores(eval_fn(rows, selected_metrics), selected_metrics, notes))
        except Exception as exc:
            notes.append(f"ragas_evaluation_failed:{type(exc).__name__}:{exc}")
    else:
        notes.append("no_ragas_rows: every case failed or is missing ground_truth")

    gate_results = {
        name: (None if scores.get(name) is None else float(scores[name]) >= RAGAS_TARGETS[name])
        for name in selected_metrics
        if name in RAGAS_TARGETS
    }
    return RagasGoldenReport(
        dataset_path=str(dataset_path),
        generated_at=f"{datetime.utcnow().isoformat()}Z",
        total_cases=len(cases),
        attempted_cases=len(rows),
        errored_cases=sum(1 for run in runs if run.error),
        metrics=scores,
        gate_results=gate_results,
        case_runs=runs,
        notes=notes,
    )


def _scope_counts(runs: list[RagasCaseRun]) -> dict[str, int]:
    return {
        "corpus": sum(1 for run in runs if run.scope == "corpus"),
        "item": sum(1 for run in runs if run.scope == "item"),
    }


def report_to_dict(report: RagasGoldenReport, *, include_cases: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {
        "dataset_path": report.dataset_path,
        "generated_at": report.generated_at,
        "total_cases": report.total_cases,
        "attempted_cases": report.attempted_cases,
        "errored_cases": report.errored_cases,
        "scope_counts": _scope_counts(report.case_runs),
        "scope_error_counts": _scope_counts([run for run in report.case_runs if run.error]),
        "metrics": report.metrics,
        "targets": report.targets,
        "gate_results": report.gate_results,
        "notes": report.notes,
    }
    if include_cases:
        data["cases"] = [run.__dict__ for run in report.case_runs]
    return data


def render_ragas_markdown(report: RagasGoldenReport) -> str:
    passed = [value for value in report.gate_results.values() if value is True]
    failed = [value for value in report.gate_results.values() if value is False]
    unknown = [value for value in report.gate_results.values() if value is None]
    if failed or unknown:
        status = "NO-GO / needs fixes"
    else:
        status = "GO for canary"

    scope_counts = _scope_counts(report.case_runs)
    scope_error_counts = _scope_counts([run for run in report.case_runs if run.error])
    lines = [
        "# HERA RAGAS Golden Dataset Report",
        "",
        f"- **Dataset:** `{report.dataset_path}`",
        f"- **Generated at:** {report.generated_at}",
        f"- **Release status:** **{status}**",
        f"- **Total cases:** {report.total_cases}",
        f"- **Attempted by RAGAS:** {report.attempted_cases}",
        f"- **Scope attempted:** corpus={scope_counts['corpus']}, item={scope_counts['item']}",
        f"- **Errored cases:** {report.errored_cases} (corpus={scope_error_counts['corpus']}, item={scope_error_counts['item']})",
        f"- **Gate score:** {len(passed)}/{len(report.gate_results)}",
        "",
        "## 1. RAGAS Metrics",
        "",
        "| Metric | Score | Target | Gate |",
        "|---|---:|---:|---:|",
    ]
    for name, target in report.targets.items():
        score = report.metrics.get(name)
        gate = report.gate_results.get(name)
        gate_text = "✅" if gate is True else "❌" if gate is False else "⚠️ not run"
        score_text = "not run" if score is None else f"{float(score):.4f}"
        lines.append(f"| {name} | {score_text} | {target:.2f} | {gate_text} |")

    lines.extend([
        "",
        "## 2. Dataset / Runtime Notes",
        "",
    ])
    if report.notes:
        lines.extend(f"- {note}" for note in report.notes)
    else:
        lines.append("- RAGAS evaluation completed without runtime notes.")

    error_runs = [run for run in report.case_runs if run.error]
    low_conf_runs = [run for run in report.case_runs if not run.error and run.confidence_score < 0.45]
    fallback_runs = [run for run in report.case_runs if not run.error and run.fallback_used]
    lines.extend([
        "",
        "## 3. Case Risk Summary",
        "",
        f"- Low-confidence cases: **{len(low_conf_runs)}**",
        f"- Retrieval fallback cases: **{len(fallback_runs)}**",
        f"- Error cases: **{len(error_runs)}**",
        "",
        "## 4. Case Sample",
        "",
        "| # | Scope | Item | Group | Confidence | Fallback | Contexts | Error | Question |",
        "|---:|---|---:|---:|---:|---:|---:|---|---|",
    ])
    for index, run in enumerate(report.case_runs[:30], start=1):
        question = run.question.replace("|", "\\|")[:140]
        lines.append(
            f"| {index} | {run.scope} | {run.item_id if run.item_id is not None else '-'} | "
            f"{run.group_id if run.group_id is not None else '-'} | {run.confidence_score:.3f} | "
            f"{run.fallback_used} | {len(run.contexts)} | {run.error or '-'} | {question} |"
        )

    lines.extend([
        "",
        "## 5. Next Actions",
        "",
        "1. Replace scaffold rows with 100 human-reviewed golden questions before production sign-off.",
        "2. Ensure judge credentials and RAGAS-compatible LLM/embedding settings are configured in the backend environment.",
        "3. Promote every production failure into this dataset or a dedicated regression dataset.",
        "",
    ])
    return "\n".join(lines)


def write_report_files(
    report: RagasGoldenReport,
    *,
    markdown_path: str | Path,
    json_path: str | Path,
    include_cases: bool = True,
) -> None:
    markdown_path = Path(markdown_path)
    json_path = Path(json_path)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(render_ragas_markdown(report), encoding="utf-8")
    json_path.write_text(
        json.dumps(report_to_dict(report, include_cases=include_cases), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
