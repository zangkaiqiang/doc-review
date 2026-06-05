"""审查编排：异步执行 + 流式产出（架构 §3）。

execute_review 由 worker（进程内线程 或 Celery）调用，自带 DB 会话，
每完成一阶段/一条意见即通过 publish 回调推送事件。

事件类型：start / stage / finding / done / error
"""
from __future__ import annotations

import re
import time
from typing import Callable

from sqlmodel import Session, select

from ..config import settings
from ..db import engine
from ..models import Document, ReviewTask, Finding, Redline, Setting
from . import chunker, rules_engine, llm_review, scoring_engine, clause_review
from .review_templates import normalize_templates

Publish = Callable[[dict], None]

_FIELDS = ("source", "category", "level", "title", "quote", "problem", "basis",
           "suggestion", "chunk_seq", "char_start", "char_end", "locate_status")


def execute_review(task_id: int, publish: Publish) -> None:
    with Session(engine) as session:
        task = session.get(ReviewTask, task_id)
        if not task:
            return
        doc = session.get(Document, task.doc_id)
        try:
            task.status = "running"
            session.add(task)
            session.commit()

            publish({"type": "start", "stance": task.stance,
                     "document": {"id": doc.id, "name": doc.name, "text": doc.text}})
            template_context = _resolve_template_context(session, task.stance)

            # 优先用任务创建时冻结的红线快照；空则回落实时过滤（兼容迁移前旧任务）。
            if task.redline_snapshot:
                redlines = task.redline_snapshot
            else:
                redline_rows = session.exec(select(Redline).where(Redline.enabled == True)).all()
                redlines = [r.model_dump() for r in redline_rows if _redline_applies(r, task, doc)]
            rules_setting = _get_setting(session, "rules")
            rules_cfg = (
                rules_engine.normalize_rules(task.rule_config, task.stance)
                if task.rule_config
                else rules_engine.resolve_rules_for_stance(task.stance, rules_setting)
            )
            # 空 dict 视为"无快照"（兼容迁移前旧任务）：回落到该立场默认 ∪ 全局覆盖。
            scoring_cfg = (
                task.scoring_config
                if task.scoring_config
                else scoring_engine.resolve_scoring_for_stance(task.stance, _get_setting(session, "scoring"))
            )

            # ① 切分
            publish({"type": "stage", "stage": "切分"})
            chunks = chunker.split(doc.text)

            # ② 要素抽取
            publish({"type": "stage", "stage": "要素抽取"})
            task.profile = _extract_profile(doc.text)

            all_findings = []

            # ③ 规则校验（确定性意见，逐条流式产出）
            publish({"type": "stage", "stage": "规则校验"})
            rule_findings, checklist = rules_engine.run(chunks, redlines, rules_cfg)
            checklist, clause_findings, suppress_missing = clause_review.review(chunks, rules_cfg, checklist)
            if suppress_missing:
                rule_findings = [
                    f for f in rule_findings
                    if not (f.get("category") == "缺失条款" and _missing_clause_name(f) in suppress_missing)
                ]
            task.checklist = checklist
            for f in rule_findings:
                _emit(session, task.id, f, all_findings, publish)
            for f in clause_findings:
                _emit(session, task.id, f, all_findings, publish)

            # ④ LLM 研判（无 key 自动降级为空）
            publish({"type": "stage", "stage": "LLM研判"})
            for f in llm_review.run(chunks, task.stance, template_context):
                _emit(session, task.id, f, all_findings, publish)

            # ⑤ 评分
            publish({"type": "stage", "stage": "评分"})
            task.score, task.level = scoring_engine.score(all_findings, scoring_cfg, task.stance)
            task.status = "done"
            session.add(task)
            session.commit()

            publish({"type": "done", "status": "done", "score": task.score,
                     "level": task.level, "checklist": task.checklist, "profile": task.profile})
        except Exception as e:  # noqa: BLE001
            task.status = "failed"
            session.add(task)
            session.commit()
            publish({"type": "error", "message": str(e)})


def _emit(session: Session, task_id: int, f: dict, acc: list, publish: Publish) -> None:
    row = Finding(task_id=task_id, **{k: f.get(k) for k in _FIELDS})
    session.add(row)
    session.flush()          # 取得自增 id
    acc.append(f)
    payload = {"id": row.id, "task_id": task_id, "status": "open",
               **{k: f.get(k) for k in _FIELDS}}
    publish({"type": "finding", "finding": payload})
    if settings.stream_delay:
        time.sleep(settings.stream_delay)


def _missing_clause_name(f: dict) -> str:
    title = str(f.get("title") or "")
    if title.startswith("缺失条款："):
        return title.removeprefix("缺失条款：")
    return ""


def _extract_profile(text: str) -> dict:
    amount = None
    m = re.search(r"(?:￥|¥|人民币)?\s*([0-9][0-9,]{2,})\s*元?", text)
    if m:
        amount = m.group(1)
    return {
        "amount": amount,
        "has_amount_cn": bool(re.search(r"[壹贰叁肆伍陆柒捌玖拾佰仟万亿]元", text)),
        "parties_hint": bool(re.search(r"甲方|乙方", text)),
    }


def _get_setting(session: Session, key: str):
    s = session.get(Setting, key)
    return s.value if s else None


def _resolve_template_context(session: Session, template_key: str) -> dict | None:
    setting = _get_setting(session, "templates")
    raw = setting.get("items") if isinstance(setting, dict) else None
    for item in normalize_templates(raw):
        if item.get("key") == template_key:
            return item
    return None


def _redline_applies(redline: Redline, task: ReviewTask, doc: Document) -> bool:
    stance_ok = redline.stance in ("", "any", task.stance)
    doc_type_ok = redline.doc_type in ("", "any", doc.doc_type)
    return stance_ok and doc_type_ok
