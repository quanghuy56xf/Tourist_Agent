# Kế Hoạch Ổn Định API, RAG Và LLM

> **Dành cho người triển khai:** Bắt buộc dùng skill `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Theo dõi tiến độ bằng các checkbox `- [ ]`.

**Mục tiêu:** Ổn định ứng dụng Next.js + FastAPI + SQLite + Chroma để các endpoint dễ bảo trì, test có thể chạy lặp lại và chức năng sinh câu chuyện vẫn hoạt động khi RAG gặp sự cố.

**Kiến trúc:** Giữ FastAPI làm lớp API, SQLite lưu metadata, Chroma ảnh lưu embedding DINOv2, Chroma văn bản + BM25 phục vụ hybrid RAG. Tách story, chat và TTS thành router riêng nhưng giữ nguyên URL. Nội dung `Item.description` luôn là context nền; tài liệu RAG chỉ được bổ sung khi truy xuất thành công.

**Công nghệ:** Next.js 14, TypeScript, FastAPI, Pydantic, SQLAlchemy, SQLite, Chroma, LangChain, Google Gemini, DINOv2, pytest.

---

## Phạm Vi

Kế hoạch này xử lý:

- Test đang bị Git bỏ qua và import module cũ.
- Backend tải model nặng ngay khi khởi động.
- Gemini trả content blocks không khớp schema `str`.
- Endpoint story bị phụ thuộc hoàn toàn vào RAG.
- Story, chat và TTS đang nằm chung một router.
- Dữ liệu SQLite, ảnh, Chroma ảnh và RAG văn bản có thể lệch nhau.
- Admin API chưa được bảo vệ.
- Thiếu test hợp đồng giữa frontend và backend.
- Tài liệu kiến trúc không khớp code thực tế.

Không thực hiện:

- Chuyển sang Supabase, PostgreSQL hoặc vector database khác.
- Streaming nội dung.
- Thay DINOv2.
- Xây hệ thống tài khoản người dùng.
- Thiết kế lại giao diện.

## Cấu Trúc Mục Tiêu

```text
backend/
  app/
    core/
    modules/
      auth/
      llm/
        chat_router.py
        client.py
        prompts.py
        story_router.py
        tts_router.py
      rag/
        retriever.py
        service.py
      objects/
      vision/
    schemas/
  tests/
    conftest.py
    api/
      test_admin_auth.py
      test_chat.py
      test_groups.py
      test_health.py
      test_objects.py
      test_search.py
      test_story.py
      test_tts.py
    integration/
      test_real_llm.py
      test_real_rag.py
    unit/
      test_embedding_lifecycle.py
      test_item_lifecycle.py
      test_llm_content.py
      test_rag_service.py
  pytest.ini
frontend/
  app/
  lib/api.ts
docs/
  architecture_and_tech_stack.md
  api.md
```

## Phân Công Hai Người

**Người A - Object/Vision Platform**

- Task 1: Nền tảng test.
- Task 2: Lazy-load model.
- Task 6: Transaction và đồng bộ vòng đời item.
- Phần object/search của Task 8.

**Người B - AI Experience**

- Task 3: Chuẩn hóa response Gemini.
- Task 4: Fallback RAG.
- Task 5: Tách story/chat/TTS.
- Phần story/chat/TTS của Task 8.

**Làm chung**

- Task 7: Admin auth.
- Task 9: Kiểm thử tích hợp và tài liệu.

Task 1 phải được merge trước khi tách nhánh làm song song. Không để hai người cùng sửa `backend/app/main.py`, `.gitignore` hoặc fixture dùng chung tại cùng thời điểm.

---

### Task 1: Khôi Phục Nền Tảng Test Có Thể Theo Dõi

**File:**

- Sửa: `.gitignore`
- Tạo: `backend/pytest.ini`
- Tạo: `backend/tests/conftest.py`
- Thay thế: `backend/test_api.py`
- Thay thế: `backend/test_delete_reuse.py`
- Xóa sau khi đã có test tương đương: `backend/test_integration.py`

- [ ] **Bước 1: Không ignore test của dự án**

Xóa các rule sau khỏi `.gitignore`:

```gitignore
test_*.py
*_test.py
test/
tests/
testing/
```

Vẫn giữ `.pytest_cache/`, `__pycache__/` và file bytecode trong ignore.

- [ ] **Bước 2: Cấu hình pytest**

Tạo `backend/pytest.ini`:

```ini
[pytest]
testpaths = tests
python_files = test_*.py
addopts = -ra
markers =
    integration: cần model local hoặc dịch vụ bên ngoài
```

- [ ] **Bước 3: Tạo SQLite fixture cô lập**

Tạo `backend/tests/conftest.py` dùng:

- SQLite in-memory.
- `StaticPool`.
- Override `get_db`.
- `TestClient`.
- Không sử dụng `backend/data/app.db` thật.

Khung fixture:

```python
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models.item import Base


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

- [ ] **Bước 4: Tạo smoke test**

Tạo `backend/tests/api/test_health.py`:

```python
def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Bước 5: Xác nhận test đang gặp coupling với model**

Chạy:

```powershell
cd backend
pytest tests/api/test_health.py -v
```

Kỳ vọng trước Task 2: test lỗi hoặc dùng quá nhiều bộ nhớ do startup tải model vision.

- [ ] **Bước 6: Xóa test cũ sau khi đã thay đủ coverage**

Chỉ xóa ba test ở thư mục gốc sau khi Tasks 2, 4, 5 và 6 đã tạo test tương đương trong `backend/tests/`.

- [ ] **Bước 7: Commit**

```powershell
git add .gitignore backend/pytest.ini backend/tests
git commit -m "test: establish tracked backend test suite"
```

---

### Task 2: Tách Khởi Động Ứng Dụng Khỏi Model AI Nặng

**File:**

- Sửa: `backend/app/core/config.py`
- Sửa: `backend/app/main.py`
- Sửa: `backend/app/modules/vision/embedding.py`
- Test: `backend/tests/api/test_health.py`
- Tạo: `backend/tests/unit/test_embedding_lifecycle.py`

- [ ] **Bước 1: Viết test lazy-load**

```python
from app.modules.vision import embedding


def test_model_is_not_loaded_on_module_import():
    assert embedding._model is None
    assert embedding._processor is None
```

- [ ] **Bước 2: Thêm cấu hình warmup**

Trong `core/config.py`:

```python
MODEL_WARMUP_ENABLED = (
    os.getenv("MODEL_WARMUP_ENABLED", "false").lower() == "true"
)
```

Mặc định `false`. Production chỉ bật sau khi xác định đủ RAM.

- [ ] **Bước 3: Chỉ warmup khi được cấu hình**

Trong `main.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    if MODEL_WARMUP_ENABLED:
        embedding.warmup()
    yield
```

- [ ] **Bước 4: Chạy test**

```powershell
cd backend
pytest tests/api/test_health.py tests/unit/test_embedding_lifecycle.py -v
```

Kỳ vọng: 2 test pass, không tải DINOv2.

- [ ] **Bước 5: Kiểm tra import backend**

```powershell
python -c "from app.main import app; print(len(app.routes))"
```

Kỳ vọng: in số route, không tải model, không `MemoryError`.

- [ ] **Bước 6: Commit**

```powershell
git add backend/app/core/config.py backend/app/main.py backend/tests
git commit -m "refactor: lazy load vision models"
```

---

### Task 3: Chuẩn Hóa Response Gemini Thành Chuỗi

**File:**

- Tạo: `backend/app/modules/llm/client.py`
- Sửa: `backend/app/modules/llm/generator.py`
- Tạo: `backend/tests/unit/test_llm_content.py`

- [ ] **Bước 1: Viết test response**

```python
import pytest

from app.modules.llm.client import extract_text_content


