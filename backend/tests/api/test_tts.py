from app.modules.llm import tts_router


class FakeTTS:
    def __init__(self, text, lang, slow):
        self.text = text

    def write_to_fp(self, fp):
        fp.write(b"fake-mp3")


def test_tts_returns_audio_stream(client, monkeypatch):
    monkeypatch.setattr(tts_router, "gTTS", FakeTTS)

    response = client.post(
        "/api/tts",
        json={"text": "Xin chào", "language": "vi"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"fake-mp3"


def test_tts_rejects_empty_text(client):
    response = client.post(
        "/api/tts",
        json={"text": "", "language": "vi"},
    )

    assert response.status_code == 422


def test_tts_returns_stable_error_for_provider_failure(client, monkeypatch):
    class BrokenTTS:
        def __init__(self, **kwargs):
            raise RuntimeError("provider details")

    monkeypatch.setattr(tts_router, "gTTS", BrokenTTS)

    response = client.post(
        "/api/tts",
        json={"text": "Xin chào", "language": "vi"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Không thể tạo âm thanh lúc này"
