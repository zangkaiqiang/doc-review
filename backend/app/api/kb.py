"""知识库接口：红线库 CRUD 与批量导入（落实存量条款导入）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import Redline

router = APIRouter(prefix="/api/kb", tags=["knowledge-base"])


class RedlineIn(BaseModel):
    code: str = ""
    content: str = ""
    keywords: str = ""
    doc_type: str = "contract"
    stance: str = "any"
    level: str = "high"
    enabled: bool = True


@router.get("/redlines")
def list_redlines(session: Session = Depends(get_session)):
    return session.exec(select(Redline)).all()


@router.post("/redlines")
def add_redline(body: RedlineIn, session: Session = Depends(get_session)):
    r = Redline(**body.model_dump())
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


@router.put("/redlines/{redline_id}")
def update_redline(redline_id: int, body: RedlineIn, session: Session = Depends(get_session)):
    r = session.get(Redline, redline_id)
    if not r:
        raise HTTPException(404, "红线不存在")
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


@router.delete("/redlines/{redline_id}")
def delete_redline(redline_id: int, session: Session = Depends(get_session)):
    r = session.get(Redline, redline_id)
    if not r:
        raise HTTPException(404, "红线不存在")
    session.delete(r)
    session.commit()
    return {"ok": True}


@router.post("/redlines/import")
def import_redlines(items: list[RedlineIn], session: Session = Depends(get_session)):
    """批量导入存量红线条款。"""
    created = 0
    for it in items:
        session.add(Redline(**it.model_dump()))
        created += 1
    session.commit()
    return {"imported": created}
