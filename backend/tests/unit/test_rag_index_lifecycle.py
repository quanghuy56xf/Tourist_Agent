from langchain_core.documents import Document

from app.models.group import Group
from app.models.group_document import GroupDocument
from app.modules.rag import index_lifecycle


class FakeRetriever:
    def __init__(self):
        self.chunks = []
        self.upserts = []

    def upsert_group_document(self, *args, **kwargs):
        self.upserts.append((args, kwargs))
        document_id, group_id, title, chunk_drafts = args
        self.chunks = [
            chunk
            for chunk in self.chunks
            if (chunk.metadata or {}).get("document_id") != document_id
        ]
        for index, draft in enumerate(chunk_drafts):
            self.chunks.append(
                Document(
                    page_content=draft.text,
                    metadata={
                        "source": "group_doc",
                        "group_id": group_id,
                        "document_id": document_id,
                        "document_title": title,
                        "document_version": kwargs["document_version"],
                        "page": f"group-doc-{document_id}-chunk-{index}",
                    },
                )
            )


def test_group_index_health_detects_missing_stale_and_orphan_chunks(db_session, monkeypatch):
    group = Group(name="RAG group")
    db_session.add(group)
    db_session.flush()
    document = GroupDocument(
        group_id=group.id,
        title="Doc",
        source_type="txt",
        extracted_text="Alpha\n\nBeta",
        canonical_text="Alpha\n\nBeta",
        chunk_count=2,
        status="ready",
        knowledge_version=2,
    )
    db_session.add(document)
    db_session.commit()

    retriever = FakeRetriever()
    retriever.chunks = [
        Document(
            page_content="Alpha",
            metadata={
                "source": "group_doc",
                "group_id": group.id,
                "document_id": document.id,
                "document_version": 1,
                "page": f"group-doc-{document.id}-chunk-0",
            },
        ),
        Document(
            page_content="Orphan",
            metadata={
                "source": "group_doc",
                "group_id": group.id,
                "document_id": 999,
                "document_version": 1,
                "page": "group-doc-999-chunk-0",
            },
        ),
    ]
    monkeypatch.setattr(index_lifecycle, "try_get_rag_retriever", lambda: retriever)

    health = index_lifecycle.get_group_index_health(db_session, group.id)

    assert health.healthy is False
    assert health.orphan_chunk_ids == ["group-doc-999-chunk-0"]
    assert health.documents[0].missing_chunk_ids == [f"group-doc-{document.id}-chunk-1"]
    assert health.documents[0].stale_chunk_ids == [f"group-doc-{document.id}-chunk-0"]


def test_reindex_group_document_rebuilds_chunks(db_session, monkeypatch):
    group = Group(name="RAG group")
    db_session.add(group)
    db_session.flush()
    document = GroupDocument(
        group_id=group.id,
        title="Doc",
        source_type="txt",
        extracted_text="",
        canonical_text="# Title\n\nAlpha knowledge",
        chunk_count=0,
        status="ready",
        knowledge_version=3,
    )
    db_session.add(document)
    db_session.commit()

    retriever = FakeRetriever()
    monkeypatch.setattr(index_lifecycle, "try_get_rag_retriever", lambda: retriever)

    status = index_lifecycle.reindex_group_document(db_session, group.id, document.id)

    assert status.healthy is True
    assert status.indexed_chunks == 1
    assert retriever.upserts[0][1]["document_version"] == 3
    assert db_session.get(GroupDocument, document.id).chunk_count == 1
