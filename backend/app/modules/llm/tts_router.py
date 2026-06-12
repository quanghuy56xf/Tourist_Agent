import io
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from gtts import gTTS

from app.schemas.generate import TTSRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tts"])


@router.post("/tts")
def text_to_speech(request: TTSRequest):
    try:
        tts = gTTS(text=request.text, lang=request.language, slow=False)
        output = io.BytesIO()
        tts.write_to_fp(output)
        output.seek(0)
        return StreamingResponse(output, media_type="audio/mpeg")
    except Exception:
        logger.exception("Text-to-speech provider failed")
        raise HTTPException(
            status_code=502,
            detail="Không thể tạo âm thanh lúc này",
        )
