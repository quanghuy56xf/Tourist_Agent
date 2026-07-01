from app.modules.llm import tts_router


from app.modules.content.tts import TTSResult


def test_tts_returns_audio_stream(client, monkeypatch):
    monkeypatch.setattr(
        tts_router,
        "synthesize_speech",
        lambda text, language, persona=None: TTSResult(ok=True, audio=b"fake-mp3", mime="audio/mpeg"),
    )

    response = client.post(
        "/api/tts",
        json={"text": "Xin chào", "language": "vi"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"fake-mp3"


def test_tts_uses_cleaned_text(client, monkeypatch):
    captured = {}

    def fake_speech(text, language, persona=None):
        captured["text"] = text
        return TTSResult(ok=True, audio=b"fake-mp3", mime="audio/mpeg")

    monkeypatch.setattr(tts_router, "synthesize_speech", fake_speech)

    response = client.post(
        "/api/tts",
        json={"text": "**Văn Miếu** 😀", "language": "vi"},
    )

    assert response.status_code == 200
    assert captured["text"] == "Văn Miếu"


def test_tts_rejects_text_empty_after_cleaning(client):
    response = client.post(
        "/api/tts",
        json={"text": "😀 ✦", "language": "vi"},
    )

    assert response.status_code == 400


def test_tts_rejects_empty_text(client):
    response = client.post(
        "/api/tts",
        json={"text": "", "language": "vi"},
    )

    assert response.status_code == 422


def test_tts_returns_stable_error_for_provider_failure(client, monkeypatch):
    def broken_speech(text, language, persona=None):
        raise RuntimeError("provider details")

    monkeypatch.setattr(tts_router, "synthesize_speech", broken_speech)

    response = client.post(
        "/api/tts",
        json={"text": "Xin chào", "language": "vi"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Không thể tạo âm thanh lúc này"


async def _fake_stream(*args, **kwargs):
    yield b"fake-mp3-chunk-1"
    yield b"fake-mp3-chunk-2"


def test_tts_stream_returns_chunked_audio(client, monkeypatch):
    monkeypatch.setattr(tts_router, "stream_speech_chunks", _fake_stream)

    response = client.post(
        "/api/tts/stream",
        json={"text": "Xin chào", "language": "vi"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/mpeg")
    assert response.content == b"fake-mp3-chunk-1fake-mp3-chunk-2"


def test_tts_stream_uses_cleaned_text(client, monkeypatch):
    captured = {}

    async def fake_stream(text, language, persona=None):
        captured["text"] = text
        yield b"fake-mp3-chunk"

    monkeypatch.setattr(tts_router, "stream_speech_chunks", fake_stream)

    response = client.post(
        "/api/tts/stream",
        json={"text": "**Văn Miếu** 😀", "language": "vi"},
    )

    assert response.status_code == 200
    assert captured["text"] == "Văn Miếu"


def test_tts_stream_rejects_empty_text(client):
    response = client.post(
        "/api/tts/stream",
        json={"text": "   ", "language": "vi"},
    )

    assert response.status_code == 400
