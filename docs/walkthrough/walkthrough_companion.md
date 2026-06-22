# Walkthrough: Người Đồng Hành Chủ Động (Lê Quý Đôn)

Mình đã hoàn tất việc nâng cấp luồng trải nghiệm Người Đồng Hành (Companion Journey) theo đúng tầm nhìn mới của bạn.

## Các tính năng đã được triển khai

### 1. Luồng Onboarding chủ động bằng Camera
*   **Hành động**: Khi du khách nhấn nút **"Bắt đầu hành trình"** (hoặc sau khi xem xong video Intro), hệ thống tự động gửi tín hiệu bắt đầu cho AI.
*   **Trải nghiệm**: Lê Quý Đôn cất giọng chào mừng và **chủ động hướng dẫn**: *"Cho ta biết hiện vật gần nhất của bạn để bắt đầu hành trình. Hãy chụp ảnh hiện vật đó cho ta nhé"*. 
*   **Auto-Camera**: Ngay lúc đó, giao diện Camera sẽ được tự động bật lên phủ ngay trên màn hình Chat. Du khách chỉ việc hướng máy ảnh về phía hiện vật (VD: Khuê Văn Các) và bấm **"Chụp ngay"**.
*   **Nối liền hành trình**: Sau khi hệ thống nhận diện xong, Camera tự đóng và AI tự động tiếp nối mạch truyện: *"À, Khuê Văn Các..."*

### 2. Xử lý Quét Ảnh chưa rõ ràng (Fallback Nhập vai)
*   **Vấn đề**: Khi ảnh quét mờ hoặc không đạt độ tin cậy tuyệt đối, hệ thống không báo lỗi khô khan.
*   **Giải pháp**: Lê Quý Đôn sẽ chủ động lên tiếng: *"Ây da, góc nhìn này hơi khó đoán quá. Đôn này đang phân vân..."*.
*   **Trải nghiệm UI**: Giao diện Camera mờ đi và hiển thị một danh sách (Bottom Sheet) gợi ý tối đa 3 hiện vật có độ tương đồng cao nhất để du khách tự chọn hoặc nhấn "Chụp lại góc khác".

### 3. Gợi ý Chủ động & Rich Action Buttons
*   **Giao tiếp thông minh**: Sau khi kể xong chuyện về hiện vật, Lê Quý Đôn sẽ **luôn kết thúc bằng một câu hỏi mở** (ví dụ: *"Ta kể vậy bạn có muốn hỏi thêm gì không?"*) và **nhắc đến tên điểm đến tiếp theo**.
*   **Quyền kiểm soát cho Du khách (Thay thế Auto-Minimap)**: Thay vì tự động bật Bản đồ đè lên màn hình Chat, hệ thống cung cấp cho du khách **2 Nút bấm (Action Buttons)** xuất hiện mượt mà ngay dưới tin nhắn:
    *   **`❓ Hỏi thêm về hiện vật này`**: Nhấn vào nút này, hệ thống tự động gửi yêu cầu kể thêm thông tin thú vị.
    *   **`🗺️ Dẫn ta tới [Điểm tiếp theo]`**: Bấm vào nút này, Bản đồ (Minimap) mới bật lên và chớp nháy chỉ đường đến trạm kế tiếp.

## Cách để bạn kiểm tra (Test) thử

1. **Xóa Lịch sử Hành trình**: Mở DevTools (F12) -> tab Application -> Local Storage. Xóa biến `visited_item_ids` và xóa Session Storage để ứng dụng hiểu là bạn "vừa mới tới".
2. Khởi động lại trang `http://localhost:3000/van-mieu/companion` (hoặc truy cập từ giao diện chính).
3. Bấm nút **"Bắt đầu hành trình"**.
4. Chờ xem Lê Quý Đôn chào hỏi và giao diện Camera tự động bật lên.
5. Thử quét ảnh cố tình bị nhòe/tối để trải nghiệm luồng **Fallback Nhập vai**.
6. Bấm chọn 1 thẻ gợi ý (hoặc quét thành công 1 ảnh rõ) để nghe kể chuyện.
7. Kéo xuống dưới tin nhắn cuối cùng để kiểm tra câu chốt rủ rê của Lê Quý Đôn.
8. Thử thao tác với 2 nút **Hỏi thêm** hoặc **Dẫn ta tới...** để kiểm tra tính năng mở Minimap theo ý muốn.

Nếu bạn gặp bất kỳ vấn đề gì về luồng chạy thực tế, hãy phản hồi lại cho mình nhé!
