"""审查相关接口：发起审查、SSE 流式获取、最终结果、更新意见状态。"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..events import bus
from ..models import Document, ReviewTask, Finding
from ..runner import start_review

router = APIRouter(prefix="/api", tags=["reviews"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",   # 关闭 Nginx 缓冲，保证流式
}
_FIELDS = ("source", "category", "level", "title", "quote", "problem", "basis",
           "suggestion", "chunk_seq", "char_start", "char_end", "locate_status", "status")


class ReviewCreate(BaseModel):
    doc_id: int | None = None
    text: str | None = None          # 也支持直接贴文本审查（骨架演示用）
    name: str = "未命名文档"
    doc_type: str = "contract"
    stance: str = "party_a"


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/reviews")
def list_reviews(session: Session = Depends(get_session)):
    """历史列表：返回审查任务（新建在前），联文档名。只读。"""
    tasks = session.exec(
        select(ReviewTask).order_by(ReviewTask.created_at.desc(), ReviewTask.id.desc())
    ).all()
    doc_ids = {t.doc_id for t in tasks}
    names = {}
    if doc_ids:
        docs = session.exec(select(Document).where(Document.id.in_(doc_ids))).all()
        names = {d.id: d.name for d in docs}
    return [
        {
            "id": t.id,
            "doc_name": names.get(t.doc_id, "未命名文档"),
            "stance": t.stance,
            "status": t.status,
            "score": t.score,
            "level": t.level,
            "created_at": t.created_at,
        }
        for t in tasks
    ]


@router.post("/reviews")
def create_review(body: ReviewCreate, session: Session = Depends(get_session)):
    """创建审查任务（异步执行，不在此阻塞）。返回 task_id，随后用 /stream 拉流。"""
    if body.doc_id:
        doc = session.get(Document, body.doc_id)
        if not doc:
            raise HTTPException(404, "文档不存在")
    elif body.text:
        doc = Document(name=body.name, doc_type=body.doc_type, text=body.text)
        session.add(doc)
        session.commit()
        session.refresh(doc)
    else:
        raise HTTPException(400, "需提供 doc_id 或 text")

    task = ReviewTask(doc_id=doc.id, stance=body.stance, status="pending")
    session.add(task)
    session.commit()
    session.refresh(task)
    return {"task_id": task.id, "status": task.status}


@router.get("/reviews/{task_id}/stream")
async def stream_review(task_id: int, session: Session = Depends(get_session)):
    """SSE：阶段进度与审查意见边生成边推送。"""
    task = session.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    bus.bind_loop(asyncio.get_running_loop())

    # 已完成的任务：直接从库中回放（支持刷新重连）
    if task.status == "done":
        doc = session.get(Document, task.doc_id)
        findings = session.exec(select(Finding).where(Finding.task_id == task_id)).all()
        payloads = [{"id": f.id, "task_id": task_id, **{k: getattr(f, k) for k in _FIELDS}}
                    for f in findings]
        done = {"type": "done", "status": "done", "score": task.score, "level": task.level,
                "checklist": task.checklist, "profile": task.profile}
        start = {"type": "start", "stance": task.stance,
                 "document": {"id": doc.id, "name": doc.name, "text": doc.text}}

        async def replay():
            yield _sse(start)
            for p in payloads:
                yield _sse({"type": "finding", "finding": p})
            yield _sse(done)

        return StreamingResponse(replay(), media_type="text/event-stream", headers=_SSE_HEADERS)

    # 进行中/待执行：先订阅再启动 worker，避免漏掉早期事件
    sub = await bus.subscribe(task_id)
    start_review(task_id)

    async def gen():
        try:
            async for ev in bus.events(sub):
                yield _sse(ev)
                if ev.get("type") in ("done", "error"):
                    break
        finally:
            await bus.close(sub)

    return StreamingResponse(gen(), media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get("/reviews/{task_id}")
def get_review(task_id: int, session: Session = Depends(get_session)):
    task = session.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    doc = session.get(Document, task.doc_id)
    findings = session.exec(select(Finding).where(Finding.task_id == task_id)).all()
    return {"task": task, "document": {"id": doc.id, "name": doc.name, "text": doc.text},
            "findings": findings}


class FindingUpdate(BaseModel):
    status: str | None = None
    reject_reason: str | None = None
    suggestion: str | None = None


@router.patch("/findings/{finding_id}")
def update_finding(finding_id: int, body: FindingUpdate, session: Session = Depends(get_session)):
    f = session.get(Finding, finding_id)
    if not f:
        raise HTTPException(404, "意见不存在")
    if body.status is not None:
        f.status = body.status
    if body.reject_reason is not None:
        f.reject_reason = body.reject_reason
    if body.suggestion is not None:
        f.suggestion = body.suggestion
    session.add(f)
    session.commit()
    return {"ok": True}
