from fastapi import HTTPException, UploadFile

from app.config import USE_AUGMENTATION
from app.services import chroma, embedding, storage

VALID_ANGLES = {"front", "side", "back"}


async def ingest_image(item_id: int, angle: str, upload_file: UploadFile) -> str:
    if angle not in VALID_ANGLES:
        raise HTTPException(status_code=400, detail="Góc ảnh không hợp lệ")

    content = await upload_file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Ảnh trống")

    chroma.delete_embedding(item_id, angle)
    image_url = storage.save_image_bytes(content, angle, item_id)

    vectors = embedding.extract_vectors_augmented(content, augment=USE_AUGMENTATION)
    chroma.add_embedding(item_id, angle, vectors[0])
    for i, vec in enumerate(vectors[1:], start=1):
        chroma.add_embedding(item_id, f"{angle}_aug{i}", vec)

    return image_url
