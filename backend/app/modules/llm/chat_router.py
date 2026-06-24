import asyncio
import base64
import logging
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import RAG_CHAT_TOP_K
from app.core.database import get_db
from app.models.item import Item
from app.modules.analytics.service import get_client_ip, record_event
from app.modules.content.tts import _synthesize_speech_async
from app.modules.llm.client import LLMServiceUnavailableError
from app.modules.llm.generator import get_rag_generator
from app.modules.rag.service import build_chat_item_context, no_item_knowledge_message
from app.modules.rag.retriever import try_get_rag_retriever
from app.schemas.generate import (
    ChatRequest,
    ChatResponse,
    CompanionChatRequest,
)

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
    return ChatResponse(content=content)


import json

@router.post("/companion/chat/stream")
async def chat_with_companion_stream(
    request: CompanionChatRequest,
    db: Session = Depends(get_db),
):
    if request.item_id is not None:
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
        if not has_verified:
            async def generate_fallback():
                yield f"event: chunk\ndata: {json.dumps({'text': 'Cái này ta chưa đọc đến, để tra lại sau!'})}\n\n"
                yield "event: done\ndata: {}\n\n"
            return StreamingResponse(generate_fallback(), media_type="text/event-stream")
        group_id = item.group_id
        current_item_name = item.name
    else:
        item = None
        docs = []
        group_id = None
        current_item_name = None

    query_visited = db.query(Item.id, Item.name).filter(Item.id.in_(request.visited_item_ids))
    if group_id is not None:
        query_visited = query_visited.filter(Item.group_id == group_id)
        
    visited_rows = query_visited.all() if request.visited_item_ids else []

    names_by_id = {row.id: row.name for row in visited_rows}
    visited_names = [
        names_by_id[visited_id]
        for visited_id in request.visited_item_ids
        if visited_id in names_by_id
    ]
    history = [
        {"role": entry.role, "content": entry.content}
        for entry in request.history
    ]

    if group_id is None and visited_rows:
        first_item = db.query(Item.group_id).filter(Item.id == request.visited_item_ids[0]).first()
        if first_item:
            group_id = first_item.group_id

    next_item_id = None
    next_item_name = None
    tour_completed = False
    if request.suggest_next and group_id is not None:
        excluded_ids = set(request.visited_item_ids)
        if item is not None:
            excluded_ids.add(item.id)
        next_item = (
            db.query(Item)
            .filter(
                Item.group_id == group_id,
                Item.id.notin_(excluded_ids),
            )
            .order_by(Item.id.asc())
            .first()
        )
        if next_item is not None:
            next_item_id = next_item.id
            next_item_name = next_item.name
        elif item is not None or visited_names:
            tour_completed = True

    async def event_generator():
        event_queue: asyncio.Queue[str | None] = asyncio.Queue()
        tts_queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def llm_producer():
            current_sentence = ""
            try:
                stream = get_rag_generator().generate_companion_chat_stream(
                    message=request.message,
                    history=history,
                    retrieved_docs=docs,
                    current_item=current_item_name,
                    visited_items=visited_names,
                    next_item_name=next_item_name,
                )
                async for chunk in stream:
                    await event_queue.put(
                        f"event: chunk\ndata: {json.dumps({'text': chunk})}\n\n"
                    )
                    current_sentence += chunk
                    while match := re.search(r"(?<=[.?!])\s+|\n\n", current_sentence):
                        sentence = current_sentence[: match.start()].strip()
                        current_sentence = current_sentence[match.end() :]
                        if sentence:
                            await tts_queue.put(sentence)

                remaining_text = current_sentence.strip()
                if remaining_text:
                    await tts_queue.put(remaining_text)
            except Exception:
                logger.exception("Companion chat streaming failed")
                await event_queue.put(
                    f"event: error\ndata: {json.dumps({'detail': 'Lỗi sinh nội dung'})}\n\n"
                )
            finally:
                await tts_queue.put(None)

        async def tts_consumer():
            try:
                while True:
                    sentence = await tts_queue.get()
                    if sentence is None:
                        break
                    audio_bytes, _ = await _synthesize_speech_async(
                        sentence,
                        "Tiếng Việt",
                        "Companion",
                    )
                    audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
                    await event_queue.put(
                        "event: audio\n"
                        f"data: {json.dumps({'audio_base64': audio_base64})}\n\n"
                    )
            except Exception:
                logger.exception("Companion text-to-speech streaming failed")
                await event_queue.put(
                    f"event: error\ndata: {json.dumps({'detail': 'Lỗi sinh nội dung'})}\n\n"
                )
            finally:
                await event_queue.put(None)

        if "[SYSTEM_EVENT]: APP_OPENED" in request.message:
            actions = {
                "buttons": [
                    {
                        "type": "open_camera",
                        "label": "📸 Quét hiện vật gần nhất",
                    }
                ]
            }
            yield f"event: actions\ndata: {json.dumps(actions)}\n\n"

        if next_item_id is not None or tour_completed:
            metadata = {
                "next_item_id": next_item_id,
                "next_item_name": next_item_name,
            }
            if tour_completed:
                metadata["tour_completed"] = True
            yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"

        if tour_completed:
            actions = {
                "buttons": [
                    {
                        "type": "restart_tour",
                        "label": "🔄 Bắt đầu hành trình mới",
                    }
                ]
            }
            yield f"event: actions\ndata: {json.dumps(actions)}\n\n"

        producer_task = asyncio.create_task(llm_producer())
        consumer_task = asyncio.create_task(tts_consumer())
        try:
            while True:
                event = await event_queue.get()
                if event is None:
                    yield "event: done\ndata: {}\n\n"
                    break
                yield event
        finally:
            for task in (producer_task, consumer_task):
                if not task.done():
                    task.cancel()
            await asyncio.gather(producer_task, consumer_task, return_exceptions=True)
    return StreamingResponse(event_generator(), media_type="text/event-stream")
