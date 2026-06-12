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
