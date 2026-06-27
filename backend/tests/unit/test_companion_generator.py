import asyncio

from langchain_core.documents import Document

from app.modules.llm.generator import RAGGenerator


class CapturingStreamingLLM:
    def __init__(self):
        self.messages = None

    async def astream(self, messages):
        self.messages = messages
        yield type("Chunk", (), {"content": "Xin chào."})()


def test_companion_prompt_includes_character_and_journey():
    generator = RAGGenerator.__new__(RAGGenerator)
    generator.llm = CapturingStreamingLLM()

    async def collect():
        return [
            chunk
            async for chunk in generator.generate_companion_chat_stream(
                message="Kể ta nghe đi",
                history=[],
                retrieved_docs=[Document(page_content="Verified context")],
                current_item="Khuê Văn Các",
                visited_items=["Cổng chính"],
            )
        ]

    assert asyncio.run(collect()) == ["Xin chào."]
    system_content = generator.llm.messages[0].content
    assert "Lê Quý Đôn" in system_content
    assert "18 tuổi" in system_content
    assert "Khuê Văn Các" in system_content
    assert "Cổng chính" in system_content
    assert "Context xác thực" in system_content


def test_companion_stream_prompt_guides_onboarding_and_offboarding():
    generator = RAGGenerator.__new__(RAGGenerator)
    generator.llm = CapturingStreamingLLM()

    async def collect():
        return [
            chunk
            async for chunk in generator.generate_companion_chat_stream(
                message="[SYSTEM_EVENT]: APP_OPENED",
                history=[],
                retrieved_docs=[],
                current_item=None,
                visited_items=["Cổng chính", "Khuê Văn Các"],
                next_item_name=None,
            )
        ]

    assert asyncio.run(collect()) == ["Xin chào."]
    system_content = generator.llm.messages[0].content
    assert "KẾT THÚC mỗi câu trả lời" in system_content
    assert "đã đi hết các điểm" in system_content
    assert "kết thúc hành trình" in system_content
