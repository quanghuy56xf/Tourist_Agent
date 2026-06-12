"""API integration test using FastAPI TestClient."""
import io

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def make_jpeg(color: tuple[int, int, int]) -> bytes:
    img = Image.new("RGB", (224, 224), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    print("[OK] GET /health")


def test_register_and_search_api():
    front = make_jpeg((80, 120, 200))
    side = make_jpeg((90, 130, 210))

    res = client.post(
        "/api/objects/register",
        data={"name": "API Test Cup", "description": "A ceramic cup for API testing"},
        files={
            "main_image": ("front.jpg", front, "image/jpeg"),
            "side_image": ("side.jpg", side, "image/jpeg"),
        },
    )
    assert res.status_code == 200, res.text
    item_id = res.json()["item_id"]
    print(f"[OK] POST /api/objects/register -> item_id={item_id}")

    res = client.post(
        "/api/search",
        files={"search_image": ("search.jpg", front, "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["found"] is True, data
    assert len(data["results"]) >= 1, data
    assert data["results"][0]["name"] == "API Test Cup"
    print(f"[OK] POST /api/search -> found={data['found']}, top1={data['results'][0]['similarity']}")


if __name__ == "__main__":
    print("Running API tests...")
    test_health()
    test_register_and_search_api()
    print("All API tests passed!")
