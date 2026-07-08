import pytest

from app.main import app
from app.models.group import Group
from app.models.item import Item
from app.modules.auth.dependencies import require_admin_if_enabled


@pytest.fixture
def minimap_client(client):
    app.dependency_overrides[require_admin_if_enabled] = lambda: None
    try:
        yield client
    finally:
        app.dependency_overrides.pop(require_admin_if_enabled, None)


def _payload():
    return {
        "imageSrc": "/images/van-mieu-minimap.png",
        "zones": [
            {
                "zoneId": "cong-chinh",
                "zoneName": "Cổng chính",
                "x": 50,
                "y": 94,
                "itemNames": ["Cổng chính"],
            }
        ],
    }


def test_put_and_get_minimap_maps_item_names_within_group(minimap_client, db_session):
    group = Group(name="Văn Miếu")
    other_group = Group(name="Khu khác")
    db_session.add_all([group, other_group])
    db_session.flush()
    expected_item = Item(name="Cổng chính", description="Expected", group=group)
    wrong_item = Item(name="Cổng chính", description="Wrong group", group=other_group)
    db_session.add_all([expected_item, wrong_item])
    db_session.commit()

    put_response = minimap_client.put(f"/api/groups/{group.id}/minimap", json=_payload())

    assert put_response.status_code == 200
    assert group.minimap_config == _payload()

    get_response = minimap_client.get(f"/api/groups/{group.id}/minimap")

    assert get_response.status_code == 200
    assert get_response.json() == {
        "imageSrc": "/images/van-mieu-minimap.png",
        "zones": [
            {
                "zoneId": "cong-chinh",
                "zoneName": "Cổng chính",
                "x": 50.0,
                "y": 94.0,
                "itemIds": [expected_item.id],
            }
        ],
    }


def test_minimap_template_preserves_item_names(minimap_client, db_session):
    group = Group(name="Văn Miếu", minimap_config=_payload())
    db_session.add(group)
    db_session.commit()

    response = minimap_client.get(f"/api/groups/{group.id}/minimap/template")

    assert response.status_code == 200
    assert response.json() == _payload()


def test_minimap_template_returns_default_when_not_configured(minimap_client, db_session):
    group = Group(name="Chưa có bản đồ")
    db_session.add(group)
    db_session.commit()

    response = minimap_client.get(f"/api/groups/{group.id}/minimap/template")

    assert response.status_code == 200
    assert response.json()["zones"][0]["itemNames"] == ["Cổng chính"]
    assert response.json()["imageSrc"]


def test_get_minimap_returns_404_when_not_configured(minimap_client, db_session):
    group = Group(name="Chưa có bản đồ")
    db_session.add(group)
    db_session.commit()

    response = minimap_client.get(f"/api/groups/{group.id}/minimap")

    assert response.status_code == 404


def test_get_minimap_resolves_fuzzy_item_names(minimap_client, db_session):
    group = Group(name="Văn Miếu")
    db_session.add(group)
    db_session.flush()
    gate_item = Item(name="Cổng chính Văn Miếu", description="Gate", group=group)
    db_session.add(gate_item)
    db_session.commit()

    payload = _payload()
    minimap_client.put(f"/api/groups/{group.id}/minimap", json=payload)

    response = minimap_client.get(f"/api/groups/{group.id}/minimap")

    assert response.status_code == 200
    assert response.json()["zones"][0]["itemIds"] == [gate_item.id]


def test_put_minimap_rejects_invalid_coordinates(minimap_client, db_session):
    group = Group(name="Văn Miếu")
    db_session.add(group)
    db_session.commit()
    payload = _payload()
    payload["zones"][0]["x"] = 101

    response = minimap_client.put(f"/api/groups/{group.id}/minimap", json=payload)

    assert response.status_code == 422
