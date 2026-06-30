import re
from dataclasses import dataclass, field
from pathlib import PurePath

from app.core.config import GROUP_DOC_MAX_BYTES

ALLOWED_VISIBILITIES = {"public", "internal", "draft"}
ALLOWED_TRUST_LEVELS = {"official", "curated", "uploaded", "unverified"}
_DEFAULT_FILENAME = "document"
_SENSITIVE_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    "phone": re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)"),
    "api_key": re.compile(r"\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*[^\s]{8,}", re.IGNORECASE),
    "private_key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
}
_FILENAME_RE = re.compile(r"[^\w. -]+", re.UNICODE)


@dataclass(frozen=True)
class GovernanceResult:
    visibility: str = "internal"
    trust_level: str = "uploaded"
    sanitized_filename: str | None = None
    warnings: list[str] = field(default_factory=list)


def normalize_visibility(value: str | None) -> str:
    visibility = (value or "internal").strip().lower()
    if visibility not in ALLOWED_VISIBILITIES:
        raise ValueError("invalid_visibility")
    return visibility


def normalize_trust_level(value: str | None) -> str:
    trust_level = (value or "uploaded").strip().lower()
    if trust_level not in ALLOWED_TRUST_LEVELS:
        raise ValueError("invalid_trust_level")
    return trust_level


def sanitize_filename(filename: str | None) -> str | None:
    if not filename:
        return None
    name = PurePath(filename.replace("\\", "/")).name.strip()
    name = _FILENAME_RE.sub("_", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return name[:255] or _DEFAULT_FILENAME


def enforce_upload_size(content: bytes) -> None:
    if GROUP_DOC_MAX_BYTES > 0 and len(content) > GROUP_DOC_MAX_BYTES:
        raise ValueError("file_too_large")


def detect_sensitive_data(text: str) -> list[str]:
    warnings: list[str] = []
    for name, pattern in _SENSITIVE_PATTERNS.items():
        if pattern.search(text or ""):
            warnings.append(f"sensitive_{name}")
    return warnings


def build_governance_result(
    *,
    filename: str | None,
    text: str,
    visibility: str | None = None,
    trust_level: str | None = None,
) -> GovernanceResult:
    normalized_visibility = normalize_visibility(visibility)
    normalized_trust = normalize_trust_level(trust_level)
    warnings = detect_sensitive_data(text)
    if normalized_visibility == "public" and warnings:
        warnings.append("public_document_contains_sensitive_patterns")
    return GovernanceResult(
        visibility=normalized_visibility,
        trust_level=normalized_trust,
        sanitized_filename=sanitize_filename(filename),
        warnings=warnings,
    )
