import asyncio
import io
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

import edge_tts

from app.modules.content.personas import language_to_edge_voice
from app.modules.content.speech_text import prepare_text_for_speech

logger = logging.getLogger(__name__)

TTS_TIMEOUT_SECONDS = 60
TTS_ENGINE_ID = "edge-tts/vi-VN-HoaiMyNeural-speech-v2"
TTS_MEDIA_TYPE = "audio/mpeg"


def build_audio_mime() -> str:
    return f"{TTS_MEDIA_TYPE};engine={TTS_ENGINE_ID}"


def is_current_audio_mime(stored_mime: str | None) -> bool:
    if not stored_mime:
        return False
    for part in stored_mime.split(";")[1:]:
        if part.strip().startswith("engine="):
            return part.strip().split("=", 1)[1] == TTS_ENGINE_ID
    return False


def response_audio_mime(stored_mime: str) -> str:
    return stored_mime.split(";")[0]


async def _synthesize_speech_async(text: str, language: str) -> tuple[bytes, str]:
    voice = language_to_edge_voice(language)
    communicate = edge_tts.Communicate(text, voice)
    output = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            output.write(chunk["data"])
    return output.getvalue(), "audio/mpeg"


def synthesize_speech(text: str, language: str) -> tuple[bytes, str] | None:
    cleaned = prepare_text_for_speech(text)
    if not cleaned:
        return None

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, _synthesize_speech_async(cleaned, language))
            return future.result(timeout=TTS_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        logger.warning("Text-to-speech synthesis timed out after %ss", TTS_TIMEOUT_SECONDS)
        return None
    except Exception:
        logger.exception("Text-to-speech synthesis failed")
        return None
