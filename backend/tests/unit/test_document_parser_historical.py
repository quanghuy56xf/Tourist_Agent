from app.modules.rag.chunking import sections_to_chunks
from app.modules.rag.document_parser import parse_flat_text_sections, parse_text_sections
from app.modules.rag.group_documents import chunks_from_canonical_markdown
from app.modules.rag.normalization import sections_to_canonical_markdown


HISTORICAL_TEXT = """
Chương Bốn

I - Khảo quan thời Hậu Lê

Năm 1247 thi Đại tỉ lấy đỗ Trạng-nguyên, Bảng-nhãn, Thám-hoa.

1- Nhà Lý

Đời Lý có lệ thi để chọn người tài cho triều đình.
""".strip()


def test_historical_sections_include_context_stack():
    sections = parse_text_sections(HISTORICAL_TEXT)

    assert len(sections) == 2
    assert sections[0].heading == "[Ngữ cảnh: Chương Bốn > I - Khảo quan thời Hậu Lê]"
    assert sections[0].heading_level == 2
    assert sections[0].source_hint == "historical"
    assert "Năm 1247" in sections[0].body
    assert sections[1].heading == (
        "[Ngữ cảnh: Chương Bốn > I - Khảo quan thời Hậu Lê > 1- Nhà Lý]"
    )
    assert sections[1].heading_level == 3
    assert "Đời Lý" in sections[1].body


def test_historical_detection_avoids_chuong_trinh_false_positive():
    sections = parse_text_sections("Chương trình tham quan địa phương rất thú vị.")

    assert len(sections) == 1
    assert sections[0].source_hint == "text:flat"
    assert sections[0].heading is None


def test_flat_text_sections_use_historical_parser_for_pdf_text():
    sections = parse_flat_text_sections(HISTORICAL_TEXT, source_hint="pdf:txt")

    assert len(sections) == 2
    assert sections[0].source_hint == "historical"
    assert sections[0].heading == "[Ngữ cảnh: Chương Bốn > I - Khảo quan thời Hậu Lê]"


def test_markdown_first_chunking_preserves_historical_context():
    source_sections = parse_text_sections(HISTORICAL_TEXT)
    canonical_text = sections_to_canonical_markdown(source_sections)
    canonical_sections, (chunks, warning) = chunks_from_canonical_markdown(canonical_text)

    assert warning is None
    assert len(canonical_sections) == 2
    assert chunks[0].text.startswith("[Ngữ cảnh: Chương Bốn > I - Khảo quan thời Hậu Lê]")
    assert "Năm 1247" in chunks[0].text


def test_sections_to_chunks_prepends_historical_context():
    sections = parse_flat_text_sections(HISTORICAL_TEXT, source_hint="pdf:txt")
    chunks = sections_to_chunks(sections)

    assert chunks[0].section_title == "[Ngữ cảnh: Chương Bốn > I - Khảo quan thời Hậu Lê]"
    assert chunks[0].text.startswith("[Ngữ cảnh: Chương Bốn > I - Khảo quan thời Hậu Lê]")
    assert "Năm 1247" in chunks[0].text


def test_table_of_contents_is_removed_before_historical_parsing():
    text = """
Khoa Cử Việt Nam

Bảng chữ viết tắt
PHẦN I: THI HỘI
Chương một : Định kỳ - Phép thi
I - Thi Hội trước thời Nguyễn
1- Nhà Lý
2- Nhà Trần
III - Trích
. Thi Hội
. Những chứng nhân thời Hậu Lê
Chương hai : Trường thi
I - Trường thi trước thời Nguyễn
1- Nhà Lý
2- Nhà Trần
Chương ba : Thí sinh
I - Luật lệ trước thời Nguyễn
II - Luật lệ thời Nguyễn

PHẦN I: THI HỘI
CHƯƠNG MỘT
THI HỘI : ĐỊNH KỲ - PHÉP THI

Thi Hội trỏ vào kỳ thi dành cho những người đã đỗ Hương cống.
I - THI HỘI TRƯỚC THỜI NGUYỀN
1- NHÀ LÝ
Nhà Lý chỉ tổ chức được bẩy kỳ thi.
""".strip()

    sections = parse_flat_text_sections(text, source_hint="pdf:txt")

    plain_text = "\n\n".join(section.body for section in sections)
    assert "1- Nhà Lý\n\nPHẦN I" not in plain_text
    assert "Thi Hội trỏ vào kỳ thi" in plain_text
    assert any("Thi Hội trỏ vào kỳ thi" in section.body for section in sections)
    assert not any("Bảng chữ viết tắt" in section.body for section in sections)
