from fastapi.testclient import TestClient

from app.main import app
from app.modules.vision import embedding


def test_model_is_not_loaded_on_module_import(monkeypatch):
    monkeypatch.setattr(embedding, "_model", None)
    monkeypatch.setattr(embedding, "_processor", None)

    assert embedding._model is None
    assert embedding._processor is None


def test_startup_does_not_warmup_model_by_default(monkeypatch):
    warmup_calls = []
    monkeypatch.setattr(embedding, "warmup", lambda: warmup_calls.append(True))

    with TestClient(app):
        pass

    assert warmup_calls == []
