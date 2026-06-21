# 🚀 PROJECT STATUS: HERA - AI Heritage Guide V2

**Bản cập nhật gần nhất:** 2026-06-20

Đây là tài liệu ngắn gọn dành riêng cho các AI Agent hoặc Developer mới để nắm bắt toàn bộ ngữ cảnh, kiến trúc và tiến độ hiện tại của dự án một cách nhanh nhất, mà không cần phải đọc lại toàn bộ PRD hay Log. Hãy cập nhật file này nếu có những thay đổi lớn về mặt cấu trúc.

---

## 1. 🌟 TỔNG QUAN (OVERVIEW)
- **Tên dự án:** AI Heritage Guide V2 (Nền tảng Hướng dẫn viên số bằng AI).
- **Mục tiêu:** Cung cấp trải nghiệm nhận diện hiện vật qua Camera với độ trễ thấp (Local AI), kết hợp tra cứu tri thức chuyên sâu (RAG) và kể chuyện/hỏi đáp đa ngôn ngữ (GenAI) cho khách tham quan bảo tàng, di tích. Dành cho admin, có giao diện quản lý đa nhóm (groups) và tải lên kho tri thức.
- **Tính chất:** Self-hosted & Multi-tenant (hỗ trợ nhiều khu triển lãm trên một server).

## 2. 🏛️ KIẾN TRÚC & CÔNG NGHỆ (ARCHITECTURE)
- **Frontend:** Next.js 14 App Router, React 18, Tailwind CSS. Giao tiếp qua `lib/api.ts` & `lib/useObjectSearch.ts`. Xử lý proxy API trong `next.config.mjs`.
- **Backend:** Python / FastAPI, quản lý bằng `uv` (`pyproject.toml`).
- **Database:** SQLite (`app.db`) cho dữ liệu metadata (Group, Item, Content).
- **Core AI Pipeline:**
  1. **Vision (Nhận diện):** `DINOv2` mã nguồn mở + ChromaDB Vector (Tìm kiếm ảnh cục bộ, rất nhanh).
  2. **RAG (Tra cứu):** Hybrid RAG = Vietnamese Bi-encoder (ChromaDB) + BM25 Sparse (`chunks.pkl`).
  3. **Generative (Sinh nội dung):** Google Gemini API (Tạo câu chuyện dựa theo Persona & chat ngữ cảnh RAG).
  4. **Text-to-Speech (TTS):** Edge TTS (Tạo luồng âm thanh đa ngôn ngữ tự nhiên).

## 3. ✅ TIẾN ĐỘ & TRẠNG THÁI HIỆN TẠI (CURRENT STATUS)
- **[ĐÃ HOÀN THÀNH]** Nâng cấp kiến trúc V1 (Supabase) lên V2 (Self-hosted FastAPI).
- **[ĐÃ HOÀN THÀNH]** Chuẩn hóa toàn bộ biến môi trường về 1 file `.env` duy nhất ở thư mục gốc (root), loại bỏ `backend/.env`.
- **[ĐÃ HOÀN THÀNH]** Tối ưu Frontend UI: Sửa lỗi nhảy giao diện trên Mobile (dùng Global wrapper `min-h-[100dvh]`), gom nhóm các xử lý tìm kiếm ảnh vào `useObjectSearch.ts`.
- **[ĐÃ HOÀN THÀNH]** Tối ưu Backend RAG & Content: 
  - Tăng độ chính xác RAG (chấp nhận khớp từ khóa chính).
  - Khắc phục tình trạng gọi Audio TTS bị trùng lặp, tối ưu payload chat history (giới hạn 10 messages gần nhất).
  - Cập nhật luồng Khám phá (Discoverable) nhóm triển lãm dành cho Visitor (API `/api/groups/discover`).
- **[ĐÃ HOÀN THÀNH]** Khôi phục Minimap MVP cho Visitor:
  - Bản đồ tĩnh theo `groupSlug`, cấu hình zone và tọa độ tại `frontend/lib/minimapConfig.ts`.
  - Ghi nhớ hiện vật gần nhất bằng `localStorage`; icon Minimap hiện chấm đỏ sau khi mở/quét hiện vật và tắt khi khách mở bản đồ.
  - Modal có marker vị trí, fallback khi chưa xác định/group chưa có bản đồ và hỗ trợ Escape/click backdrop.
  - Hiện chỉ có SVG minh họa cho Văn Miếu - Quốc Tử Giám. Chưa có zoom/pan, Admin config hoặc lưu cấu hình ở Backend.

