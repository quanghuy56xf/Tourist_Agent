FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

RUN mkdir -p \
    data/chroma \
    data/rag \
    data/group_docs \
    data/uploads \
    data/huggingface \
    uploads

ENV DATABASE_URL=sqlite:///./data/app.db
ENV CHROMA_PATH=./data/chroma
ENV UPLOAD_DIR=./data/uploads
ENV RAG_CHROMA_PATH=./data/rag_chroma
ENV RAG_BM25_PATH=./data/rag/bm25_index.pkl
ENV RAG_CHUNKS_PATH=./data/rag/chunks.pkl
ENV GROUP_DOCS_DIR=./data/group_docs
ENV HF_HOME=./data/huggingface
ENV TRANSFORMERS_CACHE=./data/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=./data/huggingface
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD sh -c 'curl -f "http://127.0.0.1:${PORT:-8000}/health" || exit 1'

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
