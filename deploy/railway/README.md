# Deploy len Railway

Repo nay deploy **2 service rieng** (backend + frontend). Moi service co Dockerfile va `railway.toml` trong thu muc cua no.

## 1. Tao project Railway

1. New Project > Deploy from GitHub repo.
2. Them **service Backend**:
   - Root Directory: `backend`
   - Builder: Dockerfile
3. Them **service Frontend**:
   - Root Directory: `frontend`
   - Builder: Dockerfile

## 2. Backend service

### Volume (bat buoc)

Railway Dashboard > Backend > Volumes > Add Volume:

- Mount path: `/app/data`

SQLite, RAG index, uploads va model cache deu nam trong `./data/*`.

### Bien moi truong

Copy tu [`backend.env.example`](./backend.env.example). Quan trong:

| Bien | Ghi chu |
|------|---------|
| `UPLOAD_DIR=./data/uploads` | Cung volume voi SQLite |
| `CORS_ORIGINS` | URL public cua frontend |
| `DEEPSEEK_API_KEY` / `GOOGLE_API_KEY` | LLM provider |
| `AUTH_TOKEN_SECRET` | Doi gia tri manh |

Railway tu inject `PORT` — Dockerfile da doc bien nay.

### Domain

Generate Domain cho backend (vd. `https://hera-api.up.railway.app`).

## 3. Frontend service

### Bien moi truong (Build + Runtime)

Copy tu [`frontend.env.example`](./frontend.env.example). Thay URL backend that:

```env
NEXT_PUBLIC_API_URL=https://hera-api.up.railway.app
NEXT_PUBLIC_BACKEND_DIRECT_URL=https://hera-api.up.railway.app
BACKEND_INTERNAL_URL=https://hera-api.up.railway.app
```

**Luu y:** `NEXT_PUBLIC_*` phai co luc **build** (Railway: tick "Available at Build" hoac redeploy sau khi set).

### Domain

Generate Domain cho frontend. Cap nhat lai `CORS_ORIGINS` o backend bang URL nay.

## 4. Test local (2 service tach)

```powershell
# Dat API key truoc
$env:DEEPSEEK_API_KEY="sk-..."
docker compose -f docker-compose.railway.yml up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000/health

## 5. Docker local day du (co tunnel profile)

```powershell
docker compose up -d --build
```

File `docker-compose.yml` giu cho dev local; `docker-compose.railway.yml` mo phong cau hinh Railway.

## Cau truc file

```
backend/
  Dockerfile
  railway.toml
  .dockerignore
frontend/
  Dockerfile
  railway.toml
  .dockerignore
docker-compose.railway.yml
deploy/railway/
  backend.env.example
  frontend.env.example
```

## Luu y khi deploy

- Lan build backend dau tien mat 10–15 phut (PyTorch + sentence-transformers).
- Neu khong gan volume, du lieu SQLite/uploads se mat khi redeploy.
- Backend can RAM du lon (khuyen nghi >= 2 GB) cho vision + RAG embedding.
