import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.item import Item
from app.modules.content.prewarm import invalidate_and_prewarm_item_content, prewarm_item_content
from app.modules.content.service import get_item_content_service
from app.modules.llm.client import LLMServiceUnavailableError
from app.schemas.generate import GenerateRequest, GenerateResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["story"])


@router.post("/generate", response_model=GenerateResponse)
def generate_content(
    request: GenerateRequest,
    db: Session = Depends(get_db),
):
    item = db.query(Item).filter(Item.id == request.item_id).first()
    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy hiện vật với ID đã cho.",
        )

    try:
        result = get_item_content_service().get_or_generate(
            db,
            item,
            request.persona,
            request.language,
        )
    except LLMServiceUnavailableError:
        logger.warning("LLM provider unavailable for story item %s", item.id)
        raise HTTPException(
            status_code=503,
            detail="Dịch vụ AI tạm thời không khả dụng",
        )
    except Exception:
        logger.exception("Story generation failed for item %s", item.id)
        raise HTTPException(
            status_code=502,
            detail="Không thể sinh nội dung lúc này",
        )

    return GenerateResponse(
        item_id=item.id,
        content=result.content,
        persona=result.persona,
        language=result.language,
    )
