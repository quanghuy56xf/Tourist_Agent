import base64

from app.models.group import Group


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


def test_hidden_group_items_not_accessible_to_visitors(client, db_session):
    group = Group(name="Secret", is_public=False)
    db_session.add(group)
    db_session.commit()

    response = client.get(f"/api/groups/{group.id}/items")
    assert response.status_code == 404


def test_anonymous_cannot_update_visibility_when_auth_disabled(
    client, db_session, monkeypatch
):
    from app.modules.auth import dependencies

    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", False)

    group = Group(name="Protected", is_public=True)
    db_session.add(group)
    db_session.commit()

    response = client.patch(
        f"/api/groups/{group.id}/visibility",
        json={"is_public": False},
    )
    assert response.status_code == 401

