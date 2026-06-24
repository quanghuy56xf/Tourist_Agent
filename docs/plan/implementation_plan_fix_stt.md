# Thay đổi kiến trúc Voice Input: MediaRecorder -> Backend STT

Tài liệu này mô tả kế hoạch chuyển đổi tính năng nhận diện giọng nói (STT) từ việc dùng API tích hợp của trình duyệt (thường xuyên bị lỗi `aborted` trên iOS) sang phương pháp an toàn và chuẩn mực hơn: **Ghi âm tại Frontend và Dịch tại Backend**.

## User Review Required
> [!IMPORTANT]
> **Xác nhận sử dụng Gemini API (gemini-2.5-flash-lite) cho STT**
> Kế hoạch này sử dụng model **`gemini-2.5-flash-lite`** để làm STT. Dòng Flash-Lite hỗ trợ phân tích trực tiếp file âm thanh (Multimodal Audio-to-Text) với độ trễ cực thấp và chi phí siêu rẻ (khoảng 50-70 VNĐ cho 20 users test), hoàn hảo cho tác vụ chép chính tả mà không đòi hỏi Backend phải cài đặt Whisper nặng nề. Bạn vui lòng xác nhận xem cách này có phù hợp không nhé!

## Proposed Changes

### Frontend
Chúng ta sẽ thay thế hoàn toàn cơ chế `SpeechRecognition` bằng `MediaRecorder`.

#### [MODIFY] `lib/voiceInput.ts`
- Xóa bỏ toàn bộ mã liên quan đến `webkitSpeechRecognition`.
- Viết lại hàm `startRecording()` để xin quyền Micro (`navigator.mediaDevices.getUserMedia`) và bắt đầu thu âm bằng `MediaRecorder`.
- Viết hàm `stopRecording()` để lấy ra đối tượng `Blob` (thường là định dạng `.webm` hoặc `.mp4`).

#### [MODIFY] `lib/api.ts`
- Bổ sung hàm `transcribeAudio(audioBlob: Blob): Promise<string>` để gửi file âm thanh dạng `multipart/form-data` lên Backend.

#### [MODIFY] `components/visitor/CompanionChat.tsx`
- Sửa lại hàm `toggleMic`:
  - Lần bấm 1: Gọi `startRecording()` và đổi trạng thái UI sang "Đang ghi âm".
  - Lần bấm 2: Gọi `stopRecording()`, đổi trạng thái UI sang "Đang xử lý...", gọi hàm `transcribeAudio(blob)`, nhận về Text và tiến hành `chatWithCompanion()` như bình thường.

---

### Backend
Chúng ta sẽ mở một API mới để đón nhận file âm thanh từ Frontend và dùng Gemini để dịch ra Text.

#### [NEW] `app/modules/stt/gemini_stt.py`
- Tạo module chuyên trách cho việc STT.
- Khởi tạo client Gemini bằng `google-genai`.
- Hàm `transcribe_audio(audio_bytes, mime_type)`: Gửi trực tiếp mảng byte âm thanh vào Prompt yêu cầu model **`gemini-2.5-flash-lite`** dịch ra văn bản tiếng Việt. Cấu hình prompt tối giản để trả về text nhanh nhất.

#### [NEW/MODIFY] `app/api/routes/audio.py` (hoặc thêm vào `chat_router.py`)
- Thêm route `POST /api/stt` (hoặc `/api/audio/transcribe`).
- API này nhận `UploadFile` từ Frontend.
- Đọc mảng byte từ file, gọi `transcribe_audio` và trả về JSON: `{"transcript": "Nội dung người dùng đã nói"}`.

## Verification Plan
1. **Máy tính (Localhost)**: Chạy thử tính năng ghi âm mới, kiểm tra xem luồng `MediaRecorder -> API -> Chat` có hoạt động mượt mà không.
2. **Điện thoại (iOS/Android)**: Quét mã Cloudflare Tunnel mở trên Safari/Chrome, cấp quyền Micro, bấm thu âm và nói. Chờ xem hệ thống có trả về chính xác text và phản hồi mà không bị lỗi `aborted` hay không.
