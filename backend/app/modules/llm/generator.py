from typing import List
from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import (
    GOOGLE_API_KEY,
    LLM_MAX_CHAT_HISTORY_CHARS,
    LLM_MAX_CHAT_HISTORY_MESSAGES,
    LLM_MAX_CONTEXT_CHARS,
    LLM_MAX_RETRIES,
    LLM_MODEL,
    LLM_TIMEOUT_SECONDS,
)
from app.modules.llm.client import extract_text_content, invoke_llm


class RAGGenerator:
    def __init__(self, model_name: str | None = None, temperature: float = 0.2):
        if not GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is not set.")

        self.llm = ChatGoogleGenerativeAI(
            model=model_name or LLM_MODEL,
            temperature=temperature,
            api_key=GOOGLE_API_KEY,
            request_timeout=LLM_TIMEOUT_SECONDS,
            retries=LLM_MAX_RETRIES,
        )

    @staticmethod
    def _truncate_text(text: str, max_chars: int) -> str:
        max_chars = max(0, max_chars)
        if len(text) <= max_chars:
            return text
        if max_chars <= 3:
            return text[:max_chars]
        return f"{text[:max_chars - 3].rstrip()}..."

    def _format_context(
        self,
        docs: List[Document],
        max_chars: int = LLM_MAX_CONTEXT_CHARS,
    ) -> str:
        formatted_context = ""
        for doc in docs:
            label = doc.metadata.get("section_title") or doc.metadata.get("page", "Unknown")
            block = f"[Mục {label}]: {doc.page_content}"
            separator = "\n\n" if formatted_context else ""
            remaining = max_chars - len(formatted_context) - len(separator)
            if remaining <= 0:
                break

            bounded_block = self._truncate_text(block, remaining)
            formatted_context += f"{separator}{bounded_block}"
            if len(bounded_block) < len(block):
                break

        return formatted_context

    def _bounded_history(
        self,
        history: List[dict],
        max_messages: int = LLM_MAX_CHAT_HISTORY_MESSAGES,
        max_chars: int = LLM_MAX_CHAT_HISTORY_CHARS,
    ) -> List[dict]:
        bounded_reversed = []
        remaining = max(0, max_chars)

        for message in reversed(history[-max(0, max_messages):]):
            if remaining <= 0:
                break

            content = str(message.get("content", ""))
            bounded_content = self._truncate_text(content, remaining)
            if bounded_content:
                bounded_reversed.append(
                    {"role": message.get("role"), "content": bounded_content}
                )
                remaining -= len(bounded_content)

        return list(reversed(bounded_reversed))

    def generate_answer(self, query: str, retrieved_docs: List[Document], persona: str = "Mặc định", language: str = "Tiếng Việt") -> str:
        if not retrieved_docs:
            return "Tôi không tìm thấy thông tin nào liên quan đến câu hỏi này trong tài liệu."

        context = self._format_context(retrieved_docs)

        lang_instruction = "BẮT BUỘC trả lời bằng Tiếng Việt." if language == "Tiếng Việt" else "BẮT BUỘC trả lời bằng Tiếng Anh (MUST ANSWER IN ENGLISH)."

        base_instructions = f"""Nhiệm vụ của bạn:
1. Trả lời câu hỏi CHỈ dựa trên các thông tin có trong Tài liệu được cung cấp ở trên.
2. NẾU tài liệu KHÔNG nhắc cụ thể đến hiện vật trong câu hỏi hoặc không có đủ chi tiết, hãy trả lời chính xác câu: "Tôi không tìm thấy thông tin trong tài liệu." và tuyệt đối KHÔNG tự bịa ra câu trả lời.
3. KHÔNG dùng kiến thức bên ngoài tài liệu, KHÔNG suy diễn thêm.
4. KHÔNG thêm trích dẫn nguồn dạng [Trang X] hay [Mục ...] — nội dung sẽ được đọc thành audio, cần văn phong tự nhiên, trôi chảy.
5. {lang_instruction}
6. Giới hạn độ dài: câu trả lời không quá 200 từ.
7. Length limit: the response must not exceed 200 words."""

        if persona == "Gen Z Explorer":
            persona_instructions = """Phong cách trả lời (Persona: Gen Z Explorer):
- Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại.
- Đưa các sự thật bất ngờ (Fact/Fun Fact) lên đầu.
- Sử dụng emoji một cách hợp lý."""
        elif persona == "Family Visitor":
            persona_instructions = """Phong cách trả lời (Persona: Family Visitor):
- Dành cho phụ huynh đi cùng con nhỏ.
- Sử dụng dạng kể chuyện (Storytelling), ví von đơn giản.
- Tuyệt đối tránh các thuật ngữ hàn lâm khó hiểu."""
        else:
            persona_instructions = """Phong cách trả lời: Mặc định, rõ ràng, lịch sự và chính xác."""

        prompt = f"""Bạn là một trợ lý AI thông minh về di tích lịch sử.

Tài liệu được cung cấp (Context):
{context}

Câu hỏi về hiện vật cần tìm hiểu:
{query}

{base_instructions}

{persona_instructions}

Câu trả lời:"""

        response = invoke_llm(self.llm, prompt)
        return extract_text_content(response.content)

    def adapt_content(
        self,
        base_content: str,
        item_name: str,
        persona: str = "Mặc định",
        language: str = "Tiếng Việt",
    ) -> str:
        lang_instruction = (
            "BẮT BUỘC viết bằng Tiếng Việt."
            if language == "Tiếng Việt"
            else "BẮT BUỘC viết bằng Tiếng Anh (MUST WRITE IN ENGLISH)."
        )

        if persona == "Gen Z Explorer":
            persona_instructions = """Phong cách (Gen Z Explorer):
- Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại.
- Đưa các sự thật bất ngờ lên đầu nếu phù hợp.
- Có thể dùng emoji hợp lý."""
        elif persona == "Family Visitor":
            persona_instructions = """Phong cách (Family Visitor):
- Dành cho phụ huynh đi cùng con nhỏ.
- Kể chuyện, ví von đơn giản.
- Tránh thuật ngữ hàn lâm."""
        else:
            persona_instructions = """Phong cách: Mặc định, rõ ràng, lịch sự và chính xác."""

        bounded_base_content = self._truncate_text(
            base_content,
            LLM_MAX_CONTEXT_CHARS,
        )

        prompt = f"""Bạn là biên tập viên nội dung thuyết minh di tích.

Viết lại mô tả về hiện vật "{item_name}" dựa trên nội dung gốc bên dưới.
Giữ nguyên các thông tin chính xác, không thêm chi tiết không có trong bản gốc.
{lang_instruction}
KHÔNG thêm trích dẫn dạng [Trang X] hay [Mục ...] — văn bản sẽ được đọc thành audio.
Giới hạn độ dài: câu trả lời không quá 200 từ.
Length limit: the response must not exceed 200 words.

{persona_instructions}

Nội dung gốc:
{bounded_base_content}

Mô tả đã viết lại:"""

        response = invoke_llm(self.llm, prompt)
        return extract_text_content(response.content)

    def generate_chat(self, message: str, history: List[dict], retrieved_docs: List[Document], persona: str = "Mặc định", language: str = "Tiếng Việt") -> str:
        context = self._format_context(retrieved_docs) if retrieved_docs else "Không có ngữ cảnh bổ sung."

        lang_instruction = "BẮT BUỘC trả lời bằng Tiếng Việt." if language == "Tiếng Việt" else "BẮT BUỘC trả lời bằng Tiếng Anh (MUST ANSWER IN ENGLISH)."

        base_instructions = f"""Nhiệm vụ của bạn:
1. Bạn đang đóng vai trò một trợ lý ảo tư vấn về di tích lịch sử.
2. Trả lời câu hỏi dựa trên các thông tin có trong Tài liệu được cung cấp (nếu có). Có thể dùng thông tin về toàn bộ khu di tích khi câu hỏi không chỉ nói riêng về hiện vật.
3. Nếu thông tin không có trong tài liệu, hãy nói "Tôi chưa có đủ thông tin xác thực để trả lời chính xác câu hỏi này." và tuyệt đối KHÔNG tự bịa ra câu trả lời.
4. {lang_instruction}
5. Giới hạn độ dài: câu trả lời không quá 150 từ.
6. Length limit: the response must not exceed 150 words."""

        if persona == "Gen Z Explorer":
            persona_instructions = """Phong cách trả lời (Persona: Gen Z Explorer):
- Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại.
- Sử dụng emoji một cách hợp lý."""
        elif persona == "Family Visitor":
            persona_instructions = """Phong cách trả lời (Persona: Family Visitor):
- Dành cho phụ huynh đi cùng con nhỏ.
- Sử dụng dạng kể chuyện, ví von đơn giản.
- Tuyệt đối tránh các thuật ngữ hàn lâm khó hiểu."""
        else:
            persona_instructions = """Phong cách trả lời: Mặc định, rõ ràng, lịch sự và chính xác."""

        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        system_prompt = f"""{base_instructions}

{persona_instructions}

Tài liệu được cung cấp (Context):
{context}
"""
        messages = [SystemMessage(content=system_prompt)]

        for msg in self._bounded_history(history):
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

        messages.append(HumanMessage(content=message))

        response = invoke_llm(self.llm, messages)
        return extract_text_content(response.content)


# Singleton instance
_generator_instance = None

def get_rag_generator() -> RAGGenerator:
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = RAGGenerator()
    return _generator_instance
