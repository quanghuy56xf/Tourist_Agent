from typing import List

from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    GOOGLE_API_KEY,
    LLM_MAX_OUTPUT_TOKENS,
    LLM_MAX_RETRIES,
    LLM_MODEL,
    LLM_PROVIDER,
    LLM_TIMEOUT_SECONDS,
)
from app.modules.llm.client import extract_complete_text, invoke_llm


def _build_llm(model_name: str | None, temperature: float):
    model = model_name or LLM_MODEL
    if LLM_PROVIDER == "deepseek":
        if not DEEPSEEK_API_KEY:
            raise ValueError("DEEPSEEK_API_KEY is not set.")
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model,
            temperature=temperature,
            api_key=DEEPSEEK_API_KEY,
            base_url=DEEPSEEK_BASE_URL,
            timeout=LLM_TIMEOUT_SECONDS,
            max_retries=LLM_MAX_RETRIES,
            max_tokens=LLM_MAX_OUTPUT_TOKENS,
        )

    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set.")

    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        api_key=GOOGLE_API_KEY,
        request_timeout=LLM_TIMEOUT_SECONDS,
        retries=LLM_MAX_RETRIES,
        max_output_tokens=LLM_MAX_OUTPUT_TOKENS,
    )


class RAGGenerator:
    def __init__(self, model_name: str | None = None, temperature: float = 0.2):
        self.llm = _build_llm(model_name, temperature)

    def _format_context(self, docs: List[Document]) -> str:
        formatted_docs = []
        for doc in docs:
            label = doc.metadata.get("section_title") or doc.metadata.get("page", "Unknown")
            formatted_docs.append(f"[Mục {label}]: {doc.page_content}")
        return "\n\n".join(formatted_docs)

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
6. Giới hạn độ dài: câu trả lời không quá 300 từ.
7. Length limit: the response must not exceed 300 words."""

        if persona == "Gen Z Explorer":
            persona_instructions = """Phong cách trả lời (Persona: Gen Z Explorer):
- Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại.
- Đưa các sự thật bất ngờ (Fact/Fun Fact) lên đầu.
- Sử dụng emoji một cách hợp lý."""
        elif persona == "Companion":
            persona_instructions = """Phong cách trả lời (Lê Quý Đôn 18 tuổi):
- Xưng "ta", gọi du khách là "bạn".
- Hào hứng, thông minh, kể chuyện sinh động nhưng không kiêu ngạo.
- Chỉ sử dụng dữ kiện trong tài liệu, tuyệt đối không bịa.
- Khi thiếu thông tin, thành thật nói rằng ta chưa đọc đến."""
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
        return extract_complete_text(response)

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
        elif persona == "Companion":
            persona_instructions = """Phong cách (Lê Quý Đôn 18 tuổi):
- Xưng "ta", gọi người nghe là "bạn".
- Giọng trẻ trung, uyên bác, hào hứng và sinh động.
- Có thể tự trêu nhẹ: "À ta lại nói nhiều quá rồi..."
- Giữ nguyên toàn bộ dữ kiện gốc, tuyệt đối không thêm thông tin."""
        elif persona == "Family Visitor":
            persona_instructions = """Phong cách (Family Visitor):
- Dành cho phụ huynh đi cùng con nhỏ.
- Kể chuyện, ví von đơn giản.
- Tránh thuật ngữ hàn lâm."""
        else:
            persona_instructions = """Phong cách: Mặc định, rõ ràng, lịch sự và chính xác."""

        prompt = f"""Bạn là biên tập viên nội dung thuyết minh di tích.

Viết lại mô tả về hiện vật "{item_name}" dựa trên nội dung gốc bên dưới.
Giữ nguyên các thông tin chính xác, không thêm chi tiết không có trong bản gốc.
{lang_instruction}
KHÔNG thêm trích dẫn dạng [Trang X] hay [Mục ...] — văn bản sẽ được đọc thành audio.
Giới hạn độ dài: câu trả lời không quá 300 từ.
Length limit: the response must not exceed 300 words.

{persona_instructions}

Nội dung gốc:
{base_content}

Mô tả đã viết lại:"""

        response = invoke_llm(self.llm, prompt)
        return extract_complete_text(response)

    def generate_chat(self, message: str, history: List[dict], retrieved_docs: List[Document], persona: str = "Mặc định", language: str = "Tiếng Việt") -> str:
        context = self._format_context(retrieved_docs) if retrieved_docs else "Không có ngữ cảnh bổ sung."

        lang_instruction = "BẮT BUỘC trả lời bằng Tiếng Việt." if language == "Tiếng Việt" else "BẮT BUỘC trả lời bằng Tiếng Anh (MUST ANSWER IN ENGLISH)."

        base_instructions = f"""Nhiệm vụ của bạn:
