import re
from dataclasses import dataclass, field
from pathlib import PurePath

from app.core.config import GROUP_DOC_MAX_BYTES
from app.modules.content.language_support import LANGUAGE_VI, normalize_language_label

ALLOWED_VISIBILITIES = {"public", "internal", "draft"}
ALLOWED_TRUST_LEVELS = {"official", "curated", "uploaded", "unverified"}
_DEFAULT_FILENAME = "document"
_SENSITIVE_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    "phone": re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)"),
    "citizen_id": re.compile(r"(?<!\d)\d{9}(?:\d{3})?(?!\d)"),
    "api_key": re.compile(r"\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*[^\s]{8,}", re.IGNORECASE),
    "private_key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
}
_FILENAME_RE = re.compile(r"[^\w. -]+", re.UNICODE)
_PII_REPLACEMENT = "[PII_REMOVED]"
_HISTORY_REMOVED = "[Message removed by safety filter]"
_FALLBACK_VI = "Tôi chưa có đủ thông tin xác thực để trả lời chính xác câu hỏi này."
_FALLBACK_EN = "I do not have enough verified information to answer this accurately."
_PROMPT_INJECTION_PATTERNS = (
    re.compile(r"\b(ignore|disregard|override|bypass)\b.{0,80}\b(previous|above|system|developer|instruction|rule)s?\b", re.IGNORECASE),
    re.compile(r"\b(system prompt|developer message|hidden instruction|chain of thought|internal context)\b", re.IGNORECASE),
    re.compile(r"\b(DAN|jailbreak|do anything now|roleplay as unrestricted)\b", re.IGNORECASE),
    re.compile(r"\b(reveal|print|show|dump|extract)\b.{0,80}\b(prompt|context|instruction|secret|token|api key)s?\b", re.IGNORECASE),
    re.compile(r"\b(bỏ qua|quên|vượt qua|ghi đè|tiết lộ|in ra|hiển thị)\b.{0,80}\b(hướng dẫn|chỉ dẫn|luật|system|prompt|ngữ cảnh|bí mật)\b", re.IGNORECASE),
    re.compile(r"\b(làm thơ|viết code|đóng vai|không cần theo|không tuân theo)\b", re.IGNORECASE),
)
_BLOCKED_TOPIC_PATTERNS = (
    re.compile(r"\b(hack|exploit|malware|phishing|ddos|ransomware|keylogger)\b", re.IGNORECASE),
    re.compile(r"\b(cờ bạc|khiêu dâm|ma túy|vũ khí|tự sát)\b", re.IGNORECASE),
)
_HERITAGE_TOPIC_PATTERNS = (
    re.compile(r"\b(di tích|lịch sử|văn hóa|hiện vật|tham quan|du lịch|bảo tàng|đền|chùa|văn miếu|quốc tử giám|lễ hội)\b", re.IGNORECASE),
    re.compile(r"\b(history|heritage|culture|artifact|museum|temple|tour|visit|festival)\b", re.IGNORECASE),
)


@dataclass(frozen=True)
class GovernanceResult:
    visibility: str = "internal"
    trust_level: str = "uploaded"
    sanitized_filename: str | None = None
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class GuardrailDecision:
    allowed: bool
    sanitized_text: str
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    topic_status: str = "unknown"


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


def redact_sensitive_data(text: str) -> tuple[str, list[str]]:
    sanitized = text or ""
    warnings: list[str] = []
    for name, pattern in _SENSITIVE_PATTERNS.items():
        sanitized, count = pattern.subn(_PII_REPLACEMENT, sanitized)
        if count:
            warnings.append(f"redacted_{name}")
    return sanitized, warnings


def detect_prompt_injection(text: str) -> list[str]:
    normalized = " ".join((text or "").split())
    return [
        f"prompt_injection_pattern_{index}"
        for index, pattern in enumerate(_PROMPT_INJECTION_PATTERNS, start=1)
        if pattern.search(normalized)
    ]


def classify_topic_scope(text: str) -> tuple[str, list[str]]:
    normalized = text or ""
    if any(pattern.search(normalized) for pattern in _BLOCKED_TOPIC_PATTERNS):
        return "blocked", ["blocked_topic"]
    if any(pattern.search(normalized) for pattern in _HERITAGE_TOPIC_PATTERNS):
        return "allowed", []
    return "soft_allowed", ["topic_scope_unverified"]


def apply_input_guardrails(text: str) -> GuardrailDecision:
    sanitized, warnings = redact_sensitive_data(text)
    reasons = detect_prompt_injection(sanitized)
    topic_status, topic_warnings = classify_topic_scope(sanitized)
    warnings.extend(topic_warnings)
    if topic_status == "blocked":
        reasons.append("blocked_topic")
    return GuardrailDecision(
        allowed=not reasons,
        sanitized_text=sanitized,
        reasons=reasons,
        warnings=warnings,
        topic_status=topic_status,
    )


def sanitize_chat_history(history: list[dict[str, str]]) -> list[dict[str, str]]:
    sanitized_history: list[dict[str, str]] = []
    for message in history:
        content = str(message.get("content") or "")
        decision = apply_input_guardrails(content)
        sanitized_history.append(
            {
                "role": str(message.get("role") or "user"),
                "content": decision.sanitized_text if decision.allowed else _HISTORY_REMOVED,
            }
        )
    return sanitized_history


def safe_fallback_message(language: str) -> str:
    return _FALLBACK_VI if normalize_language_label(language) == LANGUAGE_VI else _FALLBACK_EN


def apply_output_guardrails(
    answer: str,
    *,
    has_verified_knowledge: bool,
    confidence_score: float,
    context_count: int,
    language: str,
) -> GuardrailDecision:
    warnings: list[str] = []
    reasons: list[str] = []
    if not has_verified_knowledge or context_count <= 0:
        reasons.append("no_verified_context")
    if confidence_score < 0.3:
        reasons.append("low_confidence_block")
    elif confidence_score < 0.45:
        warnings.append("low_confidence_warn")

    if reasons:
        return GuardrailDecision(
            allowed=False,
            sanitized_text=safe_fallback_message(language),
            reasons=reasons,
            warnings=warnings,
            topic_status="allowed",
        )
    return GuardrailDecision(
        allowed=True,
        sanitized_text=answer,
        reasons=reasons,
        warnings=warnings,
        topic_status="allowed",
    )


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
