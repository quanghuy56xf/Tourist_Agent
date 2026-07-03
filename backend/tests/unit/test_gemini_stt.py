from types import SimpleNamespace

import pytest

from app.modules.stt import gemini_stt
from app.modules.stt.gemini_stt import transcribe_audio


class FakeModels:
    def __init__(self, text: str, usage_metadata=None):
        self.text = text
        self.usage_metadata = usage_metadata
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(text=self.text, usage_metadata=self.usage_metadata)


def test_transcribe_audio_sends_inline_audio_to_flash_lite():
    usage = SimpleNamespace(
        prompt_token_count=123,
        candidates_token_count=8,
        total_token_count=131,
    )
    models = FakeModels("  Xin chào Văn Miếu.  ", usage)
    client = SimpleNamespace(models=models)

    result = transcribe_audio(
        b"audio-bytes",
        "audio/webm",
        client=client,
    )

    assert result.transcript == "Xin chào Văn Miếu."
    assert result.input_tokens == 123
    assert result.output_tokens == 8
    assert result.total_tokens == 131
    assert result.token_source == "gemini"
    assert models.calls[0]["model"] == "gemini-2.5-flash-lite"


def test_transcribe_audio_handles_missing_usage_metadata():
    models = FakeModels("Xin chào")
    client = SimpleNamespace(models=models)

    result = transcribe_audio(b"audio-bytes", "audio/webm", client=client)

    assert result.transcript == "Xin chào"
    assert result.total_tokens == 0
    assert result.token_source == "missing"


def test_transcribe_audio_rejects_empty_model_output():
    client = SimpleNamespace(models=FakeModels("   "))

    with pytest.raises(ValueError, match="empty transcript"):
        transcribe_audio(b"audio-bytes", "audio/mp4", client=client)


def test_build_client_configures_bounded_retry_for_transient_errors(monkeypatch):
    captured = {}

    def fake_client(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace()

    monkeypatch.setattr(gemini_stt, "GOOGLE_API_KEY", "test-key")
    monkeypatch.setattr(gemini_stt.genai, "Client", fake_client)

    gemini_stt._build_client()

    retry = captured["http_options"].retry_options
    assert retry.attempts == 3
    assert retry.initial_delay == 0.5
    assert retry.max_delay == 2.0
    assert retry.http_status_codes == [408, 429, 500, 502, 503, 504]
