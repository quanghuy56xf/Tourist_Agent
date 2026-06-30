import re
import unicodedata

from app.modules.rag.types import StructuredSection


_BLANK_LINES_RE = re.compile(r"\n{3,}")
_HORIZONTAL_SPACE_RE = re.compile(r"[ \t\f\v]+")


def normalize_text_for_ingest(value: str) -> str:
    """Return stable UTF-8 text for hashing, storage, and chunking."""
    normalized = unicodedata.normalize("NFC", value or "")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    lines = [_HORIZONTAL_SPACE_RE.sub(" ", line).strip() for line in normalized.split("\n")]
    text = "\n".join(lines).strip()
    return _BLANK_LINES_RE.sub("\n\n", text)


def sections_to_canonical_markdown(sections: list[StructuredSection]) -> str:
    """Convert parsed sections to an internal Markdown-like canonical text."""
    parts: list[str] = []
    for section in sections:
        heading = normalize_text_for_ingest(section.heading or "")
        body = normalize_text_for_ingest(section.body or "")
        if heading:
            level = min(max(section.heading_level or 2, 1), 6)
            parts.append(f"{'#' * level} {heading}")
        if body:
            parts.append(body)
    return normalize_text_for_ingest("\n\n".join(parts))
