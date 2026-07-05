from langchain_core.documents import Document

from app.modules.rag.reranker import rerank_documents


def test_reranker_uses_document_title_for_query_overlap():
    query = "vị trạng nguyên đầu tiên được khắc tên trên văn miếu"
    documents = [
        Document(
            page_content="Nguyễn Trực đỗ đầu khoa thi và được khắc tên trên bia Tiến sĩ.",
            metadata={
                "source": "group_doc",
                "document_title": "dung-bia-tien-si-tai-van-mieu-quoc-tu-giam_ocr",
                "section_title": "",
                "quality_score": 1.0,
            },
        ),
        Document(
            page_content="Người thợ đá đầu tiên khắc bia tại Văn Miếu - Quốc Tử Giám.",
            metadata={
                "source": "group_doc",
                "document_title": "tai-lieu-khac",
                "section_title": "",
                "quality_score": 1.0,
            },
        ),
    ]

    reranked = rerank_documents(
        query=query,
        item_name="Bia Tiến sĩ",
        item_description="",
        documents=documents,
    )

    assert reranked[0].page_content.startswith("Nguyễn Trực")
    assert "document_title_overlap" in reranked[0].metadata["rerank_reasons"]
    assert reranked[0].metadata["rerank_score"] > reranked[1].metadata["rerank_score"]
