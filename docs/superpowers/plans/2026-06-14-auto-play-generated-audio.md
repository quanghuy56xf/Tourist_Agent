# Auto-play Generated Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start revealing generated text immediately while preparing server audio in parallel, then automatically play cached or newly generated audio as soon as it is ready.

**Architecture:** Keep the existing lazy audio endpoint as the single source for cached audio and TTS generation. `HeraGuidePanel` owns an explicit audio preparation state and starts loading the endpoint when a new story begins; text reveal remains independent. A small pure helper maps playback state to control behavior so it can be tested without adding a React test framework.

**Tech Stack:** Next.js 14, React 18, TypeScript, browser `HTMLAudioElement`, Node test runner.

---

### Task 1: Define audio interaction states

**Files:**
- Create: `frontend/lib/audioPlayback.ts`
- Create: `frontend/tests/audioPlayback.test.ts`
- Modify: `frontend/tsconfig.tests.json`

- [x] Add failing tests for loading, ready, paused, finished, and error controls.
- [x] Run `npm.cmd test` and confirm the new tests fail because the helper is missing.
- [x] Implement the minimal state-to-control helper.
- [x] Run `npm.cmd test` and confirm the helper tests pass.

### Task 2: Prepare and auto-play server audio

**Files:**
- Modify: `frontend/components/visitor/HeraGuidePanel.tsx`

- [x] Start text reveal without waiting for audio or browser speech discovery.
- [x] Create/load the server audio immediately for each new content URL.
- [x] Keep controls disabled with the preparing label until audio is ready.
- [x] Automatically call `play()` when cached audio or generated TTS becomes playable.
- [x] Preserve audio position when the user pauses and resume from that position.
- [x] Keep text visible and expose a separate audio error state if loading or playback fails.

### Task 3: Add localized status text and verify

**Files:**
- Modify: `frontend/lib/i18n.ts`

- [x] Add Vietnamese and English labels for preparing audio.
- [x] Run focused frontend tests.
- [x] Run the frontend production build.
- [x] Verify the changed files with `git diff --check`.