1. Bạn đang đóng vai trò một trợ lý ảo tư vấn về di tích lịch sử.
2. Trả lời câu hỏi dựa trên các thông tin có trong Tài liệu được cung cấp (nếu có).
3. Khi khách hỏi thêm chi tiết, điều thú vị, hoặc thông tin liên quan, hãy tổng hợp từ các đoạn tài liệu được cung cấp — kể cả khi đoạn không nhắc trực tiếp tên hiện vật — nếu nội dung liên quan đến khu di tích hoặc hiện vật đang xem.
4. Nếu thông tin không có trong tài liệu, hãy nói "Tôi chưa có đủ thông tin xác thực để trả lời chính xác câu hỏi này." và tuyệt đối KHÔNG tự bịa ra câu trả lời.
5. {lang_instruction}
6. Giới hạn độ dài: câu trả lời không quá 300 từ.
7. Length limit: the response must not exceed 300 words."""

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

        for msg in history[-10:]:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

        messages.append(HumanMessage(content=message))

        response = invoke_llm(self.llm, messages)
        return extract_complete_text(response)



    async def generate_companion_chat_stream(
        self,
        message: str,
        history: List[dict],
        retrieved_docs: List[Document],
        current_item: str | None,
        visited_items: List[str],
        next_item_name: str | None = None,
        language: str = "Tiếng Việt",
    ):
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        context = (
            self._format_context(retrieved_docs)
            if retrieved_docs
            else "Không có ngữ cảnh xác thực bổ sung."
        )
        journey = ", ".join(visited_items) if visited_items else "Chưa có điểm nào"
        current_item_str = current_item if current_item else "Chưa có hiện vật cụ thể nào"
        next_item_str = f"Gợi ý du khách đi tới: {next_item_name}" if next_item_name else ""
        suggestion_prompt = (
            f"KHI KẾT THÚC câu chuyện, HÃY luôn hỏi một câu mở để gợi ý khách đi tiếp, ví dụ: 'Bạn có muốn hỏi thêm gì về chỗ này không? Nếu không, điểm tiếp theo ta muốn dẫn bạn đến là {next_item_name}!'\n"
            "KẾT THÚC mỗi câu trả lời, hãy luôn đưa ra 1-2 câu hỏi mồi (gợi ý) để người dùng có thể hỏi thêm bạn. Đặt các câu hỏi gợi ý này trong cú pháp: ||Q: Câu hỏi 1|| ||Q: Câu hỏi 2||."
        ) if next_item_name else (
            "KHI KẾT THÚC câu chuyện, HÃY hỏi xem họ có muốn biết thêm chi tiết nào không.\n"
            "KẾT THÚC mỗi câu trả lời, hãy luôn đưa ra 1-2 câu hỏi mồi (gợi ý) để người dùng có thể hỏi thêm bạn. Đặt các câu hỏi gợi ý này trong cú pháp: ||Q: Câu hỏi 1|| ||Q: Câu hỏi 2||."
        )
        tour_completion_prompt = (
            "Du khách đã đi hết các điểm. Hãy khen ngợi họ, tóm tắt ngắn hành trình "
            "và kết thúc hành trình một cách ấm áp."
            if next_item_name is None and len(visited_items) > 1
            else ""
        )
        
        lang_instruction = "BẮT BUỘC trả lời bằng Tiếng Việt." if language == "Tiếng Việt" else "BẮT BUỘC trả lời bằng Tiếng Anh (MUST ANSWER IN ENGLISH)."

        system_prompt = f"""Ngươi là Lê Quý Đôn, 18 tuổi, một thần đồng trẻ tuổi quê Thái Bình,
đang chuẩn bị bước vào kỳ thi Đình tại Quốc Tử Giám.

Phong cách giao tiếp:
- Xưng "ta" hoặc "Đôn này", gọi du khách là "bạn".
- Tự tin, nhiệt huyết, hào hứng nhưng không kiêu ngạo.
{lang_instruction}

Du khách đã tham quan: {journey}
{next_item_str}
{tour_completion_prompt}

Context xác thực:
{context}
"""
        messages = [SystemMessage(content=system_prompt)]
        for entry in history[-10:]:
            if entry["role"] == "user":
                messages.append(HumanMessage(content=entry["content"]))
            elif entry["role"] == "assistant":
                messages.append(AIMessage(content=entry["content"]))
        messages.append(HumanMessage(content=message))

        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content

# Singleton instance
_generator_instance = None

def get_rag_generator() -> RAGGenerator:
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = RAGGenerator()
    return _generator_instance
