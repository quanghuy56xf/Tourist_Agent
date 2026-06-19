from fastapi import HTTPException, UploadFile

from app.core.config import USE_AUGMENTATION
from app.modules.vision import chroma, embedding
from app.core import storage

VALID_ANGLES = {"front", "side", "back"}


async def ingest_image(
    item_id: int,
    angle: str,
    upload_file: UploadFile,
    save_to_db: bool = True,
) -> str:
    if save_to_db and angle not in VALID_ANGLES:
        raise HTTPException(status_code=400, detail="Góc ảnh không hợp lệ")

    content = await upload_file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Ảnh trống")

    vectors = embedding.extract_vectors_augmented(content, augment=USE_AUGMENTATION)

    image_url = (
        storage.save_image_bytes(content, angle, item_id) if save_to_db else ""
    )
    chroma.delete_embedding(item_id, angle)
    chroma.add_embedding(item_id, angle, vectors[0])
    for i, vec in enumerate(vectors[1:], start=1):
        chroma.add_embedding(item_id, f"{angle}_aug{i}", vec)

    return image_url
