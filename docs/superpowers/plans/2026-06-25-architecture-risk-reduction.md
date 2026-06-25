# Architecture Risk Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giảm các rủi ro kiến trúc đã xác nhận mà không làm đổi flow visitor/Companion đang chạy ổn.

**Architecture:** Làm theo từng lát cắt nhỏ, mỗi lát cắt có test riêng và có thể rollback độc lập. Ưu tiên hardening và tách trách nhiệm trước, chưa đưa thêm hệ thống lớn như Celery/object storage thật nếu chưa cần; thiết kế interface để có thể nâng cấp sau.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite/Postgres-compatible schema, Next.js 14, React, TypeScript, pytest, npm lint/build.

---

## Scope

### Làm

- Chuyển audio khỏi mô hình “chỉ có BLOB trong DB” sang abstraction lưu trữ có thể dùng database hiện tại và file storage sau này.
- Thêm giới hạn an toàn cho Companion SSE để giảm nguy cơ giữ worker quá lâu.
- Thêm rate limiting backend ở các endpoint tốn tài nguyên.
- Tách `frontend/components/visitor/CompanionChat.tsx` thành các hook/component nhỏ nhưng giữ nguyên hành vi.
- Harden nhẹ RAG document delete/index repair, không thêm Celery ở giai đoạn này.

### Không làm

- Không đổi Gemini STT, MediaRecorder, silence detection.
- Không đổi backend-driven Companion SSE text+audio pipeline.
- Không xử lý `mascot.gif` vì code hiện tại không có asset/usage này.
- Không đưa Celery/Redis/object storage thật vào ngay; chỉ chuẩn bị interface nếu cần mở rộng.

---

## File Map

### Backend audio storage

- Modify: `backend/app/models/content_variant.py`
  - Thêm metadata cho audio location/hash/size, giữ `audio_data` để tương thích dữ liệu cũ.
- Create: `backend/app/modules/content/audio_storage.py`
  - Interface đọc/ghi/xóa audio; implementation mặc định vẫn lưu DB.
- Modify: `backend/app/modules/content/service.py`
  - Gọi `audio_storage` thay vì chạm trực tiếp `audio_data` ở các đường generate/ensure audio.
- Modify: `backend/app/modules/content/router.py`
  - Stream audio qua `audio_storage.open_audio_stream()`.
- Modify: `backend/app/modules/content/sync_status.py`
  - Kiểm tra audio tồn tại qua service/helper thay vì chỉ nhìn `audio_data`.
- Modify: `backend/app/modules/objects/groups_router.py`
  - Query sync status vẫn hoạt động khi audio chuyển sang storage metadata.
- Test: `backend/tests/unit/test_audio_storage.py`
- Test: `backend/tests/api/test_content_audio.py`

### Backend SSE safety

- Modify: `backend/app/modules/llm/chat_router.py`
  - Thêm giới hạn timeout tổng, queue size, cleanup task rõ ràng cho `/api/companion/chat/stream`.
- Test: `backend/tests/api/test_companion.py`

### Backend rate limiting

- Create: `backend/app/core/rate_limit.py`
  - In-memory fixed-window limiter đơn giản, đủ cho single-process/dev; có interface để thay bằng Redis sau.
- Modify: `backend/app/modules/stt/router.py`
  - Limit `/api/stt`.
- Modify: `backend/app/modules/llm/chat_router.py`
  - Limit `/api/chat` và `/api/companion/chat/stream`.
- Modify: `backend/app/modules/llm/tts_router.py`
  - Limit `/api/tts` và `/api/tts/stream`.
- Modify: `backend/app/modules/content/router.py`
  - Limit các route generate/regenerate audio/content nếu cần.
- Test: `backend/tests/unit/test_rate_limit.py`
- Test: `backend/tests/api/test_rate_limited_routes.py`

### Frontend Companion split

- Modify: `frontend/components/visitor/CompanionChat.tsx`
  - Giữ container orchestration, bỏ dần logic streaming/audio/STT/action ra ngoài.
- Create: `frontend/components/visitor/companion/types.ts`
  - Kiểu dữ liệu nội bộ của Companion UI.
