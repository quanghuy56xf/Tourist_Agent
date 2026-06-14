# HERA - Theo dõi điều chỉnh

## Đã hoàn tất

- Đổi tên sản phẩm trên giao diện visitor thành HERA.
- Thêm lựa chọn `VI | EN` tại trang chính.
- Lưu ngôn ngữ đã chọn và áp dụng cho các trang visitor tiếp theo.
- Tách lựa chọn ngôn ngữ khỏi nhóm khách/persona.
- Dịch giao diện visitor, phần giới thiệu hiện vật và câu trả lời chat.
- Giữ nguyên tên riêng và tên hiện vật do backend trả về.
- Đổi câu hướng dẫn thành:
  `Hãy chọn một phương thức bên dưới để bắt đầu khám phá di tích.`
- Giới hạn nội dung LLM sinh cho phần giới thiệu và chat tối đa 300 từ.
- Không cắt nội dung được Ban quản lý chỉnh sửa thủ công.
- Đổi phiên bản cache nội dung AI để nội dung cũ quá 300 từ được sinh lại.
- Truyền độ tương đồng thực tế từ kết quả nhận diện sang trang chi tiết và hiển
  thị dưới dạng phần trăm.

## Cần theo dõi

- Kiểm tra trực quan luồng VI/EN trên thiết bị có camera thật:
  - [ ] iOS Safari: cấp quyền camera, chụp dọc/ngang và thử lại sau lỗi.
  - [ ] Android Chrome: cấp quyền camera, chụp dọc/ngang và thử lại sau lỗi.
  - [ ] Luồng tiếng Việt: nhận diện, giới thiệu, chat và âm thanh.
  - [ ] Luồng tiếng Anh: nhận diện, giới thiệu, chat và âm thanh.
  - [ ] Trường hợp từ chối quyền camera hiển thị đúng thông báo.
