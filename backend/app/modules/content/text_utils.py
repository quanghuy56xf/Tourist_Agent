import re

GENERATION_RULES_VERSION = "llm-output-limit-v2"

# [Trang 5], [Page 12], [Mục Giới thiệu]
_CITATION_PATTERN = re.compile(
    r"\s*\[(?:Trang|Page|Mục)\s[^\]]*\]",
    re.IGNORECASE,
)


def strip_citations(text: str) -> str:
    cleaned = _CITATION_PATTERN.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()
