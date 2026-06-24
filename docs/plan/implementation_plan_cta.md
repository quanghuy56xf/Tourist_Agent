# Goal Description

Triển khai đồng thời 3 cải tiến về UX/UI trong màn hình Companion Chat nhằm mục tiêu "luôn luôn cung cấp hành động tiếp theo" cho người dùng, giữ chân họ tương tác mà không gây cảm giác hối thúc.

1. **Tính năng A (Fixed Camera Button):** Thêm một nút mở Camera (📸) cố định bên cạnh thanh nhập Text.
2. **Tính năng B (Suggested Questions):** Tự động sinh ra 1-2 nút "Gợi ý câu hỏi" ngay sau câu trả lời của Lê Quý Đôn.
3. **Tính năng C (Smart Idle Timer):** Nếu sau 15 giây kể từ khi Lê Quý Đôn nói xong mà khách không tương tác gì thêm, tự động hiện một nút mồi "Quét tiếp" nhẹ nhàng.

## User Review Required

> [!WARNING]
> Tính năng B yêu cầu sửa Prompt của LLM để nó trả về gợi ý dưới một định dạng chuẩn. Tôi dự định dùng định dạng `||Q: Nội dung câu hỏi||` ở cuối văn bản. Frontend sẽ lọc bỏ các đoạn text có định dạng này để biến thành nút bấm. Việc này có thể làm LLM mất thêm một chút thời gian sinh chữ (rất nhỏ), nhưng sẽ đảm bảo luôn có nút gợi ý ngữ cảnh chính xác.

## Proposed Changes

---

### Frontend

#### [MODIFY] `CompanionChat.tsx`
- **Tính năng A:** Tại khu vực render input form (thanh nhập text), bổ sung thêm một `<button>` gắn icon Camera bên cạnh nút Gửi. Bấm vào sẽ kích hoạt hiển thị Inline Camera.
- **Tính năng B:** Ở hàm `send` (nơi phân tích các Chunk trả về từ Backend), dùng Regular Expression để bắt các chuỗi có định dạng `||Q: ...||`. Khi phát hiện, ta tự động gỡ đoạn chữ đó khỏi bong bóng chat và thêm vào state `actionButtons` (nút dạng text gửi tin nhắn).
- **Tính năng C:** Thêm logic `useEffect` khởi tạo một `setTimeout` 15 giây. Timer này được reset mỗi khi `isLoading` kết thúc (trả lời xong). Nếu hết 15s mà người dùng chưa tương tác gì, frontend sẽ nối thêm một mảng Action Button chứa nút "📸 Quét tiếp" vào dưới bong bóng chat cuối cùng để thúc đẩy khách tiếp tục hành trình.

---

### Backend

#### [MODIFY] `generator.py`
- Cập nhật `system_prompt` trong hàm `generate_companion_chat_stream`. Thêm chỉ thị bắt buộc: *"KẾT THÚC mỗi câu trả lời, hãy luôn đưa ra 1-2 câu hỏi mồi (gợi ý) để người dùng có thể hỏi thêm bạn. Đặt các câu hỏi gợi ý này trong cú pháp: ||Q: Câu hỏi 1|| ||Q: Câu hỏi 2||."*

## Verification Plan
### Manual Verification
- F5 trình duyệt và trải nghiệm flow.
- Bấm vào thanh nhập chữ, kiểm tra nút Camera cố định có hoạt động không.
- Gõ thử một câu hỏi bình thường, chờ xem sau khi Đôn trả lời xong, dưới câu nói có xuất hiện các nút "Gợi ý câu hỏi" tự động không. Bấm thử vào nút gợi ý.
- Ngồi đợi 15 giây không làm gì để xem nút "Quét tiếp" tự động có mọc ra như dự kiến không.
