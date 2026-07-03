from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import types

from app.core.config import GOOGLE_API_KEY, STT_MODEL

STT_PROMPT = (
    "Chép chính xác lời nói trong đoạn âm thanh thành văn bản tiếng Việt. "
    "Chỉ trả về nội dung đã chép, không giải thích, không thêm dấu ngoặc kép."
)


@dataclass(frozen=True)
class SttTranscriptionResult:
    transcript: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    token_source: str = "missing"


def _build_client() -> genai.Client:
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set.")
    return genai.Client(
        api_key=GOOGLE_API_KEY,
        http_options=types.HttpOptions(
            retry_options=types.HttpRetryOptions(
                attempts=3,
                initial_delay=0.5,
                max_delay=2.0,
                exp_base=2.0,
                jitter=0.2,
                http_status_codes=[408, 429, 500, 502, 503, 504],
            ),
        ),
    )


def _usage_int(usage: Any, name: str) -> int:
    value = getattr(usage, name, 0) if usage is not None else 0
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _extract_usage(response: Any) -> tuple[int, int, int, str]:
    usage = getattr(response, "usage_metadata", None)
    input_tokens = _usage_int(usage, "prompt_token_count")
    output_tokens = _usage_int(usage, "candidates_token_count")
    total_tokens = _usage_int(usage, "total_token_count")
    if total_tokens <= 0:
        total_tokens = input_tokens + output_tokens
    token_source = "gemini" if any((input_tokens, output_tokens, total_tokens)) else "missing"
    return input_tokens, output_tokens, total_tokens, token_source


def transcribe_audio(
    audio_bytes: bytes,
    mime_type: str,
    *,
    client: Any | None = None,
) -> SttTranscriptionResult:
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
    input_tokens, output_tokens, total_tokens, token_source = _extract_usage(response)
    return SttTranscriptionResult(
        transcript=transcript,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        token_source=token_source,
    )