def test_extracts_string_content():
    assert extract_text_content("A story") == "A story"


def test_extracts_text_blocks():
    content = [
        {"type": "text", "text": "First paragraph."},
        {"type": "text", "text": "Second paragraph."},
    ]
    assert extract_text_content(content) == (
        "First paragraph.\nSecond paragraph."
    )


def test_rejects_empty_content():
    with pytest.raises(ValueError, match="empty text"):
        extract_text_content([])
```

- [ ] **Bước 2: Chạy test đỏ**

```powershell
pytest tests/unit/test_llm_content.py -v
```

Kỳ vọng: lỗi import vì chưa có `llm/client.py`.

- [ ] **Bước 3: Cài helper chuẩn hóa**

```python
from collections.abc import Sequence
from typing import Any


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
```

- [ ] **Bước 4: Áp dụng cho story và chat**

Thay hai chỗ trả `response.content` bằng:

```python
response = self.llm.invoke(prompt)
return extract_text_content(response.content)
```

và:

```python
response = self.llm.invoke(messages)
return extract_text_content(response.content)
```

- [ ] **Bước 5: Chạy test xanh**

```powershell
pytest tests/unit/test_llm_content.py -v
```

Kỳ vọng: 3 test pass.

- [ ] **Bước 6: Commit**

```powershell
git add backend/app/modules/llm backend/tests/unit/test_llm_content.py
git commit -m "fix: normalize Gemini content blocks"
```

---

### Task 4: Story Vẫn Hoạt Động Khi RAG Lỗi

**File:**

- Tạo: `backend/app/modules/rag/service.py`
- Sửa: `backend/app/modules/rag/retriever.py`
- Tạo: `backend/tests/unit/test_rag_service.py`
- Tạo: `backend/tests/api/test_story.py`

- [ ] **Bước 1: Viết test item-first context**

Test hai trường hợp:

1. Retriever ném `MemoryError`: context vẫn chứa `Item.description`.
2. Retriever hoạt động: tài liệu tìm được được nối sau description.

```python
from langchain_core.documents import Document

from app.modules.rag.service import build_item_context


class BrokenRetriever:
    def retrieve(self, query: str, top_k: int):
        raise MemoryError()


def test_item_description_is_always_grounding_context():
    docs = build_item_context(
        item_id=7,
        item_name="Test item",
        item_description="Primary description",
        retriever=BrokenRetriever(),
    )

    assert docs[0].page_content == "Primary description"
    assert docs[0].metadata["page"] == "item-7"
```

- [ ] **Bước 2: Tạo `build_item_context()`**

```python
import logging
from typing import Protocol

from langchain_core.documents import Document

logger = logging.getLogger(__name__)


class Retriever(Protocol):
    def retrieve(self, query: str, top_k: int) -> list[Document]: ...


def build_item_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 5,
) -> list[Document]:
    docs = [
        Document(
            page_content=item_description,
            metadata={"source": "item", "page": f"item-{item_id}"},
        )
    ]
    if retriever is None:
        return docs

    try:
        retrieved = retriever.retrieve(
            f"Giới thiệu chi tiết về {item_name}.",
            top_k=top_k,
        )
    except (MemoryError, OSError, RuntimeError, FileNotFoundError) as exc:
        logger.warning("RAG unavailable; using item description: %s", exc)
        return docs

    seen = {item_description.strip()}
    for document in retrieved:
        content = document.page_content.strip()
        if content and content not in seen:
            docs.append(document)
            seen.add(content)
    return docs
```

- [ ] **Bước 3: Thêm khởi tạo retriever tùy chọn**

```python
def try_get_rag_retriever() -> HybridRetriever | None:
    try:
        return get_rag_retriever()
    except (MemoryError, OSError, RuntimeError, FileNotFoundError):
        return None
