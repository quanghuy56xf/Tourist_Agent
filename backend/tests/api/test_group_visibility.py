import base64

from app.models.group import Group
from app.models.item import Item


def _basic_auth(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def test_public_groups_only_returns_visible_groups(client, db_session):
    public = Group(name="Public Site", is_public=True)
    hidden = Group(name="Hidden Site", is_public=False)
    db_session.add_all([public, hidden])
    db_session.commit()

    response = client.get("/api/groups/public")
    assert response.status_code == 200
    names = [group["name"] for group in response.json()]
    assert names == ["Public Site"]


def test_discover_groups_returns_all_groups_for_visitors(client, db_session):
    public = Group(name="Beta Public Site", is_public=True)
    hidden = Group(name="Alpha Hidden Site", is_public=False)
    db_session.add_all([public, hidden])
    db_session.commit()

    response = client.get("/api/groups/discover")
    assert response.status_code == 200
    names = [group["name"] for group in response.json()]
    assert names == ["Beta Public Site"]


def test_anonymous_list_groups_only_returns_public(client, db_session):
    public = Group(name="Open", is_public=True)
    hidden = Group(name="Closed", is_public=False)
    db_session.add_all([public, hidden])
    db_session.commit()

    response = client.get("/api/groups")
    assert response.status_code == 200
    names = [group["name"] for group in response.json()]
    assert names == ["Open"]


def test_admin_can_hide_group_from_visitors(client, db_session, monkeypatch):
    from app.modules.auth import dependencies, service

    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", True)
    monkeypatch.setattr(service, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(service, "ADMIN_PASSWORD", "secret")
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", "secret")

    group = Group(name="Toggle Site", is_public=True)
    db_session.add(group)
    db_session.commit()

    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secret"},
    ).json()

    patch = client.patch(
        f"/api/groups/{group.id}/visibility",
        json={"is_public": False},
        headers={"Authorization": f"Bearer {login['token']}"},
    )
    assert patch.status_code == 200
    assert patch.json()["is_public"] is False

    public = client.get("/api/groups/public").json()
    assert public == []

    admin_list = client.get(
        "/api/groups",
        headers={"Authorization": f"Bearer {login['token']}"},
    ).json()
    assert len(admin_list) == 1
    assert admin_list[0]["is_public"] is False


def test_discoverable_group_items_are_accessible_to_visitors(client, db_session):
    group = Group(name="Discoverable Site", is_public=False)
    db_session.add(group)
    db_session.flush()
    db_session.add(
        Item(
            name="Bronze Drum",
            description="A visitor-facing artifact",
            group_id=group.id,
        )
    )
    db_session.commit()

    response = client.get(f"/api/groups/{group.id}/items")
    assert response.status_code == 200
    data = response.json()
    assert data["group_name"] == "Discoverable Site"
    assert [item["name"] for item in data["items"]] == ["Bronze Drum"]
