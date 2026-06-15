import pytest
import httpx
from google.api_core.exceptions import ServiceUnavailable
from google.genai.errors import ClientError, ServerError
from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError

from app.modules.llm import client, generator


def test_generator_uses_configured_model_timeout_and_retries(monkeypatch):
    captured = {}

    class FakeChatGoogleGenerativeAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(generator, "LLM_PROVIDER", "gemini", raising=False)
    monkeypatch.setattr(generator, "GOOGLE_API_KEY", "test-key")
    monkeypatch.setattr(generator, "LLM_MODEL", "configured-model", raising=False)
    monkeypatch.setattr(generator, "LLM_TIMEOUT_SECONDS", 12.5, raising=False)
    monkeypatch.setattr(generator, "LLM_MAX_RETRIES", 3, raising=False)
    monkeypatch.setattr(
        generator,
        "ChatGoogleGenerativeAI",
        FakeChatGoogleGenerativeAI,
    )

    generator.RAGGenerator()

    assert captured["model"] == "configured-model"
    assert captured["request_timeout"] == 12.5
    assert captured["retries"] == 3


def test_provider_unavailable_error_is_translated():
    class BrokenLLM:
        def invoke(self, payload):
            raise ServiceUnavailable("provider overloaded")

    with pytest.raises(Exception) as exc_info:
        client.invoke_llm(BrokenLLM(), "prompt")

    assert isinstance(exc_info.value, client.LLMServiceUnavailableError)
    assert str(exc_info.value) == "LLM provider is temporarily unavailable"


def test_unexpected_provider_error_is_not_translated():
    class BrokenLLM:
        def invoke(self, payload):
            raise RuntimeError("programming error")

    with pytest.raises(RuntimeError, match="programming error"):
        client.invoke_llm(BrokenLLM(), "prompt")


@pytest.mark.parametrize(
    "provider_error",
    [
        ServerError(503, {"error": {"message": "overloaded"}}),
        httpx.ReadTimeout("request timed out"),
    ],
)
def test_current_sdk_temporary_errors_are_translated(provider_error):
    class BrokenLLM:
        def invoke(self, payload):
            raise provider_error

    with pytest.raises(client.LLMServiceUnavailableError):
        client.invoke_llm(BrokenLLM(), "prompt")


def test_wrapped_rate_limit_error_is_translated():
    provider_error = ClientError(429, {"error": {"message": "rate limited"}})
    wrapped_error = ChatGoogleGenerativeAIError("rate limited")
    wrapped_error.__cause__ = provider_error

    class BrokenLLM:
        def invoke(self, payload):
            raise wrapped_error

    with pytest.raises(client.LLMServiceUnavailableError):
        client.invoke_llm(BrokenLLM(), "prompt")
