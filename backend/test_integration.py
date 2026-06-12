"""Integration test: register object then search with same image."""
import io
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from app.services import chroma, embedding
from app.services.database import SessionLocal, init_db
from app.models.item import Item
from app.config import SIMILARITY_THRESHOLD


def make_test_image(color: tuple[int, int, int] = (100, 150, 200)) -> bytes:
    img = Image.new("RGB", (224, 224), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_embedding_dimension():
    vec = embedding.extract_vector_from_source(make_test_image())
    assert len(vec) == 384, f"Expected 384 dims, got {len(vec)}"
    print(f"[OK] Embedding dimension: {len(vec)}")


def test_register_and_search():
    init_db()
    db = SessionLocal()

    try:
        item = Item(
            name="Test Object",
            description="A blue test object for integration testing",
            main_image_url="/uploads/test/front.jpg",
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        front_bytes = make_test_image((100, 150, 200))
        side_bytes = make_test_image((110, 160, 210))

        for angle, img_bytes in [("front", front_bytes), ("side", side_bytes)]:
            vec = embedding.extract_vector_from_source(img_bytes)
            chroma.add_embedding(item.id, angle, vec)

        query_vecs = embedding.extract_vectors_augmented(front_bytes)
        result = chroma.search_best_item(query_vecs)

        assert result is not None, "Search returned no results"
        assert result.item_id == item.id, f"Expected item_id={item.id}, got {result.item_id}"
        assert result.similarity > SIMILARITY_THRESHOLD, (
            f"Similarity {result.similarity} below threshold {SIMILARITY_THRESHOLD}"
        )
        print(f"[OK] Search match: item_id={result.item_id}, similarity={result.similarity:.4f}")

        query_vecs_diff = embedding.extract_vectors_augmented(make_test_image((255, 0, 0)))
        result_diff = chroma.search_best_item(query_vecs_diff)
        if result_diff and result_diff.similarity >= SIMILARITY_THRESHOLD:
            print(f"[WARN] Different color image matched with similarity={result_diff.similarity:.4f}")
        else:
            sim = result_diff.similarity if result_diff else 0
            print(f"[OK] Different color correctly rejected (similarity={sim:.4f})")

    finally:
        db.close()


if __name__ == "__main__":
    print("Running integration tests...")
    print(f"Similarity threshold: {SIMILARITY_THRESHOLD}")
    test_embedding_dimension()
    test_register_and_search()
    print("All tests passed!")