```

Không bắt các lỗi lập trình như `AttributeError` hoặc `TypeError`.

- [ ] **Bước 4: Test endpoint story khi RAG tắt**

Mock retriever thành `None`, mock generator và xác nhận:

- `POST /api/generate` trả 200.
- Generator nhận `Item.description`.
- `content` trả về là chuỗi.

- [ ] **Bước 5: Chạy test**

```powershell
pytest tests/unit/test_rag_service.py -v
```

Kỳ vọng: tất cả pass.

- [ ] **Bước 6: Commit**

```powershell
git add backend/app/modules/rag backend/tests
git commit -m "fix: fall back to item grounding when RAG is unavailable"
```

---

### Task 5: Tách Story, Chat Và TTS Thành Router Riêng

**File:**

- Tạo: `backend/app/modules/llm/story_router.py`
- Tạo: `backend/app/modules/llm/chat_router.py`
- Tạo: `backend/app/modules/llm/tts_router.py`
- Tạo: `backend/app/modules/llm/prompts.py`
- Xóa sau khi chuyển xong: `backend/app/modules/llm/router.py`
- Sửa: `backend/app/main.py`
- Sửa: `backend/app/schemas/generate.py`
- Test: `backend/tests/api/test_story.py`
- Tạo: `backend/tests/api/test_chat.py`
- Tạo: `backend/tests/api/test_tts.py`

- [ ] **Bước 1: Siết schema request**

```python
from typing import Literal

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    item_id: int
    persona: str = "Mặc định"
    language: str = "Tiếng Việt"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    item_id: int
    persona: str = "Mặc định"
    language: str = "Tiếng Việt"
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    message: str = Field(min_length=1, max_length=2000)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: Literal["vi", "en"] = "vi"
```

- [ ] **Bước 2: Chuyển story sang `story_router.py`**

Giữ URL `POST /api/generate`.

Luồng xử lý:

1. Lấy item hoặc trả 404.
2. Gọi `try_get_rag_retriever()`.
3. Gọi `build_item_context()`.
4. Gọi generator.
5. Trả `GenerateResponse`.

Không trả raw exception cho client. Ghi log nội bộ và trả:

```python
raise HTTPException(
    status_code=502,
    detail="Không thể sinh nội dung lúc này",
)
```

- [ ] **Bước 3: Chuyển chat sang `chat_router.py`**

Giữ URL `POST /api/chat`. Dùng chung item-first context và chỉ nhận lịch sử đúng schema.

- [ ] **Bước 4: Chuyển TTS sang `tts_router.py`**

Giữ URL `POST /api/tts`. Khi provider lỗi, ghi log và trả:

```python
raise HTTPException(
    status_code=502,
    detail="Không thể tạo âm thanh lúc này",
)
```

- [ ] **Bước 5: Đăng ký ba router trong `main.py`**

```python
from app.modules.llm import chat_router, story_router, tts_router

app.include_router(story_router.router)
app.include_router(chat_router.router)
app.include_router(tts_router.router)
```

- [ ] **Bước 6: Bổ sung test hợp đồng**

`test_story.py`:

- Item không tồn tại trả 404.
- RAG lỗi nhưng story vẫn trả 200.
- Generator lỗi trả 502.
- Response `content` là chuỗi.

`test_chat.py`:

- Item không tồn tại trả 404.
- Message rỗng trả 422.
- Role ngoài `user/assistant` trả 422.
- Mock retriever/generator trả 200.

`test_tts.py`:

- Input hợp lệ trả `audio/mpeg`.
- Text rỗng trả 422.
- Provider lỗi trả 502.

- [ ] **Bước 7: Chạy test**

```powershell
pytest tests/api/test_story.py tests/api/test_chat.py tests/api/test_tts.py -v
```

- [ ] **Bước 8: Xóa router cũ**

Chỉ xóa `llm/router.py` sau khi lệnh sau vẫn liệt kê đủ ba URL:

```powershell
python -c "from app.main import app; print([r.path for r in app.routes])"
```

- [ ] **Bước 9: Commit**

```powershell
git add backend/app/modules/llm backend/app/main.py backend/app/schemas backend/tests
git commit -m "refactor: split story chat and tts endpoints"
```

---

### Task 6: Đồng Bộ Vòng Đời Item, Ảnh Và RAG

**File:**

- Sửa: `backend/app/modules/objects/register_router.py`
- Sửa: `backend/app/modules/objects/objects_router.py`
- Sửa: `backend/app/modules/objects/item_images.py`
- Sửa: `backend/app/modules/rag/retriever.py`
- Tạo: `backend/tests/unit/test_item_lifecycle.py`
- Tạo: `backend/tests/api/test_objects.py`
- Tạo: `backend/tests/api/test_search.py`

- [ ] **Bước 1: Dùng ID ổn định cho tài liệu RAG**

Mỗi item chỉ có một document ID:

```python
def _rag_document_id(item_id: int) -> str:
    return f"item-{item_id}"
