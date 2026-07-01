import io
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.modules.content.speech_text import prepare_text_for_speech
from app.modules.content.tts import stream_speech_chunks, synthesize_speech
from app.schemas.generate import TTSRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tts"])


@router.post("/tts")
def text_to_speech(request: TTSRequest):
    cleaned = prepare_text_for_speech(request.text)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Không có văn bản để đọc thành audio")

    try:
        result = synthesize_speech(cleaned, request.language, request.persona)
        payload = result.as_tuple()
        if not payload:
            raise HTTPException(
                status_code=502,
                detail=result.error_detail or "Không thể tạo âm thanh lúc này",
            )
        audio_bytes, media_type = payload
        output = io.BytesIO(audio_bytes)
        output.seek(0)
        return StreamingResponse(output, media_type=media_type)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Text-to-speech provider failed")
        raise HTTPException(
            status_code=502,
            detail="Không thể tạo âm thanh lúc này",
        )


@router.post("/tts/stream")
async def text_to_speech_stream(request: TTSRequest):
    cleaned = prepare_text_for_speech(request.text)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Không có văn bản để đọc thành audio")

    async def audio_stream():
        async for chunk in stream_speech_chunks(cleaned, request.language, request.persona):
            yield chunk

    return StreamingResponse(
        audio_stream(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )
