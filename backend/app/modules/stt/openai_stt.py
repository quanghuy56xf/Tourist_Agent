import logging
from typing import Any

from app.core.config import OPENAI_API_KEY, STT_MODEL


def _build_client() -> Any:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set.")
    from openai import OpenAI

    return OpenAI(api_key=OPENAI_API_KEY)


# Map browser MIME types to file extensions that Whisper accepts
_MIME_TO_EXT = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
}


def transcribe_audio(
    audio_bytes: bytes,
    mime_type: str,
    *,
    client: Any | None = None,
) -> str:
    if not audio_bytes:
        raise ValueError("audio is empty")

    ext = _MIME_TO_EXT.get(mime_type, "webm")
    openai_client = client or _build_client()

    response = openai_client.audio.transcriptions.create(
        model=STT_MODEL,
        file=(f"speech.{ext}", audio_bytes, mime_type),
        language="vi",
    )

    transcript = (response.text or "").strip()
    if not transcript:
        raise ValueError("Whisper returned empty transcript")
    return transcript