```

Thêm:

```python
def upsert_item_document(self, item_id: int, content: str) -> None:
    document_id = _rag_document_id(item_id)
    document = Document(
        page_content=content,
        metadata={
            "source": "item",
            "page": document_id,
            "item_id": item_id,
        },
    )
    self.vector_store.delete(ids=[document_id])
    self.vector_store.add_documents([document], ids=[document_id])
    self._replace_chunk(document)


def delete_item_document(self, item_id: int) -> None:
    document_id = _rag_document_id(item_id)
    self.vector_store.delete(ids=[document_id])
    self.chunks = [
        chunk
        for chunk in self.chunks
        if chunk.metadata.get("item_id") != item_id
    ]
    self._persist_sparse_index()
```

- [ ] **Bước 2: Viết test lifecycle**

Test:

- Update description thay thế document cũ, không append trùng.
- Delete item xóa image embeddings và text document.
- Ingest ảnh lỗi không để lại item đã commit.
- RAG sync lỗi không làm đăng ký item thất bại.

- [ ] **Bước 3: Làm registration có rollback**

Luồng:

1. `db.add(item)`.
2. `db.flush()` để lấy ID nhưng chưa commit.
3. Xử lý ảnh và embedding.
4. Gán `main_image_url`.
5. Commit khi phần bắt buộc hoàn tất.
6. Nếu lỗi: rollback DB, xóa uploads và image embeddings.

```python
try:
    db.add(item)
    db.flush()
    storage.delete_item_dir(item.id)
    # ingest images
    db.commit()
except Exception:
    db.rollback()
    if item.id is not None:
        storage.delete_item_dir(item.id)
        chroma.delete_embeddings_for_item(item.id)
    raise