- Create: `frontend/components/visitor/companion/useCompanionSpeech.ts`
  - STT recording + fallback hardcoded TTS với persona `"Companion"`.
- Create: `frontend/components/visitor/companion/useCompanionStream.ts`
  - Xử lý SSE chunk/audio/done/error/action.
- Create: `frontend/components/visitor/companion/CompanionMessages.tsx`
  - Render danh sách bubble.
- Create: `frontend/components/visitor/companion/CompanionControls.tsx`
  - Input, mic, send, trạng thái loading/speaking.
- Test/build: `npm.cmd run lint`, `npm.cmd run build`.

### RAG sync hardening

- Modify: `backend/app/modules/rag/group_documents.py`
  - Khi `_remove_vectors()` fail, ghi trạng thái cần repair thay vì chỉ warning.
- Modify: `backend/app/modules/rag/index_repair.py`
  - Thêm function repair theo một group/document cụ thể.
- Test: `backend/tests/unit/test_rag_index_repair.py`

---

## Task 1: Audio storage abstraction, giữ tương thích dữ liệu cũ

**Files:**
- Create: `backend/app/modules/content/audio_storage.py`
- Modify: `backend/app/models/content_variant.py`
- Modify: `backend/app/modules/content/service.py`
- Modify: `backend/app/modules/content/router.py`
- Test: `backend/tests/unit/test_audio_storage.py`

- [ ] **Step 1: Viết test cho storage đọc/ghi DB fallback**

Create `backend/tests/unit/test_audio_storage.py`:

```python
from app.modules.content.audio_storage import DatabaseAudioStorage


class Variant:
    audio_data = None
    audio_mime = None
    audio_size = None
    audio_sha256 = None
    audio_storage_key = None


def test_database_audio_storage_writes_audio_metadata():
    variant = Variant()
    storage = DatabaseAudioStorage()

    storage.save(variant, b"mp3-bytes", "audio/mpeg")

    assert variant.audio_data == b"mp3-bytes"
    assert variant.audio_mime == "audio/mpeg"
    assert variant.audio_size == 9
    assert variant.audio_sha256 is not None
    assert variant.audio_storage_key is None


def test_database_audio_storage_reads_legacy_blob():
    variant = Variant()
    variant.audio_data = b"legacy"
    variant.audio_mime = "audio/mpeg"

    payload, mime = DatabaseAudioStorage().read(variant)

    assert payload == b"legacy"
    assert mime == "audio/mpeg"
```

Run:

```bash
pytest backend/tests/unit/test_audio_storage.py -q
```

Expected: fail vì module chưa tồn tại.

- [ ] **Step 2: Thêm metadata vào model**

Modify `backend/app/models/content_variant.py`:

```python
audio_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
audio_size: Mapped[int | None] = mapped_column(nullable=True)
audio_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
```

Giữ nguyên:

```python
audio_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
audio_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)
```

- [ ] **Step 3: Tạo storage implementation hiện tại**

Create `backend/app/modules/content/audio_storage.py`:

```python
from __future__ import annotations

import hashlib
from typing import Protocol


class AudioStorage(Protocol):
    def save(self, variant, audio: bytes, mime: str) -> None: ...
    def read(self, variant) -> tuple[bytes, str] | None: ...
    def exists(self, variant) -> bool: ...
    def clear(self, variant) -> None: ...


class DatabaseAudioStorage:
    def save(self, variant, audio: bytes, mime: str) -> None:
        variant.audio_data = audio
        variant.audio_mime = mime
        variant.audio_storage_key = None
        variant.audio_size = len(audio)
        variant.audio_sha256 = hashlib.sha256(audio).hexdigest()

    def read(self, variant) -> tuple[bytes, str] | None:
        if variant.audio_data is None or variant.audio_mime is None:
            return None
        return variant.audio_data, variant.audio_mime

    def exists(self, variant) -> bool:
        return self.read(variant) is not None

    def clear(self, variant) -> None:
        variant.audio_data = None
        variant.audio_mime = None
        variant.audio_storage_key = None
        variant.audio_size = None
        variant.audio_sha256 = None


def get_audio_storage() -> AudioStorage:
    return DatabaseAudioStorage()
```

