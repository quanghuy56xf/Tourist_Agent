# Kế hoạch & Hướng dẫn: Deploy Cloud (Cloudflare & VM Hosting)

Dự án gồm **2 phần** với yêu cầu tài nguyên khác nhau:

| Phần | Cloudflare được? | Lý do | Phương án Triển khai |
|------|------------------|-------|---------------------|
| **Frontend** (Next.js) | **Có** — Cloudflare Pages | Chỉ chứa HTML/JS/CSS tĩnh (Static Export) | Deploy lên Cloudflare Pages (Miễn phí) |
| **Backend** (FastAPI) | **Không** — Workers/Pages | DINOv2 + PyTorch cần ~1.5–2 GB RAM | Deploy lên Cloud VM/VPS chạy Python trực tiếp |

```
Người dùng
    ↓
Cloudflare Pages (Frontend - static hosting)
    ↓ HTTPS API
Cloud VM / VPS (Backend FastAPI - Python/uv)
    ↓
SQLite + Chroma + uploads (lưu trữ cục bộ trên VM)
```

---

## 1. Yêu cầu Môi trường & Hosting Khuyên Dùng

### Frontend (Next.js 14)
- **Nền tảng**: **Cloudflare Pages** (hoặc Vercel)
- **Chi phí**: Miễn phí (Free plan)
- **Hình thức**: Static HTML Export

### Backend AI (FastAPI + DINOv2)
- **Nền tảng**: **Oracle Cloud Always Free VM** (ARM Ampere, 24 GB RAM) hoặc bất kỳ VPS nào có tối thiểu 2 GB RAM (như DigitalOcean, Linode, AWS EC2, Google Compute Engine).
- **Chi phí**: Miễn phí (với Oracle Free tier) hoặc giá rẻ (~5-10$/tháng).
- **Môi trường chạy**: Python 3.10+ quản lý bằng công cụ `uv`.

> ⚠️ **Lưu ý**: Các nền tảng Serverless miễn phí như Render (bản Free - 512MB RAM), Vercel Serverless, hay Cloudflare Workers không đủ tài nguyên để tải model PyTorch DINOv2.

---

## 2. Deploy Frontend — Cloudflare Pages