```

RAG sync chạy sau commit và là phần bổ sung, không phải nguồn dữ liệu chính.

- [ ] **Bước 4: Đồng bộ update và delete**

Khi update description:

```python
retriever.upsert_item_document(item.id, item.description)
```

Khi delete item:

```python
retriever.delete_item_document(item_id)
```

Nếu retriever không hoạt động, ghi log và vẫn hoàn thành thao tác trên SQLite, ảnh và Chroma ảnh.

- [ ] **Bước 5: Test object API**

Bao phủ:

- Tạo group.
- Register object với embedding được mock.
- List/get/update/delete.
- Reject name/description rỗng.
- Reject group không tồn tại.
- Không cho xóa ảnh front.
- Cập nhật và xóa side/back image.

- [ ] **Bước 6: Test search API**

Mock DINOv2 và Chroma:

- Filename rỗng trả 400.
- Không có match trả `found: false`.
- Dưới threshold trả suggestions, `found: false`.
- Trên threshold trả `found: true`.
- ID Chroma không tồn tại trong SQLite được dọn.

- [ ] **Bước 7: Chạy test**

```powershell
pytest tests/api/test_objects.py tests/api/test_search.py tests/unit/test_item_lifecycle.py -v
```

- [ ] **Bước 8: Commit**

```powershell
git add backend/app/modules/objects backend/app/modules/rag backend/tests
git commit -m "fix: keep item indexes and storage consistent"
```

---

### Task 7: Thay Credential Hard-Code Bằng Admin Auth Cấu Hình Được

**File:**

- Sửa: `backend/app/core/config.py`
- Sửa: `backend/app/modules/auth/dependencies.py`
- Sửa các mutation router trong `backend/app/modules/objects/`
- Sửa: `backend/.env.example`
- Tạo: `backend/tests/api/test_admin_auth.py`

- [ ] **Bước 1: Thêm cấu hình**

```python
ADMIN_AUTH_ENABLED = (
    os.getenv("ADMIN_AUTH_ENABLED", "false").lower() == "true"
)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
```

Local mặc định tắt auth. Khi deploy phải bật và truyền credential qua environment.

- [ ] **Bước 2: Viết test auth**

Test:

- Endpoint đọc vẫn public.
- Mutation yêu cầu credential khi auth bật.
- Thiếu hoặc sai credential trả 401.
- Credential đúng cho phép thao tác.
- Bật auth nhưng thiếu cấu hình trả 503.

- [ ] **Bước 3: Cài optional Basic Auth**

Dùng:

```python
optional_security = HTTPBasic(auto_error=False)
```

Tạo dependency:

```python
def require_admin_if_enabled(
    credentials: HTTPBasicCredentials | None = Depends(optional_security),
) -> str | None:
    if not ADMIN_AUTH_ENABLED:
        return None
    # kiểm tra cấu hình và credentials bằng compare_digest