- [ ] **Step 4: Chạy unit test**

```bash
pytest backend/tests/unit/test_audio_storage.py -q
```

Expected: pass.

- [ ] **Step 5: Thay direct audio write trong service**

Modify `backend/app/modules/content/service.py`:

```python
from app.modules.content.audio_storage import get_audio_storage
```

Trong đoạn lưu audio ở `ensure_audio()`, thay direct assignment bằng:

```python
get_audio_storage().save(
    variant,
    tts_result.audio,
    build_audio_mime(persona=persona),
)
```

Ở các chỗ clear/regenerate variant, dùng:

```python
get_audio_storage().clear(variant)
```

thay vì set rời rạc `audio_data=None`, `audio_mime=None` khi mục đích là xóa audio.

- [ ] **Step 6: Thay audio read trong router**

Modify `backend/app/modules/content/router.py`:

```python
from app.modules.content.audio_storage import get_audio_storage
```

Trong endpoint `/api/objects/{id}/content/audio`, dùng:

```python
stored_audio = get_audio_storage().read(variant)
if stored_audio is None:
    raise HTTPException(status_code=404, detail="Audio not found")

audio_bytes, audio_mime = stored_audio
return StreamingResponse(
    io.BytesIO(audio_bytes),
    media_type=audio_mime,
)
```

- [ ] **Step 7: Chạy test liên quan content audio**

```bash
pytest backend/tests/unit/test_audio_storage.py backend/tests/api/test_tts.py -q
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/content_variant.py backend/app/modules/content/audio_storage.py backend/app/modules/content/service.py backend/app/modules/content/router.py backend/tests/unit/test_audio_storage.py
git commit -m "refactor: introduce audio storage abstraction"
```

---

## Task 2: SSE safety guard cho Companion stream

**Files:**
- Modify: `backend/app/modules/llm/chat_router.py`
- Test: `backend/tests/api/test_companion.py`

- [ ] **Step 1: Thêm test stream kết thúc khi producer lỗi**

Add to `backend/tests/api/test_companion.py`:

```python
def test_companion_stream_emits_error_when_generator_fails(client, monkeypatch):
    class FailingGenerator:
        async def generate_companion_chat_stream(self, *args, **kwargs):
            raise RuntimeError("provider unavailable")
            yield ""

    monkeypatch.setattr(
        "app.modules.llm.chat_router.get_rag_generator",
        lambda: FailingGenerator(),
    )

    response = client.post(
        "/api/companion/chat/stream",
        json={"message": "xin chào", "language": "Tiếng Việt", "history": []},
    )

    assert response.status_code == 200
    body = response.text
    assert "event: error" in body
    assert "event: done" in body
```

Run:

```bash
pytest backend/tests/api/test_companion.py::test_companion_stream_emits_error_when_generator_fails -q
```

Expected: pass hoặc fail tùy code hiện tại; nếu fail, dùng bước sau để chuẩn hóa.

- [ ] **Step 2: Thêm queue size và timeout constants**

Modify `backend/app/modules/llm/chat_router.py` near module constants:

```python
COMPANION_EVENT_QUEUE_MAXSIZE = 32
COMPANION_TTS_QUEUE_MAXSIZE = 8
COMPANION_STREAM_TIMEOUT_SECONDS = 75
```

Trong `event_generator()`:

```python
event_queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=COMPANION_EVENT_QUEUE_MAXSIZE)
tts_queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=COMPANION_TTS_QUEUE_MAXSIZE)
```

- [ ] **Step 3: Cleanup task rõ ràng**

Trong `event_generator()` sau khi tạo task:

```python
producer_task = asyncio.create_task(llm_producer())
consumer_task = asyncio.create_task(tts_consumer())
tasks = {producer_task, consumer_task}
```

Bọc vòng đọc queue bằng timeout:

