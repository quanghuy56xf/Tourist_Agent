import re

GENERATION_RULES_VERSION = "llm-output-limit-v2"

DOCUMENT_NOT_FOUND_VI = "Tôi không tìm thấy thông tin trong tài liệu."
DOCUMENT_NOT_FOUND_EN = "I could not find information about this in the documents."

# [Trang 5], [Page 12], [Mục Giới thiệu]
_CITATION_PATTERN = re.compile(
    r"\s*\[(?:Trang|Page|Mục)\s[^\]]*\]",
    re.IGNORECASE,
)

# Lead-in phrases that sound unnatural in audio guides.
_META_LEAD_PATTERNS = (
    re.compile(
        r"^(?:dựa trên|theo)\s+(?:thông tin\s+(?:trong\s+)?)?"
        r"tài liệu(?:\s+được\s+cung\s+cấp)?\s*[,;:\-—]?\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:từ|trong)\s+(?:các\s+)?tài liệu(?:\s+được\s+cung\s+cấp)?\s*[,;:\-—]?\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:theo|dựa vào)\s+nội dung\s+(?:trong\s+)?tài liệu\s*[,;:\-—]?\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:based on|according to)\s+(?:the\s+)?"
        r"(?:provided\s+)?(?:documents?|information|context|materials?)\s*[,;:\-—]?\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:as per|from)\s+(?:the\s+)?(?:provided\s+)?"
        r"(?:documents?|information|context)\s*[,;:\-—]?\s*",
        re.IGNORECASE,
    ),
)


def strip_citations(text: str) -> str:
    cleaned = _CITATION_PATTERN.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def strip_meta_phrases(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return cleaned

    changed = True
    while changed:
        changed = False
        for pattern in _META_LEAD_PATTERNS:
            updated = pattern.sub("", cleaned, count=1).strip()
            if updated != cleaned:
                cleaned = updated
                changed = True
                break

    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned


def polish_generated_text(text: str) -> str:
    return strip_meta_phrases(strip_citations(text))


_NO_INFORMATION_MARKERS = (
    "tôi không tìm thấy thông tin",
    "không tìm thấy thông tin nào liên quan",
    "hiện chưa có đủ thông tin xác thực",
    "there is not enough verified information",
    "please add a description or heritage-site documents",
    "i could not find information about this in the documents",
)


def is_no_information_content(text: str) -> bool:
    """True when text is an empty/fallback response with no artifact facts."""
    cleaned = (text or "").strip()
    if not cleaned:
        return True
    lowered = cleaned.lower()
    return any(marker in lowered for marker in _NO_INFORMATION_MARKERS)


def is_non_adaptable_content(text: str) -> bool:
    """Alias kept for callers — non-adaptable means no facts to adapt."""
    return is_no_information_content(text)


def document_not_found_message(language: str) -> str:
    if language == "Tiếng Anh":
        return DOCUMENT_NOT_FOUND_EN
    return DOCUMENT_NOT_FOUND_VI


def is_no_knowledge_content(text: str) -> bool:
    lowered = (text or "").strip().lower()
    return (
        "hiện chưa có đủ thông tin xác thực" in lowered
        or "there is not enough verified information" in lowered
    )


def resolve_propagated_variant_content(
    base_content: str,
    language: str,
    *,
    no_knowledge_message_for_language,
) -> tuple[str, str]:
    """Copy the no-info outcome to other persona/language variants without LLM."""
    if is_no_knowledge_content(base_content):
        return no_knowledge_message_for_language(language), "no_knowledge"
    return document_not_found_message(language), "generated"
