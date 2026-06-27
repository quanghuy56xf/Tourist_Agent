from typing import List

from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI

from app.modules.rag.service import is_item_registration_document

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
from app.modules.content.language_support import (
    LANGUAGE_VI,
    answer_language_instruction,
    document_not_found_message,
    write_language_instruction,
)
from app.modules.llm.client import extract_complete_text, invoke_llm

_NATURAL_SPEECH_RULE = """KHÔNG mở đầu hoặc chen các cụm meta như "Dựa trên tài liệu được cung cấp",
"Theo thông tin trong tài liệu", "Based on the provided documents".
Viết như người thuyết minh tại chỗ: đi thẳng vào nội dung, tự nhiên, phù hợp đọc thành audio."""


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
            if is_item_registration_document(doc):
                label = doc.metadata.get("section_title", "Thông tin đăng ký hiện vật")
            else:
                label = doc.metadata.get("section_title") or doc.metadata.get(
                    "page", "Unknown"
                )
            formatted_docs.append(f"[Mục {label}]: {doc.page_content}")
        return "\n\n".join(formatted_docs)

    def _grounding_instructions(self, retrieved_docs: List[Document], language: str) -> str:
        lang_instruction = answer_language_instruction(language)
        has_registration = any(
            is_item_registration_document(doc) and (doc.page_content or "").strip()
            for doc in retrieved_docs
        )
        if has_registration:
            not_found_rule = (
                '3. Chỉ trả lời chính xác câu: "Tôi không tìm thấy thông tin trong tài liệu." '
                "khi KHÔNG có đủ chi tiết trong cả thông tin đăng ký lẫn tài liệu khu di tích."
            )
            registration_rule = (
                '2. Mục "Thông tin đăng ký hiện vật" là nguồn xác thực do quản trị viên nhập. '
                "Nếu mục này có đủ chi tiết về hiện vật, hãy dựa vào đó để trả lời — "
                "kể cả khi tài liệu khu di tích không nhắc cụ thể tên hiện vật."
            )
        else:
            registration_rule = (
                "2. NẾU tài liệu KHÔNG nhắc cụ thể đến hiện vật trong câu hỏi "
                "hoặc không có đủ chi tiết, hãy trả lời chính xác câu: "
                '"Tôi không tìm thấy thông tin trong tài liệu." '
                "và tuyệt đối KHÔNG tự bịa ra câu trả lời."
            )
            not_found_rule = ""

        return f"""Nhiệm vụ của bạn:
1. Trả lời câu hỏi CHỈ dựa trên các thông tin có trong Tài liệu được cung cấp ở trên.
{registration_rule}
{not_found_rule}
4. KHÔNG dùng kiến thức bên ngoài tài liệu, KHÔNG suy diễn thêm.
5. KHÔNG thêm trích dẫn nguồn dạng [Trang X] hay [Mục ...] — nội dung sẽ được đọc thành audio, cần văn phong tự nhiên, trôi chảy.
6. {_NATURAL_SPEECH_RULE}
7. {lang_instruction}
8. Giới hạn độ dài: câu trả lời không quá 300 từ.
9. Length limit: the response must not exceed 300 words."""

    def generate_answer(self, query: str, retrieved_docs: List[Document], persona: str = "Mặc định", language: str = "Tiếng Việt") -> str:
        if not retrieved_docs:
            return document_not_found_message(language)

        context = self._format_context(retrieved_docs)

        base_instructions = self._grounding_instructions(retrieved_docs, language)

        if persona == "Gen Z Explorer":
            persona_instructions = """Phong cách trả lời (Persona: Gen Z Explorer):
- Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại.
- Đưa các sự thật bất ngờ (Fact/Fun Fact) lên đầu nếu có trong tài liệu.
- KHÔNG dùng emoji (văn bản sẽ đọc thành audio)."""
        elif persona == "Companion":
            persona_instructions = """Phong cách trả lời (Lê Quý Đôn 18 tuổi):
- Xưng "ta", gọi du khách là "bạn".
- Hào hứng, thông minh, kể chuyện sinh động nhưng không kiêu ngạo.
- Chỉ sử dụng dữ kiện trong tài liệu, tuyệt đối không bịa.
- Khi thiếu thông tin, thành thật nói rằng ta chưa đọc đến.
- KHÔNG dùng emoji (văn bản sẽ đọc thành audio)."""
        elif persona == "Family Visitor":
            persona_instructions = """Phong cách trả lời (Persona: Family Visitor):
- Dành cho phụ huynh đi cùng con nhỏ.
- Sử dụng dạng kể chuyện (Storytelling), ví von đơn giản.
- Tuyệt đối tránh các thuật ngữ hàn lâm khó hiểu."""
        else:
            persona_instructions = """Phong cách trả lời: Mặc định — như hướng dẫn viên thuyết minh tại chỗ, rõ ràng, lịch sự.
Không nhắc đến "tài liệu", "nguồn tham khảo" hay "thông tin được cung cấp"."""

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
        lang_instruction = write_language_instruction(language)

        if persona == "Gen Z Explorer":
            persona_instructions = """Phong cách (Gen Z Explorer):
- Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại.
- Đưa các sự thật bất ngờ lên đầu nếu có trong bản gốc.
- KHÔNG dùng emoji (văn bản sẽ được đọc thành audio)."""
        elif persona == "Companion":
            persona_instructions = """Phong cách (Lê Quý Đôn 18 tuổi):
- Xưng "ta", gọi người nghe là "bạn".
- Giọng trẻ trung, uyên bác, hào hứng và sinh động.
- Có thể tự trào nhẹ: "Ôi ta lại nói nhiều quá rồi..."
- Giữ nguyên toàn bộ dữ kiện gốc, tuyệt đối không thêm thông tin.
- KHÔNG dùng emoji (văn bản sẽ được đọc thành audio)."""
        elif persona == "Family Visitor":
            persona_instructions = """Phong cách (Family Visitor):
- Dành cho phụ huynh đi cùng con nhỏ.
- Kể chuyện, ví von đơn giản.
- Tránh thuật ngữ hàn lâm."""
        else:
            persona_instructions = """Phong cách: Mặc định — như hướng dẫn viên thuyết minh tại chỗ, rõ ràng, lịch sự.
Không nhắc đến "tài liệu" hay "nguồn tham khảo"."""

        prompt = f"""Bạn là biên tập viên nội dung thuyết minh di tích.

Viết lại mô tả về hiện vật "{item_name}" dựa trên nội dung gốc bên dưới.
Nếu ngôn ngữ đích khác ngôn ngữ bản gốc, hãy DỊCH toàn bộ sang ngôn ngữ đích — không giữ nguyên tiếng Việt hay tiếng Anh trong bản trả lời.
Giữ nguyên các thông tin chính xác, KHÔNG thêm chi tiết không có trong bản gốc.
Nếu bản gốc cho biết không có đủ thông tin, hãy giữ nguyên ý đó (chỉ đổi phong cách/ngôn ngữ).
{lang_instruction}
KHÔNG thêm trích dẫn dạng [Trang X] hay [Mục ...] — văn bản sẽ được đọc thành audio.
{_NATURAL_SPEECH_RULE}
KHÔNG dùng emoji.
Giới hạn độ dài: câu trả lời không quá 300 từ.
Length limit: the response must not exceed 300 words.

{persona_instructions}

Nội dung gốc:
{base_content}

Mô tả đã viết lại:"""

        response = invoke_llm(self.llm, prompt)
        return extract_complete_text(response)

    def generate_chat(
        self,
        message: str,
        history: List[dict],
        retrieved_docs: List[Document],
        persona: str = "Mặc định",
        language: str = "Tiếng Việt",
        item_name: str = "",
    ) -> str:
        context = self._format_context(retrieved_docs) if retrieved_docs else "Không có ngữ cảnh bổ sung."
        artifact = " ".join((item_name or "").split()).strip() or "hiện vật đang xem"

        lang_instruction = answer_language_instruction(language)

        base_instructions = f"""Nhiệm vụ của bạn:
1. Bạn đang đóng vai trò một trợ lý ảo tư vấn về di tích lịch sử.
2. Khách đang xem hiện vật: {artifact}. Mọi câu trả lời phải xoay quanh hiện vật này; không chuyển sang giới thiệu công trình hoặc hiện vật khác trừ khi khách hỏi rõ ràng.
3. Trả lời câu hỏi dựa trên các thông tin có trong Tài liệu được cung cấp (nếu có).
4. Khi khách hỏi thêm chi tiết chung chung, hãy bổ sung thông tin về {artifact} từ tài liệu — không dùng đoạn tài liệu về chủ đề khác.
5. Nếu thông tin không có trong tài liệu, hãy nói "Tôi chưa có đủ thông tin xác thực để trả lời chính xác câu hỏi này." và tuyệt đối KHÔNG tự bịa ra câu trả lời.
6. {_NATURAL_SPEECH_RULE}
7. {lang_instruction}
8. Giới hạn độ dài: câu trả lời không quá 300 từ.
9. Length limit: the response must not exceed 300 words."""

        if persona == "Gen Z Explorer":
            persona_instructions = """Phong cách trả lời (Persona: Gen Z Explorer):
- Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại.
- KHÔNG dùng emoji (văn bản sẽ đọc thành audio)."""
        elif persona == "Family Visitor":
            persona_instructions = """Phong cách trả lời (Persona: Family Visitor):
- Dành cho phụ huynh đi cùng con nhỏ.
- Sử dụng dạng kể chuyện, ví von đơn giản.
- Tuyệt đối tránh các thuật ngữ hàn lâm khó hiểu."""
        else:
            persona_instructions = """Phong cách trả lời: Mặc định — như hướng dẫn viên thuyết minh tại chỗ, rõ ràng, lịch sự.
Không nhắc đến "tài liệu" hay "nguồn tham khảo"."""

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
        if language != "Tiếng Việt":
            lang_instruction = answer_language_instruction(language)
            journey_str = ", ".join(visited_items) if visited_items else "No locations visited yet"
            current_item_str = current_item if current_item else "No specific object"
            next_item_str = f"Suggest the visitor to go to: {next_item_name}" if next_item_name else ""
            
            if next_item_name:
                suggestion_prompt = (
                    f"AT THE END of the story, ALWAYS ask an open question to suggest the next stop, for example: 'Do you want to know more about this place? If not, the next stop I want to show you is {next_item_name}!'\n"
                    "AT THE END of each response, ALWAYS provide 1-2 suggested questions for the visitor to ask you more. These questions MUST strictly relate to the historical site, specific artifacts, or unique historical facts. Put these suggested questions in the syntax: ||Q: Question 1|| ||Q: Question 2||."
                )
            else:
                suggestion_prompt = (
                    "AT THE END of the story, ALWAYS ask if they want to know more details.\n"
                    "AT THE END of each response, ALWAYS provide 1-2 suggested questions for the visitor to ask you more. These questions MUST strictly relate to the historical site, specific artifacts, or unique historical facts. Put these suggested questions in the syntax: ||Q: Question 1|| ||Q: Question 2||."
                )
            tour_completion_prompt = (
                "The visitor has visited all stops. Praise them, briefly summarize the journey "
                "and conclude the journey warmly."
                if next_item_name is None and len(visited_items) > 1
                else ""
            )
            system_prompt = f"""You are Lê Quý Đôn, 18 years old, a young prodigy from Thái Bình,
preparing for the Đình exam at the Temple of Literature.

Communication style:
- Refer to yourself as "I" or "Đôn", call the visitor "you".
- Confident, enthusiastic, and excited, but not arrogant.
- If the requested information is NOT in the Verified Context, gracefully decline to answer by finding a polite excuse related to your persona (e.g., claiming you haven't read that book yet, or your focus is only on the exams). Do NOT make up facts or use external knowledge outside the provided context.
{lang_instruction}
{suggestion_prompt}

Current object: {current_item_str}
Visitor has visited: {journey_str}
{next_item_str}
{tour_completion_prompt}

Verified Context:
{context}
"""
        else:
            lang_instruction = answer_language_instruction(language)
            journey_str = ", ".join(visited_items) if visited_items else "Chưa có điểm nào"
            current_item_str = current_item if current_item else "Chưa có hiện vật cụ thể nào"
            next_item_str = f"Gợi ý du khách đi tới: {next_item_name}" if next_item_name else ""
            
            if next_item_name:
                suggestion_prompt = (
                    f"KHI KẾT THÚC câu chuyện, HÃY luôn hỏi một câu mở để gợi ý khách đi tiếp, ví dụ: 'Bạn có muốn hỏi thêm gì về chỗ này không? Nếu không, điểm tiếp theo ta muốn dẫn bạn đến là {next_item_name}!'\n"
                    "KẾT THÚC mỗi câu trả lời, hãy luôn đưa ra 1-2 câu hỏi mồi (gợi ý) để người dùng có thể hỏi thêm bạn. YÊU CẦU ƯU TIÊN các câu hỏi mồi liên quan trực tiếp đến khu di tích, hiện vật hoặc những sự thật lịch sử thú vị độc đáo. Đặt các câu hỏi gợi ý này trong cú pháp: ||Q: Câu hỏi 1|| ||Q: Câu hỏi 2||."
                )
            else:
                suggestion_prompt = (
                    "KHI KẾT THÚC câu chuyện, HÃY hỏi xem họ có muốn biết thêm chi tiết nào không.\n"
                    "KẾT THÚC mỗi câu trả lời, hãy luôn đưa ra 1-2 câu hỏi mồi (gợi ý) để người dùng có thể hỏi thêm bạn. YÊU CẦU ƯU TIÊN các câu hỏi mồi liên quan trực tiếp đến khu di tích, hiện vật hoặc những sự thật lịch sử thú vị độc đáo. Đặt các câu hỏi gợi ý này trong cú pháp: ||Q: Câu hỏi 1|| ||Q: Câu hỏi 2||."
                )
            tour_completion_prompt = (
                "Du khách đã đi hết các điểm. Hãy khen ngợi họ, tóm tắt ngắn hành trình "
                "và kết thúc hành trình một cách ấm áp."
                if next_item_name is None and len(visited_items) > 1
                else ""
            )
            system_prompt = f"""Ngươi là Lê Quý Đôn, 18 tuổi, một thần đồng trẻ tuổi quê Thái Bình,
đang chuẩn bị bước vào kỳ thi Đình tại Quốc Tử Giám.

Phong cách giao tiếp:
- Xưng "ta" hoặc "Đôn này", gọi du khách là "bạn".
- Tự tin, nhiệt huyết, hào hứng nhưng không kiêu ngạo.
- NẾU thông tin KHÔNG có trong Context xác thực, hãy từ chối trả lời một cách khéo léo, tự nhiên và đa dạng theo đúng vai diễn của mình (ví dụ: lấy cớ chưa đọc tới cuốn sách đó, hoặc chỉ đang bận tâm tới việc khoa cử). Tuyệt đối KHÔNG được bịa đặt thông tin và KHÔNG sử dụng kiến thức hiện đại ngoài bối cảnh nhân vật.
{lang_instruction}
{suggestion_prompt}

Hiện vật hiện tại: {current_item_str}
Du khách đã tham quan: {journey_str}
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