```python
try:
    while True:
        event = await asyncio.wait_for(
            event_queue.get(),
            timeout=COMPANION_STREAM_TIMEOUT_SECONDS,
        )
        if event is None:
            yield _sse("done", {})
            break
        yield event
except asyncio.TimeoutError:
    yield _sse("error", {"detail": "Companion response timed out."})
    yield _sse("done", {})
finally:
    for task in tasks:
        if not task.done():
            task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
```

- [ ] **Step 4: Chạy test Companion**

```bash
pytest backend/tests/api/test_companion.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/llm/chat_router.py backend/tests/api/test_companion.py
git commit -m "fix: guard companion stream lifetime"
```

---

## Task 3: Rate limiting cho endpoint tốn tài nguyên

**Files:**
- Create: `backend/app/core/rate_limit.py`
- Modify: `backend/app/modules/stt/router.py`
- Modify: `backend/app/modules/llm/chat_router.py`
- Modify: `backend/app/modules/llm/tts_router.py`
- Test: `backend/tests/unit/test_rate_limit.py`
- Test: `backend/tests/api/test_rate_limited_routes.py`

- [ ] **Step 1: Viết unit test limiter**

Create `backend/tests/unit/test_rate_limit.py`:

```python
import pytest
from fastapi import HTTPException

from app.core.rate_limit import FixedWindowRateLimiter


def test_fixed_window_allows_until_limit():
    limiter = FixedWindowRateLimiter(limit=2, window_seconds=60)

    limiter.check("visitor-a", now=1000.0)
    limiter.check("visitor-a", now=1001.0)

    with pytest.raises(HTTPException) as exc:
        limiter.check("visitor-a", now=1002.0)

    assert exc.value.status_code == 429


def test_fixed_window_resets_after_window():
    limiter = FixedWindowRateLimiter(limit=1, window_seconds=60)

    limiter.check("visitor-a", now=1000.0)
    limiter.check("visitor-a", now=1061.0)
```

Run:

```bash
pytest backend/tests/unit/test_rate_limit.py -q
```

Expected: fail vì module chưa tồn tại.

- [ ] **Step 2: Implement limiter**

Create `backend/app/core/rate_limit.py`:

```python
from __future__ import annotations

import time
from dataclasses import dataclass, field

from fastapi import HTTPException, Request


@dataclass
class FixedWindowRateLimiter:
    limit: int
    window_seconds: int
    buckets: dict[str, tuple[float, int]] = field(default_factory=dict)

    def check(self, key: str, now: float | None = None) -> None:
        current_time = time.time() if now is None else now
        window_start, count = self.buckets.get(key, (current_time, 0))

        if current_time - window_start >= self.window_seconds:
            window_start, count = current_time, 0

        if count >= self.limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

        self.buckets[key] = (window_start, count + 1)


stt_limiter = FixedWindowRateLimiter(limit=12, window_seconds=60)
chat_limiter = FixedWindowRateLimiter(limit=20, window_seconds=60)
tts_limiter = FixedWindowRateLimiter(limit=30, window_seconds=60)
content_limiter = FixedWindowRateLimiter(limit=20, window_seconds=60)


def client_key(request: Request, scope: str) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else None
    if ip is None and request.client is not None:
        ip = request.client.host
    return f"{scope}:{ip or 'unknown'}"
```

- [ ] **Step 3: Gắn limiter vào STT**

Modify `backend/app/modules/stt/router.py`:

```python
from fastapi import Request
from app.core.rate_limit import client_key, stt_limiter
```

Endpoint signature thêm `request: Request`, sau đó đầu hàm:

```python
stt_limiter.check(client_key(request, "stt"))
```

- [ ] **Step 4: Gắn limiter vào chat/TTS**

Modify `backend/app/modules/llm/chat_router.py`:

```python
from fastapi import Request
from app.core.rate_limit import chat_limiter, client_key
```

Trong `/api/chat` và `/api/companion/chat/stream`:

```python
chat_limiter.check(client_key(request, "chat"))
```

Modify `backend/app/modules/llm/tts_router.py`:

```python
from fastapi import Request
from app.core.rate_limit import client_key, tts_limiter
```

Trong `/api/tts` và `/api/tts/stream`:

