# Thiết kế cải thiện codebase

## Mục tiêu

Hoàn tất các khoảng trống được xác định trong `need improve.md` và qua kết quả
test/build hiện tại, không thay đổi các hành vi sản phẩm không liên quan.

## Backend

Hash cache của nội dung AI sẽ bao gồm phiên bản kiến thức của nhóm. Khi quản
trị viên thay đổi tài liệu nhóm, phiên bản kiến thức thay đổi và các nội dung
AI đã sinh trở thành hết hạn. Yêu cầu tiếp theo sẽ tự động sinh lại nội dung.

Nội dung được quản trị viên chỉnh sửa thủ công chỉ phụ thuộc vào chính nội dung
đó, vì vậy không bị vô hiệu hóa khi tài liệu kiến thức thay đổi.

Test vòng đời RAG phải khởi tạo cùng cơ chế khóa đồng bộ như một
`HybridRetriever` thực tế. Hành vi khóa trong production được giữ nguyên.

## Frontend

Độ tương đồng nhận diện tiếp tục được truyền từ kết quả tìm kiếm sang trang chi
tiết hiện vật. Logic đọc và định dạng độ tương đồng sẽ được tách thành helper
dùng chung để không hiển thị giá trị URL không hợp lệ và có thể kiểm thử độc
lập.

Object URL của ảnh chụp camera sẽ được giải phóng đúng theo URL vừa tạo, bao
gồm cả trường hợp tìm kiếm thất bại và component bị đóng.

Các hàm đặt lại trạng thái nội dung trong màn quản trị sẽ dùng callback ổn định,
giúp các effect khai báo đầy đủ dependency và tránh giữ closure cũ.

## Kiểm thử

Regression test backend sẽ xác minh:

- Hash nội dung AI thay đổi khi phiên bản kiến thức nhóm thay đổi.
- Hash nội dung thủ công không phụ thuộc phiên bản kiến thức nhóm.
- Việc cập nhật tài liệu của hiện vật trong RAG hoạt động cùng khóa đồng bộ.

Frontend sẽ dùng test runner nhẹ nhất tương thích với dự án TypeScript hiện tại
để kiểm tra:

- Chuẩn hóa, lưu và đọc ngôn ngữ; ánh xạ sang ngôn ngữ backend.
- Đọc độ tương đồng và định dạng phần trăm.
- Các helper thuần về hướng camera và cấu hình camera trong môi trường giả lập
  có kiểm soát.

Production build frontend và toàn bộ test backend offline phải chạy thành công.

## Tài liệu và kiểm thử thủ công

`need improve.md` sẽ đánh dấu việc hiển thị độ tương đồng động là đã hoàn tất,
đồng thời giữ kiểm thử camera trên thiết bị thật dưới dạng checklist rõ ràng.
Các liên kết tài liệu trong README sẽ được cập nhật theo cấu trúc thư mục
`docs` hiện tại.

Kiểm thử camera trên thiết bị thật vẫn cần thực hiện thủ công trên iOS Safari và
Android Chrome với cả tiếng Việt và tiếng Anh, bao gồm: cấp hoặc từ chối quyền
camera, chụp dọc và ngang, thử lại, nhận diện, nội dung giới thiệu, chat và âm
thanh.
