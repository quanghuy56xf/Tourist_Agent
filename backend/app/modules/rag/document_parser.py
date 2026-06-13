import io
import re
from typing import BinaryIO

from app.modules.rag.types import StructuredSection

MARKDOWN_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")
DOCX_HEADING_RE = re.compile(r"^Heading\s+(\d+)$", re.IGNORECASE)


def _flush_section(
    sections: list[StructuredSection],
    heading: str | None,
    level: int | None,
    body_lines: list[str],
    source_hint: str | None,
) -> None:
    body = "\n".join(line.rstrip() for line in body_lines).strip()
    if not heading and not body:
        return
    sections.append(
        StructuredSection(
            heading=heading,
            heading_level=level,
            body=body,
            source_hint=source_hint,
        )
    )


def _has_markdown_headings(text: str) -> bool:
    return any(
        MARKDOWN_HEADING_RE.match(line.strip())
        for line in text.split("\n")
        if line.strip()
    )


def parse_text_sections(text: str) -> list[StructuredSection]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return []

    if _has_markdown_headings(normalized):
        return _parse_markdown_sections(normalized)

    heuristic = _parse_heuristic_sections(normalized)
    if heuristic:
        return heuristic

    return [
        StructuredSection(
            heading=None,
            heading_level=None,
            body=normalized,
            source_hint="text:flat",
        )
    ]


def _parse_markdown_sections(text: str) -> list[StructuredSection]:
    sections: list[StructuredSection] = []
    heading: str | None = None
    level: int | None = None
    body_lines: list[str] = []

    for line in text.split("\n"):
        match = MARKDOWN_HEADING_RE.match(line.strip())
        if match:
            _flush_section(sections, heading, level, body_lines, "md")
            heading = match.group(2).strip()
            level = len(match.group(1))
            body_lines = []
            continue
        body_lines.append(line)

    _flush_section(sections, heading, level, body_lines, "md")
    return sections


def _parse_heuristic_sections(text: str) -> list[StructuredSection]:
    blocks = re.split(r"\n\s*\n", text)
    if len(blocks) <= 1:
        return []

    sections: list[StructuredSection] = []
    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        first = lines[0]
        if (
            len(lines) > 1
            and len(first) < 80
            and not first.endswith(".")
        ):
            sections.append(
                StructuredSection(
                    heading=first,
                    heading_level=2,
                    body="\n".join(lines[1:]),
                    source_hint="heuristic",
                )
            )
        else:
            sections.append(
                StructuredSection(
                    heading=None,
                    heading_level=None,
                    body=block.strip(),
                    source_hint="heuristic",
                )
            )
    return sections if len(sections) > 1 else []


def parse_docx_sections(content: bytes) -> list[StructuredSection]:
    from docx import Document

    document = Document(io.BytesIO(content))
    sections: list[StructuredSection] = []
    heading: str | None = None
    level: int | None = None
    body_lines: list[str] = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        style_name = (paragraph.style.name or "").strip()
        heading_match = DOCX_HEADING_RE.match(style_name)
        if heading_match:
            _flush_section(
                sections,
                heading,
                level,
                body_lines,
                f"docx:{style_name}",
            )
            heading = text
            level = int(heading_match.group(1))
            body_lines = []
            continue
        body_lines.append(text)

    _flush_section(sections, heading, level, body_lines, "docx")
    if sections:
        return sections

    full_text = "\n".join(
        paragraph.text.strip()
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    )
    return parse_text_sections(full_text)


def parse_flat_text_sections(
    text: str,
    *,
    source_hint: str = "text:flat",
) -> list[StructuredSection]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return []

    if _has_markdown_headings(normalized):
        return _parse_markdown_sections(normalized)

    return [
        StructuredSection(
            heading=None,
            heading_level=None,
            body=normalized,
            source_hint=source_hint,
        )
    ]


def extract_pdf_text(content: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content))
    page_texts: list[str] = []

    for page in reader.pages:
        page_text = (page.extract_text() or "").strip()
        if page_text:
            page_texts.append(page_text)

    return "\n\n".join(page_texts).strip()


def parse_pdf_sections(content: bytes) -> list[StructuredSection]:
    text = extract_pdf_text(content)
    if not text:
        return []
    return parse_flat_text_sections(text, source_hint="pdf:txt")


def parse_upload_to_sections(
    *,
    source_type: str,
    content: bytes | str,
    filename: str | None = None,
) -> list[StructuredSection]:
    if source_type == "text":
        text = content if isinstance(content, str) else content.decode("utf-8")
        return parse_text_sections(text)

    if source_type == "txt":
        text = content.decode("utf-8") if isinstance(content, bytes) else content
        return parse_text_sections(text)

    if source_type == "docx":
        if isinstance(content, str):
            raise ValueError("DOCX content must be bytes")
        return parse_docx_sections(content)

    if source_type == "pdf":
        if isinstance(content, str):
            raise ValueError("PDF content must be bytes")
        return parse_pdf_sections(content)

    raise ValueError(f"Unsupported source type: {source_type}")


def sections_to_plain_text(sections: list[StructuredSection]) -> str:
    parts: list[str] = []
    for section in sections:
        if section.heading:
            parts.append(section.heading)
        if section.body:
            parts.append(section.body)
    return "\n\n".join(parts).strip()


def detect_source_type(filename: str | None, mime_type: str | None) -> str | None:
    if filename:
        lower = filename.lower()
        if lower.endswith(".txt"):
            return "txt"
        if lower.endswith(".docx"):
            return "docx"
        if lower.endswith(".pdf"):
            return "pdf"
    if mime_type == "text/plain":
        return "txt"
    if mime_type == "application/pdf":
        return "pdf"
    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return "docx"
    return None
