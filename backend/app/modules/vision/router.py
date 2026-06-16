import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.config import SIMILARITY_THRESHOLD, USE_AUGMENTATION
from app.models.item import Item
from app.modules.analytics.service import get_client_ip, record_event
from app.schemas.search import SearchMatch, SearchResponse
from app.modules.vision import chroma, embedding
from app.core import storage
from app.core.database import get_db

router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search_object(
    request: Request,
    search_image: UploadFile = File(...),
    session_id: str | None = Form(None),
    group_id: int | None = Form(None),
    search_session_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if not search_image.filename:
        raise HTTPException(status_code=400, detail="Ảnh tìm kiếm là bắt buộc")

    started = time.perf_counter()
    client_ip = get_client_ip(request)

    try:
        content = await search_image.read()
        vectors = embedding.extract_vectors_augmented(content, augment=USE_AUGMENTATION)

        matches = chroma.search_top_items(vectors)
        if not matches:
            duration_ms = int((time.perf_counter() - started) * 1000)
            record_event(
                db,
                event_type="search",
                group_id=group_id,
                session_id=session_id,
                search_session_id=search_session_id,
                client_ip=client_ip,
                duration_ms=duration_ms,
                success=True,
                metadata={"found": False, "result_count": 0},
            )
            return SearchResponse(
                found=False,
                message="Không tìm thấy hiện vật gần giống",
            )

        results: list[SearchMatch] = []
        resolved_group_id = group_id
        for match in matches:
            item = db.query(Item).filter(Item.id == match.item_id).first()
            if item is None:
                chroma.delete_embeddings_for_item(match.item_id)
                continue

            if resolved_group_id is None and item.group_id is not None:
                resolved_group_id = item.group_id

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
            duration_ms = int((time.perf_counter() - started) * 1000)
            record_event(
                db,
                event_type="search",
                group_id=resolved_group_id,
                session_id=session_id,
                search_session_id=search_session_id,
                client_ip=client_ip,
                duration_ms=duration_ms,
                success=True,
                metadata={"found": False, "result_count": 0},
            )
            return SearchResponse(
                found=False,
                message="Không tìm thấy hiện vật gần giống",
            )

        best_similarity = results[0].similarity
        found = best_similarity >= SIMILARITY_THRESHOLD
        duration_ms = int((time.perf_counter() - started) * 1000)
        record_event(
            db,
            event_type="search",
            group_id=resolved_group_id,
            item_id=results[0].item_id if found else None,
            session_id=session_id,
            search_session_id=search_session_id,
            client_ip=client_ip,
            duration_ms=duration_ms,
            success=True,
            metadata={
                "found": found,
                "similarity": best_similarity,
                "result_count": len(results),
            },
        )

        return SearchResponse(
            found=found,
            results=results,
            message=None if found else "Không có hiện vật khớp đủ tin cậy — xem gợi ý bên dưới",
        )
    except HTTPException:
        raise
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        record_event(
            db,
            event_type="search_error",
            group_id=group_id,
            session_id=session_id,
            search_session_id=search_session_id,
            client_ip=client_ip,
            duration_ms=duration_ms,
            success=False,
            error_detail=str(exc),
        )
        raise
