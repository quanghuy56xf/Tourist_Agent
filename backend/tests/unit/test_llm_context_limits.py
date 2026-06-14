from langchain_core.documents import Document

from app.modules.llm.generator import RAGGenerator


def make_generator() -> RAGGenerator:
    return RAGGenerator.__new__(RAGGenerator)


def test_format_context_respects_aggregate_character_limit():
    generator = make_generator()
    docs = [
        Document(page_content="A" * 80, metadata={"section_title": "One"}),
        Document(page_content="B" * 80, metadata={"section_title": "Two"}),
    ]

    context = generator._format_context(docs, max_chars=100)

    assert len(context) <= 100
    assert context.startswith("[Mục One]:")
    assert "A" in context


def test_bounded_history_prioritizes_recent_messages():
    generator = make_generator()
    history = [
        {"role": "user", "content": "old" * 20},
        {"role": "assistant", "content": "middle" * 10},
        {"role": "user", "content": "latest" * 10},
    ]

    bounded = generator._bounded_history(
        history,
        max_messages=10,
        max_chars=80,
    )

    assert sum(len(message["content"]) for message in bounded) <= 80
    assert bounded[-1]["content"].startswith("latest")
    assert all("old" not in message["content"] for message in bounded)


def test_bounded_history_respects_message_count_limit():
    generator = make_generator()
    history = [
        {"role": "user", "content": str(index)}
        for index in range(12)
    ]

    bounded = generator._bounded_history(
        history,
        max_messages=3,
        max_chars=100,
    )

    assert [message["content"] for message in bounded] == ["9", "10", "11"]
