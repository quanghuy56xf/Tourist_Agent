from unittest.mock import Mock

import pytest
from langchain_core.documents import Document

from app.models.group import Group
from app.models.group_document import GroupDocument
from app.models.item import Item
from app.modules.content.relevance import (
    is_item_related_to_documents,
    items_affected_by_documents,
)


def test_is_item_related_when_name_in_document_text(db_session):
    group = Group(name="G")
    db_session.add(group)
    db_session.flush()
    item = Item(name="Văn Miếu", description="Di tích", group_id=group.id)
    db_session.add(item)
    db_session.add(
        GroupDocument(
            group_id=group.id,
            title="Doc",
            source_type="text",
            extracted_text="Văn Miếu là di tích quan trọng.",
            storage_path="x.txt",
            chunk_count=1,
            status="ready",
        )
    )
    db_session.commit()

    assert is_item_related_to_documents(db_session, item, document_ids=None) is True


def test_is_item_related_when_changed_doc_in_top_k(db_session, monkeypatch):
    group = Group(name="G")
    db_session.add(group)
    db_session.flush()
    item = Item(name="Chuông đồng", description="Hiện vật", group_id=group.id)
    db_session.add(item)
    document = GroupDocument(
        group_id=group.id,
        title="Doc",
        source_type="text",
        extracted_text="Thông tin về chuông đồng thời Lý.",
        storage_path="x.txt",
        chunk_count=1,
        status="ready",
    )
    db_session.add(document)
    db_session.commit()

    retriever = Mock()
    retriever.retrieve = Mock(
        return_value=[
            Document(
                page_content="Chunk về chuông đồng.",
                metadata={"source": "group_doc", "document_id": document.id},
            )
        ]
    )
    monkeypatch.setattr(
        "app.modules.content.relevance.try_get_rag_retriever",
        lambda: retriever,
    )

    assert is_item_related_to_documents(db_session, item, document_ids=[document.id]) is True


def test_is_item_not_related_when_no_match(db_session, monkeypatch):
    group = Group(name="G")
    db_session.add(group)
    db_session.flush()
    item = Item(name="Unrelated", description="Desc", group_id=group.id)
    db_session.add(item)
    document = GroupDocument(
        group_id=group.id,
        title="Doc",
        source_type="text",
        extracted_text="Totally different topic.",
        storage_path="x.txt",
        chunk_count=1,
        status="ready",
    )
    db_session.add(document)
    db_session.commit()

    retriever = Mock()
    retriever.retrieve = Mock(return_value=[])
    monkeypatch.setattr(
        "app.modules.content.relevance.try_get_rag_retriever",
        lambda: retriever,
    )

    assert is_item_related_to_documents(db_session, item, document_ids=[document.id]) is False


def test_items_affected_filters_by_top_k_chunks(db_session, monkeypatch):
    group = Group(name="G")
    db_session.add(group)
    db_session.flush()
    related = Item(name="Chuông", description="A", group_id=group.id)
    unrelated = Item(name="Khác", description="B", group_id=group.id)
    db_session.add_all([related, unrelated])
    document = GroupDocument(
        group_id=group.id,
        title="Doc",
        source_type="text",
        extracted_text="Topic",
        storage_path="x.txt",
        chunk_count=1,
        status="ready",
    )
    db_session.add(document)
    db_session.commit()

    def fake_retrieve(query, top_k, group_id):
        if "Chuông" in query:
            return [
                Document(
                    page_content="Chunk",
                    metadata={"source": "group_doc", "document_id": document.id},
                )
            ]
        return []

    retriever = Mock()
    retriever.retrieve = Mock(side_effect=fake_retrieve)
    monkeypatch.setattr(
        "app.modules.content.relevance.try_get_rag_retriever",
        lambda: retriever,
    )

    affected = items_affected_by_documents(db_session, group.id, [document.id])
    assert related.id in affected
    assert unrelated.id not in affected
