import asyncio
import base64
import json
import logging
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import RAG_CHAT_TOP_K
from app.core.database import get_db
from app.models.item import Item
from app.modules.analytics.chat_logs import record_chat_turn, resolve_conversation_id
from app.modules.analytics.service import get_client_ip, record_event
from app.modules.content.text_utils import polish_generated_text
from app.modules.content.tts import _synthesize_speech_async
from app.modules.llm.client import LLMServiceUnavailableError, estimate_token_usage
from app.modules.llm.generator import get_rag_generator
from app.modules.content.language_support import LANGUAGE_VI, normalize_language_label
from app.modules.rag.service import (
    build_chat_item_context,
    build_chat_item_context_with_trace,
    build_group_chat_context_with_trace,
    no_item_knowledge_message,
)
from app.modules.rag.security import (
    apply_input_guardrails,
    apply_output_guardrails,
    safe_fallback_message,
    sanitize_chat_history,
)
from app.modules.rag.tracing import RagTraceContext, record_rag_trace
from app.modules.rag.retriever import try_get_rag_retriever
from app.schemas.generate import (
    ChatRequest,
    ChatResponse,
    CompanionChatRequest,
)

logger = logging.getLogger(__name__)
_ORIGINAL_BUILD_CHAT_ITEM_CONTEXT = build_chat_item_context

router = APIRouter(prefix="/api", tags=["chat"])

TTS_WORKER_COUNT = 3
TTS_MAX_ATTEMPTS = 3
TTS_RETRY_BACKOFF_SECONDS = (0.3, 0.8)
ENABLE_COMPANION_ACK_AUDIO = False
FIRST_SEGMENT_SOFT_LIMIT = 45
NORMAL_SEGMENT_SOFT_LIMIT = 90
SEGMENT_HARD_LIMIT = 150
MIN_SEGMENT_LENGTH = 24
TTS_STOP_MARKERS = ("||Q:", "||Action:")
_ACK_AUDIO_CACHE: dict[tuple[str, str], bytes] = {}
_ACK_AUDIO_LOCKS: dict[tuple[str, str], asyncio.Lock] = {}


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _companion_ack_text(language: str) -> str:
    is_vi = normalize_language_label(language) == LANGUAGE_VI
    return "Ừm, để Đôn xem nào." if is_vi else "Let me think for a moment."


async def _get_companion_ack_audio(language: str) -> bytes:
    text = _companion_ack_text(language)
    key = (normalize_language_label(language), text)
    cached = _ACK_AUDIO_CACHE.get(key)
    if cached is not None:
        return cached

    lock = _ACK_AUDIO_LOCKS.setdefault(key, asyncio.Lock())
    async with lock:
        cached = _ACK_AUDIO_CACHE.get(key)
        if cached is not None:
            return cached
        audio_bytes, _ = await _synthesize_speech_async(text, language, "Companion")
        _ACK_AUDIO_CACHE[key] = audio_bytes
        return audio_bytes


def _find_stop_marker(text: str) -> int | None:
    indexes = [idx for marker in TTS_STOP_MARKERS if (idx := text.find(marker)) >= 0]
    return min(indexes) if indexes else None


def _split_at(text: str, end: int, *, min_length: int = MIN_SEGMENT_LENGTH) -> tuple[str | None, str]:
    segment = text[:end].strip()
    remaining = text[end:].lstrip()
    if len(segment) < min_length:
        return None, text
    return segment, remaining


def _extract_tts_segments(buffer: str, *, first_segment: bool) -> tuple[list[str], str, bool]:
    stop_tts = False
    marker_idx = _find_stop_marker(buffer)
    if marker_idx is not None:
        buffer = buffer[:marker_idx]
        stop_tts = True

    segments: list[str] = []
    while True:
        sentence_match = re.search(r"(?<=[.?!。])\s+|\n+", buffer)
        if sentence_match:
            segment, buffer = _split_at(buffer, sentence_match.start() + 1, min_length=1)
            if segment:
                segments.append(segment)
                first_segment = False
                continue
            break

        soft_limit = FIRST_SEGMENT_SOFT_LIMIT if first_segment else NORMAL_SEGMENT_SOFT_LIMIT
        if len(buffer) >= soft_limit:
            soft_breaks = [match.end() for match in re.finditer(r"[,;:—–-]\s+", buffer)]
            soft_breaks = [idx for idx in soft_breaks if idx >= MIN_SEGMENT_LENGTH]
            if soft_breaks:
                segment, buffer = _split_at(buffer, soft_breaks[-1])
                if segment:
                    segments.append(segment)
                    first_segment = False
                    continue

        if len(buffer) >= SEGMENT_HARD_LIMIT:
            cut = buffer.rfind(" ", MIN_SEGMENT_LENGTH, SEGMENT_HARD_LIMIT)
            if cut < MIN_SEGMENT_LENGTH:
                cut = SEGMENT_HARD_LIMIT
            segment, buffer = _split_at(buffer, cut)
            if segment:
                segments.append(segment)
                first_segment = False
                continue

        break

    return segments, buffer, stop_tts


