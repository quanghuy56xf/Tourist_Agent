from app.modules.rag.chunking import sections_to_chunks
from app.modules.rag.document_parser import parse_flat_text_sections, parse_text_sections
from app.modules.rag.types import StructuredSection


def test_markdown_sections_become_single_chunks():
    text = "# Giới thiệu\n\nNội dung mục một.\n\n## Chi tiết\n\nNội dung mục hai."
    sections = parse_text_sections(text)
    chunks = sections_to_chunks(sections)

    assert len(sections) == 2
    assert len(chunks) == 2
    assert chunks[0].chunk_strategy == "section"
    assert chunks[0].section_title == "Giới thiệu"
    assert "Nội dung mục một" in chunks[0].text


def test_long_section_is_split_with_heading_prefix():
    body = "a" * 2100
    sections = [
        StructuredSection(
            heading="Mục dài",
            heading_level=2,
            body=body,
            source_hint="md",
        )
    ]
    chunks = sections_to_chunks(sections)

    assert len(chunks) >= 2
    assert all(chunk.chunk_strategy == "section_split" for chunk in chunks)
    assert all(chunk.text.startswith("Mục dài") for chunk in chunks)


def test_flat_text_uses_character_fallback():
    text = "x" * 2500
    sections = parse_text_sections(text)
    chunks = sections_to_chunks(sections)

    assert len(chunks) >= 2
    assert all(chunk.chunk_strategy == "character" for chunk in chunks)


def test_flat_text_sections_skip_heuristic_split():
    blocks = "\n\n".join(f"Đoạn {index}\nNội dung ngắn." for index in range(50))
    flat_sections = parse_flat_text_sections(blocks, source_hint="pdf:txt")
    heuristic_sections = parse_text_sections(blocks)

    assert len(flat_sections) == 1
    assert len(heuristic_sections) > 1

    flat_chunks = sections_to_chunks(flat_sections)
    heuristic_chunks = sections_to_chunks(heuristic_sections)
    assert len(flat_chunks) < len(heuristic_chunks)
