"""事件总线：审查流水线产出的阶段/意见事件，经此推送给 SSE 订阅者。

- 默认 InMemoryEventBus：进程内，线程安全 publish + 异步 subscribe（零依赖）。
- 配置 Celery broker 时切到 RedisEventBus：跨进程（worker→web）经 Redis pub/sub。
"""
from __future__ import annotations

import asyncio
import json
import threading
from dataclasses import dataclass
from typing import Dict, List, Optional

from .config import settings


@dataclass
class Sub:
    task_id: int
    queue: Optional[asyncio.Queue] = None
    redis_obj: object = None


class InMemoryEventBus:
    def __init__(self) -> None:
        self._subs: Dict[int, List[asyncio.Queue]] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def subscribe(self, task_id: int) -> Sub:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subs.setdefault(task_id, []).append(q)
        return Sub(task_id=task_id, queue=q)

    async def events(self, sub: Sub):
        assert sub.queue is not None
        while True:
            ev = await sub.queue.get()
            yield ev

    async def close(self, sub: Sub) -> None:
        with self._lock:
            lst = self._subs.get(sub.task_id, [])
            if sub.queue in lst:
                lst.remove(sub.queue)

    def publish(self, task_id: int, event: dict) -> None:
        """可能从 worker 线程调用，需线程安全地投递到事件循环。"""
        with self._lock:
            queues = list(self._subs.get(task_id, []))
        loop = self._loop
        for q in queues:
            if loop and loop.is_running():
                loop.call_soon_threadsafe(q.put_nowait, event)
            else:
                q.put_nowait(event)


class RedisEventBus:
    """跨进程事件（Celery worker 发布 → web 订阅）。"""

    def __init__(self, url: str) -> None:
        self._url = url

    def bind_loop(self, loop) -> None:  # noqa: D401
        pass

    @staticmethod
    def _chan(task_id: int) -> str:
        return f"docreview:review:{task_id}"

    async def subscribe(self, task_id: int) -> Sub:
        import redis.asyncio as aioredis

        client = aioredis.from_url(self._url, decode_responses=True)
        pubsub = client.pubsub()
        await pubsub.subscribe(self._chan(task_id))
        return Sub(task_id=task_id, redis_obj=(client, pubsub))

    async def events(self, sub: Sub):
        client, pubsub = sub.redis_obj  # type: ignore[misc]
        async for msg in pubsub.listen():
            if msg.get("type") == "message":
                yield json.loads(msg["data"])

    async def close(self, sub: Sub) -> None:
        client, pubsub = sub.redis_obj  # type: ignore[misc]
        await pubsub.unsubscribe(self._chan(sub.task_id))
        await pubsub.close()
        await client.close()

    def publish(self, task_id: int, event: dict) -> None:
        import redis

        client = redis.from_url(self._url)
        client.publish(self._chan(task_id), json.dumps(event, ensure_ascii=False))
        client.close()


def _make_bus():
    if settings.celery_broker_url:
        return RedisEventBus(settings.celery_result_backend or settings.celery_broker_url)
    return InMemoryEventBus()


bus = _make_bus()
