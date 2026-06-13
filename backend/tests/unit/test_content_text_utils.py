from app.modules.content.text_utils import strip_citations


def test_strip_citations_removes_page_tags():
    text = "Đây là mô tả hay [Trang 5]. Tiếp theo [Page 12] nữa."
    assert strip_citations(text) == "Đây là mô tả hay. Tiếp theo nữa."


def test_strip_citations_removes_section_tags():
    text = "Thông tin quan trọng [Mục Giới thiệu] ở đây."
    assert strip_citations(text) == "Thông tin quan trọng ở đây."