## 4. 🚧 CÁC VẤN ĐỀ ĐANG TỒN ĐỌNG & NEXT STEPS (TODO)
Nếu bạn (AI Agent) tiếp nhận dự án này, hãy xem xét các task sau để tiếp tục tối ưu:
1. **Khắc phục môi trường Test (Pytest):** Các virtualenv đang có chút lộn xộn (thiếu `pytest` ở backend/.venv hoặc sai đường dẫn). Cần dọn dẹp và chạy lại unit test cho `config/auth`.
2. **Cải tiến trạng thái Audio API:** Thêm một trường dữ liệu trạng thái rõ ràng (như `audio_status: "pending" | "ready" | "failed"`) vào Content API để UI trên Frontend không phải phỏng đoán qua biến `has_audio` và `audio_url`.
3. **Cải thiện Hash Cache Nội Dung:** Đưa biến `group.knowledge_version` vào hàm băm sinh nội dung. Nếu Admin cập nhật tài liệu RAG, mọi phiên bản nội dung (variants) đã tạo phải tự động vô hiệu hóa mà không cần xóa tay.
4. **Tối ưu hình ảnh (Frontend):** Dần dần chuyển các thẻ `<img>` hiện tại chịu tải cao sang sử dụng thẻ `<Image>` chuẩn của `next/image` một cách cẩn thận để khắc phục warning build.
5. **Dọn dẹp State Admin:** Có thể thay thế `localStorage` của Admin bằng Context/State management chuẩn mực hơn trên Next.js.

## 5. 🛠️ LƯU Ý CHO CÁC AGENT (AGENT GUIDELINES)
- Hãy bám sát vào file **.env gốc** (root), không tạo lại `.env` trong thư mục `backend/`.
- File **PRD** và **Architecture** nằm trong `docs/prd/PRD_v2.md` và `docs/architecture/architecture_v2.md`.
- File ghi chép công việc chi tiết (hàng ngày) là `WORKLOG.md`.
- Các file backup dữ liệu RAG, CSDL SQLite được hệ thống tự lưu tại `backend/data/backups/`. Đừng xóa chúng.
- Trước khi thực hiện lệnh bash, sử dụng các công cụ chuyên biệt của IDE (như `grep_search`, `read_file`, v.v.) thay vì chạy `grep`, `cat` trực tiếp trên terminal. Mọi thay đổi liên quan đến cấu trúc cần update lại file `PROJECT_STATUS.md` này.

## 6. Dynamic Minimap Update (2026-06-21)
- Minimap configuration is now stored per Group in `groups.minimap_config`.
- Admin can download/edit/upload JSON using stable `itemNames`.
- Visitor API resolves `itemNames` to environment-local `itemIds` within the selected Group.
- Visitor UI prefetches the configuration before opening the modal.
- Static `frontend/lib/minimapConfig.ts` has been replaced by API configuration plus `frontend/lib/minimapState.ts`.

## 7. AI Historical Companion (2026-06-21)
- Added the independent `/{groupSlug}/companion` journey for Lê Quý Đôn at age 18.
- Companion mode persists for the current browser session and records visited item IDs locally.
- Item detail uses the dedicated Companion narration and chat interface while this mode is active.
- Added `POST /api/companion/chat`, with verified item context and visited-item names scoped to the current Group.
- Companion speech uses Edge TTS voice `vi-VN-NamMinhNeural`; microphone input uses the browser Web Speech API when available.
- **UI/UX Tweaks**:
  - Implemented Gradient Fade Mask (`mask-image: linear-gradient`) to blend the square avatar/video naturally into the dark UI background without harsh borders.
  - Replaced the initial "Close" button with a standard `<HomeButton />` and a "📸 Quét" (Scan) button in the Companion header.
  - Added a large glowing Voice Assistant microphone button (CompanionMic pattern) above the chat input with pulsing CSS animations (`animate-ping`, `animate-pulse`, `animate-spin`) to encourage voice interaction.
  - The chat input box is now always visible. If the user talks without scanning an item, the companion responds locally with a canned prompt requesting them to scan first.
- **Mobile Speech Recognition Fixes**:
  - Added error catching for `aborted` and `not-allowed` errors on mobile browsers, showing specific error codes.
  - Handled iOS Safari `aborted` errors by explicitly calling `stopChatTts()` before `startListening()` to avoid audio session conflicts.
  - Warns users if they open the link via in-app browsers (Zalo/Facebook) which block microphone access.
- Avatar images are loaded from `frontend/public/images/companion/` (updated to `companion-bg.png` generated via `generate_image`); missing assets have an in-app fallback.
- Intro video is expected at `frontend/public/videos/companion-intro.mp4`; a welcome screen is used until the video is supplied.
- One-time narration generation script: `backend/scripts/generate_companion_narration.py`.
- Companion proactively requests a short next-stop suggestion and notifies the Minimap after narration.