```python
tts_limiter.check(client_key(request, "tts"))
```

- [ ] **Step 5: Chạy unit test và API smoke test**

```bash
pytest backend/tests/unit/test_rate_limit.py backend/tests/api/test_companion.py backend/tests/api/test_tts.py -q
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/rate_limit.py backend/app/modules/stt/router.py backend/app/modules/llm/chat_router.py backend/app/modules/llm/tts_router.py backend/tests/unit/test_rate_limit.py
git commit -m "feat: add backend request rate limiting"
```

---

## Task 4: Tách `CompanionChat.tsx` không đổi hành vi

**Files:**
- Modify: `frontend/components/visitor/CompanionChat.tsx`
- Create: `frontend/components/visitor/companion/types.ts`
- Create: `frontend/components/visitor/companion/useCompanionSpeech.ts`
- Create: `frontend/components/visitor/companion/useCompanionStream.ts`
- Create: `frontend/components/visitor/companion/CompanionMessages.tsx`
- Create: `frontend/components/visitor/companion/CompanionControls.tsx`

- [ ] **Step 1: Tạo types dùng chung**

Create `frontend/components/visitor/companion/types.ts`:

```ts
import type { ChatMessage } from "@/lib/api";

export type CompanionBubble = ChatMessage & {
  id?: string;
  isActionPrompt?: boolean;
};

export type CompanionLanguage = "Tiếng Việt" | "English" | string;
```

- [ ] **Step 2: Tách speech hook**

Create `frontend/components/visitor/companion/useCompanionSpeech.ts`:

```ts
import { useCallback, useState } from "react";
import { playChatTts } from "@/lib/chatTts";

export function useCompanionSpeech(language: string) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
    async (text: string) => {
      setIsSpeaking(true);
      try {
        await playChatTts(text, language, undefined, "Companion");
      } catch {
        // Companion fallback speech should never block the chat UI.
      } finally {
        setIsSpeaking(false);
      }
    },
    [language],
  );

  return { isSpeaking, speak, setIsSpeaking };
}
```

- [ ] **Step 3: Tách stream hook**

Create `frontend/components/visitor/companion/useCompanionStream.ts` by moving the existing `chatWithCompanionStream(...)` processing from `CompanionChat.tsx` into a hook with this public shape:

```ts
export function useCompanionStream(params: {
  language: string;
  itemId?: number;
  itemName?: string;
  onAssistantText: (text: string) => void;
  onAssistantAudio: (audioBase64: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  return {
    isLoading,
    sendMessage,
    abortCurrentStream,
  };
}
```

The moved code must keep the same SSE event handling:

```ts
if (event.type === "chunk") appendChunk(event.text);
if (event.type === "audio") await playAudioBase64(event.audio_base64);
if (event.type === "metadata") updateNextItem(event);
if (event.type === "error") handleError(event.detail);
if (event.type === "done") finishMessage();
```

- [ ] **Step 4: Tách message rendering**

Create `frontend/components/visitor/companion/CompanionMessages.tsx` with props:

```ts
import type { CompanionBubble } from "./types";

type Props = {
  messages: CompanionBubble[];
  isLoading: boolean;
};

export function CompanionMessages({ messages, isLoading }: Props) {
  return (
    <div className="space-y-3">
      {messages.map((message, index) => (
        <div key={message.id ?? index}>
          {/* Move existing bubble markup here without changing classes. */}
        </div>
      ))}
      {isLoading ? <div>...</div> : null}
    </div>
  );
}
```

When implementing, copy the actual existing bubble JSX from `CompanionChat.tsx`; do not redesign CSS/classes.

- [ ] **Step 5: Tách controls**

Create `frontend/components/visitor/companion/CompanionControls.tsx` with props:

```ts
type Props = {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  onSend: () => void;
  onMicClick: () => void;
};

export function CompanionControls(props: Props) {
  return (
    <div>
      {/* Move existing input/mic/send controls here without changing classes. */}
    </div>
  );
}
```

When implementing, copy the actual existing controls JSX from `CompanionChat.tsx`; do not change labels/classes.

