# AI_CONTEXT.md

## Project
HERA - AI Heritage Guide, nền tảng hướng dẫn tham quan di sản self-hosted và multi-tenant.
Frontend dùng Next.js 14; backend dùng FastAPI; dữ liệu metadata lưu trong SQLite.

## Architecture
- `frontend/app/`: visitor UI và admin UI.
- `frontend/components/visitor/`: giao diện tham quan, Minimap và AI Companion.
- `frontend/lib/api.ts`: API client chính của frontend.
- `backend/app/modules/vision/`: nhận diện hiện vật bằng DINOv2 và ChromaDB.
- `backend/app/modules/rag/`: Hybrid RAG với ChromaDB và BM25.
- `backend/app/modules/content/`: nội dung thuyết minh, persona và TTS.
- `backend/app/modules/llm/`: chat, sinh nội dung và AI Companion.
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
- Hoàn thiện luồng AI Companion Lê Quý Đôn: Tối ưu UX/UI (Dynamic Avatar, Floating Scanner, Suggested Questions) và Hỗ trợ đa ngôn ngữ (i18n) với Tiếng Anh.
- Sửa lỗi và tinh chỉnh: Tránh TTS đọc định dạng câu hỏi mồi, hợp nhất danh sách Action Buttons để không bị ghi đè, tinh chỉnh prompt để LLM đặt câu hỏi gợi ý sát với di tích.
- Dynamic Minimap cấu hình động theo từng Group bằng JSON và `itemNames`.

## Prompt Usage
Mở đầu task mới bằng:

> Đọc `docs/AI_CONTEXT.md` trước. Sau đó chỉ xử lý task này: ...
