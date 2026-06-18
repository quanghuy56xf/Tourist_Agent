# Thiết kế luồng persona cho khách tham quan HERA

## Mục tiêu

Giảm số quyết định người dùng phải thực hiện trước khi có thể quét hoặc tải ảnh,
đồng thời vẫn hỗ trợ cá nhân hóa nội dung khi khách có nhu cầu.

Sau khi chọn khu di tích, khách được đưa thẳng đến trang chọn phương thức khám
phá hiện tại. HERA mặc định sử dụng persona dành cho khách phổ thông và cho phép
đổi persona mà không tạo thêm một bước thiết lập bắt buộc.

Giữ nguyên theme, màu sắc, kiểu chữ, cách trình bày thẻ, khoảng cách và nhận diện
thương hiệu hiện tại. Mockup đã duyệt chỉ mô tả thứ bậc thông tin và luồng điều
hướng, không phải đề xuất thay đổi giao diện trực quan.

## Các quyết định sản phẩm

- Bỏ màn hình bắt buộc chọn persona khỏi hành trình của khách.
- Hiển thị persona mặc định là `Phổ thông` khi dùng tiếng Việt và `General` khi
  dùng tiếng Anh.
- Giữ giá trị backend là `Mặc định` để không phải chuyển đổi cơ sở dữ liệu hoặc
  bộ nhớ đệm nội dung.
- Các persona tùy chọn gồm:
  - `Phổ thông` / `General` → giá trị backend `Mặc định`
  - `Trẻ em / Gia đình` / `Children / Family` → giá trị backend
    `Family Visitor`
  - `Gen Z` / `Gen Z` → giá trị backend `Gen Z Explorer`
- Không tạo persona riêng cho khách quốc tế. Ngôn ngữ quyết định ngôn ngữ đầu
  ra; persona quyết định giọng kể, độ phức tạp và phong cách trình bày.
- Ngôn ngữ và persona hoạt động độc lập. Mọi persona đều dùng được với tiếng
  Việt và tiếng Anh.

## Hành trình khách tham quan

Luồng chính mới:

```text
Chọn khu di tích
→ khởi tạo lượt tham quan mới với persona Phổ thông
→ mở trang phương thức khám phá
→ quét ảnh, tải ảnh hoặc chọn tour
→ xem nội dung hiện vật
```

Trang chủ của khu di tích không còn hỏi `Tôi là...` và không yêu cầu chọn
persona trước khi tiếp tục. Khi chọn một khu di tích, người dùng được chuyển
thẳng đến trang phương thức khám phá của khu đó.

Trang phương thức tiếp tục giữ ba lựa chọn chính:

- Quét hiện vật bằng camera
- Tải ảnh có sẵn
- Bắt đầu tour khám phá

Persona là tùy chọn phụ và không được cản trở các thao tác chính này.

## Bộ chọn tùy chỉnh

Thêm bộ chọn persona dạng gọn bên cạnh bộ chọn ngôn ngữ `VI | EN` ở góc trên
bên phải của trang phương thức khám phá.

Các bộ chọn sử dụng theme và phong cách điều khiển hiện tại của HERA. Không tạo
theme hoặc hệ thống thiết kế mới.

Bộ chọn persona:

- Ban đầu hiển thị `Phổ thông` hoặc `General`.
- Mở danh sách ba persona khi được chạm vào.
- Cập nhật persona đang dùng ngay sau khi chọn.
- Hiển thị nhãn theo ngôn ngữ giao diện nhưng lưu giá trị backend ổn định.
- Hoàn toàn không bắt buộc; khách có thể bỏ qua và bắt đầu khám phá ngay.

Đổi ngôn ngữ không làm thay đổi persona. Đổi persona không làm thay đổi ngôn
ngữ.

## Thời hạn lưu tùy chọn

Ngôn ngữ và persona có quy tắc lưu khác nhau.

### Ngôn ngữ

Tiếp tục lưu ngôn ngữ trong `localStorage`. Khách dùng cùng trình duyệt trên
điện thoại cá nhân có thể giữ tùy chọn tiếng Việt hoặc tiếng Anh sau khi đóng
trình duyệt và trong những lần truy cập sau.

### Persona

Lưu persona đang dùng trong `sessionStorage`, không lưu trong `localStorage`.

- Persona được giữ khi chuyển giữa trang phương thức, quét ảnh, kết quả tải
  ảnh, nội dung hiện vật và tour.
- Persona vẫn được giữ khi tải lại trang trong cùng tab.
- Persona không được xem là hồ sơ dài hạn của khách.
- Mỗi lần chọn một khu di tích sẽ bắt đầu lượt tham quan mới và đặt lại persona
  thành giá trị backend `Mặc định`.
- Nếu khách mở trực tiếp một trang con mà chưa có persona trong phiên, HERA dùng
  `Mặc định`.

Trình duyệt có thể khôi phục tab sau sự cố hoặc khởi động lại, vì vậy không dùng
riêng `sessionStorage` để xác định khách quay lại. Hành động chọn khu di tích là
mốc rõ ràng bắt đầu một lượt tham quan mới.

## Luồng dữ liệu

```text
Khách chọn khu di tích
→ ghi Mặc định vào sessionStorage
→ chuyển thẳng đến /[groupSlug]/method
→ nếu đổi persona, cập nhật sessionStorage
→ các trang quét ảnh, tải ảnh và tour dùng chung phiên của tab
→ trang hiện vật và chat đọc persona từ sessionStorage
→ frontend gửi persona và ngôn ngữ ổn định đến API hiện tại
→ backend chọn hoặc sinh biến thể nội dung tương ứng
```