- [ ] **Step 6: Slim container**

Modify `frontend/components/visitor/CompanionChat.tsx`:

- Keep props and top-level state orchestration.
- Replace local `speak()` with `useCompanionSpeech(language)`.
- Replace stream-processing block with `useCompanionStream(...)`.
- Replace inline messages/controls JSX with `CompanionMessages` and `CompanionControls`.

Target: reduce `CompanionChat.tsx` from roughly 986 lines to under 500 lines in this task.

- [ ] **Step 7: Verify frontend**

```bash
npm.cmd run lint
npm.cmd run build
```

Expected: both pass. Existing image/hook warnings are acceptable only if they existed before this task.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/visitor/CompanionChat.tsx frontend/components/visitor/companion
git commit -m "refactor: split companion chat component"
```

---

## Task 5: RAG sync hardening, không thêm queue lớn

**Files:**
- Modify: `backend/app/modules/rag/group_documents.py`
- Modify: `backend/app/modules/rag/index_repair.py`
- Test: `backend/tests/unit/test_rag_index_repair.py`

- [ ] **Step 1: Viết test repair targeted**

Create or extend `backend/tests/unit/test_rag_index_repair.py`:

```python
def test_repair_group_document_removes_orphan_vectors(monkeypatch):
    calls = []

    class FakeRetriever:
        def delete_group_document(self, group_id, document_id):
            calls.append((group_id, document_id))

    monkeypatch.setattr(
        "app.modules.rag.index_repair.get_group_retriever",
        lambda: FakeRetriever(),
    )

    from app.modules.rag.index_repair import repair_group_document_index

    repair_group_document_index(group_id=10, document_id=20)

    assert calls == [(10, 20)]
```

Run:

```bash
pytest backend/tests/unit/test_rag_index_repair.py -q
```

Expected: fail vì function chưa tồn tại.

- [ ] **Step 2: Thêm targeted repair function**

Modify `backend/app/modules/rag/index_repair.py`:

```python
def repair_group_document_index(group_id: int, document_id: int) -> None:
    """Remove vector/BM25 entries for a single deleted or stale group document."""
    get_group_retriever().delete_group_document(group_id, document_id)
```

- [ ] **Step 3: Dùng repair khi delete vector fail**

Modify `backend/app/modules/rag/group_documents.py` inside `_remove_vectors()` exception path:

```python
logger.warning(
    "Vector removal failed for group %s document %s; index repair is required",
    group_id,
    document_id,
    exc_info=True,
)
```

If there is an existing admin repair endpoint, wire this document ID into that flow; otherwise keep the warning explicit and searchable. Do not block document deletion.

- [ ] **Step 4: Chạy RAG tests**

```bash
pytest backend/tests/unit/test_rag_index_repair.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/rag/group_documents.py backend/app/modules/rag/index_repair.py backend/tests/unit/test_rag_index_repair.py
git commit -m "fix: harden rag index repair path"
```

---

## Final Verification

Run full targeted verification:

```bash
pytest backend/tests/api/test_companion.py backend/tests/api/test_tts.py backend/tests/unit/test_audio_storage.py backend/tests/unit/test_rate_limit.py backend/tests/unit/test_rag_index_repair.py -q
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected:

- Backend tests pass.
- Frontend lint/build pass.
- `git diff --check` has no whitespace errors.
- Manual smoke:
  - Companion normal chat still streams text and audio from one SSE connection.
  - Hardcoded Companion fallback messages still speak with Companion voice.
  - STT retry behavior remains unchanged from previous fix.
  - Item content audio still plays for existing DB audio.

---

## Recommended Execution Order

1. Task 2 — SSE safety guard: highest runtime-risk reduction, small backend-only change.
2. Task 3 — Rate limiting: protects expensive endpoints.
3. Task 4 — Companion split: reduces future bug risk, frontend-only.
4. Task 1 — Audio storage abstraction: important but touches model/service/router, do after runtime guards.
5. Task 5 — RAG hardening: low urgency, small safety improvement.

This order avoids mixing risky data-model changes with stream/rate-limit safety work.

