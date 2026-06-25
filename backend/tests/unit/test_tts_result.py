from concurrent.futures import TimeoutError as FuturesTimeoutError
from unittest.mock import patch

from app.modules.content.tts import TTSResult, synthesize_speech


def test_synthesize_speech_reports_timeout():
    with patch("app.modules.content.tts.ThreadPoolExecutor") as executor_cls:
        pool = executor_cls.return_value.__enter__.return_value
        pool.submit.return_value.result.side_effect = FuturesTimeoutError()
        result = synthesize_speech("Xin chào", "Tiếng Việt")

    assert result.ok is False
    assert result.error_code == "timeout"
    assert "timed out" in (result.error_detail or "").lower()


def test_synthesize_speech_reports_empty_input():
    result = synthesize_speech("   ", "Tiếng Việt")
    assert result.ok is False
    assert result.error_code == "empty_input"