```

- [ ] **Bước 4: Chỉ bảo vệ mutation**

Áp dụng cho:

- `POST /api/groups`
- `POST /api/objects/register`
- `PUT /api/objects/{item_id}`
- `DELETE /api/objects/{item_id}`
- `PUT /api/objects/{item_id}/images/{angle}`
- `DELETE /api/objects/{item_id}/images/{angle}`

Không bảo vệ read API, search, story, chat và TTS.

- [ ] **Bước 5: Cập nhật `.env.example`**

```env
ADMIN_AUTH_ENABLED=false
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
```

- [ ] **Bước 6: Chạy test**

```powershell
pytest tests/api/test_admin_auth.py -v
```

- [ ] **Bước 7: Commit**

```powershell
git add backend/app backend/.env.example backend/tests/api/test_admin_auth.py
git commit -m "security: protect admin mutations with configurable auth"
```

---

### Task 8: Hoàn Thiện Test Hợp Đồng Frontend - Backend

**File:**

- Sửa: `frontend/lib/api.ts`
- Sửa: `frontend/app/item/[id]/page.tsx`
- Sửa: `frontend/app/manual/page.tsx`
- Tạo: `backend/tests/api/test_groups.py`
- Hoàn thiện: `backend/tests/api/`

- [ ] **Bước 1: Test group API**

Bao phủ:

- Create group trả 201.
- Tạo group trùng trả group đã có.
- List groups trả đúng `item_count`.
- Group không tồn tại trả 404.

- [ ] **Bước 2: Đảm bảo mỗi frontend function có contract test**

| Frontend function | Endpoint | Test |
|---|---|---|
| `registerObject` | `POST /api/objects/register` | `test_objects.py` |
| `searchObject` | `POST /api/search` | `test_search.py` |
| `listGroups` | `GET /api/groups` | `test_groups.py` |
| `createGroup` | `POST /api/groups` | `test_groups.py` |
| `getGroupItems` | `GET /api/groups/{id}/items` | `test_groups.py` |
| `getUngroupedItems` | `GET /api/objects/ungrouped` | `test_objects.py` |
| `getItem` | `GET /api/objects/{id}` | `test_objects.py` |
| `updateItem` | `PUT /api/objects/{id}` | `test_objects.py` |
| `deleteItem` | `DELETE /api/objects/{id}` | `test_objects.py` |
| `updateItemImage` | `PUT /api/objects/{id}/images/{angle}` | `test_objects.py` |
| `deleteItemImage` | `DELETE /api/objects/{id}/images/{angle}` | `test_objects.py` |
| `generateContent` | `POST /api/generate` | `test_story.py` |
| `chatWithAI` | `POST /api/chat` | `test_chat.py` |
| `fetchTTSAudio` | `POST /api/tts` | `test_tts.py` |

- [ ] **Bước 3: Ngăn gọi story trùng ở item page**

Trong effect, bỏ `error` khỏi dependency:

```typescript
}, [itemId, persona, language]);
```

Thêm cancellation flag để response cũ không ghi đè persona/language mới.

- [ ] **Bước 4: Resolve URL ảnh thống nhất**

Trong `frontend/app/manual/page.tsx`, dùng `resolveImageUrl()` thay vì render trực tiếp đường dẫn backend.

- [ ] **Bước 5: Xóa helper không dùng**

Xóa `getTTSUrl()` khỏi `frontend/lib/api.ts`; giữ `fetchTTSAudio()`.

- [ ] **Bước 6: Chạy toàn bộ API test**

```powershell
cd backend
pytest tests/api -v
```

- [ ] **Bước 7: Build frontend**

```powershell
cd frontend
npm.cmd run build
```

Kỳ vọng: build thành công. Cảnh báo `<img>` có thể giữ lại vì không thuộc phạm vi ổn định lần này.

- [ ] **Bước 8: Commit**

```powershell
git add frontend backend/tests/api
git commit -m "test: cover frontend backend API contracts"
```

---

### Task 9: Kiểm Thử Provider Thật Và Cập Nhật Tài Liệu

**File:**

- Tạo: `backend/tests/integration/test_real_llm.py`
- Tạo: `backend/tests/integration/test_real_rag.py`
- Sửa: `backend/pytest.ini`
- Sửa: `README.md`
- Viết lại: `docs/architecture_and_tech_stack.md`
- Tạo: `docs/api.md`
- Sửa: `docker-compose.yml`

- [ ] **Bước 1: Tạo test Gemini thật dạng opt-in**

Test chỉ chạy khi:

```powershell
$env:RUN_EXTERNAL_LLM_TESTS="true"
```

Test dùng context tổng hợp, không gửi dữ liệu item thật:

```python
@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("RUN_EXTERNAL_LLM_TESTS") != "true",
    reason="external Gemini test is opt-in",
)
def test_real_story_generation_returns_plain_text():
    content = get_rag_generator().generate_answer(
        query="Kể một câu chuyện ngắn về hiện vật.",
        retrieved_docs=[
            Document(
                page_content=(
                    "Hiện vật được tạo năm 2024 "
                    "để kiểm thử hệ thống."
                ),
                metadata={"page": "test-1"},
            )
        ],
        persona="Family Visitor",
        language="Tiếng Việt",
    )

    assert isinstance(content, str)
    assert content.strip()
```

- [ ] **Bước 2: Tạo test RAG thật dạng opt-in**

Chỉ chạy khi `RUN_REAL_RAG_TESTS=true`.

Test phải:

- Kiểm tra file BM25, chunks và Chroma tồn tại.
- Khởi tạo retriever.
- Retrieve một query được duyệt.
- Xác nhận kết quả là `Document`.

Test mặc định không tải model.

- [ ] **Bước 3: Bổ sung cấu hình Docker**

```yaml
- GOOGLE_API_KEY=${GOOGLE_API_KEY}
- RAG_CHROMA_PATH=./data/rag_chroma
- RAG_BM25_PATH=./data/rag/bm25_index.pkl
- RAG_CHUNKS_PATH=./data/rag/chunks.pkl
- MODEL_WARMUP_ENABLED=false
- ADMIN_AUTH_ENABLED=${ADMIN_AUTH_ENABLED:-false}
- ADMIN_USERNAME=${ADMIN_USERNAME:-}
- ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
```

- [ ] **Bước 4: Viết lại tài liệu kiến trúc**

`docs/architecture_and_tech_stack.md` phải mô tả đúng:

- Next.js frontend.
- FastAPI backend.
- SQLite là metadata chính.
- DINOv2 + Chroma ảnh.
- Chroma văn bản + BM25 hybrid RAG.
- Gemini cho story/chat.
- gTTS.
- Fallback bằng `Item.description`.
- Danh sách endpoint hiện tại.
- Thư mục runtime được Git ignore.

- [ ] **Bước 5: Tạo tài liệu API**

`docs/api.md` ghi rõ:

- Method và URL.
- Request/response.
- Validation.
- Endpoint nào cần admin auth.
- Mã lỗi ổn định.

- [ ] **Bước 6: Cập nhật README**

Hướng dẫn:

```powershell
cd backend
pytest -m "not integration"
pytest -m integration

