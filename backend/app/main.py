import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import (
    ADMIN_AUTH_ENABLED,
    CONTENT_AUDIO_SWEEP_ENABLED,
    CONTENT_AUDIO_SWEEP_INTERVAL_SECONDS,
    CORS_ALLOW_ALL,
    CORS_ORIGINS,
    LOG_LEVEL,
    MODEL_WARMUP_ENABLED,
    UPLOAD_DIR,
)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Import langchain splitters before google.genai/LLM client on Windows to avoid
# a native crash (exit 0xC0000005) when both stacks load in the reverse order.
import langchain_text_splitters  # noqa: F401

from app.modules.objects import groups_router as groups, objects_router as objects, register_router as register
from app.modules.vision import router as search
from app.modules.llm import chat_router, story_router, tts_router
from app.modules.content import router as content_router
from app.modules.rag import group_documents_router
from app.modules.auth import router as auth_router
from app.modules.auth import users_router
from app.modules.tours import router as tours_router
from app.modules.tour_match import router as tour_match_router
from app.modules.analytics import router as analytics_router
from app.modules.stt import router as stt_router
from app.modules.vision import embedding
from app.core.database import init_db


async def _audio_sweep_loop(interval_seconds: int):
    from app.modules.content.audio_jobs import sweep_missing_audio

    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await asyncio.to_thread(sweep_missing_audio)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Periodic audio sweep failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting HERA backend (admin_auth_enabled=%s)", ADMIN_AUTH_ENABLED)
    init_db()
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    if MODEL_WARMUP_ENABLED:
        embedding.warmup()

    audio_sweep_task: asyncio.Task | None = None
    if CONTENT_AUDIO_SWEEP_ENABLED and CONTENT_AUDIO_SWEEP_INTERVAL_SECONDS > 0:
        audio_sweep_task = asyncio.create_task(
            _audio_sweep_loop(CONTENT_AUDIO_SWEEP_INTERVAL_SECONDS)
        )
        logger.info(
            "Audio sweep scheduled every %ss", CONTENT_AUDIO_SWEEP_INTERVAL_SECONDS
        )

    logger.info("HERA backend startup complete")
    try:
        yield
    finally:
        if audio_sweep_task is not None:
            audio_sweep_task.cancel()
            try:
                await audio_sweep_task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="DINOv2 Object Search API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ALLOW_ALL else CORS_ORIGINS,
    allow_credentials=not CORS_ALLOW_ALL,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(register.router)
app.include_router(groups.router)
app.include_router(group_documents_router.router)
app.include_router(objects.router)
app.include_router(content_router.router)
app.include_router(tours_router.router)
app.include_router(tour_match_router.router)
app.include_router(analytics_router.router)
app.include_router(search.router)
app.include_router(story_router.router)
app.include_router(chat_router.router)
app.include_router(tts_router.router)
app.include_router(stt_router.router)

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}
