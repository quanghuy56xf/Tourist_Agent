# HERA - AI Heritage Guide 🏛️

HERA (AI Heritage Guide) là nền tảng quản trị và hướng dẫn viên số bằng AI, giúp nhận diện các hiện vật di sản qua hình ảnh và tự động tạo nội dung giới thiệu thông minh đa ngôn ngữ.

Ứng dụng hỗ trợ nhận diện hiện vật tức thì qua camera (Edge AI), tra cứu thông tin chuyên sâu qua Hybrid RAG và kể chuyện bằng giọng nói (Streaming TTS).

---

## 🚀 Công Nghệ Sử Dụng

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS (Hỗ trợ PWA).
- **Backend**: FastAPI (Python), quản lý package bằng `uv`.
- **Database (Metadata)**: SQLite.
- **Nhận diện hình ảnh (Local Vision)**: DINOv2 mã nguồn mở + Chroma DB.
- **Truy xuất thông tin (Hybrid RAG)**: Chroma DB (Dense) + BM25 (Sparse).
- **Tạo nội dung (Generative AI)**: Google Gemini API.
- **Chuyển đổi văn bản thành giọng nói (TTS)**: Edge TTS (Microsoft) hỗ trợ Audio Streaming đa ngôn ngữ.

---

## 🔄 Luồng Hoạt Động Chính

1. **Quản lý Triển lãm (Admin)**: Ban quản lý tạo lập các khu trưng bày (Groups), đăng ký hiện vật (Items), tự tải lên hình ảnh huấn luyện và tài liệu lịch sử chuyên sâu.
2. **Khách tham quan (Visitor)**: Quét mã QR, chọn Ngôn ngữ, Nhóm người dùng (Persona) và khu trưng bày tương ứng.
3. **Nhận diện & Tra cứu**: Khách chụp ảnh hiện vật. DINOv2 trích xuất vector ảnh, đối chiếu với ChromaDB để định danh với độ trễ siêu thấp.
4. **Sinh câu chuyện & TTS**: RAG cung cấp bối cảnh chuẩn xác để Gemini sinh câu chuyện cá nhân hóa. Kết quả được đọc qua Edge TTS.
5. **Chatbot Ngữ cảnh**: Khách có thể tiếp tục hỏi đáp chuyên sâu. Mọi câu trả lời đều được kiểm soát chặt chẽ chống ảo giác thông tin (Hallucination) nhờ Hybrid RAG.

---

## 🛠️ Hướng Dẫn Chạy Local

> [!NOTE]
> Hệ thống ưu tiên chạy trực tiếp và phát triển trên môi trường local thông thường (Self-hosted) hoặc qua Docker.
> Xem hướng dẫn chạy đầy đủ và expose qua Internet ở file [manual_run.md](manual_run.md).

### 1. Cấu Hình Biến Môi Trường (`.env`)
Hệ thống sử dụng một file `.env` chung ở thư mục gốc. Bạn hãy sao chép từ file mẫu:
```powershell
copy .env.example .env
```
Các cấu hình quan trọng cần quan tâm:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-2.5-flash

# Bật tính năng đăng nhập Admin (True = Yêu cầu Basic Auth cho các thao tác thêm/sửa/xóa)
ADMIN_AUTH_ENABLED=false
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password-here
```

### 2. Chạy Backend (FastAPI)
Yêu cầu đã cài đặt [uv](https://github.com/astral-sh/uv).

```powershell
cd backend
# Cài đặt thư viện dependencies và đồng bộ môi trường bằng uv
uv sync
# Khởi chạy server FastAPI ở port 8000
uv run uvicorn app.main:app --reload --port 8000
```
- **Swagger UI (API Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Chạy Frontend (Next.js)
Mở một cửa sổ Terminal mới:
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
uv run pytest -m "not integration"
```

### Chạy Integration Test (Sử dụng Model và API RAG thật)
```powershell
$env:RUN_EXTERNAL_LLM_TESTS="true"
$env:RUN_REAL_RAG_TESTS="true"
uv run pytest -m integration -v
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
uv run python scripts/repair_rag_index.py --data-dir data
```

Để tự động sửa các vector bị trùng lặp (duplicate vectors):
```powershell
cd backend
$env:PYTHONPATH="."
uv run python scripts/repair_rag_index.py --data-dir data --apply
```
*Lưu ý: Script sẽ tự động sao lưu dữ liệu `rag_chroma`, `chunks.pkl` và `bm25_index.pkl` vào thư mục `backend/data/backups/` trước khi áp dụng thay đổi.*

---

## 📄 Tài Liệu Liên Quan

- **Tài liệu Yêu cầu (PRD)**: [docs/prd/PRD_v2.md](docs/prd/PRD_v2.md)
- **Kiến trúc V2**: [docs/architecture/architecture_v2.md](docs/architecture/architecture_v2.md)
- **Hướng dẫn chạy chi tiết**: [manual_run.md](manual_run.md)
- **Hướng dẫn triển khai**: [DEPLOY.md](DEPLOY.md)
