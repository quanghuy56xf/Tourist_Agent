# Triển khai Trải nghiệm "Người Đồng Hành Chủ Động" (Proactive Companion Journey)

Mục tiêu: Biến nhân vật Lê Quý Đôn từ một AI phản hồi thụ động thành một người dẫn đường chủ động ngay từ khi du khách vừa mở ứng dụng. Điểm nhấn của phiên bản này là **Luồng Onboarding (Bắt đầu) thông minh**: Lê Quý Đôn sẽ chủ động yêu cầu du khách quét hiện vật đầu tiên để xác định vị trí, sau đó giao diện sẽ tự động bật camera.

## Đánh giá Đề xuất mới của bạn
**Đánh giá: 10/10 điểm về mặt Trải nghiệm người dùng (UX).** 
Thay vì để khách hàng bơ vơ tự tìm hiểu cách dùng (phải bấm nút quét ở đâu đó), nhân vật AI trực tiếp "nắm tay chỉ việc". Việc hòa trộn giữa thế giới thực (quét camera) và thế giới ảo (AI trò chuyện) diễn ra hoàn toàn tự nhiên như một cuộc hội thoại thực tế.

**Tính khả thi kỹ thuật:** Hoàn toàn khả thi. Trình duyệt cho phép tự động mở luồng video từ Camera (thông qua `getUserMedia`) nếu người dùng đã cấp quyền, hoặc sẽ hiện popup xin quyền. Ta có thể nhúng trực tiếp giao diện Camera vào màn hình Companion thay vì bắt khách chuyển trang.

## Proposed Changes (Kế hoạch Cập nhật)

Dưới đây là thiết kế luồng kỹ thuật mới nhất:

### 1. Backend: Cập nhật System Prompt & Logic Nhận diện
*   **Cập nhật `backend/app/modules/llm/generator.py`**:
    *   Cập nhật System Prompt cho "Greeting": *"Người dùng vừa mở ứng dụng. Dựa vào danh sách `visited_items`, nếu danh sách trống, hãy chào mừng họ đến Quốc Tử Giám và yêu cầu họ: 'Cho ta biết hiện vật gần nhất của bạn để bắt đầu hành trình. Hãy chụp ảnh hiện vật đó cho ta nhé'. Nếu họ đã đi qua vài điểm, hãy tóm tắt hành trình và gợi ý điểm tiếp theo. Nhớ xưng 'ta' và gọi 'bạn'."*
    *   Xử lý sự kiện nhận diện thành công: Khi AI nhận được tin nhắn ẩn kiểu `[HỆ THỐNG]: Khách vừa quét hiện vật X`, AI sẽ phản hồi tự nhiên: *"À, bạn đang đứng ở X. Để ta kể cho bạn nghe..."*

### 2. Frontend: Tự động bật Camera & Xử lý quét ảnh
*   **Tích hợp Camera vào `CompanionChat.tsx`**:
    *   Khi luồng khởi tạo bắt đầu và `visited_items` trống rỗng, ngay sau khi Lê Quý Đôn nói câu chào (hoặc đồng thời), Frontend sẽ thay đổi state `showInlineCamera = true`.
    *   State này sẽ làm xuất hiện Component `CameraCapture` (hiện đang dùng ở trang Quét) ngay bên trong giao diện Chat (hoặc dạng một Modal trượt từ dưới lên).
*   **Luồng xử lý sau khi chụp**:
    *   Khách hàng hướng camera và bấm nút chụp.
    *   Gửi ảnh tới API `searchImage`.
    *   Khi có kết quả (`item_id`, `name`), Frontend đóng Camera, tự động thêm `item_id` vào danh sách đã xem, và gửi một tin nhắn lên API chat: `[HỆ THỐNG]: Du khách vừa chụp ảnh và đang đứng tại hiện vật: [Tên hiện vật]. Hãy bắt đầu giới thiệu về nó.`
    *   Lê Quý Đôn sẽ đọc thông tin và bắt đầu kể chuyện.
*   **Tự động mở Bản đồ (Auto-open Minimap)**:
    *   Giữ nguyên như kế hoạch trước: Ở các chặng tiếp theo, khi Đôn kể xong và gợi ý điểm đến (`next_item_id`), Frontend sẽ tự động pop-up Minimap nhấp nháy vị trí đó.

## Verification Plan

### Manual Verification
1. Xóa lịch sử (localStorage). Vào trang Companion -> Bấm "Bắt đầu".
2. Lê Quý Đôn cất giọng chào và yêu cầu chụp ảnh.
3. **Camera tự động mở ra** ngay trên màn hình (có thể xin quyền mic/cam nếu là lần đầu).
4. Khách bấm chụp một bức ảnh (ví dụ: ảnh Khuê Văn Các).
5. Hệ thống nhận diện xong, Camera tự đóng lại. Lê Quý Đôn lập tức nói: *"À, Khuê Văn Các..."* và bắt đầu kể chuyện.
6. Kể xong, giao diện Minimap tự động bật lên chỉ đường tới điểm tiếp theo.
