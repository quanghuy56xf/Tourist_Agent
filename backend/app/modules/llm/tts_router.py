import io
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.modules.content.tts import synthesize_speech
from app.schemas.generate import TTSRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tts"])


@router.post("/tts")
def text_to_speech(request: TTSRequest):
    try:
        result = (
            synthesize_speech(request.text, request.language, request.persona)
            if request.persona
            else synthesize_speech(request.text, request.language)
        )
        if not result:
            raise HTTPException(
                status_code=502,
                detail="Không thể tạo âm thanh lúc này",
            )
        audio_bytes, media_type = result
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
