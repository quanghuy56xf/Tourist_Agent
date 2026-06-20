from types import SimpleNamespace

import pytest

from app.modules.llm.client import extract_complete_text


def test_extract_complete_text_rejects_token_limited_response():
    response = SimpleNamespace(
        content="Công trình này đánh dấu không",
        response_metadata={"finish_reason": "MAX_TOKENS"},
    )

    with pytest.raises(ValueError, match="incomplete"):
        extract_complete_text(response)


def test_extract_complete_text_accepts_non_punctuated_text():
    response = SimpleNamespace(
        content="Fun fact: công trình này là biểu tượng nổi bật ✨",
        response_metadata={"finish_reason": "STOP"},
    )

    assert extract_complete_text(response).endswith("✨")


def test_extract_complete_text_accepts_complete_sentence():
    response = SimpleNamespace(
        content="Công trình này đánh dấu không gian linh thiêng.",
        response_metadata={"finish_reason": "STOP"},
    )

    assert extract_complete_text(response).endswith(".")
