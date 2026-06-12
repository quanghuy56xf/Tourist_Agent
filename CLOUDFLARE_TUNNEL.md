# Docker local + Cloudflare Tunnel

Chạy **toàn bộ app bằng Docker trên máy cá nhân**, expose ra internet qua **Cloudflare Tunnel** (HTTPS miễn phí, ổn định hơn ngrok).

```
Internet (HTTPS)
      ↓
Cloudflare Tunnel (cloudflared)
      ↓
localhost:3000  →  frontend container (Next.js)
                         ↓ proxy /api, /uploads
                   backend container (FastAPI + DINOv2)
                         ↓
                   Docker volumes (data + uploads)
```

---

## Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows)
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
- Internet (lần đầu tải model DINOv2)

---

## Cách 1 — Quick Tunnel (nhanh nhất, không cần domain)

### Bước 1: Cài cloudflared

```powershell
winget install Cloudflare.cloudflared
```

### Bước 2: Khởi động Docker

```powershell
cd D:\HocAI\TestDinoV2
.\scripts\start-docker.ps1
```

Lần đầu build ~10–15 phút (PyTorch). Sau đó:

| Dịch vụ | URL local |
|---------|-----------|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

### Bước 3: Mở Cloudflare Tunnel

```powershell
.\scripts\start-cloudflare-tunnel.ps1
# Chọn 1 (Quick Tunnel)
```

Script in URL dạng:

```
https://random-words.trycloudflare.com
```

Mở URL đó từ **điện thoại / máy khác** — dùng web đầy đủ (đăng ký, quét, top 3).

**Lưu ý Quick Tunnel:**
- URL đổi mỗi lần chạy lại
- Máy bạn phải bật (Docker + cloudflared)
- Miễn phí, không cần tài khoản Cloudflare

---

## Cách 2 — Named Tunnel (URL cố định, cần domain)

### Cách nhanh — script tự động (khuyên dùng)

**Yêu cầu:** Bạn có domain đã add vào Cloudflare (DNS do Cloudflare quản lý).

```powershell
# 1. Docker dang chay
docker compose up -d

# 2. Setup domain co dinh (1 lan)
.\scripts\setup-named-tunnel.ps1
# Nhap domain: tenban.com
# Nhap subdomain: app  →  https://app.tenban.com

# 3. Khoi dong tunnel
.\scripts\start-cloudflare-tunnel.ps1
# Chon 2 (Named Tunnel)
```

### Cách thủ công

#### Bước 1: Tài khoản Cloudflare + domain

- Đăng ký https://dash.cloudflare.com
- **Add site** → nhập domain → đổi nameserver domain về Cloudflare
- Chờ DNS active (vài phút đến 24h)

#### Bước 2: Tạo tunnel

```powershell
cloudflared tunnel login
cloudflared tunnel create dinov2-app
cloudflared tunnel list    # lay Tunnel ID
```

#### Bước 3: Cấu hình DNS

```powershell
cloudflared tunnel route dns dinov2-app app.tenban.com
```

#### Bước 4: Tạo `cloudflared/config.yml`

```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<USER>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: app.tenban.com
    service: http://localhost:3000
  - service: http_status:404
```

#### Bước 5: Chạy

```powershell
docker compose up -d
.\scripts\start-cloudflare-tunnel.ps1   # chon 2
```

Truy cập: `https://app.tenban.com` — **URL co dinh, khong doi**

---

## Cách 3 — Tunnel token trong Docker (tự động hóa)

Dùng khi đã tạo tunnel trên Cloudflare Zero Trust Dashboard:

1. Vào **Networks → Tunnels → Create tunnel**
2. Chọn **Docker**, copy `TUNNEL_TOKEN`
3. Tạo file `.env` ở root project:

```env
TUNNEL_TOKEN=eyJhIjoi...
```

4. Trong Cloudflare Dashboard, cấu hình **Public Hostname**:
   - Service: `http://frontend:3000` (nếu chạy tunnel trong compose)
   - Hoặc `http://host.docker.internal:3000`

5. Chạy tất cả:

```powershell
docker compose --profile tunnel up -d --build
```

---

## Lệnh Docker thường dùng

```powershell
# Khởi động
docker compose up -d --build

# Xem log
docker compose logs -f backend
docker compose logs -f frontend

# Dừng
docker compose down

# Xóa data (reset database)
docker compose down -v
```

---

## Cấu trúc file Docker

```
TestDinoV2/
├── docker-compose.yml       # backend + frontend (+ cloudflared tùy chọn)
├── backend/Dockerfile       # FastAPI + DINOv2 + Chroma
├── frontend/Dockerfile      # Next.js standalone
├── cloudflared/
│   └── config.example.yml   # Named tunnel config
└── scripts/
    ├── start-docker.ps1
    └── start-cloudflare-tunnel.ps1
```

---

## So sánh với ngrok

| | Cloudflare Tunnel | ngrok free |
|---|---|---|
| HTTPS | Có | Có |
| URL cố định | Có (Named Tunnel + domain) | Không |
| Cần domain | Chỉ Named Tunnel | Không |
| Miễn phí | Có | Có |
| Ổn định | Tốt hơn | URL đổi liên tục |

---

## Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Build Docker lâu | Bình thường — PyTorch ~2 GB |
| Backend unhealthy | Đợi 1–2 phút (model DINOv2 đang load) |
| Tunnel không kết nối | Kiểm tra `docker compose ps`, frontend port 3000 |
| Ảnh không hiển thị | Frontend proxy `/uploads` — kiểm tra backend volume |
| Camera không hoạt động | Cần HTTPS — Cloudflare Tunnel có sẵn |
| Data mất | Kiểm tra volumes: `docker volume ls` |
