from unittest.mock import Mock

from langchain_core.documents import Document

from app.modules.content.service import ItemContentService
from app.modules.llm.generator import RAGGenerator
from app.modules.rag.service import (
    ITEM_REGISTRATION_SECTION,
    ITEM_REGISTRATION_SOURCE,
    build_item_registration_document,
)


def test_format_context_labels_registration_chunk():
    docs = [
        build_item_registration_document(3, "Mô tả đăng ký chi tiết về hiện vật."),
        Document(
            page_content="Thông tin từ tài liệu khu di tích.",
            metadata={"source": "group_doc", "page": "kb-1"},
        ),
    ]

    context = RAGGenerator.__new__(RAGGenerator)._format_context(docs)

    assert f"[Mục {ITEM_REGISTRATION_SECTION}]" in context
    assert "Mô tả đăng ký chi tiết về hiện vật." in context


def test_grounding_instructions_recognize_registration_chunk():
    docs = [
        build_item_registration_document(3, "Mô tả đăng ký chi tiết về hiện vật."),
    ]

    instructions = RAGGenerator.__new__(RAGGenerator)._grounding_instructions(
        docs,
        "Tiếng Việt",
    )

    assert "Thông tin đăng ký hiện vật" in instructions
    assert "kể cả khi tài liệu khu di tích không nhắc cụ thể" in instructions


def test_generate_text_uses_registration_when_llm_returns_not_found(
    monkeypatch,
):
    from app.models.item import Item

    item = Item(
        name="Đại Trung Môn",
        description=(
            "Cổng nằm sau khu vực nhập môn, dẫn vào không gian trung tâm "
            "của Văn Miếu. Tên gọi Đại Trung thể hiện tư tưởng trung dung."
        ),
        group_id=1,
    )
    registration_doc = build_item_registration_document(item.id, item.description)
    generator = Mock()
    generator.generate_answer.return_value = (
        "Tôi không tìm thấy thông tin trong tài liệu."
    )

    monkeypatch.setattr(
        "app.modules.content.service.get_rag_generator",
        lambda: generator,
    )
    monkeypatch.setattr(
        "app.modules.content.service.build_verified_item_context",
        lambda **kwargs: ([registration_doc], True),
    )

    text, source = ItemContentService().generate_text(item, "Mặc định", "Tiếng Việt")

    assert text == item.description
    assert source == "generated"
    generator.adapt_content.assert_not_called()
