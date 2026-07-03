import logging
from time import perf_counter
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import STT_MODEL, STT_PROVIDER
from app.core.database import get_db
from app.modules.analytics.stt_cost import record_stt_usage

logger = logging.getLogger(__name__)


def transcribe_audio(audio_bytes: bytes, mime_type: str) -> Any:
    """Route to the configured STT provider."""
    if STT_PROVIDER == "openai":
        from app.modules.stt.openai_stt import transcribe_audio as provider_transcribe_audio
    else:
        from app.modules.stt.gemini_stt import transcribe_audio as provider_transcribe_audio
    return provider_transcribe_audio(audio_bytes, mime_type)


router = APIRouter(prefix="/api", tags=["stt"])

MAX_AUDIO_BYTES = 5 * 1024 * 1024
SUPPORTED_AUDIO_TYPES = {
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
}


class TranscriptionResponse(BaseModel):
    transcript: str


def _header_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _transcript_text(result: Any) -> str:
    if isinstance(result, str):
        return result
    return str(getattr(result, "transcript", "") or "")


@router.post("/stt", response_model=TranscriptionResponse)
async def transcribe_uploaded_audio(
    request: Request,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> TranscriptionResponse:
    session_id = request.headers.get("x-visitor-session-id")
    group_id = _header_int(request.headers.get("x-group-id"))
    mime_type = (audio.content_type or "").split(";", 1)[0].lower()
    if mime_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Định dạng âm thanh không được hỗ trợ.",
        )

    audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="File âm thanh rỗng.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File âm thanh vượt quá giới hạn 5 MB.",
        )

    started = perf_counter()
    result: Any | None = None
    try:
        result = transcribe_audio(audio_bytes, mime_type)
        transcript = _transcript_text(result).strip()
        if not transcript:
            raise ValueError("empty transcript")
    except ValueError as exc:
        duration_ms = int((perf_counter() - started) * 1000)
        record_stt_usage(
            db,
            session_id=session_id,
            group_id=group_id,
            provider=STT_PROVIDER,
            model=STT_MODEL,
            mime_type=mime_type,
            audio_bytes=len(audio_bytes),
            success=False,
            error_detail=str(exc),
            duration_ms=duration_ms,
        )
        logger.warning("STT validation failed: %s", exc)
        raise HTTPException(
            status_code=422,
            detail="Không nhận diện được nội dung giọng nói.",
        ) from exc
    except Exception as exc:
        duration_ms = int((perf_counter() - started) * 1000)
        record_stt_usage(
            db,
            session_id=session_id,
            group_id=group_id,
            provider=STT_PROVIDER,
            model=STT_MODEL,
            mime_type=mime_type,
            audio_bytes=len(audio_bytes),
            success=False,
            error_detail=getattr(exc, "message", None) or str(exc),
            duration_ms=duration_ms,
        )
        logger.exception(
            "STT (%s) failed: type=%s code=%s status=%s message=%s",
            STT_PROVIDER,
            type(exc).__name__,
            getattr(exc, "code", None),
            getattr(exc, "status", None),
            getattr(exc, "message", None) or str(exc),
        )
        raise HTTPException(
            status_code=502,
            detail="Dịch vụ nhận diện giọng nói tạm thời không khả dụng.",
        ) from exc

    duration_ms = int((perf_counter() - started) * 1000)
    record_stt_usage(
        db,
        session_id=session_id,
        group_id=group_id,
        provider=STT_PROVIDER,
        model=STT_MODEL,
        mime_type=mime_type,
        audio_bytes=len(audio_bytes),
        input_tokens=int(getattr(result, "input_tokens", 0) or 0),
        output_tokens=int(getattr(result, "output_tokens", 0) or 0),
        total_tokens=int(getattr(result, "total_tokens", 0) or 0),
        token_source=str(getattr(result, "token_source", "missing") or "missing"),
        success=True,
        duration_ms=duration_ms,
    )
    return TranscriptionResponse(transcript=transcript)
