# PROJECT STATUS: HERA - AI Heritage Guide V2

**Cập nhật gần nhất:** 2026-06-23

Tài liệu này là ảnh chụp ngắn gọn về trạng thái hiện tại của dự án, dành cho AI Agent và developer mới. Lịch sử triển khai chi tiết được lưu tại `WORKLOG.md`.

## 1. Tổng quan

HERA là nền tảng hướng dẫn tham quan di sản bằng AI, vận hành theo mô hình self-hosted và multi-tenant. Một máy chủ có thể phục vụ nhiều bảo tàng, di tích hoặc khu triển lãm độc lập dưới dạng các Group.

Trải nghiệm chính của khách tham quan gồm:

- Nhận diện hiện vật từ camera với độ trễ thấp.
- Tra cứu tri thức chuyên sâu từ tài liệu của từng Group.
- Sinh nội dung thuyết minh và hỏi đáp theo persona, có hỗ trợ đa ngôn ngữ.
- Phát giọng đọc tự nhiên và hỗ trợ tương tác bằng giọng nói.
- Hiển thị Minimap và gợi ý điểm tham quan tiếp theo.

Admin có thể quản lý Group, hiện vật, nội dung, tài liệu tri thức và cấu hình Minimap.

## 2. Kiến trúc và công nghệ

- **Frontend:** Next.js 14 App Router, React 18 và Tailwind CSS. Visitor UI và Admin UI nằm trong `frontend/app/`; các thành phần tham quan chính nằm tại `frontend/components/visitor/`.
- **Backend:** Python/FastAPI, quản lý dependency bằng `uv` qua `pyproject.toml`.
- **Database:** SQLite (`app.db`) lưu metadata như Group, Item, Content và cấu hình Minimap.
- **Vision:** DINOv2 kết hợp ChromaDB để tạo vector và tìm ảnh hiện vật cục bộ.
- **RAG:** Hybrid RAG gồm Vietnamese Bi-encoder trong ChromaDB và BM25 sparse index (`chunks.pkl`).
- **Generative AI:** Google Gemini dùng để sinh nội dung, chat theo persona, AI Companion và nhận dạng lời nói.
- **TTS:** Edge TTS tạo giọng đọc đa ngôn ngữ; Companion dùng giọng `vi-VN-NamMinhNeural`.
- **API frontend:** Các lời gọi chính đi qua `frontend/lib/api.ts`; luồng nhận diện ảnh được tập trung trong `frontend/lib/useObjectSearch.ts`.

## 3. Trạng thái hiện tại

### Nền tảng cốt lõi

- Kiến trúc V1 dựa trên Supabase đã được chuyển sang V2 self-hosted với FastAPI và SQLite.
- Cấu hình môi trường đã được chuẩn hóa về một file `.env` duy nhất tại thư mục gốc.
- Visitor có thể khám phá các Group qua `GET /api/groups/discover`.
- Luồng nhận diện ảnh, truy xuất RAG, sinh nội dung, chat và TTS đã hoạt động xuyên suốt.
- RAG đã được cải thiện để chấp nhận từ khóa chính và tận dụng tài liệu thuộc đúng Group.
- TTS được tạo theo yêu cầu, tránh gọi trùng; frontend chỉ gửi 10 tin nhắn gần nhất lên API chat.
- Giao diện mobile sử dụng chiều cao động `100dvh` và wrapper chung để giảm layout shift.

### Dynamic Minimap

- Cấu hình Minimap được lưu riêng cho từng Group trong `groups.minimap_config`.
- Admin có thể tải xuống, chỉnh sửa và tải lên JSON sử dụng `itemNames` ổn định giữa các môi trường.
- Visitor API chuyển `itemNames` thành `itemIds` thuộc đúng Group tại runtime.
- Visitor UI tải trước cấu hình, ghi nhớ hiện vật gần nhất và hiển thị marker hoặc trạng thái fallback phù hợp.
- Cấu hình tĩnh cũ trong `frontend/lib/minimapConfig.ts` đã được thay bằng cấu hình từ API và state tại `frontend/lib/minimapState.ts`.
- Khi Companion gợi ý điểm tiếp theo, Minimap có thể tự mở và làm nổi bật vị trí được đề xuất.

