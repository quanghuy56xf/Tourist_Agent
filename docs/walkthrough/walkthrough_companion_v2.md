# Hoàn tất Frontend: Trải nghiệm Active Companion End-to-End

Mình đã hoàn thiện triển khai toàn bộ các yêu cầu Frontend dựa trên bản thiết kế UX cho trải nghiệm Người Đồng Hành Chủ Động (Active Companion). Phần Frontend giờ đây đã sẵn sàng bắt nhịp cùng Backend để tự động sinh ra các nút Action (hành động).

## 🚀 Các Thay Đổi Chính

### 1. Bắt Sự Kiện `actions` Từ Backend (SSE Stream)
- Cập nhật hàm `chatWithCompanionStream` trong `api.ts` để đọc và phân tách event type `'actions'` gửi qua SSE (Server-Sent Events) từ Backend. 
- Giờ đây, thay vì chỉ nhận các event `metadata`, `chunk` và `audio`, Frontend đã có thể phân tích mảng dữ liệu cấu hình các nút bấm.

### 2. Quản Lý State cho Action Buttons
- Thêm biến state mới `actionButtons` vào component `CompanionChat.tsx` để lưu cấu hình các nút do Backend chỉ định:
  ```typescript
  const [actionButtons, setActionButtons] = useState<{ type: string; label: string }[]>([]);
  ```
- Mỗi khi người dùng hoặc hệ thống gửi một tin nhắn mới, danh sách các nút hiện tại sẽ được xoá, đảm bảo UI luôn hiển thị gọn gàng và theo đúng ngữ cảnh thời gian thực.

### 3. Giao Diện Nút Bấm Động (Dynamic Action Buttons)
Các Action Buttons được render động tùy theo payload của Backend. Các thiết kế cụ thể bao gồm:

#### 📸 Nút Onboarding (Quét Hiện Vật)
Khi bắt đầu ứng dụng, Backend gửi yêu cầu `open_camera`. Frontend sẽ vẽ một nút màu ngọc lục bảo nổi bật:
> **📸 Quét hiện vật gần nhất** 

Khi bấm vào, nút sẽ tự động ẩn và gọi hàm mở Inline Camera để khách hàng quét hiện vật.

#### 🗺️ Giai Đoạn Transit (Khám Phá + Quét Tiếp)
Trong giai đoạn khách đang di chuyển giữa các điểm, nếu Backend gợi ý điểm đến tiếp theo (`suggestedNextPoint`), luồng UI sẽ hiển thị bộ ba nút quen thuộc:
- ❓ **Hỏi thêm về hiện vật này**
- 🗺️ **Khám phá [Tên Hiện Vật]** (Mở Minimap)
- 📸 **Đã đến nơi, quét hiện vật** (Nút mới thêm)

💡 *Điểm hay ho:* Bạn không cần phải mở rồi đóng Minimap mới thấy nút quét. Nút được sắp xếp cạnh nút "Khám phá" để nếu khách hàng đã nhớ đường và tự đi tới nơi, họ có thể bấm ngay nút quét.

#### 🏁 Giai Đoạn Offboarding (Kết Thúc Tour)
Khi Backend gửi tín hiệu hoàn thành Tour, hai nút Offboarding sẽ xuất hiện:
- 🔄 **Bắt đầu hành trình mới**: Bấm vào sẽ tự động xóa bộ nhớ localStorage lưu lại các hiện vật đã đi và Refresh lại trang để trở về trạng thái Onboarding.
- 🌟 **Đánh giá trải nghiệm**: Bấm vào sẽ hiện cảnh báo Placeholder (Alert) cám ơn người dùng đánh giá.

---

> [!TIP]
> **Kiểm Tra Nhanh**
> Bạn có thể mở ứng dụng trên Web (chế độ điện thoại), thực hiện một vòng lặp bằng cách Reload lại trang chủ. Hành trình từ khi hiện ra nút Onboarding đầu tiên cho đến khi kết thúc sẽ tuân theo đúng kịch bản bạn thiết kế!
