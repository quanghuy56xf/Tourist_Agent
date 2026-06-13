from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import (
    CORS_ALLOW_ALL,
    CORS_ORIGINS,
    MODEL_WARMUP_ENABLED,
    UPLOAD_DIR,
)
from app.modules.objects import groups_router as groups, objects_router as objects, register_router as register
from app.modules.vision import router as search
from app.modules.llm import chat_router, story_router, tts_router
from app.modules.content import router as content_router
from app.modules.rag import group_documents_router
from app.modules.vision import embedding
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    if MODEL_WARMUP_ENABLED:
        embedding.warmup()
    yield


app = FastAPI(title="DINOv2 Object Search API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ALLOW_ALL else CORS_ORIGINS,
    allow_credentials=not CORS_ALLOW_ALL,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(register.router)
app.include_router(groups.router)
app.include_router(group_documents_router.router)
app.include_router(objects.router)
app.include_router(content_router.router)
app.include_router(search.router)
app.include_router(story_router.router)
app.include_router(chat_router.router)
app.include_router(tts_router.router)

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}
