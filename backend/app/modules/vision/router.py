from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import SIMILARITY_THRESHOLD, USE_AUGMENTATION
from app.models.item import Item
from app.schemas.search import SearchMatch, SearchResponse
from app.modules.vision import chroma, embedding
from app.core import storage
from app.core.database import get_db

router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search_object(
    search_image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not search_image.filename:
        raise HTTPException(status_code=400, detail="Ảnh tìm kiếm là bắt buộc")

    content = await search_image.read()
    vectors = embedding.extract_vectors_augmented(content, augment=USE_AUGMENTATION)

    matches = chroma.search_top_items(vectors)
    if not matches:
        return SearchResponse(
            found=False,
            message="Không tìm thấy vật thể gần giống",
        )

    results: list[SearchMatch] = []
    for match in matches:
        item = db.query(Item).filter(Item.id == match.item_id).first()
        if item is None:
            chroma.delete_embeddings_for_item(match.item_id)
            continue

        images = storage.list_item_images(item.id)
        front = next((img for img in images if img["angle"] == "front"), None)
        image_url = front["url"] if front else item.main_image_url

        results.append(
            SearchMatch(
                item_id=item.id,
                name=item.name,
                description=item.description,
                similarity=round(match.similarity, 4),
                image_url=image_url,
            )
        )

    if not results:
        return SearchResponse(
            found=False,
            message="Không tìm thấy vật thể gần giống",
        )

    best_similarity = results[0].similarity
    found = best_similarity >= SIMILARITY_THRESHOLD

    return SearchResponse(
        found=found,
        results=results,
        message=None if found else "Không có vật thể khớp đủ tin cậy — xem gợi ý bên dưới",
    )