### Bước 1: Chuẩn bị Static Export ở Local
Next.js hỗ trợ chế độ xuất tĩnh (Static Export). Hãy kiểm tra file [next.config.mjs](file:///d:/HocAI/Code%20Team60/frontend/next.config.mjs) ở local, đảm bảo đã cấu hình đúng cổng API. Để deploy lên Cloudflare, chúng ta sẽ thiết lập biến môi trường `NEXT_PUBLIC_API_URL` trỏ tới URL API thực tế của Backend.

### Bước 2: Push code lên GitHub
```bash
git init
git add .
git commit -m "Deploy chuẩn bị"
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

### Bước 3: Tạo dự án Cloudflare Pages
1. Truy cập [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Chọn kho lưu trữ GitHub của bạn.
3. Thiết lập thông số Build:
   - **Framework preset**: `Next.js (Static HTML Export)`
   - **Build command**: `npm run build` (hoặc `npm run build:static`)
   - **Build output directory**: `frontend/out` (nếu đặt thư mục gốc Next.js ở subdirectory `frontend`) hoặc `out`.
   - **Root directory**: `frontend`
4. Thêm các Biến Môi Trường (Environment Variables):
   - `NEXT_PUBLIC_API_URL`: Điền link URL Backend của bạn (ví dụ: `https://api.yourdomain.com`).
   - `NODE_VERSION`: `20`
5. Nhấn **Save and Deploy**. Cloudflare sẽ tự động tải source code và build ra trang tĩnh.

---

## 3. Deploy Backend — Cloud VM / VPS

Dưới đây là hướng dẫn cài đặt trực tiếp trên một máy chủ Linux (Ubuntu) sử dụng công cụ `uv`.

### Bước 1: Cài đặt Python và uv trên VM
Kết nối SSH vào máy chủ VPS của bạn và chạy các lệnh:
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt các thư viện bổ sung cần thiết cho xử lý ảnh (OpenCV/DINOv2)
sudo apt install -y curl git python3-pip python3-venv libgl1 libglib2.0-0

# Cài đặt công cụ quản lý uv siêu tốc của Astral
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
```

### Bước 2: Clone Code và Cài đặt dependencies
```bash
git clone https://github.com/<username>/<repo-name>.git
cd <repo-name>/backend

# Đồng bộ hóa môi trường ảo và cài đặt tất cả thư viện tự động qua uv
uv sync
```

### Bước 3: Cấu hình biến môi trường (`.env`)
Tạo file `.env` trên VPS:
```bash
cp .env.example .env
nano .env
```
Cấu hình các giá trị cần thiết:
```env
GOOGLE_API_KEY=your-gemini-api-key
LLM_MODEL=gemini-2.5-flash
MODEL_WARMUP_ENABLED=true

# Địa chỉ URL của Frontend chạy trên Cloudflare Pages (dùng cho CORS bảo mật)
CORS_ORIGINS=https://your-frontend-app.pages.dev
CORS_ALLOW_ALL=false

# Cấu hình admin đăng nhập
ADMIN_AUTH_ENABLED=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password-here
```

### Bước 4: Chạy Backend bằng Systemd (Vận hành lâu dài)
Để đảm bảo Backend tự động khởi chạy lại khi server restart hoặc khi gặp lỗi, ta cấu hình nó chạy dưới dạng một Systemd Service.

Tạo file service:
```bash
sudo nano /etc/systemd/system/hera-backend.service
```
Nhập nội dung sau (thay thế `/home/ubuntu/<repo-name>` bằng đường dẫn thực tế trên VPS của bạn):
```ini
[Unit]
Description=HERA Backend FastAPI Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/<repo-name>/backend
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=/home/ubuntu/<repo-name>/backend/.env

[Install]
WantedBy=multi-user.target
```

Kích hoạt và khởi chạy dịch vụ:
```bash
sudo systemctl daemon-reload
sudo systemctl enable hera-backend
sudo systemctl start hera-backend

# Kiểm tra trạng thái hoạt động
sudo systemctl status hera-backend
```

---

## 4. Reverse Proxy & HTTPS cho Backend (Nginx)

Để Frontend trên HTTPS gọi được vào Backend, Backend cũng phải sử dụng HTTPS. Chúng ta sử dụng Nginx làm reverse proxy và cài đặt SSL miễn phí với Let's Encrypt.

### Bước 1: Cài đặt Nginx
```bash
sudo apt install -y nginx
```

### Bước 2: Cấu hình Server Block
Tạo cấu hình virtual host:
```bash
sudo nano /etc/nginx/sites-available/hera-api
```
Nội dung cấu hình:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com; # Thay bằng subdomain/domain thực tế

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Tăng kích thước tối đa cho upload ảnh/tài liệu hiện vật
        client_max_body_size 50M;
    }
}
```
Kích hoạt config và restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/hera-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Bước 3: Cài đặt SSL Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```
Certbot sẽ tự động đăng ký và cấu hình chứng chỉ SSL HTTPS cho subdomain của bạn.

---

## 5. Ước tính tài nguyên trên VPS

| Resource | Giá trị ước lượng | Ghi chú |
|----------|---------|---------|
| RAM trống cần cho Backend | 1.5 – 2 GB | Tốn chủ yếu do DINOv2 load vào PyTorch CPU |
| Disk space | ~5 - 10 GB | Bao gồm Python, virtual environment và dữ liệu hiện vật/ảnh |
| CPU | 1 - 2 Cores | Đủ tốt cho việc xử lý ảnh đơn lẻ và sinh RAG |
