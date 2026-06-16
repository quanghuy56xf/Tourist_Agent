# HERA - AI Heritage Guide 🏛️

HERA (AI Heritage Guide) là ứng dụng nhận diện hiện vật di sản bằng hình ảnh và tự động tạo nội dung giới thiệu thông minh tích hợp công nghệ trí tuệ nhân tạo (AI).

Ứng dụng hỗ trợ nhận diện hiện vật qua camera, tra cứu thông tin chi tiết bằng mô hình ngôn ngữ lớn (RAG) và hỗ trợ giọng nói thuyết minh (TTS).

---

## 🚀 Công Nghệ Sử Dụng

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS.
- **Backend**: FastAPI (Python), SQLAlchemy.
- **Metadata Database**: SQLite.
- **Nhận diện hình ảnh**: DINOv2 + Chroma DB (Vector Database).
- **Retrieval-Augmented Generation (RAG)**: Chroma + BM25 (Hybrid Search).
- **Tạo nội dung (Generative AI)**: Google Gemini API (gemini-2.5-flash).
- **Chuyển đổi văn bản thành giọng nói (TTS)**: gTTS (Google Text-to-Speech).

---

## 🔄 Luồng Hoạt Động Chính

1. **Quản lý Hiện Vật**: Quản trị viên (Admin) đăng ký các hiện vật kèm theo hình ảnh đa góc chụp.
2. **Lưu trữ & Vector hóa**: Backend lưu metadata vào SQLite, hình ảnh vào thư mục `uploads/` và tạo các vector embedding lưu vào Chroma.
3. **Tìm kiếm & Nhận diện**: Người dùng chụp ảnh hiện vật để hệ thống tìm kiếm 3 hiện vật tương đồng nhất.
4. **Tạo cốt truyện & Trò chuyện**: Hệ thống sử dụng thông tin hiện vật làm ngữ cảnh nền để AI sinh nội dung giới thiệu (Story) hoặc giải đáp câu hỏi của người dùng (Chat).
5. **Tìm kiếm lai (Hybrid RAG)**: Tích hợp thông tin tài liệu bổ sung từ Chroma và BM25 khi thực hiện RAG nhằm nâng cao độ chính xác của câu trả lời.
6. **Cơ chế Dự phòng (Fallback)**: Khi dịch vụ RAG gặp sự cố, hệ thống tự động sử dụng mô tả sẵn có của hiện vật để duy trì tính năng Story/Chat mà không bị gián đoạn.

---

## 🛠️ Hướng Dẫn Chạy Local

> [!NOTE]
> Các file cấu hình Docker đã được gỡ bỏ khỏi dự án để ưu tiên chạy trực tiếp và phát triển trên môi trường local thông thường.

### 1. Cấu Hình Biến Môi Trường (`.env`)
Sao chép file cấu hình mẫu và điền đầy đủ các thông tin cần thiết:
- Backend: Sao chép từ `backend/.env.example` sang `backend/.env`
- Frontend: Sao chép từ `frontend/.env.local` hoặc tạo cấu hình phù hợp.

Các cấu hình quan trọng:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-2.5-flash
LLM_TIMEOUT_SECONDS=60
LLM_MAX_RETRIES=2
MODEL_WARMUP_ENABLED=false

ADMIN_AUTH_ENABLED=false
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password-here
```
*Lưu ý: Khi bật `ADMIN_AUTH_ENABLED=true`, các endpoint thay đổi dữ liệu yêu cầu HTTP Basic Auth. Các tính năng công khai như search, story, chat và TTS vẫn cho phép truy cập public.*

### 2. Chạy Backend (FastAPI)
Yêu cầu đã cài đặt [uv](https://github.com/astral-sh/uv).

```powershell
cd backend
# Cài đặt thư viện dependencies bằng uv
uv sync
# Kích hoạt môi trường ảo (venv)
.\.venv\Scripts\Activate.ps1
# Khởi chạy server FastAPI
python -m uvicorn app.main:app --reload --port 8000
```
- **Swagger UI (API Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health check**: [http://localhost:8000/health](http://localhost:8000/health)

### 3. Chạy Frontend (Next.js)
```powershell
cd frontend
# Cài đặt các thư viện dependencies
npm install
# Khởi chạy môi trường phát triển (development mode)
npm run dev
```
- **Trang chủ**: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Chạy Kiểm Thử (Tests)

### Chạy Unit Test Offline (Không gọi API LLM/RAG thật)
```powershell
cd backend
pytest -m "not integration"
```

### Chạy Integration Test (Sử dụng Model và API RAG thật)
```powershell
$env:RUN_EXTERNAL_LLM_TESTS="true"
$env:RUN_REAL_RAG_TESTS="true"
pytest -m integration -v
```

### Build Frontend
```powershell
cd frontend
npm run build
```

---

## 🧹 Kiểm Tra & Sửa Lỗi RAG Index

Để kiểm tra (audit) mà không làm thay đổi dữ liệu gốc:
```powershell
cd backend
$env:PYTHONPATH="."
python scripts/repair_rag_index.py --data-dir data
```

Để tự động sửa các vector bị trùng lặp (duplicate vectors):
```powershell
python scripts/repair_rag_index.py --data-dir data --apply
```
*Lưu ý: Script sẽ tự động sao lưu dữ liệu `rag_chroma`, `chunks.pkl` và `bm25_index.pkl` vào thư mục `backend/data/backups/` trước khi áp dụng thay đổi.*

---

## 📄 Tài Liệu Liên Quan

- [Kiến trúc & Công nghệ](docs/architecture_and_tech_stack.md)
- [Tài liệu API](docs/api.md)
- [Kế hoạch ổn định API/RAG/LLM](docs/superpowers/plans/2026-06-12-stabilize-api-rag-llm.md)
