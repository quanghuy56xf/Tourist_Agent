import base64

import pytest

from app.modules.auth import dependencies, service


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
    monkeypatch.setattr(service, "MANAGER_USERNAME", "manager")
    monkeypatch.setattr(service, "MANAGER_PASSWORD", "manager-secret")
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", "secret")


def test_login_admin_returns_token(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "admin"
    assert body["username"] == "admin"
    assert body["token"]


def test_login_manager_returns_token(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "manager", "password": "manager-secret"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "manager"


def test_login_rejects_wrong_password(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )

    assert response.status_code == 401


def test_me_accepts_bearer_token(client):
    login = client.post(
        "/api/auth/login",
        json={"username": "manager", "password": "manager-secret"},
    ).json()

    response = client.get("/api/auth/me", headers=_bearer(login["token"]))

    assert response.status_code == 200
    assert response.json()["role"] == "manager"


def test_manager_cannot_create_group(client):
    login = client.post(
        "/api/auth/login",
        json={"username": "manager", "password": "manager-secret"},
    ).json()

    response = client.post(
        "/api/groups",
        json={"name": "Manager group"},
        headers=_bearer(login["token"]),
    )

    assert response.status_code == 403


def test_admin_can_create_group_with_bearer(client):
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secret"},
    ).json()

    response = client.post(
        "/api/groups",
        json={"name": "Admin group"},
        headers=_bearer(login["token"]),
    )

    assert response.status_code == 201


def test_mutation_accepts_admin_basic_auth(client):
    response = client.post(
        "/api/groups",
        json={"name": "Basic admin group"},
        headers=_basic_auth("admin", "secret"),
    )

    assert response.status_code == 201
