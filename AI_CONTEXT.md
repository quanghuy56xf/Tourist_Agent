# AI_CONTEXT.md

## Project
HERA - AI Heritage Guide, nền tảng hướng dẫn tham quan di sản self-hosted và multi-tenant.
Frontend dùng Next.js 14; backend dùng FastAPI; dữ liệu metadata lưu trong SQLite.

## Architecture
- `frontend/app/`: visitor UI và admin UI.
- `frontend/components/visitor/`: giao diện tham quan, Minimap và AI Companion.
- `frontend/lib/api.ts`: API client chính của frontend.
- `frontend/lib/i18n/`: Dữ liệu và logic đa ngôn ngữ (vi, en, ko, ja, zh, fr).
- `backend/app/modules/vision/`: nhận diện hiện vật bằng DINOv2 và ChromaDB.
- `backend/app/modules/rag/`: Hybrid RAG với ChromaDB, BM25 và Reranker.
- `backend/app/modules/content/`: nội dung thuyết minh, persona và TTS.
- `backend/app/modules/llm/`: chat, sinh nội dung và AI Companion.
- `backend/app/modules/stt/`: nhận dạng giọng nói bằng Gemini.
- `backend/app/modules/analytics/`: đo lường Product Eval và RAGAS metrics.
- `backend/data/backups/`: dữ liệu backup; không được xóa.

## Rules
- Không đọc, hiển thị hoặc chỉnh sửa file `.env` nếu người dùng không yêu cầu rõ ràng.
- Chỉ dùng file `.env` tại thư mục gốc; không tạo `backend/.env`.
- Ưu tiên diff nhỏ và bám sát task.
- Không refactor code không liên quan.
- Không xóa dữ liệu, backup hoặc thay đổi của người dùng.
- Viết test trước cho feature và bug fix khi phù hợp.
- Luôn chạy test liên quan và build/type-check trước khi báo hoàn thành.
- Cập nhật `PROJECT_STATUS.md` khi có thay đổi kiến trúc đáng kể.

## Current Focus
- Mở rộng hỗ trợ đa ngôn ngữ (6 ngôn ngữ) cho toàn bộ UI và các popup hướng dẫn, đánh giá (Eval Feedback).
- Tinh chỉnh tham số truy xuất RAG (k, search_K) và Reranker để cải thiện tính chính xác và độ liên quan của ngữ cảnh.
- Hoàn thiện và duy trì hệ thống kiểm thử Product Eval & RAGAS.
- Tinh chỉnh trải nghiệm Mobile UX (dùng `100dvh` wrapper, sắp xếp luồng scan/upload).

## Prompt Usage
Mở đầu task mới bằng:

> Đọc `ai_context.md` trước. Sau đó chỉ xử lý task này: ...
