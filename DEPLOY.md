# Kế hoạch & Hướng dẫn: Triển khai Hệ thống (Railway & GCP VM)

Dự án HERA V2 được cấu trúc triển khai (deployment) thành 2 phần độc lập:

| Phần | Nền tảng | Lý do | Phương án Triển khai |
|------|------------------|-------|---------------------|
| **Frontend** (Next.js) | **Railway** | Có sẵn tính năng tự động build/deploy, hỗ trợ Next.js. | Deploy trực tiếp từ GitHub lên Railway. |
| **Backend** (FastAPI) | **Google Cloud VM (GCP)** | Backend dùng DINOv2 yêu cầu nhiều RAM (~2GB+) và khả năng kiểm soát Vector Database (Chroma). | Chạy Containerized với **Docker Compose** + **Caddy**. |

```mermaid
graph TD
    User([Khách truy cập]) -->|HTTPS| Frontend[Frontend: Railway (aihera.io.vn)]
    Frontend -->|HTTPS API Request| Caddy[Reverse Proxy: Caddy (api.aihera.io.vn)]
    
    subgraph GCP VM
        Caddy --> Backend[Backend: FastAPI (Docker)]
        Backend --> Postgres[(PostgreSQL)]
        Backend --> Chroma[(ChromaDB)]
    end
```

---

## 1. Deploy Frontend — Railway

1. Đăng nhập vào [Railway](https://railway.app/).
2. Chọn **New Project** -> **Deploy from GitHub repo**.
3. Chọn repo chứa dự án HERA.
4. Cấu hình thư mục gốc (Root Directory) là `/frontend` (hoặc cấu hình thông qua Settings của dự án trên Railway).
5. Thêm các Biến Môi Trường (Environment Variables):
   - `NEXT_PUBLIC_API_URL`: URL API Backend (ví dụ: `https://api.aihera.io.vn`).
6. Railway sẽ tự động phân tích code Next.js, cài đặt dependencies và tiến hành build. Hệ thống sẽ tự động triển khai phiên bản mới mỗi khi có code đẩy lên nhánh `main`.

---

## 2. Deploy Backend — Google Cloud VM (Docker Compose)

Hệ thống Backend được đóng gói toàn bộ vào Docker Compose, bao gồm:
- **Backend (FastAPI)**
- **Database (PostgreSQL)**
- **Reverse Proxy (Caddy)** tự động cấu hình chứng chỉ HTTPS Let's Encrypt.

### Bước 1: Chuẩn bị máy chủ
1. Khởi tạo một VM trên Google Cloud với hệ điều hành Ubuntu (khuyến nghị có ít nhất 2GB RAM để chạy ổn định DINOv2).
2. Trỏ tên miền API (ví dụ: `api.aihera.io.vn`) về địa chỉ IP Public của máy ảo.
3. Cài đặt **Docker** cùng **Git**:
   ```bash
   sudo apt update
   sudo apt install -y git docker.io docker-compose-v2
   sudo usermod -aG docker $USER
   ```

### Bước 2: Clone Code và Cấu hình Môi trường
```bash
# Tạo thư mục chạy dự án
sudo mkdir -p /opt/c2-app
sudo chown -R $USER:$USER /opt/c2-app
cd /opt/c2-app

# Clone dự án từ GitHub
git clone https://github.com/<username>/<repo-name>.git C2-App-060
cd C2-App-060

# Tạo file cấu hình môi trường
cp .env.example .env
nano .env
```
Cấu hình các biến quan trọng trong file `.env`:
```env
# URL của Frontend dùng cho CORS
CORS_ORIGINS="https://aihera.io.vn"
CORS_ALLOW_ALL=false

# Domain cho Backend API
APP_DOMAIN=api.aihera.io.vn
ACME_EMAIL=your-email@example.com

# Các cấu hình AI Keys...
GOOGLE_API_KEY=your_key...
```

### Bước 3: Triển khai (Deploy)
Dự án đã có sẵn script `deploy.sh` hỗ trợ kéo code và build lại toàn bộ hệ thống bằng Docker Compose:
```bash
chmod +x deploy.sh
./deploy.sh
```

Caddy sẽ tự khởi động, thiết lập chứng chỉ SSL cho `api.aihera.io.vn` và định tuyến (proxy) request tới Backend.

---

## 3. Hệ thống CI/CD (GitHub Actions)

Dự án sử dụng GitHub Actions để tự động hoá quy trình kiểm thử và cập nhật hệ thống.

- **Frontend CI**: Chạy cài đặt dependencies, Lint và Build thử cho các thay đổi ở thư mục `frontend/` nhằm đảm bảo chất lượng source code. (Việc Deploy do Railway tự quản lý).
- **Backend CI**: Sử dụng công cụ `uv` siêu tốc để tạo môi trường Python và chạy toàn bộ unit test (`pytest`) cho mỗi thay đổi ở nhánh `backend/`.
- **Backend CD**: Tự động SSH vào máy chủ Google Cloud VM và thực thi script `./deploy.sh` để cập nhật mã nguồn cũng như container mỗi khi nhánh `main` nhận commit mới.

> ⚠️ **Yêu cầu:** Để GitHub Actions có thể deploy tự động lên Backend (CD), hãy đảm bảo bạn đã cấu hình 3 biến `Repository Secrets` trên kho lưu trữ GitHub: 
> 1. `SSH_HOST` (IP Public của GCP VM)
> 2. `SSH_USERNAME` (Tài khoản SSH vào VM)
> 3. `SSH_KEY` (Nội dung khoá Private Key)
