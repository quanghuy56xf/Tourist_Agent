# Dynamic Minimap Configuration

Chuyển đổi cấu hình minimap từ việc hardcode trong file `minimapConfig.ts` sang việc lưu trữ linh hoạt (dynamic) trên Database. Cấu hình sẽ được người quản trị (Admin) upload thông qua file JSON trên giao diện Web. Hệ thống sẽ tự động đối chiếu `itemNames` thành `itemIds` để loại bỏ hoàn toàn lỗi conflict ID giữa các môi trường (Local, Staging, VM).

## Preloading Strategy

Để đảm bảo trải nghiệm mượt mà không có độ trễ, cấu hình Minimap sẽ được chạy ngầm để tải trước (prefetch) ngay khi người dùng mở trang (tại `MinimapButton.tsx`). Khi người dùng bấm mở Modal, cấu hình đã sẵn sàng và hiển thị lập tức như phiên bản đồng bộ cũ.

## Cấu trúc Template Mặc Định

Nếu một khu di tích chưa từng có bản đồ, khi Admin bấm tải về template mẫu, Backend sẽ sinh ra file JSON mẫu có nội dung mặc định là "Cổng chính" để định hướng cách thức hoạt động.

## Proposed Changes

---

### Database & Models

#### [MODIFY] [backend/app/models/group.py](file:///d:/ai_project/C2-App-060/backend/app/models/group.py)
- Import `JSON` từ `sqlalchemy`.
- Thêm cột `minimap_config`: `Mapped[dict | list | None] = mapped_column(JSON, nullable=True)` vào model `Group`.

#### [MODIFY] [backend/app/core/database.py](file:///d:/ai_project/C2-App-060/backend/app/core/database.py)
- Cập nhật hàm `_migrate_schema` để thêm cột `minimap_config` kiểu JSON vào bảng `groups` bằng lệnh `ALTER TABLE` nếu cột chưa tồn tại.

---

### Backend API

#### [MODIFY] [backend/app/schemas/group.py](file:///d:/ai_project/C2-App-060/backend/app/schemas/group.py)
- Thêm `MinimapZoneConfig` (`zoneId`, `zoneName`, `x`, `y`, `itemNames`).
- Thêm `MinimapConfigPayload` (`imageSrc`, `zones`).

#### [MODIFY] [backend/app/modules/objects/groups_router.py](file:///d:/ai_project/C2-App-060/backend/app/modules/objects/groups_router.py)
- Thêm `GET /api/groups/{group_id}/minimap`:
  - Lấy `minimap_config` từ `Group`. Nếu None, trả về 404.
  - Lấy tất cả `Item` thuộc `group_id` này.
  - Tự động map `itemNames` (trong config) thành mảng `itemIds` (của server hiện hành) và thay thế trong response JSON để Client sử dụng.
- Thêm `PUT /api/groups/{group_id}/minimap`:
  - Nhận payload JSON từ Admin upload.
  - Kiểm tra quyền truy cập (require admin/manager).
  - Validate định dạng và lưu trực tiếp JSON gốc (với `itemNames`) vào cột `minimap_config` của `Group`.
- Thêm `GET /api/groups/{group_id}/minimap/template`:
  - Trả về đúng `minimap_config` đã lưu (không đổi sang ID) để Admin chỉnh sửa.
  - Nếu `minimap_config` null, trả về template mẫu chứa zone "Cổng chính" kèm hình ảnh demo.

---

### Frontend

#### [MODIFY] [frontend/lib/api.ts](file:///d:/ai_project/C2-App-060/frontend/lib/api.ts)
- Định nghĩa kiểu `MinimapConfig` và `MinimapZone`.
- Thêm hàm `getDynamicMinimapConfig(groupId: number)`.
- Thêm hàm `uploadMinimapConfig(groupId: number, payload: MinimapConfig)`.
- Thêm hàm `downloadMinimapTemplate(groupId: number)`.

#### [NEW] [frontend/components/admin/MinimapConfigPanel.tsx](file:///d:/ai_project/C2-App-060/frontend/components/admin/MinimapConfigPanel.tsx)
- Giao diện Panel Admin dành riêng cho cấu hình bản đồ.
- Hiển thị nút "Tải về JSON mẫu".
- Sử dụng thẻ `<input type="file" accept=".json" />` kết hợp FileReader để đọc file JSON và gửi payload lên Backend bằng `uploadMinimapConfig`.

#### [MODIFY] [frontend/app/admin/groups/page.tsx](file:///d:/ai_project/C2-App-060/frontend/app/admin/groups/page.tsx)
- Nhúng `<MinimapConfigPanel groupId={activeGroup.id} groupName={activeGroup.name} />` vào màn hình quản lý, ngay bên dưới `GroupDocumentsPanel`.

#### [MODIFY] [frontend/components/visitor/MinimapButton.tsx](file:///d:/ai_project/C2-App-060/frontend/components/visitor/MinimapButton.tsx)
- Sử dụng `useEffect` gọi `getDynamicMinimapConfig(groupId)` ngầm dưới background ngay lúc nút Minimap được render. Lưu vào State để truyền xuống Modal, đảm bảo modal mở lập tức không độ trễ.
- Thêm logic lấy `groupId` từ `localStorage.getItem(VISITOR_GROUP_ID_KEY)`.

#### [MODIFY] [frontend/components/visitor/MinimapModal.tsx](file:///d:/ai_project/C2-App-060/frontend/components/visitor/MinimapModal.tsx)
- Cập nhật Component để nhận cấu hình trực tiếp qua `props.config` thay vì import từ file TS.

#### [NEW] [frontend/lib/minimapState.ts](file:///d:/ai_project/C2-App-060/frontend/lib/minimapState.ts)
- Chuyển 4 hàm state của visitor (`rememberMinimapItem`, `readRememberedMinimapItem`, `hasUnreadMinimap`, `markMinimapSeen`) từ `minimapConfig.ts` sang file riêng này để không bị vướng logic cứng cũ.

#### [DELETE] [frontend/lib/minimapConfig.ts](file:///d:/ai_project/C2-App-060/frontend/lib/minimapConfig.ts)
- Xóa hoàn toàn file tĩnh cũ vì toàn bộ hệ thống đã chuyển sang logic API.

## Verification Plan

### Automated/Code Checks
- Đảm bảo Backend trả về schema chính xác cho cả Visitor (mang `itemIds`) và Template (mang `itemNames`).
- Đảm bảo API PUT Validate được dữ liệu rác.

### Manual Verification
1. Đăng nhập vào trang Admin, chọn 1 khu di tích (VD: Văn Miếu).
2. Tại bảng Cấu hình Minimap, bấm nút "Tải về JSON mẫu".
3. Thay đổi thông tin trong JSON, lưu file.
4. Bấm "Upload cấu hình JSON", chọn file vừa sửa. Cập nhật thành công.
5. Mở 1 cửa sổ ẩn danh vào App khách tham quan, khi hiện Modal Minimap kiểm tra xem data tải từ server có chuẩn không (và mở lên tức thì do đã pre-load ngầm).
6. Quét thử 1 hiện vật bất kỳ để kiểm tra icon định vị trên map nhảy chuẩn không.
