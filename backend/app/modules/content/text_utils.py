import re

MAX_GENERATED_WORDS = 200
MAX_CHAT_WORDS = 150
GENERATION_RULES_VERSION = "max-200-words-v2"

# [Trang 5], [Page 12], [Mục Giới thiệu]
_CITATION_PATTERN = re.compile(
    r"\s*\[(?:Trang|Page|Mục)\s[^\]]*\]",
    re.IGNORECASE,
)


def strip_citations(text: str) -> str:
    cleaned = _CITATION_PATTERN.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def limit_words(text: str, max_words: int = MAX_GENERATED_WORDS) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text.strip()
    limited = " ".join(words[:max_words]).rstrip(" ,;:")
    return f"{limited}..."
