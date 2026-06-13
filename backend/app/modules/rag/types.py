from dataclasses import dataclass


@dataclass(frozen=True)
class StructuredSection:
    heading: str | None
    heading_level: int | None
    body: str
    source_hint: str | None = None


@dataclass(frozen=True)
class ChunkDraft:
    text: str
    section_title: str | None
    heading_level: int | None
    chunk_strategy: str  # section | section_split | character
