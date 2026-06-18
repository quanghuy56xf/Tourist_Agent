import io
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.models.item import Item
from app.modules.content.personas import DEFAULT_LANGUAGE, DEFAULT_PERSONA, LANGUAGES, PERSONAS
from app.modules.content.service import build_audio_url, get_item_content_service
from app.modules.content.tts import is_current_audio_mime, response_audio_mime
from app.modules.llm.client import LLMServiceUnavailableError
from app.modules.auth.dependencies import require_admin_if_enabled
from app.modules.auth.service import ensure_group_access
from app.schemas.content import (
    ItemContentDraftRequest,
    ItemContentDraftResponse,
    ItemContentResponse,
    ItemContentUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/objects", tags=["content"])


def _get_item_or_404(db: Session, item_id: int) -> Item:
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy hiện vật.")
    return item


def _regenerate_other_variants_task(item_id: int, base_content: str) -> None:
    db = SessionLocal()
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if item is None:
            return
        get_item_content_service().regenerate_other_variants(db, item, base_content)
    finally:
        db.close()


def _ensure_audio_task(item_id: int, persona: str, language: str) -> None:
    db = SessionLocal()
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if item is None:
            return
        get_item_content_service().ensure_audio(db, item, persona, language)
    except Exception:
        logger.exception("Background audio generation failed for item %s", item_id)
    finally:
        db.close()


@router.get("/content/options")
def get_content_options():
    return {
        "personas": list(PERSONAS),
        "languages": list(LANGUAGES),
        "editable_persona": DEFAULT_PERSONA,
        "editable_language": DEFAULT_LANGUAGE,
    }


@router.get("/{item_id}/content", response_model=ItemContentResponse)
def get_item_content(
    item_id: int,
    background_tasks: BackgroundTasks,
    persona: str = "Mặc định",
    language: str = "Tiếng Việt",
    db: Session = Depends(get_db),
):
    item = _get_item_or_404(db, item_id)
    service = get_item_content_service()

    try:
        result = service.get_or_generate(db, item, persona, language)
    except LLMServiceUnavailableError:
        logger.warning("LLM provider unavailable for item content %s", item.id)
        raise HTTPException(
            status_code=503,
            detail="Dịch vụ AI tạm thời không khả dụng",
        )
    except Exception:
        logger.exception("Item content generation failed for item %s", item.id)
        raise HTTPException(
            status_code=502,
            detail="Không thể sinh nội dung lúc này",
        )

    audio_url = result.audio_url
    if result.content.strip() and not result.has_audio:
        audio_url = build_audio_url(
            item.id,
            result.persona,
            result.language,
            result.content,
        )

    return ItemContentResponse(
        item_id=result.item_id,
        persona=result.persona,
        language=result.language,
        content=result.content,
        has_audio=result.has_audio,
        audio_url=audio_url,
        stored=result.stored,
        source=result.source,
    )


@router.put("/{item_id}/content", response_model=ItemContentResponse)
def update_item_content(
    item_id: int,
    payload: ItemContentUpdateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    item = _get_item_or_404(db, item_id)
    ensure_group_access(staff, item.group_id)
    service = get_item_content_service()
    try:
        result = service.update_content(
            db,
            item,
            payload.persona,
            payload.language,
            payload.content,
        )
    except ValueError as exc:
        if str(exc) == "empty_content":
            raise HTTPException(status_code=400, detail="Nội dung mô tả không được để trống")
        if str(exc) == "read_only_variant":
            raise HTTPException(
                status_code=403,
                detail="Chỉ có thể chỉnh sửa persona Mặc định (Tiếng Việt)",
            )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Item content update failed for item %s", item.id)
        raise HTTPException(status_code=502, detail="Không thể cập nhật mô tả lúc này")

    background_tasks.add_task(_regenerate_other_variants_task, item.id, result.content)

    audio_url = None
    if result.content.strip():
        audio_url = build_audio_url(
            item.id,
            result.persona,
            result.language,
            result.content,
        )
        background_tasks.add_task(
            _ensure_audio_task,
            item.id,
            result.persona,
            result.language,
        )

    return ItemContentResponse(
        item_id=result.item_id,
        persona=result.persona,
        language=result.language,
        content=result.content,
        has_audio=bool(audio_url),
        audio_url=audio_url,
        stored=result.stored,
        source=result.source,
    )


@router.post("/{item_id}/content/draft", response_model=ItemContentDraftResponse)
def generate_item_content_draft(
    item_id: int,
    payload: ItemContentDraftRequest,
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    item = _get_item_or_404(db, item_id)
    ensure_group_access(staff, item.group_id)
    if payload.persona != DEFAULT_PERSONA or payload.language != DEFAULT_LANGUAGE:
        raise HTTPException(
            status_code=403,
            detail="Chỉ có thể sinh bản nháp cho persona Mặc định (Tiếng Việt)",
        )

    service = get_item_content_service()
    try:
        content = service.generate_draft_content(
            item,
            payload.persona,
            payload.language,
        )
    except LLMServiceUnavailableError:
        raise HTTPException(
            status_code=503,
            detail="Dịch vụ AI tạm thời không khả dụng",
        ) from None
    except Exception:
        logger.exception("Item content draft generation failed for item %s", item.id)
        raise HTTPException(status_code=502, detail="Không thể sinh nội dung lúc này") from None

    return ItemContentDraftResponse(
        item_id=item.id,
        persona=payload.persona,
        language=payload.language,
        content=content,
    )


@router.get("/{item_id}/content/audio")
def get_item_content_audio(
    item_id: int,
    persona: str = "Mặc định",
    language: str = "Tiếng Việt",
    db: Session = Depends(get_db),
):
    item = _get_item_or_404(db, item_id)
    service = get_item_content_service()
    variant = service.get_valid_variant(db, item, persona, language)
    if variant is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy âm thanh cho nội dung này.")

    if (
        variant.audio_data is None
        or variant.audio_mime is None
        or not is_current_audio_mime(variant.audio_mime)
    ):
        variant = service.ensure_audio(db, item, persona, language)
    if variant is None or variant.audio_data is None or variant.audio_mime is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy âm thanh cho nội dung này.")

    return StreamingResponse(
        io.BytesIO(variant.audio_data),
        media_type=response_audio_mime(variant.audio_mime),
        headers={"Cache-Control": "private, no-cache"},
    )
