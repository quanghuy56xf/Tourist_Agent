from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ALLOW_ALL, CORS_ORIGINS, UPLOAD_DIR
from app.routers import groups, objects, register, search
from app.services import embedding
from app.services.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
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
app.include_router(objects.router)
app.include_router(search.router)

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}
