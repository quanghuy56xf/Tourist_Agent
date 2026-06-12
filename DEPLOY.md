# Kế hoạch: Docker + Deploy Cloud (Cloudflare & Free Hosting)

## Bối cảnh quan trọng

Dự án gồm **2 phần** với yêu cầu tài nguyên khác nhau:

| Phần | Cloudflare được? | Lý do |
|------|------------------|-------|
| **Frontend** (Next.js) | **Có** — Cloudflare Pages | Chỉ HTML/JS/CSS |
| **Backend** (FastAPI + DINOv2) | **Không** — Workers/Pages | PyTorch cần ~1.5–2 GB RAM |

**Kết luận:** Deploy **tách 2 phần** — frontend lên Cloudflare, backend lên host khác hỗ trợ Docker/RAM đủ.

```
Người dùng
    ↓
Cloudflare Pages (frontend FREE)
    ↓ HTTPS API
Hugging Face Spaces / Oracle VM (backend)
    ↓
SQLite + Chroma + uploads (volume)
```

---

## Phương án free được khuyến nghị

### Phương án A — Dễ nhất (khuyên dùng cho demo)

| Thành phần | Nền tảng | Chi phí |
|------------|----------|---------|
| Frontend | **Cloudflare Pages** | Free |
| Backend | **Hugging Face Spaces** (Docker) | Free CPU |

- HF Spaces hỗ trợ Docker, phù hợp ML
- RAM free ~16 GB — đủ DINOv2 (CPU)
- URL: `https://<user>-<space>.hf.space`

### Phương án B — Ổn định nhất (data không mất)

| Thành phần | Nền tảng |
|------------|----------|
| Full stack | **Oracle Cloud Always Free VM** (ARM, 24 GB RAM) |

- Chạy `docker-compose up` — backend + frontend + nginx
- Docker volumes — SQLite, Chroma, ảnh **không mất** khi restart
- Cloudflare DNS (free) + HTTPS

### Không khuyến nghị

| Nền tảng | Lý do |
|----------|-------|
| Render Free | 512 MB RAM — không đủ PyTorch |
| Cloudflare Workers | Không chạy PyTorch |
| Vercel serverless | Không chạy backend AI |

---

## 1. Cấu trúc Docker cần tạo

```
TestDinoV2/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .dockerignore
├── backend/
│   └── Dockerfile
├── frontend/
│   └── Dockerfile              # chỉ Phương án B
└── nginx/
    └── nginx.conf              # chỉ Phương án B
```

### `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim-bookworm

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
RUN mkdir -p data uploads

ENV DATABASE_URL=sqlite:///./data/app.db
ENV CHROMA_PATH=./data/chroma
ENV UPLOAD_DIR=./uploads

EXPOSE 8000
HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

> Image ~2–3 GB. Build lần đầu 10–15 phút.

### `docker-compose.yml`

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - backend_data:/app/data
      - backend_uploads:/app/uploads
    environment:
      - CORS_ORIGINS=https://your-app.pages.dev
      - CORS_ALLOW_ALL=false
      - SIMILARITY_THRESHOLD=0.75

volumes:
  backend_data:
  backend_uploads:
```

### `.dockerignore`

```
**/__pycache__
**/.venv
backend/data/
backend/uploads/
frontend/node_modules/
frontend/.next/
.git/
*.md
```

---

## 2. Thay đổi code trước khi deploy

### Frontend — tách dev vs production

Hiện tại `next.config.mjs` proxy `/api` → `127.0.0.1:8000` — **chỉ chạy local**.

| Môi trường | `NEXT_PUBLIC_API_URL` | Rewrites |
|------------|----------------------|----------|
| Local dev | *(trống)* | Có |
| Cloudflare Pages | `https://xxx.hf.space` | Không (static export) |
| Oracle VM | `https://api.domain.com` | Không |

**Cần thêm** trong `next.config.mjs`:

```js
const isStatic = process.env.BUILD_STATIC === "true";

const nextConfig = {
  output: isStatic ? "export" : undefined,
  async rewrites() {
    if (isStatic) return [];
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
      { source: "/uploads/:path*", destination: "http://127.0.0.1:8000/uploads/:path*" },
    ];
  },
};
```

**Script build Cloudflare** trong `package.json`:

```json
"build:static": "cross-env BUILD_STATIC=true next build"
```

### Backend — CORS production

```env
CORS_ORIGINS=https://your-app.pages.dev
CORS_ALLOW_ALL=false
```

### Hugging Face Spaces — đổi port

HF Spaces dùng port **7860**:

```dockerfile
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

---

## 3. Deploy Frontend — Cloudflare Pages

### Bước 1: Push code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<user>/TestDinoV2.git
git push -u origin main
```

### Bước 2: Tạo Cloudflare Pages project

1. Vào https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → Connect Git
2. Chọn repo GitHub

### Bước 3: Cấu hình build

| Setting | Giá trị |
|---------|--------|
| Root directory | `frontend` |
| Build command | `npm install && npm run build:static` |
| Build output directory | `out` |
| Node version | 20 |

### Bước 4: Biến môi trường

```
NEXT_PUBLIC_API_URL=https://<your-space>.hf.space
BUILD_STATIC=true
```

### Bước 5: Deploy

Cloudflare tự build và deploy. URL: `https://<project>.pages.dev`

---

## 4. Deploy Backend — Hugging Face Spaces

