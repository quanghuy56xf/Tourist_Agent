from types import SimpleNamespace

import pytest

from app.modules.stt.gemini_stt import transcribe_audio


class FakeModels:
    def __init__(self, text: str):
        self.text = text
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(text=self.text)


def test_transcribe_audio_sends_inline_audio_to_flash_lite():
    models = FakeModels("  Xin chào Văn Miếu.  ")
    client = SimpleNamespace(models=models)

    transcript = transcribe_audio(
        b"audio-bytes",
        "audio/webm",
        client=client,
    )

    assert transcript == "Xin chào Văn Miếu."
    assert models.calls[0]["model"] == "gemini-2.5-flash-lite"


def test_transcribe_audio_rejects_empty_model_output():
    client = SimpleNamespace(models=FakeModels("   "))

    with pytest.raises(ValueError, match="empty transcript"):
        transcribe_audio(b"audio-bytes", "audio/mp4", client=client)
