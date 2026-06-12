# LLM Resilience Design

## Goal

Keep story and chat responsive when the configured Gemini model is overloaded,
while allowing deployments to select a model without code changes.

## Design

- Read `LLM_MODEL`, `LLM_TIMEOUT_SECONDS`, and `LLM_MAX_RETRIES` from the
  environment. Default to `gemini-2.5-flash`, a 60-second timeout, and two
  retries.
- Configure `ChatGoogleGenerativeAI` with those values so the provider client
  handles transient retryable failures.
- Introduce `LLMServiceUnavailableError` as the stable application boundary for
  provider overload, quota, and deadline failures.
- Translate that exception to HTTP 503 in story and chat. Preserve HTTP 502 for
  unexpected generation failures.
- Cover configuration, provider error translation, and router status mapping
  with offline tests.

## Non-Goals

- Changing prompts, RAG retrieval, response schemas, or frontend behavior.
- Automatically switching models during a request.

