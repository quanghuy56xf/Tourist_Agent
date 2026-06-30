from datetime import datetime
from unittest.mock import Mock

import pytest

from app.models.group import Group
from app.modules.rag import group_documents_router


class FakeGroupDocumentService:
    def __init__(self):
        self.documents: list[dict] = []
        self.next_id = 1

    def list_documents(self, db, group_id):
        return [Mock(**doc) for doc in self.documents if doc["group_id"] == group_id]

    async def create_document(self, db, *, group_id, title, text, upload, **kwargs):
        doc = {
            "id": self.next_id,
            "group_id": group_id,
            "title": title,
            "source_type": "text",
            "original_filename": None,
            "extracted_text": text or "",
            "chunk_count": 1,
            "status": "ready",
            "error_message": None,
            "created_at": datetime(2026, 6, 13),
            "updated_at": datetime(2026, 6, 13),
        }
        self.next_id += 1
        self.documents.append(doc)
        return Mock(**doc)

    def delete_document(self, db, group_id, document_id):
        self.documents = [
            doc
            for doc in self.documents
            if not (doc["group_id"] == group_id and doc["id"] == document_id)
        ]
        return []


@pytest.fixture
def fake_group_document_service(monkeypatch):
    service = FakeGroupDocumentService()
    monkeypatch.setattr(
        group_documents_router,
        "get_group_document_service",
        lambda: service,
    )
    return service


def test_list_group_documents_returns_empty(client, db_session, fake_group_document_service):
    group = Group(name="Test group")
    db_session.add(group)
    db_session.commit()

    response = client.get(f"/api/groups/{group.id}/documents")
    assert response.status_code == 200
    assert response.json() == []


def test_create_group_document_with_text(client, db_session, fake_group_document_service):
    group = Group(name="Doc group")
    db_session.add(group)
    db_session.commit()

    response = client.post(
        f"/api/groups/{group.id}/documents",
        data={"title": "Lịch sử", "text": "# Mở đầu\n\nNội dung"},
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Lịch sử"
    assert response.json()["chunk_count"] == 1


def test_delete_group_document(client, db_session, fake_group_document_service):
    group = Group(name="Delete group")
    db_session.add(group)
    db_session.commit()

    create_response = client.post(
        f"/api/groups/{group.id}/documents",
        data={"title": "Temp", "text": "Hello"},
    )
    document_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/groups/{group.id}/documents/{document_id}")
    assert delete_response.status_code == 200

    list_response = client.get(f"/api/groups/{group.id}/documents")
    assert list_response.json() == []