Việc chuẩn hóa ở backend và giá trị mặc định hiện tại tiếp tục là lớp bảo vệ khi
persona bị thiếu hoặc không hợp lệ.

## Thống kê ẩn danh

Không tạo tài khoản khách, hồ sơ lâu dài, dấu vân tay thiết bị hoặc lịch sử liên
kết qua nhiều lượt tham quan trong phạm vi thay đổi này.

Hệ thống có thể ghi nhận các sự kiện sử dụng sản phẩm ẩn danh như:

- Khu di tích được chọn
- Ngôn ngữ đang dùng tại thời điểm phát sinh sự kiện
- Persona đang dùng tại thời điểm phát sinh sự kiện
- Phương thức khám phá được chọn
- Hiện vật được xem
- Tour được bắt đầu hoặc hoàn thành

Các sự kiện có thể dùng mã lượt tham quan hoặc mã phiên ẩn danh hiện tại để nhóm
các thao tác trong cùng trải nghiệm. Không lưu tên, email, số điện thoại, mã
quảng cáo hoặc định danh nhằm nhận ra cùng một người trong những lần truy cập
sau.

## Tương thích và chuyển đổi

Một số trình duyệt có thể đang lưu `user_persona` trong `localStorage` từ phiên
bản hiện tại. Luồng mới phải bỏ qua và xóa giá trị cũ này để lựa chọn trước đây
không vô tình trở thành sở thích dài hạn.

Các biến thể nội dung backend hiện có vẫn hợp lệ vì giá trị persona ổn định
không thay đổi. Chỉ nhãn hiển thị và cách lưu tùy chọn ở frontend thay đổi.

## Xử lý lỗi và phương án dự phòng

- Persona trong phiên bị thiếu, sai định dạng hoặc không được hỗ trợ → dùng
  `Mặc định`.
- Không thể sử dụng `sessionStorage` → giữ `Mặc định` trong bộ nhớ của trang
  hiện tại và không chặn hành trình khám phá.
- Thiếu biến thể nội dung theo persona/ngôn ngữ → giữ nguyên cơ chế sinh và dự
  phòng hiện tại của backend.
- Không có ngôn ngữ đã lưu → tiếp tục dùng tiếng Việt mặc định.
- Lỗi ở bộ chọn tùy chỉnh không được ngăn khách dùng camera, tải ảnh hoặc tour.

## Chiến lược kiểm thử

### Kiểm thử tự động frontend

- Chọn khu di tích sẽ chuyển thẳng đến `/<groupSlug>/method`.
- Mỗi lần chọn khu di tích sẽ đặt lại persona thành `Mặc định`.
- Không còn màn hình bắt buộc chọn persona.
- Trang phương thức hiển thị bộ chọn ngôn ngữ và persona với nhãn đã bản địa
  hóa.
- Persona mặc định hiển thị là `Phổ thông` trong tiếng Việt và `General` trong
  tiếng Anh.
- Thay đổi persona được ghi vào `sessionStorage`.
- Persona được giữ khi chuyển trang và tải lại trang trong cùng phiên.
- Persona không được ghi vào `localStorage`.
- Giá trị cũ `localStorage.user_persona` được xóa và bỏ qua.
- Persona thiếu hoặc không hợp lệ sẽ trở về `Mặc định`.
- Đổi ngôn ngữ giữ nguyên persona và đổi persona giữ nguyên ngôn ngữ.
- API nội dung hiện vật và chat nhận đúng persona cùng ngôn ngữ đã chọn.

### Kiểm thử hồi quy backend

- Các giá trị persona và cơ chế chuẩn hóa hiện tại tiếp tục hoạt động.
- `Mặc định` tiếp tục là giá trị mặc định của API.
- Cả ba persona tiếp tục dùng được với tiếng Việt và tiếng Anh.
- Không tạo persona backend mới dành riêng cho khách quốc tế.

### Kiểm tra thủ công

- Xác nhận theme hiện tại không thay đổi về mặt trực quan.
- Chọn khu di tích và xác nhận trang phương thức mở ngay.
- Quét ảnh mà không chạm vào persona và xác nhận nội dung Phổ thông được dùng.
- Đổi persona, quét hoặc tải ảnh và xác nhận nội dung hiện vật cùng chat sử dụng
  đúng phong cách đã chọn.
- Chuyển giữa tiếng Việt và tiếng Anh, xác nhận persona không thay đổi.
- Bắt đầu lượt tham quan mới bằng cách chọn lại khu di tích và xác nhận persona
  trở về Phổ thông.
- Xác nhận dữ liệu thống kê chỉ chứa sự kiện sản phẩm, không có định danh cá
  nhân.

## Tiêu chí nghiệm thu

- Persona không còn là bước bắt buộc trong hành trình của khách.
- Chọn khu di tích sẽ mở thẳng trang phương thức khám phá.
- Nội dung Phổ thông được dùng khi khách không chọn persona.
- Bộ chọn persona gọn được đặt cạnh bộ chọn ngôn ngữ.
- Theme trực quan hiện tại của HERA được giữ nguyên.
- Persona chỉ được giữ trong lượt tham quan hiện tại và đặt lại khi chọn khu di
  tích cho lượt mới.
- Ngôn ngữ tiếp tục được ghi nhớ lâu dài trên trình duyệt như hiện tại.
- Không tạo lịch sử lâu dài theo từng cá nhân.
- Thống kê ẩn danh có thể ghi nhận ngôn ngữ, persona, phương thức và lượt xem
  hiện vật.
- Các biến thể persona và bộ nhớ đệm nội dung backend hiện có vẫn tương thích.
