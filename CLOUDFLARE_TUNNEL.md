# Chạy Local + Cloudflare Tunnel

Tài liệu này hướng dẫn cách chạy toàn bộ ứng dụng trên máy tính cá nhân của bạn và expose ra internet thông qua **Cloudflare Tunnel** (HTTPS miễn phí, bảo mật tốt, ổn định hơn ngrok) để có thể tiến hành test tính năng camera quét hiện vật trực tiếp bằng điện thoại.

```
Internet (HTTPS)
      ↓
Cloudflare Tunnel (cloudflared)
      ↓
localhost:3000  →  Frontend (Next.js dev server)
                      ↓ proxy /api, /uploads
localhost:8000  →  Backend (FastAPI server)
```

---

## 🛠️ Yêu Cầu Chuẩn Bị

- **Đã chạy Backend ở local**: `http://localhost:8000` (FastAPI)
- **Đã chạy Frontend ở local**: `http://localhost:3000` (Next.js)
- **Cài đặt cloudflared**: Công cụ kết nối tunnel của Cloudflare.
  - Windows: Chạy lệnh `winget install Cloudflare.cloudflared` hoặc tải file exe từ [trang chủ Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

---

## 🚀 Cách 1 — Quick Tunnel (Nhanh nhất, không cần tài khoản/domain)

Đây là cách đơn giản nhất để tạo ra một đường dẫn HTTPS tạm thời dùng để test nhanh trên điện thoại.

### Bước 1: Khởi động hai server local
Đảm bảo cả backend (cổng 8000) và frontend (cổng 3000) đều đang hoạt động bình thường trên máy tính của bạn.

### Bước 2: Bật Tunnel trỏ về cổng Frontend (3000)
Mở một cửa sổ terminal mới và chạy lệnh:
```powershell
cloudflared tunnel --url http://localhost:3000
```

### Bước 3: Lấy đường dẫn và Trải Nghiệm
1. Ở các dòng log in ra màn hình, tìm dòng chứa URL có đuôi `.trycloudflare.com` (ví dụ: `https://something-random.trycloudflare.com`).
2. Nhập URL đó vào điện thoại (hoặc gửi qua tin nhắn/quét QR) để truy cập giao diện.
3. Khi bạn truy cập URL này, mọi yêu cầu `/api` hay `/uploads` của Frontend sẽ được proxy chính xác về Backend cục bộ (`http://localhost:8000`) thông qua cơ chế rewrite của Next.js chạy ở local cổng 3000.

*Lưu ý: URL Quick Tunnel là ngẫu nhiên và sẽ thay đổi mỗi khi bạn chạy lại lệnh.*

---

## 🌐 Cách 2 — Named Tunnel (Đường dẫn cố định, yêu cầu có Domain riêng)

Nếu bạn muốn sở hữu một đường dẫn cố định và chuyên nghiệp (ví dụ: `https://hera.yourdomain.com`), hãy làm theo các bước sau.

### Bước 1: Trỏ DNS Domain về Cloudflare
1. Đăng ký tài khoản miễn phí trên [Cloudflare](https://dash.cloudflare.com).
2. Thêm domain của bạn vào Cloudflare và thay đổi nameserver ở nhà đăng ký domain theo hướng dẫn của Cloudflare.
3. Chờ trạng thái DNS chuyển sang Active.

### Bước 2: Xác thực Cloudflared trên Máy tính
Mở CMD/PowerShell ở máy local và chạy lệnh:
```powershell
cloudflared tunnel login
```
Trình duyệt sẽ tự động mở ra, bạn chọn domain muốn cấp quyền quản lý cho cloudflared.

### Bước 3: Tạo Named Tunnel
Tạo một tunnel mới đặt tên là `hera-tunnel`:
```powershell
cloudflared tunnel create hera-tunnel
```
Lệnh này sẽ sinh ra một **Tunnel ID** và lưu trữ file credentials tại thư mục `C:\Users\<Tên_User>\.cloudflared\<TUNNEL_ID>.json`.

### Bước 4: Tạo cấu hình định tuyến DNS
Trỏ subdomain mong muốn về Tunnel vừa tạo:
```powershell
cloudflared tunnel route dns hera-tunnel app.yourdomain.com
```

### Bước 5: Viết file Cấu Hình `config.yml`
Tạo một thư mục đặt tên là `cloudflared` ở thư mục gốc của dự án và tạo file `cloudflared/config.yml` với nội dung:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Bước 6: Chạy Named Tunnel
Chạy lệnh sau để kích hoạt đường truyền cố định:
```powershell
cloudflared tunnel --config cloudflared/config.yml run
```
Bây giờ, bạn có thể truy cập dự án ổn định tại `https://app.yourdomain.com` bất cứ khi nào server local của bạn đang bật.

---

## 💡 Các Script Tiện Ích Sẵn Có

Dự án cung cấp sẵn các script PowerShell trong thư mục `scripts/` giúp tự động hóa quá trình chạy:

1. **Khởi chạy Tunnel nhanh**:
   ```powershell
   .\scripts\start-cloudflare-tunnel.ps1
   ```
   Script sẽ kiểm tra cổng 3000 và cho phép bạn chọn nhanh giữa **Quick Tunnel (1)** hoặc **Named Tunnel (2)**.

2. **Cấu hình tự động Named Tunnel**:
   ```powershell
   .\scripts\setup-named-tunnel.ps1
   ```
   Tự động đăng nhập, tạo tunnel, trỏ DNS và tạo file `config.yml` chỉ sau vài lượt nhập tham số đơn giản.
