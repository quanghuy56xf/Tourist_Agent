from unittest.mock import Mock

import pytest

from app.models.group import Group
from app.models.group_document import GroupDocument
from app.models.item import Item
from app.modules.content.relevance import is_item_related_to_documents


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