cd ..\frontend
npm.cmd run build
```

- [ ] **Bước 7: Chạy kiểm tra offline cuối**

```powershell
cd backend
pytest -m "not integration" -v

cd ..\frontend
npm.cmd run build

cd ..
git diff --check
```

Kỳ vọng:

- Backend test offline pass.
- Frontend build thành công.
- `git diff --check` không báo lỗi.

- [ ] **Bước 8: Chạy integration test trong môi trường phù hợp**

```powershell
$env:RUN_EXTERNAL_LLM_TESTS="true"
$env:RUN_REAL_RAG_TESTS="true"
pytest -m integration -v
```

Nếu RAG vẫn `MemoryError`:

- Giữ fallback production.
- Ghi nhận mức RAM tối thiểu.
- Việc đổi sang embedding model nhỏ hơn phải là thay đổi riêng được duyệt.
- Không để RAG bổ sung làm chặn story.

- [ ] **Bước 9: Commit**

```powershell
git add README.md docs backend/tests backend/pytest.ini docker-compose.yml
git commit -m "docs: align architecture and verification workflow"
```

---

## Các Mốc Review

### Mốc A: Nền Tảng - Sau Task 1 Và 2

- Test được Git theo dõi.
- FastAPI import mà không tải DINOv2.
- Health test chạy trong môi trường RAM thấp.

### Mốc B: Biên AI - Sau Task 3 Đến 5

- Gemini luôn được chuyển thành `str`.
- URL `/api/generate`, `/api/chat`, `/api/tts` không đổi.
- Story chạy bằng item description khi RAG lỗi.
- Test AI endpoint không cần mạng.

### Mốc C: Toàn Vẹn Dữ Liệu - Sau Task 6 Và 7

- Registration lỗi giữa chừng được dọn sạch.
- Update description không tạo RAG document trùng.
- Delete item dọn các index liên quan khi khả dụng.
- Admin mutation có auth cấu hình được.

### Mốc D: Sẵn Sàng Phát Hành - Sau Task 8 Và 9

- Mỗi frontend API function có backend contract test.
- Offline test và frontend build pass.
- Test provider thật là opt-in và chỉ dùng dữ liệu tổng hợp.
- Tài liệu khớp code thực tế.

## Tiêu Chí Hoàn Thành

- [ ] `pytest -m "not integration"` chạy không cần internet, Gemini hoặc model RAG thật.
- [ ] `npm.cmd run build` thành công.
- [ ] `/api/generate` trả `content` dạng chuỗi khi Gemini trả content blocks.
- [ ] `/api/generate` vẫn chạy khi retriever ném `MemoryError`.
- [ ] Update item thay thế RAG document cũ.
- [ ] Delete item dọn SQLite, uploads, image embeddings và text document khi retriever khả dụng.
- [ ] Không còn test import `app.services` hoặc `app.config`.
- [ ] Không còn production credential hard-code.
- [ ] URL frontend đang dùng không thay đổi.
- [ ] Tài liệu mô tả đúng Next.js + FastAPI + SQLite + Chroma.

