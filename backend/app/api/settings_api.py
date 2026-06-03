"""设置接口：模型配置（OpenAI 兼容）与评分规则配置。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..db import get_session
from ..models import Setting
from ..services.model_gateway import gateway

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _upsert(session: Session, key: str, value: dict):
    s = session.get(Setting, key)
    if s:
        s.value = value
    else:
        s = Setting(key=key, value=value)
    session.add(s)
    session.commit()
    return value


@router.get("/{key}")
def get_setting(key: str, session: Session = Depends(get_session)):
    s = session.get(Setting, key)
    return s.value if s else {}


@router.put("/model")
def put_model(cfg: dict, session: Session = Depends(get_session)):
    # 持久化并热更新网关；api_key 不回显
    gateway.configure(cfg)
    safe = {**cfg}
    safe.pop("api_key", None)
    _upsert(session, "model", safe)
    return {"ok": True, "available": gateway.available}


@router.put("/scoring")
def put_scoring(cfg: dict, session: Session = Depends(get_session)):
    return _upsert(session, "scoring", cfg)
