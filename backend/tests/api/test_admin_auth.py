import base64

import pytest

from app.modules.auth import dependencies


def _basic_auth(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(
        f"{username}:{password}".encode(),
    ).decode()
    return {"Authorization": f"Basic {token}"}


def test_read_endpoints_remain_public_when_auth_is_enabled(
    client,
    monkeypatch,
):
    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", True)
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", "secret")

    response = client.get("/api/groups")

    assert response.status_code == 200


def test_mutation_remains_open_when_auth_is_disabled(
    client,
    monkeypatch,
):
    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", False)

    response = client.post("/api/groups", json={"name": "Public local group"})

    assert response.status_code == 201


@pytest.mark.parametrize(
    "headers",
    [
        {},
        _basic_auth("admin", "wrong"),
        _basic_auth("wrong", "secret"),
    ],
)
def test_mutation_rejects_missing_or_wrong_credentials(
    client,
    monkeypatch,
    headers,
):
    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", True)
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", "secret")

    response = client.post(
        "/api/groups",
        json={"name": "Protected group"},
        headers=headers,
    )

    assert response.status_code == 401


def test_mutation_accepts_correct_credentials(client, monkeypatch):
    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", True)
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", "secret")

    response = client.post(
        "/api/groups",
        json={"name": "Protected group"},
        headers=_basic_auth("admin", "secret"),
    )

    assert response.status_code == 201


def test_enabled_auth_without_server_credentials_fails_closed(
    client,
    monkeypatch,
):
    monkeypatch.setattr(dependencies, "ADMIN_AUTH_ENABLED", True)
    monkeypatch.setattr(dependencies, "ADMIN_USERNAME", None)
    monkeypatch.setattr(dependencies, "ADMIN_PASSWORD", None)

    response = client.post(
        "/api/groups",
        json={"name": "Misconfigured group"},
        headers=_basic_auth("admin", "secret"),
    )

    assert response.status_code == 503
