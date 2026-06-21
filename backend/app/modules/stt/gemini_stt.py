from typing import Any

from google import genai
from google.genai import types

from app.core.config import GOOGLE_API_KEY

STT_MODEL = "gemini-2.5-flash-lite"
STT_PROMPT = (
    "Chép chính xác lời nói trong đoạn âm thanh thành văn bản tiếng Việt. "
    "Chỉ trả về nội dung đã chép, không giải thích, không thêm dấu ngoặc kép."
)


def _build_client() -> genai.Client:
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set.")
    return genai.Client(api_key=GOOGLE_API_KEY)


def transcribe_audio(
    audio_bytes: bytes,
    mime_type: str,
    *,
    client: Any | None = None,
) -> str:
    if not audio_bytes:
        raise ValueError("audio is empty")

    gemini_client = client or _build_client()
    response = gemini_client.models.generate_content(
        model=STT_MODEL,
        contents=[
            STT_PROMPT,
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
        ],
        config=types.GenerateContentConfig(
            temperature=0,
            max_output_tokens=256,
        ),
    )
    transcript = (getattr(response, "text", None) or "").strip()
    if not transcript:
        raise ValueError("Gemini returned empty transcript")
    return transcript