### AI Historical Companion

- Có hành trình riêng tại `/{groupSlug}/companion` với nhân vật Lê Quý Đôn 18 tuổi, chuẩn bị thi Đình.
- Persona xưng “ta” hoặc “Đôn này”, gọi khách là “bạn”, thể hiện sự thông minh, nhiệt huyết và tự tin; không dùng cách xưng hô già dặn như “lão phu” hoặc “tiên sinh”.
- Companion mode tồn tại trong phiên trình duyệt, ghi nhớ các hiện vật đã ghé và dùng ngữ cảnh thuộc đúng Group.
- Trang hiện vật sử dụng nội dung kể chuyện và giao diện chat riêng khi Companion mode đang bật.
- `POST /api/companion/chat` xác minh hiện vật, lịch sử tham quan và phạm vi Group trước khi sinh câu trả lời.
- Voice input dùng `getUserMedia` và `MediaRecorder`; audio được gửi tới `POST /api/stt` để Gemini chép thành tiếng Việt.
- Companion chủ động chào hỏi, yêu cầu khách quét hiện vật, có thể mở camera ngay trong giao diện chat và đề xuất điểm đến tiếp theo.
- Nội dung chat có thể tách thành nhiều bong bóng nhưng TTS vẫn được tạo một lần cho toàn bộ câu trả lời.
- Nếu chưa quét hiện vật, Companion yêu cầu khách quét trước thay vì trả lời ngoài ngữ cảnh.

### Định hướng giao diện Companion

- MVP avatar 3D `.glb` đã bị loại bỏ vì giới hạn dung lượng, chất lượng low-poly, nguy cơ uncanny valley và chi phí hiệu năng trên mobile.
- Phiên bản hiện tại ưu tiên avatar 2D chất lượng cao.
- Hướng cải tiến tiếp theo là Dynamic Collapsible Avatar: giữ hình ảnh lớn khi mở hành trình, sau đó thu gọn thành avatar tròn khi hội thoại dài để dành không gian cho chat, camera và Minimap.

## 4. Current focus và TODO ưu tiên

1. **[Hoàn thành] Dynamic Collapsible Avatar:** Đã tối ưu không gian, hiệu ứng chuyển đổi mượt mà (500ms) và cho phép toggle thủ công.
2. **Tối ưu hình ảnh frontend:** chuyển dần các ảnh chịu tải cao sang `next/image` sau khi kiểm tra hành vi responsive và fallback.
3. **Dọn state Admin:** thay thế hoàn toàn `localStorage` và window events còn sót lại (`adminAuth`, `groups-changed`) bằng Context hoặc store để quản lý trạng thái đồng nhất hơn.
4. **Kiểm thử thiết bị thật:** xác nhận microphone, camera, TTS, inline scan và Minimap trên Safari iPhone.

## 5. Quy tắc quan trọng

- Không đọc, hiển thị hoặc chỉnh sửa `.env` nếu người dùng không yêu cầu rõ ràng.
- Chỉ sử dụng `.env` tại thư mục gốc; không tạo lại `backend/.env`.
- Ưu tiên diff nhỏ, bám sát task và không refactor phần không liên quan.
- Không xóa dữ liệu, database, vector store hoặc backup trong `backend/data/backups/`.
- Viết test trước cho feature hoặc bug fix khi phù hợp.
- Luôn chạy test liên quan và build/type-check trước khi báo hoàn thành thay đổi code.
- Chỉ cập nhật tài liệu này khi trạng thái hiện tại, kiến trúc hoặc ưu tiên lớn thay đổi; ghi diễn tiến hằng ngày vào `WORKLOG.md`.

## 6. Tài liệu liên quan

- Product requirements: `docs/prd/PRD_v2.md`
- Architecture: `docs/architecture/architecture_v2.md`
- AI context ngắn: `AI_CONTEXT.md`
- Nhật ký triển khai: `WORKLOG.md`
