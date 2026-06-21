from app.modules.stt import router as stt_router


def test_stt_transcribes_uploaded_audio(client, monkeypatch):
    monkeypatch.setattr(
        stt_router,
        "transcribe_audio",
        lambda audio_bytes, mime_type: "Đây là Khuê Văn Các.",
    )

    response = client.post(
        "/api/stt",
        files={"audio": ("speech.webm", b"audio-data", "audio/webm")},
    )

    assert response.status_code == 200
    assert response.json() == {"transcript": "Đây là Khuê Văn Các."}


def test_stt_rejects_empty_audio(client):
    response = client.post(
        "/api/stt",
        files={"audio": ("speech.webm", b"", "audio/webm")},
    )

    assert response.status_code == 400


def test_stt_rejects_unsupported_audio_type(client):
    response = client.post(
        "/api/stt",
        files={"audio": ("speech.txt", b"not-audio", "text/plain")},
    )

    assert response.status_code == 415
