import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from langchain_core.documents import Document
from sqlalchemy.orm import Session

from app.models.item import Item
from app.modules.rag.service import build_chat_item_context_with_trace
from app.modules.rag.tracing import RagTraceContext


@dataclass(frozen=True)
class RagEvalCase:
    question: str
    item_id: int
    group_id: int | None = None
    expected_document_ids: list[int] = field(default_factory=list)
    expected_terms: list[str] = field(default_factory=list)
    expect_no_data: bool = False


@dataclass(frozen=True)
class RagEvalCaseResult:
    case: RagEvalCase
    retrieved_document_ids: list[int]
    context_text: str
    has_verified_knowledge: bool
    confidence_score: float
    expected_document_hit: bool
    expected_terms_hit: bool
    no_data_correct: bool


@dataclass(frozen=True)
class RagEvalReport:
    total: int
    hit_at_k: float
    expected_document_hit_rate: float
    expected_terms_hit_rate: float
    no_data_accuracy: float
    low_confidence_rate: float
    results: list[RagEvalCaseResult]


class ContextBuilder(Protocol):
    def __call__(
        self,
        db: Session,
        item: Item,
        message: str,
        conversation_id: str | None = None,
        top_k: int = 4,
    ) -> tuple[list[Document], bool, RagTraceContext]: ...


def _as_int_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, int)]


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def load_eval_cases(path: str | Path) -> list[RagEvalCase]:
    cases: list[RagEvalCase] = []
    with Path(path).open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            payload = json.loads(stripped)
            if not isinstance(payload, dict):
                raise ValueError(f"invalid_eval_case:{line_number}")
            cases.append(
                RagEvalCase(
                    question=str(payload.get("question") or ""),
                    item_id=int(payload["item_id"]),
                    group_id=payload.get("group_id") if isinstance(payload.get("group_id"), int) else None,
                    expected_document_ids=_as_int_list(payload.get("expected_document_ids")),
                    expected_terms=_as_str_list(payload.get("expected_terms")),
                    expect_no_data=bool(payload.get("expect_no_data", False)),
                )
            )
    return cases


def report_to_dict(report: RagEvalReport, *, include_results: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {
        "total": report.total,
        "hit_at_k": report.hit_at_k,
        "expected_document_hit_rate": report.expected_document_hit_rate,
        "expected_terms_hit_rate": report.expected_terms_hit_rate,
        "no_data_accuracy": report.no_data_accuracy,
        "low_confidence_rate": report.low_confidence_rate,
    }
    if include_results:
        data["results"] = [
            {
                "question": result.case.question,
                "item_id": result.case.item_id,
                "retrieved_document_ids": result.retrieved_document_ids,
                "has_verified_knowledge": result.has_verified_knowledge,
                "confidence_score": result.confidence_score,
                "expected_document_hit": result.expected_document_hit,
                "expected_terms_hit": result.expected_terms_hit,
                "no_data_correct": result.no_data_correct,
            }
            for result in report.results
        ]
    return data


def _doc_ids(documents: list[Document]) -> list[int]:
    ids: list[int] = []
    for document in documents:
        document_id = (document.metadata or {}).get("document_id")
        if isinstance(document_id, int) and document_id not in ids:
            ids.append(document_id)
    return ids


def _contains_all_terms(text: str, terms: list[str]) -> bool:
    folded = text.casefold()
    return all(term.casefold() in folded for term in terms)


def evaluate_cases(
    db: Session,
    cases: list[RagEvalCase],
    *,
    top_k: int = 4,
    low_confidence_threshold: float = 0.45,
    context_builder: ContextBuilder = build_chat_item_context_with_trace,
) -> RagEvalReport:
    results: list[RagEvalCaseResult] = []
    for index, case in enumerate(cases):
        item = db.query(Item).filter(Item.id == case.item_id).first()
        if item is None:
            raise ValueError(f"item_not_found:{case.item_id}")

        docs, has_verified, trace = context_builder(
            db,
            item,
            case.question,
            conversation_id=f"rag-eval-{index}",
            top_k=top_k,
        )
        context_text = "\n".join(document.page_content or "" for document in docs)
        retrieved_ids = _doc_ids(docs)
        expected_document_hit = (
            not case.expected_document_ids
            or any(document_id in retrieved_ids for document_id in case.expected_document_ids)
        )
        expected_terms_hit = (
            not case.expected_terms or _contains_all_terms(context_text, case.expected_terms)
        )
        no_data_correct = (not has_verified) if case.expect_no_data else has_verified
        results.append(
            RagEvalCaseResult(
                case=case,
                retrieved_document_ids=retrieved_ids,
                context_text=context_text,
                has_verified_knowledge=has_verified,
                confidence_score=trace.confidence_score,
                expected_document_hit=expected_document_hit,
                expected_terms_hit=expected_terms_hit,
                no_data_correct=no_data_correct,
            )
        )

    total = len(results)
    if total == 0:
        return RagEvalReport(
            total=0,
            hit_at_k=0.0,
            expected_document_hit_rate=0.0,
            expected_terms_hit_rate=0.0,
            no_data_accuracy=0.0,
            low_confidence_rate=0.0,
            results=[],
        )

    hit_count = sum(
        1
        for result in results
        if result.expected_document_hit and result.expected_terms_hit and result.no_data_correct
    )
    no_data_cases = [result for result in results if result.case.expect_no_data]
    no_data_accuracy = (
        sum(1 for result in no_data_cases if result.no_data_correct) / len(no_data_cases)
        if no_data_cases
        else 1.0
    )
    return RagEvalReport(
        total=total,
        hit_at_k=round(hit_count / total, 4),
        expected_document_hit_rate=round(
            sum(1 for result in results if result.expected_document_hit) / total,
            4,
        ),
        expected_terms_hit_rate=round(
            sum(1 for result in results if result.expected_terms_hit) / total,
            4,
        ),
        no_data_accuracy=round(no_data_accuracy, 4),
        low_confidence_rate=round(
            sum(
                1
                for result in results
                if result.confidence_score < low_confidence_threshold
            )
            / total,
            4,
        ),
        results=results,
    )
