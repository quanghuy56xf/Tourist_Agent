"""Verify delete cleans data so new items don't inherit old images/metadata."""
import io

import httpx
from PIL import Image

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def make_jpeg(color: tuple[int, int, int]) -> bytes:
    img = Image.new("RGB", (64, 64), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_delete_then_register_no_stale_data():
    red = make_jpeg((200, 0, 0))
    blue = make_jpeg((0, 0, 200))

    res = client.post(
        "/api/objects/register",
        data={"name": "Object A", "description": "Desc A"},
        files={"main_image": ("front.jpg", red, "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    id_a = res.json()["item_id"]

    ungrouped = client.get("/api/objects/ungrouped").json()["items"]
    item_a = next(i for i in ungrouped if i["id"] == id_a)
    assert item_a["name"] == "Object A"
    assert "?v=" in item_a["images"][0]["url"]

    res = client.delete(f"/api/objects/{id_a}")
    assert res.status_code == 200, res.text

    res = client.post(
        "/api/objects/register",
        data={"name": "Object B", "description": "Desc B"},
        files={"main_image": ("front.jpg", blue, "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    id_b = res.json()["item_id"]

    ungrouped = client.get("/api/objects/ungrouped").json()["items"]
    item_b = next(i for i in ungrouped if i["id"] == id_b)
    assert item_b["name"] == "Object B"
    assert item_b["description"] == "Desc B"
    assert item_b["images"][0]["url"] != item_a["images"][0]["url"] or id_b != id_a

    res = client.post(
        "/api/search",
        files={"search_image": ("search.jpg", blue, "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["results"], data
    assert data["results"][0]["name"] == "Object B"

    client.delete(f"/api/objects/{id_b}")
    print(f"[OK] delete/reuse test passed (id_a={id_a}, id_b={id_b}, reused={id_a == id_b})")


if __name__ == "__main__":
    test_delete_then_register_no_stale_data()