def _record_chat(
    db: Session,
    *,
    request: ChatRequest,
    item: Item,
    http_request: Request,
    duration_ms: int,
    success: bool,
    error_detail: str | None = None,
    assistant_message: str | None = None,
    token_usage=None,
    prompt_text_for_estimate: str = "",
):
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
    conversation_id = resolve_conversation_id(
        session_id=request.session_id,
        search_session_id=request.search_session_id,
        item_id=item.id,
        chat_mode="item",
    )
    return record_chat_turn(
        db,
        conversation_id=conversation_id,
        chat_mode="item",
        user_message=request.message,
        assistant_message=assistant_message,
        group_id=item.group_id,
        item_id=item.id,
        session_id=request.session_id,
        search_session_id=request.search_session_id,
        persona=request.persona,
        language=request.language,
        success=success,
        error_detail=error_detail,
        duration_ms=duration_ms,
        token_usage=token_usage,
        prompt_text_for_estimate=prompt_text_for_estimate,
    )


def _record_companion_chat(
    db: Session,
    *,
    request: CompanionChatRequest,
    group_id: int | None,
    item_id: int | None,
    duration_ms: int,
    success: bool,
    assistant_message: str | None,
    error_detail: str | None = None,
    token_usage=None,
    prompt_text_for_estimate: str = "",
):
    conversation_id = resolve_conversation_id(
        session_id=request.session_id,
        search_session_id=None,
        item_id=item_id,
        chat_mode="companion",
    )
    return record_chat_turn(
        db,
        conversation_id=conversation_id,
        chat_mode="companion",
        user_message=request.message,
        assistant_message=assistant_message,
        group_id=group_id,
        item_id=item_id,
        session_id=request.session_id,
        search_session_id=None,
        persona="Companion",
        language=request.language,
        success=success,
        error_detail=error_detail,
        duration_ms=duration_ms,
        token_usage=token_usage,
        prompt_text_for_estimate=prompt_text_for_estimate,
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

    input_decision = apply_input_guardrails(request.message)
    if not input_decision.allowed:
        duration_ms = int((time.perf_counter() - started) * 1000)
        fallback = safe_fallback_message(request.language)
        _record_chat(
            db,
            request=request,
            item=item,
            http_request=http_request,
            duration_ms=duration_ms,
            success=True,
            assistant_message=fallback,
            token_usage=estimate_token_usage(
                prompt_text=input_decision.sanitized_text,
                completion_text=fallback,
            ),
        )
        return ChatResponse(content=fallback)

    guarded_message = input_decision.sanitized_text
    if build_chat_item_context is not _ORIGINAL_BUILD_CHAT_ITEM_CONTEXT:
        docs, has_verified = build_chat_item_context(
            item_id=item.id,
            item_name=item.name,
            item_description=item.description,
            group_id=item.group_id,
            retriever=try_get_rag_retriever(),
            top_k=RAG_CHAT_TOP_K,
            query=guarded_message,
        )
        rag_trace = RagTraceContext(retrieval_query=guarded_message, top_k=RAG_CHAT_TOP_K)
    else:
        docs, has_verified, rag_trace = build_chat_item_context_with_trace(
            item_id=item.id,
            item_name=item.name,
            item_description=item.description,
            group_id=item.group_id,
            retriever=try_get_rag_retriever(),
            top_k=RAG_CHAT_TOP_K,
            query=guarded_message,
        )
    history = sanitize_chat_history(
        [
            {"role": message.role, "content": message.content}
            for message in request.history
        ]
    )

    if not has_verified:
        duration_ms = int((time.perf_counter() - started) * 1000)
        fallback = no_item_knowledge_message(request.language)
        chat_turn = _record_chat(
            db,
            request=request,
            item=item,
            http_request=http_request,
            duration_ms=duration_ms,
            success=True,
            assistant_message=fallback,
            token_usage=estimate_token_usage(
                prompt_text=request.message,
                completion_text=fallback,
            ),
        )
        conversation_id = resolve_conversation_id(
            session_id=request.session_id,
            search_session_id=request.search_session_id,
            item_id=item.id,
            chat_mode="item",
        )
        record_rag_trace(
            db,
            chat_turn_id=chat_turn.id if chat_turn else None,
            conversation_id=conversation_id,
            group_id=item.group_id,
            item_id=item.id,
            query=guarded_message,
            trace=rag_trace,
            has_verified_knowledge=False,
        )
        return ChatResponse(content=fallback)

    generator = get_rag_generator()
    try:
        content = generator.generate_chat(
            message=guarded_message,
            history=history,
            retrieved_docs=docs,
            persona=request.persona,
            language=request.language,
            item_name=item.name,
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

    polished = polish_generated_text(content)
    output_decision = apply_output_guardrails(
        polished,
        has_verified_knowledge=has_verified,
        confidence_score=rag_trace.confidence_score,
        context_count=len(rag_trace.context_chunks),
        language=request.language,
    )
    polished = output_decision.sanitized_text
    duration_ms = int((time.perf_counter() - started) * 1000)
    token_usage = getattr(generator, "last_token_usage", None) or estimate_token_usage(
        prompt_text=guarded_message,
        completion_text=polished,
    )
    chat_turn = _record_chat(
        db,
        request=request,
        item=item,
        http_request=http_request,
        duration_ms=duration_ms,
        success=True,
        assistant_message=polished,
        token_usage=token_usage,
        prompt_text_for_estimate=request.message,
    )
    conversation_id = resolve_conversation_id(
        session_id=request.session_id,
        search_session_id=request.search_session_id,
        item_id=item.id,
        chat_mode="item",
    )
    record_rag_trace(
        db,
        chat_turn_id=chat_turn.id if chat_turn else None,
        conversation_id=conversation_id,
        group_id=item.group_id,
        item_id=item.id,
        query=guarded_message,
        trace=rag_trace,
        has_verified_knowledge=has_verified,
    )
    return ChatResponse(content=polished)


@router.post("/companion/chat/stream")
async def chat_with_companion_stream(
    request: CompanionChatRequest,
    db: Session = Depends(get_db),
):
    if request.item_id is not None:
        item = db.query(Item).filter(Item.id == request.item_id).first()
        if item is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy hiện vật.")

        group_id = item.group_id
        current_item_name = item.name
        if build_chat_item_context is not _ORIGINAL_BUILD_CHAT_ITEM_CONTEXT:
            docs, has_verified = build_chat_item_context(
                item_id=item.id,
                item_name=item.name,
                item_description=item.description,
                group_id=group_id,
                retriever=try_get_rag_retriever(),
                top_k=RAG_CHAT_TOP_K,
                query=request.message,
            )
            rag_trace = RagTraceContext(retrieval_query=request.message, top_k=RAG_CHAT_TOP_K)
        else:
            docs, has_verified, rag_trace = build_chat_item_context_with_trace(
                item_id=item.id,
                item_name=item.name,
                item_description=item.description,
                group_id=group_id,
                retriever=try_get_rag_retriever(),
                top_k=RAG_CHAT_TOP_K,
                query=request.message,
            )
        if not has_verified:
            async def generate_fallback():
                is_vi = normalize_language_label(request.language) == LANGUAGE_VI
                fallback_msg = (
                    "Cái này ta chưa đọc đến, để tra lại sau!"
                    if is_vi
                    else "I haven't read about this yet, let me check it later!"
                )
                started = time.perf_counter()
                yield f"event: chunk\ndata: {json.dumps({'text': fallback_msg})}\n\n"
                yield "event: done\ndata: {}\n\n"
                duration_ms = int((time.perf_counter() - started) * 1000)
                chat_turn = _record_companion_chat(
                    db,
                    request=request,
                    group_id=group_id,
                    item_id=item.id if item else None,
                    duration_ms=duration_ms,
                    success=True,
                    assistant_message=fallback_msg,
                    token_usage=estimate_token_usage(
                        prompt_text=request.message,
                        completion_text=fallback_msg,
                    ),
                )
                conversation_id = resolve_conversation_id(
                    session_id=request.session_id,
                    search_session_id=None,
                    item_id=item.id if item else None,
                    chat_mode="companion",
                )
                record_rag_trace(
                    db,
                    chat_turn_id=chat_turn.id if chat_turn else None,
                    conversation_id=conversation_id,
                    group_id=group_id,
                    item_id=item.id if item else None,
                    query=request.message,
                    trace=rag_trace,
                    has_verified_knowledge=False,
                )
            return StreamingResponse(generate_fallback(), media_type="text/event-stream")
    else:
        item = None
        group_id = request.group_id
        current_item_name = None
        if group_id is not None:
            docs, has_verified, rag_trace = build_group_chat_context_with_trace(
                query=request.message,
                group_id=group_id,
                retriever=try_get_rag_retriever(),
                top_k=RAG_CHAT_TOP_K,
            )
        else:
            docs = []
            has_verified = False
            rag_trace = None

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
        is_vi = normalize_language_label(request.language) == LANGUAGE_VI
        started = time.perf_counter()
        event_queue: asyncio.Queue[str | None] = asyncio.Queue()
        tts_queue: asyncio.Queue[tuple[int, str] | None] = asyncio.Queue()
        tts_result_queue: asyncio.Queue[tuple[int, str, bytes | None] | None] = asyncio.Queue()

        def elapsed_ms() -> int:
            return int((time.perf_counter() - started) * 1000)

        async def llm_producer():
            current_sentence = ""
            stop_tts = False
            has_sent_tts_segment = False
            next_tts_seq = 0
            first_chunk_ms: int | None = None
            first_segment_ms: int | None = None
            assistant_chunks: list[str] = []
            stream_error: str | None = None
            generator = get_rag_generator()
            try:
                stream = generator.generate_companion_chat_stream(
                    message=request.message,
                    history=history,
                    retrieved_docs=docs,
                    current_item=current_item_name,
                    visited_items=visited_names,
                    next_item_name=next_item_name,
                    language=request.language,
                )
                async for chunk in stream:
                    if first_chunk_ms is None:
                        first_chunk_ms = elapsed_ms()
                    assistant_chunks.append(chunk)
                    await event_queue.put(_sse_event("chunk", {"text": chunk}))
                    if stop_tts:
                        continue

                    current_sentence += chunk
                    segments, current_sentence, should_stop = _extract_tts_segments(
                        current_sentence,
                        first_segment=not has_sent_tts_segment,
                    )
                    for segment in segments:
                        if first_segment_ms is None:
                            first_segment_ms = elapsed_ms()
                        await tts_queue.put((next_tts_seq, segment))
                        next_tts_seq += 1
                        has_sent_tts_segment = True
                    if should_stop:
                        stop_tts = True

                remaining_text = current_sentence.strip()
                if remaining_text and not stop_tts:
                    if first_segment_ms is None:
                        first_segment_ms = elapsed_ms()
                    await tts_queue.put((next_tts_seq, remaining_text))
            except Exception:
                stream_error = "Lỗi sinh nội dung"
                logger.exception("Companion chat streaming failed")
                await event_queue.put(_sse_event("error", {"detail": stream_error}))
            finally:
                for _ in range(TTS_WORKER_COUNT):
                    await tts_queue.put(None)
                assistant_message = "".join(assistant_chunks).strip() or None
                duration_ms = elapsed_ms()
                prompt_text = request.message + "\n".join(
                    entry["content"] for entry in history[-10:]
                )
                token_usage = getattr(generator, "last_token_usage", None) or estimate_token_usage(
                    prompt_text=prompt_text,
                    completion_text=assistant_message or "",
                )
                chat_turn = _record_companion_chat(
                    db,
                    request=request,
                    group_id=group_id,
                    item_id=item.id if item else None,
                    duration_ms=duration_ms,
                    success=stream_error is None,
                    assistant_message=assistant_message,
                    error_detail=stream_error,
                    token_usage=token_usage,
                    prompt_text_for_estimate=prompt_text,
                )
                if rag_trace is not None:
                    conversation_id = resolve_conversation_id(
                        session_id=request.session_id,
                        search_session_id=None,
                        item_id=item.id if item else None,
                        chat_mode="companion",
                    )
                    record_rag_trace(
                        db,
                        chat_turn_id=chat_turn.id if chat_turn else None,
                        conversation_id=conversation_id,
                        group_id=group_id,
                        item_id=item.id if item else None,
                        query=request.message,
                        trace=rag_trace,
                        has_verified_knowledge=has_verified,
                    )
                logger.info(
                    "Companion stream text latency session=%s item=%s first_chunk_ms=%s first_segment_ms=%s",
                    request.session_id,
                    request.item_id,
                    first_chunk_ms,
                    first_segment_ms,
                )

        async def tts_worker(worker_id: int):
            while True:
                item = await tts_queue.get()
                if item is None:
                    await tts_result_queue.put(None)
                    break
                seq, text = item
                tts_started_ms = elapsed_ms()
                audio_bytes: bytes | None = None
                for attempt in range(1, TTS_MAX_ATTEMPTS + 1):
                    try:
                        audio_bytes, _ = await _synthesize_speech_async(
                            text,
                            request.language,
                            "Companion",
                        )
                        logger.debug(
                            "Companion TTS segment worker=%s seq=%s attempt=%s start_ms=%s done_ms=%s chars=%s",
                            worker_id,
                            seq,
                            attempt,
                            tts_started_ms,
                            elapsed_ms(),
                            len(text),
                        )
                        break
                    except Exception as exc:
                        if attempt >= TTS_MAX_ATTEMPTS:
                            logger.exception(
                                "Companion TTS segment failed after retries worker=%s seq=%s attempts=%s text_preview=%r",
                                worker_id,
                                seq,
                                attempt,
                                text[:100],
                            )
                            break
                        backoff = TTS_RETRY_BACKOFF_SECONDS[
                            min(attempt - 1, len(TTS_RETRY_BACKOFF_SECONDS) - 1)
                        ]
                        logger.warning(
                            "Companion TTS segment retry worker=%s seq=%s attempt=%s/%s backoff=%.1fs error=%s text_preview=%r",
                            worker_id,
                            seq,
                            attempt,
                            TTS_MAX_ATTEMPTS,
                            backoff,
                            exc,
                            text[:100],
                        )
                        await asyncio.sleep(backoff)
                await tts_result_queue.put((seq, text, audio_bytes))

        async def audio_orderer():
            next_seq_to_send = 0
            pending: dict[int, tuple[str, bytes | None]] = {}
            finished_workers = 0
            first_audio_sent_ms: int | None = None
            try:
                while finished_workers < TTS_WORKER_COUNT:
                    result = await tts_result_queue.get()
                    if result is None:
                        finished_workers += 1
                        continue

                    seq, text, audio_bytes = result
                    pending[seq] = (text, audio_bytes)
                    while next_seq_to_send in pending:
                        ordered_text, ordered_audio = pending.pop(next_seq_to_send)
                        if ordered_audio:
                            audio_base64 = base64.b64encode(ordered_audio).decode("ascii")
                            if first_audio_sent_ms is None:
                                first_audio_sent_ms = elapsed_ms()
                            await event_queue.put(
                                _sse_event(
                                    "audio",
                                    {
                                        "seq": next_seq_to_send,
                                        "kind": "content",
                                        "text": ordered_text,
                                        "audio_base64": audio_base64,
                                    },
                                )
                            )
                        else:
                            logger.warning(
                                "Companion TTS segment skipped seq=%s text_preview=%r",
                                next_seq_to_send,
                                ordered_text[:100],
                            )
                        next_seq_to_send += 1
            except Exception:
                logger.exception("Companion audio ordering failed")
                await event_queue.put(_sse_event("error", {"detail": "Lỗi sinh nội dung"}))
            finally:
                logger.info(
                    "Companion stream audio latency session=%s item=%s first_audio_sent_ms=%s done_ms=%s",
                    request.session_id,
                    request.item_id,
                    first_audio_sent_ms,
                    elapsed_ms(),
                )
                await event_queue.put(None)

        if "[SYSTEM_EVENT]: APP_OPENED" in request.message:
            scan_label = "📸 Quét hiện vật gần nhất" if is_vi else "📸 Scan nearest object"
            actions = {
                "buttons": [
                    {
                        "type": "open_camera",
                        "label": scan_label,
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
            restart_label = "🔄 Bắt đầu hành trình mới" if is_vi else "🔄 Start a new journey"
            actions = {
                "buttons": [
                    {
                        "type": "restart_tour",
                        "label": restart_label,
                    }
                ]
            }
            yield f"event: actions\ndata: {json.dumps(actions)}\n\n"

        async def ack_producer():
            if "[SYSTEM_EVENT]:" in request.message:
                return
            try:
                ack_audio = await _get_companion_ack_audio(request.language)
                await event_queue.put(
                    _sse_event(
                        "audio",
                        {
                            "seq": -1,
                            "kind": "ack",
                            "audio_base64": base64.b64encode(ack_audio).decode("ascii"),
                        },
                    )
                )
            except Exception:
                logger.exception("Companion acknowledgement TTS failed")

        ack_task = (
            asyncio.create_task(ack_producer())
            if ENABLE_COMPANION_ACK_AUDIO
            else None
        )
        producer_task = asyncio.create_task(llm_producer())
        worker_tasks = [
            asyncio.create_task(tts_worker(worker_id))
            for worker_id in range(TTS_WORKER_COUNT)
        ]
        orderer_task = asyncio.create_task(audio_orderer())
        tasks = [
            task
            for task in [ack_task, producer_task, *worker_tasks, orderer_task]
            if task is not None
        ]
        try:
            while True:
                event = await event_queue.get()
                if event is None:
                    yield "event: done\ndata: {}\n\n"
                    break
                yield event
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    return StreamingResponse(event_generator(), media_type="text/event-stream")
