import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'app.db'}")
CHROMA_PATH = os.getenv("CHROMA_PATH", str(BASE_DIR / "data" / "chroma"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.75"))
SEARCH_TOP_K = int(os.getenv("SEARCH_TOP_K", "20"))
SEARCH_TOP_N = int(os.getenv("SEARCH_TOP_N", "3"))
USE_AUGMENTATION = os.getenv("USE_AUGMENTATION", "true").lower() == "true"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
CORS_ALLOW_ALL = os.getenv("CORS_ALLOW_ALL", "false").lower() == "true"
