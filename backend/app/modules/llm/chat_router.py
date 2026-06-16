import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import RAG_CHAT_TOP_K
from app.core.database import get_db
from app.models.item import Item
from app.modules.analytics.service import get_client_ip, record_event
from app.modules.content.text_utils import limit_words
from app.modules.llm.client import LLMServiceUnavailableError
from app.modules.llm.generator import get_rag_generator
from app.modules.rag.service import build_chat_item_context, no_item_knowledge_message
from app.modules.rag.retriever import try_get_rag_retriever
from app.schemas.generate import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


def _record_chat(
    db: Session,
    *,
    request: ChatRequest,
    item: Item,
    http_request: Request,
    duration_ms: int,
    success: bool,
    error_detail: str | None = None,
) -> None:
    record_event(
        db,
        event_type="chat" if success else "chat_error",
        group_id=item.group_id,
        item_id=item.id,
        session_id=request.session_id,
        search_session_id=request.search_session_id,
        client_ip=get_client_ip(http_request),
        duration_ms=duration_ms,
        success=success,
        error_detail=error_detail,
    )


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(
    request: ChatRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    started = time.perf_counter()
    item = db.query(Item).filter(Item.id == request.item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy hiện vật.")

    docs, has_verified = build_chat_item_context(
        item_id=item.id,
        item_name=item.name,
        item_description=item.description,
        group_id=item.group_id,
        retriever=try_get_rag_retriever(),
        top_k=RAG_CHAT_TOP_K,
        query=request.message,
    )
    history = [
        {"role": message.role, "content": message.content}
        for message in request.history
    ]

    if not has_verified:
        duration_ms = int((time.perf_counter() - started) * 1000)
        _record_chat(
            db,
            request=request,
            item=item,
            http_request=http_request,
            duration_ms=duration_ms,
            success=True,
        )
        return ChatResponse(content=no_item_knowledge_message(request.language))

    try:
        content = get_rag_generator().generate_chat(
            message=request.message,
            history=history,
            retrieved_docs=docs,
            persona=request.persona,
            language=request.language,
        )
    except LLMServiceUnavailableError:
        duration_ms = int((time.perf_counter() - started) * 1000)
        _record_chat(
            db,
            request=request,
            item=item,
            http_request=http_request,
            duration_ms=duration_ms,
            success=False,
            error_detail="LLM provider unavailable",
        )
        logger.warning("LLM provider unavailable for chat item %s", item.id)
        raise HTTPException(
            status_code=503,
            detail="Dịch vụ AI tạm thời không khả dụng",
        )
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        _record_chat(
            db,
            request=request,
            item=item,
            http_request=http_request,
            duration_ms=duration_ms,
            success=False,
            error_detail=str(exc),
        )
        logger.exception("Chat generation failed for item %s", item.id)
        raise HTTPException(
            status_code=502,
            detail="Không thể sinh nội dung lúc này",
        )

    duration_ms = int((time.perf_counter() - started) * 1000)
    _record_chat(
        db,
        request=request,
        item=item,
        http_request=http_request,
        duration_ms=duration_ms,
        success=True,
    )
    return ChatResponse(content=limit_words(content))
