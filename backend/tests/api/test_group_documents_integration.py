from unittest.mock import Mock

import pytest

from app.models.group import Group
from app.models.item import Item
from app.modules.content.service import compute_content_hash
from app.modules.rag import group_documents_router


def test_generated_content_hash_changes_with_group_knowledge_version(db_session):
    group = Group(name="Hash group", knowledge_version=1)
    db_session.add(group)
    db_session.flush()
    item = Item(name="Item", description="Desc", group_id=group.id)
    db_session.add(item)
    db_session.commit()

    first = compute_content_hash(item.description, 1)
    group.knowledge_version = 2
    db_session.commit()
    second = compute_content_hash(item.description, 2)

    assert first != second


def test_manual_content_hash_ignores_group_knowledge_version():
    first = compute_content_hash("Manual content", 1, source="manual")
    second = compute_content_hash("Manual content", 2, source="manual")

    assert first == second


def test_create_document_invalidates_all_item_content_variants(
    client,
    db_session,
    monkeypatch,
):
    from app.models.content_variant import ItemContentVariant
    from app.modules.content.service import get_item_content_service

    group = Group(name="Invalidate group", knowledge_version=1)
    db_session.add(group)
    db_session.flush()
    related = Item(name="Văn Miếu", description="Desc", group_id=group.id)
    unrelated = Item(name="Other", description="Desc", group_id=group.id)
    db_session.add_all([related, unrelated])
    db_session.flush()
    for item in (related, unrelated):
        db_session.add(
            ItemContentVariant(
                item_id=item.id,
                persona="Mặc định",
                language="Tiếng Việt",
                text_content="Cached",
                content_hash=compute_content_hash(item.description),
                status="ready",
                source="pregenerated",
            )
        )
    db_session.commit()

    retriever = Mock()
    retriever.upsert_group_document = Mock()
    retriever.retrieve = Mock(return_value=[])
    monkeypatch.setattr(
        "app.modules.rag.group_documents.try_get_rag_retriever",
        lambda: retriever,
    )
    monkeypatch.setattr(
        "app.modules.content.relevance.try_get_rag_retriever",
        lambda: retriever,
    )
    monkeypatch.setattr(
        "app.modules.rag.group_documents_router.regenerate_related_items_task",
        lambda *args, **kwargs: None,
    )

    response = client.post(
        f"/api/groups/{group.id}/documents",
        data={"title": "Doc", "text": "# Văn Miếu\n\nThông tin về Văn Miếu."},
    )
    assert response.status_code == 201

    related_variant = get_item_content_service().get_valid_variant(
        db_session,
        related,
        "Mặc định",
        "Tiếng Việt",
    )
    unrelated_variant = get_item_content_service().get_valid_variant(
        db_session,
        unrelated,
        "Mặc định",
        "Tiếng Việt",
    )
    assert related_variant is None
    assert unrelated_variant is None


def test_title_only_document_update_invalidates_all_content_variants(
    client,
    db_session,
    monkeypatch,
):
    from app.models.content_variant import ItemContentVariant

    group = Group(name="Title update group", knowledge_version=1)
    db_session.add(group)
    db_session.flush()
    first = Item(name="First", description="Description", group_id=group.id)
    second = Item(name="Second", description="Description", group_id=group.id)
    db_session.add_all([first, second])
    db_session.commit()

    retriever = Mock()
    retriever.upsert_group_document = Mock()
    retriever.retrieve = Mock(return_value=[])
    monkeypatch.setattr(
        "app.modules.rag.group_documents.try_get_rag_retriever",
        lambda: retriever,
    )
    monkeypatch.setattr(
        "app.modules.rag.group_documents_router.regenerate_related_items_task",
        lambda *args, **kwargs: None,
    )

    created = client.post(
        f"/api/groups/{group.id}/documents",
        data={"title": "Original", "text": "Reference content."},
    )
    assert created.status_code == 201

    for item in (first, second):
        db_session.add(
            ItemContentVariant(
                item_id=item.id,
                persona="Mặc định",
                language="Tiếng Việt",
                text_content="Cached.",
                content_hash=compute_content_hash(item.description),
                status="ready",
                source="generated",
            )
        )
    db_session.commit()

    response = client.put(
        f"/api/groups/{group.id}/documents/{created.json()['id']}",
        data={"title": "Renamed"},
    )

    assert response.status_code == 200
    assert db_session.query(ItemContentVariant).count() == 0