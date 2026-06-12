import pytest

from app.modules.llm.client import extract_text_content


def test_extracts_string_content():
    assert extract_text_content("A story") == "A story"


def test_extracts_text_blocks():
    content = [
        {"type": "text", "text": "First paragraph."},
        {"type": "text", "text": "Second paragraph."},
    ]

    assert extract_text_content(content) == "First paragraph.\nSecond paragraph."


def test_rejects_empty_content():
    with pytest.raises(ValueError, match="empty text"):
        extract_text_content([])
