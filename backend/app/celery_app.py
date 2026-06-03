"""Celery 应用（可选）。仅在配置了 DOCREVIEW_CELERY_BROKER_URL 时使用。

启动 worker：
    celery -A app.celery_app.celery worker --loglevel=info
"""
from __future__ import annotations

from celery import Celery

from .config import settings
from .events import bus
from .services.pipeline import execute_review

celery = Celery(
    "docreview",
    broker=settings.celery_broker_url or "memory://",
    backend=settings.celery_result_backend or "cache+memory://",
)


@celery.task(name="run_review")
def run_review_task(task_id: int) -> None:
    execute_review(task_id, lambda ev: bus.publish(task_id, ev))
