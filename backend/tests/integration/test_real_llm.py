import os

import pytest
from langchain_core.documents import Document

from app.modules.llm.generator import get_rag_generator

pytestmark = pytest.mark.integration


@pytest.mark.skipif(
    os.getenv("RUN_EXTERNAL_LLM_TESTS") != "true",
    reason="External Gemini test is opt-in",
)
def test_real_story_generation_returns_plain_text():
    content = get_rag_generator().generate_answer(
        query="Kể một câu chuyện ngắn về hiện vật.",
        retrieved_docs=[
            Document(
                page_content=(
                    "Hiện vật được tạo năm 2024 để kiểm thử hệ thống."
                ),
                metadata={"page": "test-1"},
            )
        ],
        persona="Family Visitor",
        language="Tiếng Việt",
    )

    assert isinstance(content, str)
    assert content.strip()
