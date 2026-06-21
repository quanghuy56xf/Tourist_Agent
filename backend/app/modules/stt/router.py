import logging

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.modules.stt.gemini_stt import transcribe_audio

logger = logging.getLogger(__name__)

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


@router.post("/stt", response_model=TranscriptionResponse)
async def transcribe_uploaded_audio(
    audio: UploadFile = File(...),
) -> TranscriptionResponse:
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

    try:
        transcript = transcribe_audio(audio_bytes, mime_type)
    except ValueError as exc:
        logger.warning("STT validation failed: %s", exc)
        raise HTTPException(
            status_code=422,
            detail="Không nhận diện được nội dung giọng nói.",
        ) from exc
    except Exception as exc:
        logger.exception("Gemini STT failed")
        raise HTTPException(
            status_code=502,
            detail="Dịch vụ nhận diện giọng nói tạm thời không khả dụng.",
        ) from exc

    return TranscriptionResponse(transcript=transcript)
