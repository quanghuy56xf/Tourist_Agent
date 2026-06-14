# Kế hoạch triển khai cải thiện codebase

> **Dành cho agent thực thi:** dùng `superpowers:executing-plans` và thực hiện lần lượt từng tác vụ.

**Mục tiêu:** Khép lại các lỗi test, ổn định state frontend, bổ sung regression test và cập nhật tài liệu theo thiết kế đã duyệt.

**Kiến trúc:** Giữ nguyên kiến trúc hiện tại. Chỉ tách logic thuần cần kiểm thử thành helper nhỏ, sửa test setup để phản ánh dependency production và cập nhật cache contract theo hành vi đã chốt.

**Công nghệ:** FastAPI, pytest, Next.js 14, TypeScript, Node test runner.

---

### Tác vụ 1: Khóa hành vi cache và RAG bằng regression test

**Tệp:**
- Sửa: `backend/tests/api/test_group_documents_integration.py`
- Sửa: `backend/tests/unit/test_item_lifecycle.py`

- [x] Đổi test cache thành yêu cầu hash nội dung AI thay đổi theo `knowledge_version`.
- [x] Thêm test xác minh hash nội dung thủ công không đổi theo `knowledge_version`.
- [x] Khởi tạo `_index_lock` trong fixture RAG dùng `__new__`.
- [x] Chạy riêng các test trên và xác nhận đều qua.

### Tác vụ 2: Thêm helper và test frontend

**Tệp:**
- Tạo: `frontend/lib/similarity.ts`
- Tạo: `frontend/tests/i18n.test.ts`
- Tạo: `frontend/tests/similarity.test.ts`
- Tạo: `frontend/tests/cameraOrientation.test.ts`
- Sửa: `frontend/app/item/[id]/page.tsx`
- Sửa: `frontend/package.json`

- [x] Viết test cho locale, similarity và camera helpers.
- [x] Chạy test để xác nhận helper similarity chưa tồn tại.
- [x] Thêm helper similarity và dùng tại trang chi tiết.
- [x] Thêm script `test` dùng Node test runner.
- [x] Chạy toàn bộ test frontend.

### Tác vụ 3: Sửa vòng đời object URL và React hooks

**Tệp:**
- Sửa: `frontend/app/scan/page.tsx`
- Sửa: `frontend/components/ItemsManagementPanel.tsx`

- [x] Theo dõi URL ảnh hiện tại bằng ref và giải phóng khi thay thế, lỗi, reset hoặc unmount.
- [x] Chuyển các helper reset story thành `useCallback`.
- [x] Khai báo dependency đầy đủ cho các effect liên quan.
- [x] Chạy lint/build để xác nhận không còn cảnh báo hook.

### Tác vụ 4: Cập nhật tài liệu

**Tệp:**
- Sửa: `need improve.md`
- Sửa: `README.md`

- [x] Đánh dấu similarity động là hoàn tất.
- [x] Thêm checklist camera thật cho iOS/Android và VI/EN.
- [x] Sửa liên kết kiến trúc và API sang các đường dẫn đang tồn tại.

### Tác vụ 5: Xác minh toàn bộ

- [x] Chạy `pytest -m "not integration" -q` trong `backend`.
- [x] Chạy `npm.cmd test` trong `frontend`.
- [x] Chạy `npm.cmd run build` trong `frontend`.
- [x] Kiểm tra diff để bảo đảm không ghi đè thay đổi không liên quan.
