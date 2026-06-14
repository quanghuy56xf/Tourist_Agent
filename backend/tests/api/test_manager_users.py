import base64

import pytest

from app.models.group import Group
from app.models.user import User
from app.modules.auth import dependencies, service
from app.modules.auth.passwords import hash_password


def _basic_auth(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def configure_auth(monkeypatch):
    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", True)
    monkeypatch.setattr(service, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(service, "ADMIN_PASSWORD", "secret")
    monkeypatch.setattr(service, "MANAGER_USERNAME", None)
    monkeypatch.setattr(service, "MANAGER_PASSWORD", None)
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", "secret")


def test_admin_can_create_manager_with_groups(client, db_session):
    group_a = Group(name="Site A")
    group_b = Group(name="Site B")
    db_session.add_all([group_a, group_b])
    db_session.commit()

    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secret"},
    ).json()

    create = client.post(
        "/api/users",
        json={
            "username": "manager-a",
            "password": "pass1234",
            "group_ids": [group_a.id],
        },
        headers=_bearer(login["token"]),
    )
    assert create.status_code == 201
    body = create.json()
    assert body["username"] == "manager-a"
    assert body["group_ids"] == [group_a.id]


def test_manager_only_sees_assigned_groups(client, db_session):
    group_a = Group(name="Allowed")
    group_b = Group(name="Blocked")
    db_session.add_all([group_a, group_b])
    db_session.add(
        User(
            username="scoped-manager",
            password_hash=hash_password("pass1234"),
            role="manager",
            is_active=True,
        )
    )
    db_session.commit()
    manager = db_session.query(User).filter(User.username == "scoped-manager").one()
    manager.groups = [group_a]
    db_session.commit()

    login = client.post(
        "/api/auth/login",
        json={"username": "scoped-manager", "password": "pass1234"},
    ).json()
    assert login["group_ids"] == [group_a.id]

    groups = client.get("/api/groups", headers=_bearer(login["token"])).json()
    assert [group["name"] for group in groups] == ["Allowed"]

    blocked = client.get(
        f"/api/groups/{group_b.id}/items",
        headers=_bearer(login["token"]),
    )
    assert blocked.status_code == 403


def test_manager_cannot_access_users_api(client, db_session):
    db_session.add(
        User(
            username="scoped-manager",
            password_hash=hash_password("pass1234"),
            role="manager",
            is_active=True,
        )
    )
    db_session.commit()

    login = client.post(
        "/api/auth/login",
        json={"username": "scoped-manager", "password": "pass1234"},
    ).json()

    response = client.get("/api/users", headers=_bearer(login["token"]))
    assert response.status_code == 403
