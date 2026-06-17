# Hướng dẫn chạy dự án thủ công (Manual Run)

Tài liệu này hướng dẫn cách chạy từng thành phần của hệ thống một cách thủ công trên máy tính (không dùng Docker) và cách đưa ứng dụng lên Internet để test trên điện thoại thông qua Cloudflare Tunnel.

---

## 1. Chạy Backend (FastAPI)

Backend cung cấp API, giao tiếp với Database, tìm kiếm ảnh và RAG. Bạn cần bật một Terminal/PowerShell mới.

```powershell
# 1. Khởi tạo file biến môi trường ở thư mục gốc (nếu chưa có)
copy .env.example .env

# 2. Di chuyển vào thư mục backend
cd backend

# 3. Tạo môi trường và cài đặt thư viện bằng uv
uv sync

# 4. Khởi chạy server Backend bằng uv
uv run uvicorn app.main:app --reload --port 8000
```
> **Lưu ý:**
> - Nếu bạn muốn dùng tính năng AI tạo sinh, nhớ mở file `.env` ở thư mục gốc và cung cấp `GOOGLE_API_KEY` (hoặc key tương ứng nếu cấu hình sử dụng LLM khác).
> - Backend sẽ load biến môi trường từ file `.env` ở gốc dự án.
> - Backend sẽ chạy tại: `http://localhost:8000`
> - Giao diện API Docs (Swagger): `http://localhost:8000/docs`

---

## 2. Chạy Frontend (Next.js)

Frontend cung cấp giao diện người dùng. Bạn cần mở thêm một Terminal/PowerShell thứ 2 (để Backend vẫn tiếp tục chạy).

```powershell
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt các thư viện Node.js
npm install

# 3. Khởi chạy server Frontend ở chế độ phát triển
npm run dev
```
> **Lưu ý:**
> - Frontend sẽ chạy tại: `http://localhost:3000`
> - Quá trình kết nối proxy tự động gọi API tới `http://localhost:8000` của Backend.

---

## 3. Chạy Cloudflare Tunnel (Để test trên điện thoại)

Khi test các tính năng như "Chụp ảnh trên điện thoại", hệ thống đòi hỏi phải có giao thức **HTTPS**. Cloudflare Tunnel sẽ giúp public port `3000` của máy tính bạn ra ngoài Internet bằng HTTPS hoàn toàn miễn phí.

Mở Terminal/PowerShell thứ 3:

### Bước 3.1: Cài đặt Cloudflared (Nếu máy chưa có)
```powershell
winget install Cloudflare.cloudflared
```
*(Nếu cài đặt xong báo lỗi không nhận lệnh `cloudflared`, bạn hãy tắt hẳn và mở lại cửa sổ PowerShell mới).*

### Bước 3.2: Mở Quick Tunnel
Đảm bảo rằng Frontend vẫn đang chạy ở port 3000. Chạy lệnh sau:
```powershell
cloudflared tunnel --url http://localhost:3000
```

### Bước 3.3: Lấy đường dẫn (URL) và Test
- Trong màn hình Terminal vừa chạy lệnh, tìm dòng có đuôi `.trycloudflare.com` (ví dụ: `https://random-words.trycloudflare.com`).
- Lấy điện thoại quét mã QR hoặc gõ đường dẫn đó vào trình duyệt Safari/Chrome trên điện thoại.
- Bây giờ bạn có thể trải nghiệm đầy đủ tính năng quét ảnh bằng camera của điện thoại!

> ⚠️ **Chú ý quan trọng:** 
> - URL này là tạm thời và sẽ thay đổi mỗi khi bạn tắt đi bật lại lệnh Cloudflare Tunnel.
> - Máy tính của bạn phải luôn bật và giữ cho 3 Terminal (Backend, Frontend, Cloudflare) cùng hoạt động.
