import hashlib
import json
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.group_document import GroupDocument
from app.modules.rag.normalization import normalize_text_for_ingest


_MIN_SUBSTANTIVE_CHARS = 80
_REPLACEMENT_CHAR = "�"
_SYMBOL_RE = re.compile(r"[^\w\sÀ-ỹ.,;:!?()\[\]{}\-–—'\"/\\%]", re.UNICODE)
_WORD_OR_DIGIT_RE = re.compile(r"[\wÀ-ỹ]", re.UNICODE)


@dataclass(frozen=True)
class DocumentQualityReport:
    char_count: int
    section_count: int
    chunk_count: int
    content_hash: str
    normalized_hash: str
    quality_score: float
    warnings: list[str]

    def warnings_json(self) -> str:
        return json.dumps(self.warnings, ensure_ascii=False)


def sha256_text(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def _score_from_warnings(warnings: list[str]) -> float:
    score = 1.0
    penalties = {
        "empty_content": 1.0,
        "content_too_short": 0.35,
        "possible_ocr_noise": 0.25,
        "too_many_symbols": 0.2,
        "duplicate_content": 0.15,
        "truncated_chunks": 0.1,
    }
    for warning in warnings:
        score -= penalties.get(warning, 0.05)
    return round(max(0.0, score), 3)


def build_quality_report(
    *,
    canonical_text: str,
    section_count: int,
    chunk_count: int,
    duplicate: bool = False,
    truncated: bool = False,
) -> DocumentQualityReport:
    normalized = normalize_text_for_ingest(canonical_text)
    compact = " ".join(normalized.casefold().split())
    char_count = len(normalized)
    warnings: list[str] = []

    if not normalized:
        warnings.append("empty_content")
    elif char_count < _MIN_SUBSTANTIVE_CHARS:
        warnings.append("content_too_short")

    replacement_count = normalized.count(_REPLACEMENT_CHAR)
    if char_count and replacement_count / char_count > 0.01:
        warnings.append("possible_ocr_noise")

    word_or_digit_count = len(_WORD_OR_DIGIT_RE.findall(normalized))
    symbol_count = len(_SYMBOL_RE.findall(normalized))
    if char_count and (symbol_count / char_count > 0.08 or word_or_digit_count / char_count < 0.35):
        warnings.append("too_many_symbols")

    if duplicate:
        warnings.append("duplicate_content")
    if truncated:
        warnings.append("truncated_chunks")

    return DocumentQualityReport(
        char_count=char_count,
        section_count=section_count,
        chunk_count=chunk_count,
        content_hash=sha256_text(normalized),
        normalized_hash=sha256_text(compact),
        quality_score=_score_from_warnings(warnings),
        warnings=warnings,
    )


def has_duplicate_normalized_hash(
    db: Session,
    *,
    group_id: int,
    normalized_hash: str,
    exclude_document_id: int | None = None,
) -> bool:
    query = db.query(GroupDocument.id).filter(
        GroupDocument.group_id == group_id,
        GroupDocument.normalized_hash == normalized_hash,
    )
    if exclude_document_id is not None:
        query = query.filter(GroupDocument.id != exclude_document_id)
    return query.first() is not None
