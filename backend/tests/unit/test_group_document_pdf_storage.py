from app.modules.rag.group_documents import GroupDocumentService


def test_prepare_storage_content_converts_pdf_to_txt():
    service = GroupDocumentService()
    pdf_bytes = b"not-a-real-pdf"

    def fake_extract(_content: bytes) -> str:
        return "Nội dung PDF đã trích xuất."

    from app.modules.rag import group_documents as module

    original = module.extract_pdf_text
    module.extract_pdf_text = fake_extract
    try:
        storage_type, storage_bytes, sections, original_filename = (
            service._prepare_storage_content("pdf", pdf_bytes, "tai-lieu.pdf")
        )
    finally:
        module.extract_pdf_text = original

    assert storage_type == "txt"
    assert storage_bytes == "Nội dung PDF đã trích xuất.".encode("utf-8")
    assert original_filename == "tai-lieu.pdf"
    assert len(sections) == 1
    assert sections[0].body == "Nội dung PDF đã trích xuất."
