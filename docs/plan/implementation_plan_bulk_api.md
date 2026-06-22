# Kế hoạch triển khai: Đăng ký hiện vật hàng loạt

Tính năng đăng ký hàng loạt cho phép người quản trị tải lên toàn bộ ảnh từ một thư mục và đọc mô tả từ một file JSON, sau đó tự động nạp vào hệ thống.

## 1. Mở rộng Backend API (Ít thay đổi codebase nhất)

Thay vì tạo một API nhận toàn bộ thư mục (rất nặng và dễ timeout), chúng ta sẽ tạo một API mới xử lý **1 hiện vật với nhiều ảnh**: `POST /api/objects/bulk-register-item`.
Frontend sẽ đóng vai trò đọc thư mục, nhóm các ảnh theo thư mục con (tên hiện vật), ghép với mô tả từ file JSON, và gọi API này tuần tự cho từng hiện vật. Cách này giúp báo cáo tiến độ thời gian thực (real-time progress) rất tốt và tránh timeout.

### Các thay đổi cụ thể ở Backend:

#### [MODIFY] `backend/app/modules/objects/item_images.py`
- Sửa hàm `ingest_image` thêm tham số `save_to_db: bool = True`.
- Nếu `save_to_db = False`: Bỏ qua bước kiểm tra `VALID_ANGLES` (front, side, back) và bỏ qua bước lưu file bằng `storage.save_image_bytes`. Hệ thống vẫn sẽ trích xuất vector bằng DINOv2 và lưu vào ChromaDB.

#### [MODIFY] `backend/app/modules/objects/register_router.py`
- Thêm API mới `POST /api/objects/bulk-register-item` nhận các form data:
  - `name`: Tên hiện vật.
  - `description`: Mô tả.
  - `group_id`: ID khu di tích.
  - `images`: Danh sách `UploadFile`.
  - `skip_existing`: `bool` (Mặc định False).
  - `dry_run`: `bool` (Mặc định False).
- Logic xử lý:
  - Kiểm tra `skip_existing`: Nếu true, query DB xem có hiện vật cùng tên trong `group_id` chưa. Có thì trả về status `"skipped"`.
  - Kiểm tra `dry_run`: Nếu true, trả về status `"success"` (bỏ qua mọi thao tác DB/File).
  - Tạo `Item` trong SQLite.
  - Lấy tối đa 3 ảnh đầu tiên, gán nhãn lần lượt là `front`, `side`, `back`. Gọi `ingest_image(save_to_db=True)`.
  - Các ảnh từ thứ 4 trở đi, gán nhãn là `extra_1`, `extra_2`... Gọi `ingest_image(save_to_db=False)`.
  - Cập nhật RAG và trả về kết quả.

#### [NEW] `backend/tests/api/test_bulk_register.py`
- Viết test cho API mới, kiểm tra các luồng: `dry_run`, `skip_existing`, lưu đủ 3 ảnh đầu và chỉ nạp vector cho các ảnh dư.

---

## 2. Giao diện Frontend

#### [MODIFY] `frontend/app/admin/register/page.tsx`
- Bổ sung thanh Tab (Segmented Control) để chuyển đổi giữa 2 chế độ: **Đăng ký đơn** và **Đăng ký hàng loạt**.
- Chế độ "Đăng ký hàng loạt" sẽ có các thành phần:
  - Ô input 1 (Thư mục ảnh): Dùng `<input type="file" webkitdirectory directory multiple />`. Folder gốc chứa nhiều subfolder (tên subfolder = tên hiện vật), trong subfolder chứa ảnh.
  - Ô input 2 (File JSON): Tải lên file JSON mô tả (Định dạng: `{"Tên hiện vật 1": "Mô tả 1", ...}`).
  - Các checkbox tùy chọn: `[ ] Dry run (Chỉ chạy thử)` và `[ ] Skip existing (Bỏ qua hiện vật đã có)`.
  - Nút "Bắt đầu đăng ký".
- Logic Frontend:
  - Khi người dùng bấm bắt đầu, Frontend nhóm các ảnh theo đường dẫn `webkitRelativePath`.
  - Đối chiếu tên subfolder với file JSON để lấy mô tả. Nếu thiếu mô tả hoặc thiếu ảnh -> Báo lỗi cho hiện vật đó.
  - Chạy vòng lặp gọi API `bulk-register-item` cho từng hiện vật hợp lệ.
  - Hiển thị danh sách kết quả trực quan (Thành công / Thất bại / Bỏ qua) cho từng hiện vật.

---

## 3. Quy trình thực hiện (TDD)
1. Viết test case Backend cho luồng bulk.
2. Sửa file `item_images.py` và `register_router.py`.
3. Chạy test Backend đảm bảo Pass hoàn toàn.
4. Triển khai giao diện Frontend và logic upload/gọi API tuần tự.
5. Kiểm tra thực tế trên ứng dụng.

> [!IMPORTANT]  
> Xin bạn hãy xem qua kế hoạch này. Nếu mọi thứ đã hợp lý, hãy phê duyệt để mình bắt đầu viết code ngay!
