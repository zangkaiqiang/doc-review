"""设置接口：模型配置（OpenAI 兼容）与评分规则配置。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..db import get_session
from ..models import Setting
from ..services.model_gateway import gateway
from ..services.rules_engine import default_rule_templates, normalize_rule_templates, resolve_rules_for_stance
from ..services.scoring_engine import (
    default_scoring_templates,
    normalize_scoring_templates,
    resolve_scoring_for_stance,
)

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


def _default_for(key: str) -> dict:
    if key == "rules":
        return default_rule_templates()
    if key == "scoring":
        return default_scoring_templates()
    return {}


@router.get("/rules/{stance}")
def get_rules_for_stance(stance: str, session: Session = Depends(get_session)):
    s = session.get(Setting, "rules")
    return resolve_rules_for_stance(stance, s.value if s else None)


@router.get("/scoring/{stance}")
def get_scoring_for_stance(stance: str, session: Session = Depends(get_session)):
    s = session.get(Setting, "scoring")
    return resolve_scoring_for_stance(stance, s.value if s else None)


@router.get("/{key}")
def get_setting(key: str, session: Session = Depends(get_session)):
    s = session.get(Setting, key)
    if not s:
        return _default_for(key)
    if key == "rules":
        return normalize_rule_templates(s.value)
    if key == "scoring":
        return normalize_scoring_templates(s.value)
    return s.value


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
    return _upsert(session, "scoring", normalize_scoring_templates(cfg))


@router.put("/rules")
def put_rules(cfg: dict, session: Session = Depends(get_session)):
    return _upsert(session, "rules", normalize_rule_templates(cfg))
