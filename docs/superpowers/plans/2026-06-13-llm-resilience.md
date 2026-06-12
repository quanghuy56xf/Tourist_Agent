# LLM Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemini model selection configurable and return a stable HTTP 503 response for temporary provider failures.

**Architecture:** Environment settings configure the existing LangChain Gemini client. A small client-layer exception translates retryable Google API failures into an application error that story and chat routers map to HTTP 503.

**Tech Stack:** Python, FastAPI, LangChain Google GenAI, google-api-core, pytest.

---

### Task 1: Configuration

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/modules/llm/generator.py`
- Test: `backend/tests/unit/test_config.py`

- [ ] Add failing tests for the default LLM model, timeout, and retry count.
- [ ] Run `pytest tests/unit/test_config.py -v` and confirm the new tests fail.
- [ ] Add `LLM_MODEL`, `LLM_TIMEOUT_SECONDS`, and `LLM_MAX_RETRIES`.
- [ ] Pass those settings to `ChatGoogleGenerativeAI`.
- [ ] Run the configuration tests and confirm they pass.

### Task 2: Provider Error Translation

**Files:**
- Modify: `backend/app/modules/llm/client.py`
- Modify: `backend/app/modules/llm/generator.py`
- Test: `backend/tests/unit/test_llm_content.py`

- [ ] Add failing tests showing retryable Google API errors become `LLMServiceUnavailableError`.
- [ ] Run the focused unit tests and confirm the expected failure.
- [ ] Add the application exception and invocation wrapper.
- [ ] Use the wrapper for story and chat generation.
- [ ] Run the focused unit tests and confirm they pass.

### Task 3: HTTP Status Mapping

**Files:**
- Modify: `backend/app/modules/llm/chat_router.py`
- Modify: `backend/app/modules/llm/story_router.py`
- Test: `backend/tests/api/test_chat.py`
- Test: `backend/tests/api/test_story.py`

- [ ] Add failing API tests expecting HTTP 503 for `LLMServiceUnavailableError`.
- [ ] Run the focused API tests and confirm the expected failure.
- [ ] Catch the application exception before the generic handler.
- [ ] Preserve the current HTTP 502 behavior for unexpected exceptions.
- [ ] Run the focused API tests and confirm they pass.

### Task 4: Deployment Documentation and Verification

**Files:**
- Modify: `backend/.env.example`
- Modify: `docker-compose.yml`
- Modify: `README.md`

- [ ] Document the three new environment settings.
- [ ] Run all LLM/config/router tests.
- [ ] Run `pytest -m "not integration"` and confirm the offline suite passes.