### Bước 1: Tạo Space

1. https://huggingface.co/new-space
2. SDK: **Docker**
3. Hardware: **CPU basic** (free)

### Bước 2: Cấu trúc repo Space

```
README.md          # metadata (title, emoji, colorFrom...)
Dockerfile         # từ backend/Dockerfile (port 7860)
requirements.txt   # từ backend/requirements.txt
app/               # copy toàn bộ backend/app/
```

### Bước 3: README.md metadata

```yaml
---
title: DINOv2 Object Search API
emoji: 🔍
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---
```

### Bước 4: Push & chờ build

```bash
git clone https://huggingface.co/spaces/<user>/<space-name>
# copy files, commit, push
```

Space tự build Docker image. Lần đầu tải DINOv2 ~2–5 phút.

### Bước 5: Lấy URL

`https://<user>-<space>.hf.space` — dùng làm `NEXT_PUBLIC_API_URL` trên Cloudflare.

### Lưu ý HF Spaces free

- **Data mất khi restart** Space (SQLite + Chroma + uploads)
- Cold start ~30–60 giây lần đầu
- Phù hợp demo; production dùng Oracle VM

---

## 5. Deploy Full Stack — Oracle Cloud (Phương án B)

### Tổng quan

```
Cloudflare DNS (free SSL)
        ↓
Oracle VM (ARM, 24 GB RAM, free)
  ├── nginx :443
  │     ├── /        → frontend:3000
  │     ├── /api     → backend:8000
  │     └── /uploads → backend:8000
  ├── frontend container
  ├── backend container
  └── Docker volumes (persistent data)
```

### Các bước

1. **Tạo VM** — Oracle Cloud → Always Free → ARM Ampere (4 OCPU, 24 GB)
2. **Cài Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
3. **Clone & chạy:**
   ```bash
   git clone https://github.com/<user>/TestDinoV2.git
   cd TestDinoV2
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. **Nginx** — reverse proxy HTTPS (Let's Encrypt hoặc Cloudflare proxy)
5. **Cloudflare DNS** — trỏ A record về IP VM, bật proxy (orange cloud)

**Ưu điểm:** Một domain, data persistent, không cold-start.

---

## 6. So sánh phương án

| Tiêu chí | A: CF Pages + HF Spaces | B: Oracle VM |
|----------|-------------------------|--------------|
| Chi phí | Free | Free |
| Độ khó | Trung bình | Khó hơn |
| Data persistent | Không | Có |
| Cold start | ~30–60s | Không |
| HTTPS | Có sẵn | Qua Cloudflare |
| Phù hợp | Demo, học tập | Production nhỏ |

---

## 7. Thứ tự triển khai (checklist)

```
1. Tạo backend/Dockerfile
       ↓
2. Test docker build local
   docker compose up --build
       ↓
3. Deploy backend → Hugging Face Spaces
   Lấy URL: https://xxx.hf.space
       ↓
4. Cấu hình frontend static export
   BUILD_STATIC=true, bỏ rewrites
       ↓
5. Deploy frontend → Cloudflare Pages
   NEXT_PUBLIC_API_URL = URL HF Spaces
       ↓
6. Cập nhật CORS backend = URL Cloudflare Pages
       ↓
7. Test E2E: đăng ký → quét → top 3
       ↓
8. (Tùy chọn) Nâng cấp Oracle VM nếu cần data lâu dài
```

- [ ] `backend/Dockerfile` + `.dockerignore`
- [ ] `docker-compose.yml` — test local
- [ ] Frontend `build:static` + `next.config.mjs` production
- [ ] Deploy HF Spaces — lấy backend URL
- [ ] Deploy Cloudflare Pages — set `NEXT_PUBLIC_API_URL`
- [ ] `CORS_ORIGINS` = URL Cloudflare Pages
- [ ] Test E2E trên mobile (camera cần HTTPS)
- [ ] (Tùy chọn) Oracle VM + nginx + volumes

---

## 8. Ước tính tài nguyên

| Resource | Giá trị |
|----------|---------|
| RAM backend | 1.5–2 GB |
| Docker image | ~2.5 GB |
| Disk data | Tăng theo số vật thể |
| CPU | 1–2 cores đủ inference |

---

## 9. Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| CORS error trên Cloudflare | `CORS_ORIGINS` chưa đúng | Thêm URL `.pages.dev` vào backend env |
| Ảnh không hiển thị | `image_url` là relative path | Dùng full URL: `NEXT_PUBLIC_API_URL + image_url` |
| HF Space timeout | Model load lâu | Tăng startup timeout, dùng `warmup()` sẵn |
| Camera không hoạt động | Thiếu HTTPS | Cloudflare Pages có HTTPS — OK |
| Data mất sau restart HF | Không có persistent disk | Chuyển Oracle VM hoặc HF paid storage |
| Build Docker quá lâu | PyTorch lớn | Dùng `--index-url cpu-only` torch |

---

## 10. File cần tạo khi implement

| File | Phương án A | Phương án B |
|------|-------------|-------------|
| `backend/Dockerfile` | Có | Có |
| `docker-compose.yml` | Test local | Production |
| `.dockerignore` | Có | Có |
| `frontend/Dockerfile` | Không cần | Có |
| `nginx/nginx.conf` | Không cần | Có |
| `docker-compose.prod.yml` | Không cần | Có |
