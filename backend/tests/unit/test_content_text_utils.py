from app.modules.content.text_utils import polish_generated_text, strip_citations


def test_strip_citations_removes_page_tags():
    text = "Đây là mô tả hay [Trang 5]. Tiếp theo [Page 12] nữa."
    assert strip_citations(text) == "Đây là mô tả hay. Tiếp theo nữa."


def test_strip_citations_removes_section_tags():
    text = "Thông tin quan trọng [Mục Giới thiệu] ở đây."
    assert strip_citations(text) == "Thông tin quan trọng ở đây."


def test_strip_meta_phrases_removes_document_lead_in_vi():
    text = "Dựa trên tài liệu được cung cấp, đây là cổng chính của Văn Miếu."
    assert polish_generated_text(text) == "Đây là cổng chính của Văn Miếu."


def test_strip_meta_phrases_removes_document_lead_in_en():
    text = "Based on the provided documents, this gate leads to the main courtyard."
    assert (
        polish_generated_text(text)
        == "This gate leads to the main courtyard."
    )


def test_polish_generated_text_applies_citations_and_meta_cleanup():
    text = "Theo thông tin trong tài liệu [Trang 2], hiện vật này là trống đồng."
    assert polish_generated_text(text) == "Hiện vật này là trống đồng."
