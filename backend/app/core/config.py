import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _read_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"{name} must be either 'true' or 'false'")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'app.db'}")
CHROMA_PATH = os.getenv("CHROMA_PATH", str(BASE_DIR / "data" / "chroma"))

# RAG paths and keys
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
_DEFAULT_LLM_MODEL = "deepseek-chat" if LLM_PROVIDER == "deepseek" else "gemini-2.5-flash"
LLM_MODEL = os.getenv("LLM_MODEL", _DEFAULT_LLM_MODEL)
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))
RAG_CHROMA_PATH = os.getenv("RAG_CHROMA_PATH", str(BASE_DIR / "data" / "rag_chroma"))
RAG_BM25_PATH = os.getenv("RAG_BM25_PATH", str(BASE_DIR / "data" / "rag" / "bm25_index.pkl"))
RAG_CHUNKS_PATH = os.getenv("RAG_CHUNKS_PATH", str(BASE_DIR / "data" / "rag" / "chunks.pkl"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))
GROUP_DOCS_DIR = os.getenv("GROUP_DOCS_DIR", str(BASE_DIR / "data" / "group_docs"))
RAG_MAX_SECTION_CHARS = int(os.getenv("RAG_MAX_SECTION_CHARS", "2000"))
RAG_MAX_CHUNK_CHARS = int(os.getenv("RAG_MAX_CHUNK_CHARS", "2000"))
RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
RAG_MAX_CHUNKS_PER_DOCUMENT = int(os.getenv("RAG_MAX_CHUNKS_PER_DOCUMENT", "0"))
GROUP_DOC_MAX_BYTES = int(os.getenv("GROUP_DOC_MAX_BYTES", "0"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.75"))
SEARCH_TOP_K = int(os.getenv("SEARCH_TOP_K", "20"))
SEARCH_TOP_N = int(os.getenv("SEARCH_TOP_N", "3"))
RAG_CHAT_TOP_K = int(os.getenv("RAG_CHAT_TOP_K", "8"))
USE_AUGMENTATION = _read_bool_env("USE_AUGMENTATION", True)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
CORS_ALLOW_ALL = _read_bool_env("CORS_ALLOW_ALL", False)
MODEL_WARMUP_ENABLED = _read_bool_env("MODEL_WARMUP_ENABLED", False)
CONTENT_PREWARM_ENABLED = _read_bool_env("CONTENT_PREWARM_ENABLED", False)
CONTENT_PREWARM_ALL_VARIANTS = _read_bool_env("CONTENT_PREWARM_ALL_VARIANTS", True)
ADMIN_AUTH_ENABLED = _read_bool_env("ADMIN_AUTH_ENABLED", False)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
MANAGER_USERNAME = os.getenv("MANAGER_USERNAME")
MANAGER_PASSWORD = os.getenv("MANAGER_PASSWORD")
AUTH_TOKEN_SECRET = os.getenv("AUTH_TOKEN_SECRET", "hera-dev-auth-secret-change-me")
AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", str(60 * 60 * 12)))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
CONTENT_REGEN_MAX_WORKERS = int(os.getenv("CONTENT_REGEN_MAX_WORKERS", "4"))
CONTENT_REGEN_TOP_K = int(os.getenv("CONTENT_REGEN_TOP_K", "3"))
CONTENT_TTS_MAX_WORKERS = int(os.getenv("CONTENT_TTS_MAX_WORKERS", "4"))
CONTENT_AUDIO_SWEEP_ENABLED = _read_bool_env("CONTENT_AUDIO_SWEEP_ENABLED", True)
CONTENT_AUDIO_SWEEP_INTERVAL_SECONDS = int(
    os.getenv("CONTENT_AUDIO_SWEEP_INTERVAL_SECONDS", "300")
)
