# Minimap MVP Design

## Goal

Khôi phục Minimap cho giao diện visitor sau khi code được force cập nhật. Minimap giúp khách xem khu vực gần nhất dựa trên hiện vật vừa mở, không thay đổi backend hoặc database.

## Scope

- Bản đồ tĩnh 2D theo từng `groupSlug`.
- Cấu hình khu vực và tọa độ phần trăm nằm ở frontend.
- Ghi nhớ hiện vật gần nhất bằng `localStorage`.
- Nút bản đồ nổi xuất hiện trên mọi trang visitor thuộc một khu di tích.
- Sau khi một hiện vật tải thành công, icon Minimap hiển thị chấm đỏ cho đến khi khách mở bản đồ.
- Modal hiển thị bản đồ, marker vị trí và trạng thái fallback.
- Khôi phục SVG placeholder cho Văn Miếu - Quốc Tử Giám.
- Có regression test cho config, storage, tích hợp layout, ghi nhớ item và accessibility cơ bản.

Không thuộc scope:

- Zoom/pan.
- Cấu hình Minimap từ Admin.
- Lưu cấu hình ở backend/database.
- Định vị GPS hoặc indoor positioning.
- Thay placeholder bằng bản đồ sản xuất.

## Architecture

### Configuration and storage

`frontend/lib/minimapConfig.ts` định nghĩa:

- `MinimapZone`: ID, tên khu vực, tọa độ `x/y` theo phần trăm và danh sách `itemIds`.
- `MinimapConfig`: `groupSlug`, tiêu đề, đường dẫn ảnh và danh sách khu vực.
- Hàm lấy config theo group.
- Hàm tìm khu vực theo item ID.
- Hàm tạo storage key `hera_last_item_${groupSlug}`.
- Hàm đọc/ghi item gần nhất, an toàn trong SSR và khi browser storage bị chặn.
- Hàm đọc/ghi trạng thái Minimap chưa xem theo từng groupSlug.

MVP chỉ cấu hình `van-mieu-quoc-tu-giam` với sáu khu vực mẫu.

### Visitor components

`MinimapButton.tsx`:

- Là client component.
- Lấy `groupSlug` từ route hiện tại.
- Hiển thị floating action button ở vùng dưới bên trái, tránh thanh điều hướng mobile.
- Quản lý trạng thái đóng/mở modal.
- Đọc trạng thái chưa xem và hiển thị chấm đỏ trên icon.
- Khi khách mở modal, đánh dấu Minimap đã xem và ẩn chấm đỏ.

`MinimapModal.tsx`:

- Chỉ render khi mở.
- Đọc item gần nhất từ storage mỗi lần mở.
- Lấy config và khu vực tương ứng.
- Hiển thị marker đỏ có hiệu ứng ping tại tọa độ phần trăm.
- Đóng bằng nút X, phím Escape hoặc click backdrop.
- Có `role="dialog"` và `aria-modal`.
- Hiển thị “Chưa xác định vị trí” nếu chưa có item phù hợp.
- Hiển thị thông báo bản đồ chưa khả dụng nếu group chưa có config.

### Integration

`frontend/app/[groupSlug]/layout.tsx` gắn đúng một `MinimapButton` bên trong visitor route guard để mọi trang của group đều truy cập được.

`frontend/app/[groupSlug]/item/[id]/page.tsx` gọi `rememberMinimapItem(groupSlug, itemId)` sau khi API `getItem()` trả thành công. Không ghi storage nếu item tải thất bại.

## Data flow

1. Visitor mở thành công trang chi tiết hiện vật.
2. Frontend lưu item ID theo group và đánh dấu Minimap chưa xem trong localStorage.
3. Icon Minimap hiển thị chấm đỏ để thu hút sự chú ý.
4. Visitor mở nút Minimap ở bất kỳ trang nào trong cùng group; trạng thái được đánh dấu đã xem và chấm đỏ biến mất.
5. Modal đọc item ID, tìm zone trong config và đặt marker lên ảnh.
6. Nếu không có storage, mapping hoặc config, modal hiển thị fallback tương ứng.

## Error handling

- Mọi thao tác `localStorage` được bọc `try/catch`.
- Hàm storage không chạy trong SSR.
- Item ID không hợp lệ không được lưu.
- Lỗi storage không làm hỏng trạng thái đóng/mở modal hoặc điều hướng visitor.
- Group không có config không làm crash layout.
- Item chưa được map không hiển thị marker.

## Testing

Regression test frontend kiểm tra:

- Các module và SVG cần thiết tồn tại.
- Config Văn Miếu có nhiều zone và ánh xạ item mẫu chính xác.
- Storage key có namespace theo group.
- Layout gắn đúng Minimap button.
- Trang item ghi nhớ item sau khi tải thành công.
- Button sở hữu trạng thái modal.
- Chấm đỏ xuất hiện sau khi ghi nhớ item và biến mất khi mở Minimap.
- Modal có fallback, marker ping và dialog semantics.

Sau triển khai chạy test Minimap riêng và TypeScript `--noEmit`; không cần chạy toàn bộ suite.