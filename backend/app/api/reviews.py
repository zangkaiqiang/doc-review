"""审查相关接口：发起审查、获取结果、更新意见状态。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import Document, ReviewTask, Finding
from ..services import pipeline

router = APIRouter(prefix="/api", tags=["reviews"])


class ReviewCreate(BaseModel):
    doc_id: int | None = None
    text: str | None = None          # 也支持直接贴文本审查（骨架演示用）
    name: str = "未命名文档"
    doc_type: str = "contract"
    stance: str = "party_a"


@router.post("/reviews")
def create_review(body: ReviewCreate, session: Session = Depends(get_session)):
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

    pipeline.run_review(session, task)
    return {"task_id": task.id, "status": task.status}


@router.get("/reviews/{task_id}")
def get_review(task_id: int, session: Session = Depends(get_session)):
    task = session.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    doc = session.get(Document, task.doc_id)
    findings = session.exec(select(Finding).where(Finding.task_id == task_id)).all()
    return {
        "task": task,
        "document": {"id": doc.id, "name": doc.name, "text": doc.text},
        "findings": findings,
    }


class FindingUpdate(BaseModel):
    status: str | None = None        # accepted | rejected | edited
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
