"""FastAPI 应用入口。"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .seed import seed
from .api import documents, reviews, kb, settings_api

app = FastAPI(title="文档审查智能体 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(reviews.router)
app.include_router(kb.router)
app.include_router(settings_api.router)


@app.on_event("startup")
def on_startup():
    init_db()
    seed()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "llm_configured": bool(settings.llm_api_key),
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
    }
