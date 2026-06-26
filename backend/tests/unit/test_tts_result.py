import asyncio
from unittest.mock import patch

from app.modules.content.tts import TTSResult, synthesize_speech


def test_synthesize_speech_reports_timeout():
    async def hang(*args, **kwargs):
        await asyncio.sleep(10)

    with patch("app.modules.content.tts.TTS_TIMEOUT_SECONDS", 0.001):
        with patch("app.modules.content.tts._synthesize_speech_async", side_effect=hang):
            result = synthesize_speech("Xin chào", "Tiếng Việt")

    assert result.ok is False
    assert result.error_code == "timeout"
    assert "timed out" in (result.error_detail or "").lower()


def test_synthesize_speech_reports_empty_input():
    result = synthesize_speech("   ", "Tiếng Việt")
    assert result.ok is False
    assert result.error_code == "empty_input"
