from collections.abc import Sequence
from typing import Any

import httpx
import requests
from google.api_core.exceptions import (
    DeadlineExceeded,
    ServiceUnavailable,
    TooManyRequests,
)
from google.genai.errors import APIError

try:
    from openai import APIStatusError, RateLimitError
except ImportError:  # pragma: no cover - optional until langchain-openai installed
    APIStatusError = RateLimitError = ()


_LEGACY_TEMPORARY_ERRORS = (
    DeadlineExceeded,
    ServiceUnavailable,
    TooManyRequests,
)
_OPENAI_TEMPORARY_ERRORS = tuple(
    error_type
    for error_type in (RateLimitError, APIStatusError)
    if isinstance(error_type, type)
)
_TIMEOUT_ERRORS = (httpx.TimeoutException, requests.exceptions.Timeout)
_TEMPORARY_STATUS_CODES = {429, 503, 504}


class LLMServiceUnavailableError(RuntimeError):
    pass


def _is_temporary_provider_error(exc: Exception) -> bool:
    current: BaseException | None = exc
    while current is not None:
        if isinstance(current, _LEGACY_TEMPORARY_ERRORS + _TIMEOUT_ERRORS + _OPENAI_TEMPORARY_ERRORS):
            return True
        if (
            isinstance(current, APIStatusError)
            and current.status_code in _TEMPORARY_STATUS_CODES
        ):
            return True
        if (
            isinstance(current, APIError)
            and current.code in _TEMPORARY_STATUS_CODES
        ):
            return True
        current = current.__cause__
    return False


def invoke_llm(llm: Any, payload: Any) -> Any:
    try:
        return llm.invoke(payload)
    except Exception as exc:
        if _is_temporary_provider_error(exc):
            raise LLMServiceUnavailableError(
                "LLM provider is temporarily unavailable"
            ) from exc
        raise


def extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        text = content.strip()
    elif isinstance(content, Sequence):
        parts = [
            block.get("text", "").strip()
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        text = "\n".join(part for part in parts if part)
    else:
        text = ""

    if not text:
        raise ValueError("LLM returned empty text content")
    return text
