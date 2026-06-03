"""审查执行调度：选择执行后端（进程内线程 或 Celery）。

确保同一任务只执行一次。
"""
from __future__ import annotations

import threading

from .config import settings
from .events import bus

_started: set[int] = set()
_lock = threading.Lock()


def start_review(task_id: int) -> None:
    with _lock:
        if task_id in _started:
            return
        _started.add(task_id)

    if settings.celery_broker_url:
        # 跨进程：交给 Celery worker
        from .celery_app import run_review_task
        run_review_task.delay(task_id)
    else:
        # 进程内：后台线程执行，事件经内存总线推送
        from .services.pipeline import execute_review

        def _publish(ev: dict) -> None:
            bus.publish(task_id, ev)

        threading.Thread(target=execute_review, args=(task_id, _publish), daemon=True).start()
