from collections.abc import Sequence
from dataclasses import dataclass
from math import ceil
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


@dataclass(frozen=True)
class TokenUsage:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    prompt_cache_hit_tokens: int = 0
    prompt_cache_miss_tokens: int = 0
    token_source: str = "provider"

    @classmethod
    def from_parts(
        cls,
        *,
        prompt_cache_hit_tokens: int,
        prompt_cache_miss_tokens: int,
        completion_tokens: int,
        token_source: str,
    ) -> "TokenUsage":
        prompt_tokens = prompt_cache_hit_tokens + prompt_cache_miss_tokens
        return cls(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            prompt_cache_hit_tokens=prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=prompt_cache_miss_tokens,
            token_source=token_source,
        )


def estimate_token_count(text: str) -> int:
    cleaned = (text or "").strip()
    if not cleaned:
        return 0
    return max(1, ceil(len(cleaned) / 3.5))


def estimate_token_usage(
    *,
    prompt_text: str,
    completion_text: str = "",
) -> TokenUsage:
    prompt_tokens = estimate_token_count(prompt_text)
    completion_tokens = estimate_token_count(completion_text)
    return TokenUsage.from_parts(
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        token_source="estimated",
    )


def _coerce_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _usage_dict(response: Any) -> dict[str, Any]:
    metadata = getattr(response, "response_metadata", None) or {}
    usage = metadata.get("usage_metadata") or metadata.get("token_usage") or {}
    if isinstance(usage, dict):
        return usage
    return {}


def extract_token_usage(
    response: Any,
    *,
    prompt_text: str = "",
    completion_text: str = "",
) -> TokenUsage:
    if response is None:
        if prompt_text or completion_text:
            return estimate_token_usage(
                prompt_text=prompt_text,
                completion_text=completion_text,
            )
        return TokenUsage.from_parts(
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=0,
            completion_tokens=0,
            token_source="estimated",
        )

    usage = _usage_dict(response)

    cache_hit = _coerce_int(usage.get("prompt_cache_hit_tokens"))
    cache_miss = _coerce_int(usage.get("prompt_cache_miss_tokens"))
    completion_tokens = _coerce_int(
        usage.get("candidates_token_count")
        or usage.get("completion_tokens")
        or usage.get("output_tokens")
    )

    prompt_tokens = _coerce_int(
        usage.get("prompt_token_count")
        or usage.get("prompt_tokens")
        or usage.get("input_tokens")
    )

    if cache_hit or cache_miss:
        if not prompt_tokens:
            prompt_tokens = cache_hit + cache_miss
        elif cache_hit + cache_miss == 0:
            cache_miss = prompt_tokens
    elif prompt_tokens or completion_tokens:
        cache_miss = prompt_tokens

    if cache_hit or cache_miss or completion_tokens:
        return TokenUsage.from_parts(
            prompt_cache_hit_tokens=cache_hit,
            prompt_cache_miss_tokens=cache_miss,
            completion_tokens=completion_tokens,
            token_source="provider",
        )

    if prompt_text or completion_text:
        return estimate_token_usage(
            prompt_text=prompt_text,
            completion_text=completion_text,
        )

    return TokenUsage.from_parts(
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=0,
        completion_tokens=0,
        token_source="estimated",
    )


def merge_stream_token_usage(chunks: list[Any]) -> TokenUsage | None:
    for chunk in reversed(chunks):
        usage = extract_token_usage(chunk)
        if usage.token_source == "provider" and (
            usage.prompt_cache_hit_tokens
            or usage.prompt_cache_miss_tokens
            or usage.completion_tokens
        ):
            return usage
    return None


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


def extract_complete_text(response: Any) -> str:
    """Extract text and reject provider- or syntax-truncated generations."""
    metadata = getattr(response, "response_metadata", None) or {}
    finish_reason = str(
        metadata.get("finish_reason")
        or metadata.get("finishReason")
        or ""
    ).upper()
    if finish_reason in {"MAX_TOKENS", "LENGTH", "TOKEN_LIMIT"}:
        raise ValueError("LLM returned incomplete text content")

    return extract_text_content(getattr(response, "content", None))
