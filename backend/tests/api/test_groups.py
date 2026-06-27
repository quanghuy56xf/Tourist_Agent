import base64

import pytest

from sqlalchemy import event

from app.models.content_variant import ItemContentVariant
from app.models.group import Group
from app.models.item import Item
from app.modules.content.personas import all_variants
from app.modules.content.service import compute_content_hash



def _basic_auth(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


@pytest.fixture(autouse=True)
def configure_auth(monkeypatch):
    from app.modules.auth import dependencies, service

    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", True)
    monkeypatch.setattr(service, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(service, "ADMIN_PASSWORD", "secret")
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", "secret")


def test_create_group_returns_201(client):
    response = client.post("/api/groups", json={"name": "Heritage"}, headers=_basic_auth("admin", "secret"))

    assert response.status_code == 201
    assert response.json()["name"] == "Heritage"


def test_duplicate_group_returns_existing_group(client):
    first = client.post("/api/groups", json={"name": "Heritage"}, headers=_basic_auth("admin", "secret"))
    second = client.post("/api/groups", json={"name": "Heritage"}, headers=_basic_auth("admin", "secret"))

    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]


def test_list_groups_reports_item_count(client, db_session):
    group = Group(name="Heritage")
    db_session.add(group)
    db_session.flush()
    db_session.add(
        Item(
            name="Item",
            description="Description",
            group_id=group.id,
        )
    )
    db_session.commit()

    response = client.get("/api/groups")

    assert response.status_code == 200
    assert response.json()[0]["item_count"] == 1


def test_missing_group_items_returns_404(client):
    response = client.get("/api/groups/999999/items")

    assert response.status_code == 404


def test_group_sync_status_requires_every_persona_language_variant(
    client,
    db_session,
):
    group = Group(name="Variant sync group")
    item = Item(
        name="Item",
        description="Description",
        group=group,
    )
    db_session.add_all([group, item])
    db_session.flush()
    db_session.add(
        ItemContentVariant(
            item_id=item.id,
            persona="Mặc định",
            language="Tiếng Việt",
            text_content="Nội dung mặc định.",
            audio_data=b"audio",
            audio_mime="audio/mpeg",
            status="ready",
            source="generated",
            content_hash=compute_content_hash(
                item.description,
                group_knowledge_version=group.knowledge_version,
            ),
        )
    )
    db_session.commit()

    response = client.get(f"/api/groups/{group.id}/sync-status")

    assert response.status_code == 200
    assert len(all_variants()) == 18
    assert response.json() == {
        "total_items": 1,
        "synced_items": 0,
        "is_fully_synced": False,
    }
    for persona, language in all_variants():
        if persona == "Mặc định" and language == "Tiếng Việt":
            continue
        db_session.add(
            ItemContentVariant(
                item_id=item.id,
                persona=persona,
                language=language,
                text_content=f"Nội dung {persona} {language}.",
                audio_data=b"audio",
                audio_mime="audio/mpeg",
                status="ready",
                source="generated",
                content_hash=compute_content_hash(
                    item.description,
                    group_knowledge_version=group.knowledge_version,
                ),
            )
        )
    db_session.commit()

    response = client.get(f"/api/groups/{group.id}/sync-status")

    assert response.json() == {
        "total_items": 1,
        "synced_items": 1,
        "is_fully_synced": True,
    }


def test_group_sync_status_does_not_select_audio_blob(client, db_session):
    group = Group(name="Lightweight sync query")
    item = Item(name="Item", description="Description", group=group)
    db_session.add_all([group, item])
    db_session.commit()

    statements = []

    def capture_statement(_conn, _cursor, statement, _parameters, _context, _many):
        if "item_content_variants" in statement:
            statements.append(statement)

    bind = db_session.get_bind()
    event.listen(bind, "before_cursor_execute", capture_statement)
    try:
        response = client.get(f"/api/groups/{group.id}/sync-status")
    finally:
        event.remove(bind, "before_cursor_execute", capture_statement)

    assert response.status_code == 200
    variant_select = next(
        statement for statement in statements if statement.lstrip().upper().startswith("SELECT")
    )
    assert "audio_data IS NOT NULL" in variant_select
    assert "audio_data AS" not in variant_select


def test_group_content_sync_status_empty_group(client, db_session):
    group = Group(name="Empty sync")
    db_session.add(group)
    db_session.commit()

    response = client.get(f"/api/groups/{group.id}/content/sync-status")

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["total"] == 0
    assert body["items"] == []


def test_sync_missing_content_queues_items(client, db_session, monkeypatch):
    group = Group(name="Queue sync")
    db_session.add(group)
    db_session.flush()
    item = Item(name="Item", description="Short", group_id=group.id)
    db_session.add(item)
    db_session.commit()

    queued: list[tuple[int, list[int]]] = []

    def fake_task(group_id, item_ids):
        queued.append((group_id, item_ids))

    monkeypatch.setattr(
        "app.modules.objects.groups_router.sync_missing_items_task",
        fake_task,
    )

    response = client.post(f"/api/groups/{group.id}/content/sync-missing")

    assert response.status_code == 202
    body = response.json()
    assert body["queued_count"] == 1
    assert body["queued_item_ids"] == [item.id]
    assert queued == [(group.id, [item.id])]
