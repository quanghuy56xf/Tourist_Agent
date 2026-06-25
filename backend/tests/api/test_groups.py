from app.models.group import Group
from app.models.item import Item


def test_create_group_returns_201(client):
    response = client.post("/api/groups", json={"name": "Heritage"})

    assert response.status_code == 201
    assert response.json()["name"] == "Heritage"


def test_duplicate_group_returns_existing_group(client):
    first = client.post("/api/groups", json={"name": "Heritage"})
    second = client.post("/api/groups", json={"name": "Heritage"})

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
