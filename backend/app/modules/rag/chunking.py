from app.core.config import (
    RAG_CHUNK_OVERLAP,
    RAG_MAX_CHUNKS_PER_DOCUMENT,
    RAG_MAX_CHUNK_CHARS,
    RAG_MAX_SECTION_CHARS,
)
from app.modules.rag.types import ChunkDraft, StructuredSection


def sections_to_chunks(sections: list[StructuredSection]) -> list[ChunkDraft]:
    drafts, _ = sections_to_chunks_with_meta(sections)
    return drafts


def sections_to_chunks_with_meta(
    sections: list[StructuredSection],
) -> tuple[list[ChunkDraft], str | None]:
    if not sections:
        return [], None

    drafts: list[ChunkDraft] = []
    truncation_warning: str | None = None

    for section in sections:
        section_text = _section_text(section)
        if not section_text:
            continue

        is_flat_section = section.heading is None and section.heading_level is None

        if is_flat_section and len(section_text) > RAG_MAX_CHUNK_CHARS:
            for chunk in _split_text(section_text, RAG_MAX_CHUNK_CHARS, RAG_CHUNK_OVERLAP):
                drafts.append(
                    ChunkDraft(
                        text=chunk,
                        section_title=None,
                        heading_level=None,
                        chunk_strategy="character",
                    )
                )
            continue

        if len(section_text) <= RAG_MAX_SECTION_CHARS:
            drafts.append(
                ChunkDraft(
                    text=section_text,
                    section_title=section.heading,
                    heading_level=section.heading_level,
                    chunk_strategy="section",
                )
            )
            continue

        prefix = f"{section.heading}\n\n" if section.heading else ""
        for body_chunk in _split_text(section.body or section_text, RAG_MAX_CHUNK_CHARS, RAG_CHUNK_OVERLAP):
            drafts.append(
                ChunkDraft(
                    text=f"{prefix}{body_chunk}".strip(),
                    section_title=section.heading,
                    heading_level=section.heading_level,
                    chunk_strategy="section_split",
                )
            )

    if drafts:
        drafts, truncation_warning = _enforce_chunk_limit(drafts)
        return drafts, truncation_warning

    flat_text = "\n\n".join(_section_text(section) for section in sections).strip()
    if not flat_text:
        return [], None

    for chunk in _split_text(flat_text, RAG_MAX_CHUNK_CHARS, RAG_CHUNK_OVERLAP):
        drafts.append(
            ChunkDraft(
                text=chunk,
                section_title=None,
                heading_level=None,
                chunk_strategy="character",
            )
        )
    drafts, truncation_warning = _enforce_chunk_limit(drafts)
    return drafts, truncation_warning


def _section_text(section: StructuredSection) -> str:
    if section.heading and section.body:
        return f"{section.heading}\n\n{section.body}".strip()
    if section.heading:
        return section.heading.strip()
    return section.body.strip()


def _split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if len(text) <= chunk_size:
        return [text]

    overlap = min(max(0, overlap), max(chunk_size - 1, 0))
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        next_start = end - overlap if overlap > 0 else end
        if next_start <= start:
            next_start = start + 1
        start = next_start
    return chunks


def _enforce_chunk_limit(
    drafts: list[ChunkDraft],
) -> tuple[list[ChunkDraft], str | None]:
    if RAG_MAX_CHUNKS_PER_DOCUMENT <= 0 or len(drafts) <= RAG_MAX_CHUNKS_PER_DOCUMENT:
        return drafts, None
    total = len(drafts)
    return (
        drafts[:RAG_MAX_CHUNKS_PER_DOCUMENT],
        (
            f"Chỉ index {RAG_MAX_CHUNKS_PER_DOCUMENT}/{total} chunk đầu "
            f"do giới hạn tài liệu."
        ),
    )
