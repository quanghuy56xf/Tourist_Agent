# Docker Production Adjustment Notes

Use this note as the checklist to re-apply the Docker/deploy changes on a fresh codebase.

## Target Architecture

- Keep `docker-compose.yml` for lightweight local development.
- Add `docker-compose.prod.yml` for production on one VM.
- Production services:
  - `frontend`: Next.js container.
  - `backend`: FastAPI/Python container.
  - `postgres`: PostgreSQL metadata database.
  - `caddy`: public HTTPS reverse proxy.
- Only expose Caddy ports `80` and `443`.
- Keep backend, frontend, and Postgres internal to the Docker network.

## Dependency Rule

- Docker backend must use `backend/requirements.txt`.
- Do not use `uv.lock` as the Docker production dependency source.
- Add PostgreSQL driver to `backend/requirements.txt`:

```txt
psycopg[binary]>=3.2.0
```

## Local Docker Changes

In `docker-compose.yml`:

- Keep local stack simple: backend + frontend.
- Backend should read local env from the root `.env`:

```yaml
env_file:
  - ./.env
```

- Keep only Docker-specific overrides in `environment`, for example:

```yaml
environment:
  - PORT=8000
  - HF_HOME=./data/huggingface
  - TRANSFORMERS_CACHE=./data/huggingface
  - SENTENCE_TRANSFORMERS_HOME=./data/huggingface
```

## Data Path Convention

Use the same relative backend paths in local direct-run, local Docker, and production Docker. For direct local runs, backend code resolves these relative paths under `backend/`:

```env
DATABASE_URL=sqlite:///./data/app.db
CHROMA_PATH=./data/chroma
UPLOAD_DIR=./data/uploads
RAG_CHROMA_PATH=./data/rag_chroma
RAG_BM25_PATH=./data/rag/bm25_index.pkl
RAG_CHUNKS_PATH=./data/rag/chunks.pkl
GROUP_DOCS_DIR=./data/group_docs
HF_HOME=./data/huggingface
TRANSFORMERS_CACHE=./data/huggingface
SENTENCE_TRANSFORMERS_HOME=./data/huggingface
```

Meaning:

- Direct local backend run from `backend/` writes to `backend/data`.
- Docker backend runs from `/app`, so the same paths write to `/app/data`.
- Docker volumes mount into `/app/data/...`.

## Production Compose

Add `docker-compose.prod.yml` with:

- `postgres` service using `postgres:16-alpine`.
- `backend` built from `./backend`.
- `frontend` built from `./frontend`.
- `caddy` using `caddy:2-alpine`.
- Backend `DATABASE_URL`:

```yaml
DATABASE_URL: postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

- Backend production paths:

```yaml
CHROMA_PATH: ./data/chroma
UPLOAD_DIR: ./data/uploads
RAG_CHROMA_PATH: ./data/rag_chroma
RAG_BM25_PATH: ./data/rag/bm25_index.pkl
RAG_CHUNKS_PATH: ./data/rag/chunks.pkl
GROUP_DOCS_DIR: ./data/group_docs
HF_HOME: ./data/huggingface
TRANSFORMERS_CACHE: ./data/huggingface
SENTENCE_TRANSFORMERS_HOME: ./data/huggingface
CORS_ALLOW_ALL: "false"
```

Recommended production volumes:

- `postgres_data:/var/lib/postgresql/data`
- `uploads_data:/app/data/uploads`
- `chroma_data:/app/data/chroma`
- `rag_chroma_data:/app/data/rag_chroma`
- `rag_data:/app/data/rag`
- `group_docs_data:/app/data/group_docs`
- `hf_cache:/app/data/huggingface`
- `caddy_data:/data`
- `caddy_config:/config`

## Caddy

Add `deploy/caddy/Caddyfile`:

```caddyfile
{
	email {$ACME_EMAIL}
}

{$APP_DOMAIN} {
	encode zstd gzip

	handle /api/* {
		reverse_proxy backend:8000
	}

	handle /uploads/* {
		reverse_proxy backend:8000
	}

	handle /health {
		reverse_proxy backend:8000
	}

	handle {
		reverse_proxy frontend:3000
	}
}
```

## Production Env

Add `.env.production.example` and keep real `.env.production` ignored by Git.

Important values:

```env
APP_DOMAIN=your-domain.example.com
ACME_EMAIL=admin@example.com
POSTGRES_DB=heritage_app
POSTGRES_USER=heritage_app
POSTGRES_PASSWORD=replace-with-a-long-random-password
CORS_ORIGINS=https://your-domain.example.com
ADMIN_AUTH_ENABLED=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
AUTH_TOKEN_SECRET=replace-with-a-long-random-secret
GOOGLE_API_KEY=
```

Add to `.gitignore`:

```gitignore
.env.production
```

## Manual Deploy Command

On the VM:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1/health
```

## CI/CD Decision

CI/CD was intentionally postponed.

Do not add GitHub Actions/GHCR yet unless requested later. Current deploy flow is manual build on VM from source.
