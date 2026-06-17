# Deploy 1 VM with Docker Compose

This guide deploys the app to one Google Cloud VM with Docker Compose, Caddy HTTPS, and PostgreSQL. CI/CD can be added later; this version is meant for manual deploy first.

## Production Model

```text
Google Cloud VM
  Caddy :80/:443
    /        -> frontend:3000
    /api     -> backend:8000
    /uploads -> backend:8000
    /health  -> backend:8000

  frontend
  backend
  postgres
  Docker volumes
```

Only Caddy is exposed to the internet. Frontend, backend, and PostgreSQL stay inside the Docker network.

## Data Volumes

- `postgres_data`: relational metadata such as users, groups, items, tours, and content variants.
- `uploads_data`: uploaded item images and generated/uploaded files served from `/uploads`.
- `chroma_data`: image/object search Chroma index from `CHROMA_PATH`.
- `rag_chroma_data`: RAG semantic vector index from `RAG_CHROMA_PATH`.
- `rag_data`: RAG helper files such as `bm25_index.pkl` and `chunks.pkl`.
- `group_docs_data`: uploaded source documents for group knowledge.
- `hf_cache`: Hugging Face and sentence-transformer model cache.
- `caddy_data` and `caddy_config`: Caddy certificates and runtime config.

Back up `postgres_data`, `uploads_data`, `group_docs_data`, `chroma_data`, `rag_chroma_data`, and `rag_data`. The cache can be rebuilt.

## VM Setup

1. Create a Google Cloud VM. Start with at least 2 vCPU, 4 GB RAM, and 40 GB disk. Use more RAM if model loading is slow.
2. Open firewall ports `80` and `443`. Keep `3000`, `8000`, and `5432` closed to the internet.
3. Install Docker and the Compose plugin.
4. Point your domain `A` record to the VM external IP.
5. Clone the repo on the VM:

```bash
git clone https://github.com/<owner>/<repo>.git /opt/heritage-app
cd /opt/heritage-app
```

6. Create the production environment file:

```bash
cp .env.production.example .env.production
nano .env.production
```

Set these values carefully:

```env
APP_DOMAIN=your-domain.example.com
ACME_EMAIL=admin@example.com
POSTGRES_PASSWORD=<long-random-password>
CORS_ORIGINS=https://your-domain.example.com
ADMIN_AUTH_ENABLED=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>
AUTH_TOKEN_SECRET=<long-random-secret>
GOOGLE_API_KEY=<your-key>
```

## Manual Deploy

Run this on the VM:

```bash
cd /opt/heritage-app
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1/health
```

First build can take a long time because the backend image downloads PyTorch and model dependencies.

## Local Parity

Local development and local Docker both use the root `.env` for shared backend settings. Keep `.env.example` as the template and update `.env` when you need local secrets.

Backend data paths use the same relative convention in both modes. For direct local runs, the backend resolves these relative paths under `backend/`:

```env
DATABASE_URL=sqlite:///./data/app.db
CHROMA_PATH=./data/chroma
UPLOAD_DIR=./data/uploads
RAG_CHROMA_PATH=./data/rag_chroma
RAG_BM25_PATH=./data/rag/bm25_index.pkl
RAG_CHUNKS_PATH=./data/rag/chunks.pkl
GROUP_DOCS_DIR=./data/group_docs
HF_HOME=./data/huggingface
```

When running directly from `backend/`, these paths resolve under `backend/data`. When running in Docker, they resolve under `/app/data`, which is mounted to Docker volumes.

Docker backend dependencies are installed from `backend/requirements.txt`, so keep that file as the production dependency source.

## Logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f frontend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f caddy
```

## Stop Or Restart

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

Do not run `down -v` unless you intentionally want to delete production data volumes.

## Rollback

If the latest code has a problem:

```bash
cd /opt/heritage-app
git log --oneline -5
git checkout <previous-commit-sha>
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
curl -fsS http://127.0.0.1/health
```

When the fix is ready, checkout the deployment branch again and redeploy.

## Backup

Minimum daily backup:

```bash
cd /opt/heritage-app
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backup-$(date +%F).sql"
docker run --rm \
  -v heritage-app_uploads_data:/data:ro \
  -v "$PWD:/backup" alpine \
  tar czf "/backup/uploads-$(date +%F).tar.gz" -C /data .
```

Also back up `group_docs_data`, `chroma_data`, `rag_chroma_data`, and `rag_data` if rebuild time matters.
