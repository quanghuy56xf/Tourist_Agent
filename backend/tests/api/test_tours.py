from app.models.group import Group
from app.models.item import Item


def _seed_items(db_session):
    group = Group(name="Văn Miếu")
    db_session.add(group)
    db_session.flush()
    first = Item(name="Chuông văn miếu", description="Chuông đúc thời Lê", group_id=group.id)
    second = Item(name="Bia tiến sĩ", description="Bia ghi danh tiến sĩ", group_id=group.id)
    db_session.add_all([first, second])
    db_session.commit()
    return first, second


def test_create_tour_returns_201(client, db_session):
    first, second = _seed_items(db_session)

    response = client.post(
        "/api/tours",
        json={
            "title_vi": "Tour thử",
            "title_en": "Sample tour",
            "description_vi": "Mô tả tour",
            "description_en": "Tour description",
            "is_published": True,
            "stops": [
                {"item_id": first.id, "hint_vi": "Gợi ý 1", "hint_en": "Hint 1"},
                {"item_id": second.id, "hint_vi": "Gợi ý 2", "hint_en": "Hint 2"},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title_vi"] == "Tour thử"
    assert len(body["stops"]) == 2
    assert body["stops"][0]["hint_vi"] == "Gợi ý 1"


def test_list_published_tours(client, db_session):
    first, second = _seed_items(db_session)
    client.post(
        "/api/tours",
        json={
            "title_vi": "Tour công khai",
            "title_en": "Public tour",
            "stops": [
                {"item_id": first.id, "hint_vi": "A"},
                {"item_id": second.id, "hint_vi": "B"},
            ],
        },
    )

    response = client.get("/api/tours")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_tour_detail(client, db_session):
    first, second = _seed_items(db_session)
    created = client.post(
        "/api/tours",
        json={
            "title_vi": "Tour chi tiết",
            "title_en": "Detail tour",
            "stops": [
                {"item_id": first.id, "hint_vi": "Gợi ý"},
                {"item_id": second.id, "hint_vi": "Gợi ý 2"},
            ],
        },
    ).json()

    response = client.get(f"/api/tours/{created['id']}")

    assert response.status_code == 200
    assert response.json()["stops"][0]["name"] == "Chuông văn miếu"
