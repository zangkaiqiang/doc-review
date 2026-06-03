"""审查编排：串起架构 §3 的流水线（MVP 同步执行，便于骨架演示）。

解析 → 切分 → 要素抽取 → 规则校验 → LLM研判 → 定位回填 → 评分 → 汇总
（要素抽取在 MVP 用轻量正则占位；流式/异步留待接入 Celery+SSE）
"""
from __future__ import annotations

import re
from typing import List

from sqlmodel import Session, select

from ..models import Document, ReviewTask, Finding, Redline, Setting
from . import chunker, rules_engine, llm_review, scoring_engine


def run_review(session: Session, task: ReviewTask) -> None:
    doc = session.get(Document, task.doc_id)
    redlines = [r.model_dump() for r in session.exec(select(Redline).where(Redline.enabled == True)).all()]
    scoring_cfg = _get_setting(session, "scoring")

    task.status = "running"

    # ① 切分（解析在上传时已完成）
    task.stage = "切分"
    chunks = chunker.split(doc.text)

    # ② 要素抽取（MVP 轻量占位）
    task.stage = "要素抽取"
    task.profile = _extract_profile(doc.text)

    # ③ 规则校验
    task.stage = "规则校验"
    rule_findings, checklist = rules_engine.run(chunks, redlines)
    task.checklist = checklist

    # ④ LLM 研判（无 key 自动降级为空）
    task.stage = "LLM研判"
    llm_findings = llm_review.run(chunks, task.stance)

    all_findings = rule_findings + llm_findings

    # ⑤ 评分
    task.stage = "评分"
    task.score, task.level = scoring_engine.score(all_findings, scoring_cfg)

    # ⑥ 落库
    task.stage = "汇总"
    for f in all_findings:
        session.add(Finding(task_id=task.id, **{k: f.get(k) for k in (
            "source", "category", "level", "title", "quote", "problem", "basis",
            "suggestion", "chunk_seq", "char_start", "char_end", "locate_status")}))
    task.status = "done"
    session.add(task)
    session.commit()


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
