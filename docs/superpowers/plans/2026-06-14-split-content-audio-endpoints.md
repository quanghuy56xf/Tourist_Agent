# Split Content And Audio Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return item text without waiting for TTS and generate/stream server audio only when playback is explicitly requested.

**Architecture:** Keep the existing text and audio routes, but remove synchronous `finalize_with_audio` calls from text GET/PUT handlers. The frontend receives text immediately and gives the guide panel a lazy audio endpoint; the panel accesses it only from a user playback action.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, Next.js 14, React, TypeScript.

---

### Task 1: Decouple Backend Text Responses From TTS

**Files:**
- Modify: `backend/tests/api/test_content.py`
- Modify: `backend/app/modules/content/router.py`

- [ ] Add API tests asserting `GET /content` and `PUT /content` never call `finalize_with_audio`, return text successfully, and report existing audio only when already stored.
- [ ] Run the focused tests and confirm they fail because the handlers still invoke TTS.
- [ ] Remove synchronous audio finalization from both handlers.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Load Server Audio Only On Explicit Playback

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/item/[id]/page.tsx`
- Modify: `frontend/components/visitor/HeraGuidePanel.tsx`
- Test: `frontend/tests/contentAudio.test.ts`

- [ ] Add a test for constructing the item audio endpoint independently from the text response.
- [ ] Run the frontend tests and confirm the new test fails.
- [ ] Add the endpoint helper and pass it to the guide panel as a lazy audio source.
- [ ] Keep automatic text reveal/browser speech unchanged, but access server audio only inside an explicit play/replay handler.
- [ ] Run frontend tests and build.

### Task 3: Verify The Full Flow

**Files:**
- Verify only.

- [ ] Run the complete backend test suite.
- [ ] Run the complete frontend test suite and production build.
- [ ] Call item 10 text endpoint and confirm it returns without generating audio.
- [ ] Call item 10 audio endpoint separately and confirm it streams audio.
