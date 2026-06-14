# AI Heritage Guide

Ứng dụng nhận diện hiện vật bằng ảnh và tạo nội dung giới thiệu bằng AI.

## Công Nghệ

- Frontend: Next.js 14, TypeScript, Tailwind CSS.
- Backend: FastAPI, SQLAlchemy.
- Metadata: SQLite.
- Tìm kiếm ảnh: DINOv2 + Chroma.
- RAG văn bản: Chroma + BM25.
- Sinh nội dung: Google Gemini.
- Chuyển văn bản thành giọng nói: gTTS.

## Luồng Chính

1. Admin đăng ký item và ảnh nhiều góc.
2. Backend lưu metadata trong SQLite, ảnh trong `uploads/` và embedding ảnh trong Chroma.
3. Người dùng chụp ảnh để tìm top item gần nhất.
4. Story/chat luôn dùng `Item.description` làm context nền.
5. Hybrid RAG bổ sung tài liệu khi index và model khả dụng.
6. Nếu RAG lỗi, story/chat vẫn có thể hoạt động bằng description.

## Chạy Local

### Backend

```powershell
cd backend
uv sync
.\.venv\Scripts\Activate.ps1
copy .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:3000`
- Swagger: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Cấu Hình Quan Trọng

```env
GOOGLE_API_KEY=
LLM_MODEL=gemini-2.5-flash
LLM_TIMEOUT_SECONDS=60
LLM_MAX_RETRIES=2
MODEL_WARMUP_ENABLED=false

ADMIN_AUTH_ENABLED=false
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
```

Khi `ADMIN_AUTH_ENABLED=true`, các endpoint thay đổi group, item và ảnh yêu cầu HTTP Basic Auth. Endpoint đọc, search, story, chat và TTS vẫn public.

## Chạy Test

Test offline không tải model thật và không gọi provider:

```powershell
cd backend
pytest -m "not integration"
```

Test provider/model thật là opt-in:

```powershell
$env:RUN_EXTERNAL_LLM_TESTS="true"
$env:RUN_REAL_RAG_TESTS="true"
pytest -m integration -v
```

Build frontend:

```powershell
cd frontend
npm.cmd run build
```

## Kiểm Tra Và Repair RAG Index

Audit không thay đổi dữ liệu:

```powershell
cd backend
$env:PYTHONPATH="."
python scripts/repair_rag_index.py --data-dir data
```

Repair duplicate vectors:

```powershell
python scripts/repair_rag_index.py --data-dir data --apply
```

Script chỉ tự repair khi mọi chunk đều đã có vector. Trước khi sửa, script backup `rag_chroma`, `chunks.pkl` và `bm25_index.pkl` vào `backend/data/backups/`.

## Tài Liệu

- [Kiến trúc](docs/architecture/architecture_v2.md)
- [API](docs/specs/api.md)
- [Implementation plan](docs/superpowers/plans/2026-06-12-stabilize-api-rag-llm.md)
