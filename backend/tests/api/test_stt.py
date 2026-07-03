import logging
from types import SimpleNamespace

from app.models.stt_usage_log import SttUsageLog
from app.modules.stt import router as stt_router


def test_stt_transcribes_uploaded_audio(client, db_session, monkeypatch):
    monkeypatch.setattr(
        stt_router,
        "transcribe_audio",
        lambda audio_bytes, mime_type: SimpleNamespace(
            transcript="Đây là Khuê Văn Các.",
            input_tokens=100,
            output_tokens=6,
            total_tokens=106,
            token_source="gemini",
        ),
    )

    response = client.post(
        "/api/stt",
        files={"audio": ("speech.webm", b"audio-data", "audio/webm")},
        headers={"X-Visitor-Session-Id": "sess-1", "X-Group-Id": "2"},
    )

    assert response.status_code == 200
    assert response.json() == {"transcript": "Đây là Khuê Văn Các."}
    log = db_session.query(SttUsageLog).one()
    assert log.session_id == "sess-1"
    assert log.group_id == 2
    assert log.input_tokens == 100
    assert log.output_tokens == 6
    assert log.total_tokens == 106
    assert log.success == 1
    assert log.cost_usd > 0


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


def test_stt_logs_gemini_error_code(client, db_session, monkeypatch, caplog):
    class GeminiUnavailableError(Exception):
        code = 503
        status = "UNAVAILABLE"
        message = "Service temporarily unavailable"

    def fail_transcription(audio_bytes, mime_type):
        raise GeminiUnavailableError()

    monkeypatch.setattr(stt_router, "transcribe_audio", fail_transcription)

    with caplog.at_level(logging.ERROR, logger=stt_router.__name__):
        response = client.post(
            "/api/stt",
            files={"audio": ("speech.webm", b"audio-data", "audio/webm")},
            headers={"X-Visitor-Session-Id": "sess-error"},
        )

    assert response.status_code == 502
    assert "code=503" in caplog.text
    assert "status=UNAVAILABLE" in caplog.text
    log = db_session.query(SttUsageLog).one()
    assert log.session_id == "sess-error"
    assert log.success == 0
    assert log.error_detail == "Service temporarily unavailable"
