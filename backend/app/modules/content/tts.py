import asyncio
import io
import logging
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from dataclasses import dataclass

import edge_tts

from app.modules.content.personas import language_to_edge_voice
from app.modules.content.speech_text import prepare_text_for_speech

logger = logging.getLogger(__name__)

TTS_TIMEOUT_SECONDS = 60
TTS_ENGINE_ID = "edge-tts/vi-VN-HoaiMyNeural-speech-v2"
COMPANION_TTS_ENGINE_ID = "edge-tts/vi-VN-NamMinhNeural-speech-v1"
TTS_MEDIA_TYPE = "audio/mpeg"


@dataclass(frozen=True)
class TTSResult:
    ok: bool
    audio: bytes | None = None
    mime: str | None = None
    error_code: str | None = None
    error_detail: str | None = None

    def as_tuple(self) -> tuple[bytes, str] | None:
        if self.ok and self.audio is not None and self.mime is not None:
            return self.audio, self.mime
        return None


def build_audio_mime(persona: str | None = None) -> str:
    engine = COMPANION_TTS_ENGINE_ID if persona == "Companion" else TTS_ENGINE_ID
    return f"{TTS_MEDIA_TYPE};engine={engine}"


def is_current_audio_mime(stored_mime: str | None, persona: str | None = None) -> bool:
    if not stored_mime:
        return False
    for part in stored_mime.split(";")[1:]:
        if part.strip().startswith("engine="):
            expected = COMPANION_TTS_ENGINE_ID if persona == "Companion" else TTS_ENGINE_ID
            return part.strip().split("=", 1)[1] == expected
    return False


def response_audio_mime(stored_mime: str) -> str:
    return stored_mime.split(";")[0]


def _format_tts_error(exc: Exception) -> tuple[str, str]:
    name = type(exc).__name__
    message = str(exc).strip() or name
    if name == "NoAudioReceived":
        return "no_audio_received", f"Edge TTS returned no audio ({message})"
    if isinstance(exc, RuntimeError) and "empty audio" in message.lower():
        return "empty_audio", "Edge TTS returned empty audio"
    return "edge_tts_error", f"{name}: {message[:200]}"


async def _synthesize_speech_async(
    text: str,
    language: str,
    persona: str | None = None,
) -> tuple[bytes, str]:
    voice = language_to_edge_voice(language, persona=persona)
    communicate = edge_tts.Communicate(text, voice)
    output = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            output.write(chunk["data"])
    audio = output.getvalue()
    if not audio:
        raise RuntimeError("Text-to-speech returned empty audio")
    return audio, "audio/mpeg"


def _run_synthesis(text: str, language: str, persona: str | None = None) -> tuple[bytes, str]:
    return asyncio.run(_synthesize_speech_async(text, language, persona))


def synthesize_speech(
    text: str,
    language: str,
    persona: str | None = None,
) -> TTSResult:
    cleaned = prepare_text_for_speech(text)
    if not cleaned:
        return TTSResult(
            ok=False,
            error_code="empty_input",
            error_detail="No speakable text after cleaning",
        )

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_run_synthesis, cleaned, language, persona)
            audio, mime = future.result(timeout=TTS_TIMEOUT_SECONDS)
        return TTSResult(ok=True, audio=audio, mime=mime)
    except FuturesTimeoutError:
        logger.warning("Text-to-speech synthesis timed out after %ss", TTS_TIMEOUT_SECONDS)
        return TTSResult(
            ok=False,
            error_code="timeout",
            error_detail=f"Edge TTS timed out after {TTS_TIMEOUT_SECONDS}s",
        )
    except Exception as exc:
        code, detail = _format_tts_error(exc)
        logger.warning("Text-to-speech synthesis failed (%s): %s", code, detail)
        return TTSResult(ok=False, error_code=code, error_detail=detail)


async def stream_speech_chunks(
    text: str,
    language: str,
    persona: str | None = None,
) -> AsyncIterator[bytes]:
    """Yield MP3 bytes from Edge TTS as they arrive."""
    cleaned = prepare_text_for_speech(text)
    if not cleaned:
        return

    voice = language_to_edge_voice(language, persona=persona)
    communicate = edge_tts.Communicate(cleaned, voice)
    async for chunk in communicate.stream():
        if chunk["type"] != "audio":
            continue
        data = chunk.get("data")
        if data:
            yield data
