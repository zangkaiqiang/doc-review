"""条款完整性智能体复核。

规则引擎先用关键词召回条款状态；模型可用时，本模块再判断是否存在
等价约定、约定不清或实质缺失。模型失败时保留规则结果。
"""
from __future__ import annotations

from typing import Any, Iterable

from rapidfuzz import fuzz

from .chunker import Chunk
from .model_gateway import gateway

SYSTEM = (
    "你是合同条款完整性复核助手。请只基于提供的合同原文，判断每个标准条款是否已充分约定。"
    "重点识别等价表达，不要只看关键词。只输出 JSON object："
    "{\"clauses\":[{\"clause\":\"条款名\",\"status\":\"sufficient|partial|missing\","
    "\"quote\":\"原文逐字引用，missing 可为空\",\"problem\":\"判断说明\","
    "\"suggestion\":\"补充或修改建议\"}]}。"
    "status 含义：sufficient=已有充分约定；partial=有相关约定但不明确/不完整；missing=未发现有效约定。"
    "quote 必须来自原文，不得改写。"
)


def review(chunks: list[Chunk], rules_cfg: dict, rule_checklist: list[dict]) -> tuple[list[dict], list[dict], set[str]]:
    """返回 (增强 checklist, 额外智能体意见, 需压制的规则缺失条款名集合)。"""
    fallback = _fallback_checklist(rule_checklist)
    if not gateway.available:
        return fallback, [], set()

    clauses = [item for item in rules_cfg.get("checklist", []) if item.get("enabled", True)]
    if not clauses:
        return fallback, [], set()

    data = gateway.chat_object(SYSTEM, _build_user(chunks, clauses))
    if not isinstance(data, dict):
        return fallback, [], set()

    decisions = _normalize_decisions(data.get("clauses"), chunks)
    if not decisions:
        return fallback, [], set()

    by_rule = {item["clause"]: item for item in fallback}
    enhanced: list[dict] = []
    extra_findings: list[dict] = []
    suppress_missing: set[str] = set()

    for clause in clauses:
        name = str(clause.get("clause", "")).strip()
        if not name:
            continue
        base = by_rule.get(name, {"clause": name, "present": False, "status": "missing", "review_source": "rule"})
        decision = decisions.get(name)
        if not decision:
            enhanced.append(base)
            continue

        status = decision["status"]
        present = status in ("sufficient", "partial")
        item = {
            **base,
            "present": present,
            "status": status,
            "review_source": "agent",
            "quote": decision.get("quote", ""),
            "problem": decision.get("problem", ""),
            "suggestion": decision.get("suggestion", ""),
            "char_start": decision.get("char_start"),
            "char_end": decision.get("char_end"),
            "locate_status": decision.get("locate_status", "uncertain"),
        }
        enhanced.append(item)

        if status in ("sufficient", "partial"):
            suppress_missing.add(name)
        if status == "partial":
            extra_findings.append(_partial_finding(name, decision))
        elif status == "missing" and base.get("present"):
            extra_findings.append(_missing_finding(name, decision))

    return enhanced, extra_findings, suppress_missing


def _fallback_checklist(rule_checklist: list[dict]) -> list[dict]:
    result = []
    for item in rule_checklist:
        present = bool(item.get("present"))
        result.append({
            **item,
            "status": "sufficient" if present else "missing",
            "review_source": "rule",
        })
    return result


def _build_user(chunks: list[Chunk], clauses: list[dict]) -> str:
    clause_lines = "\n".join(
        f"- {item.get('clause', '')}；规则关键词：{', '.join(item.get('keywords') or [])}"
        for item in clauses
    )
    text = "\n".join(f"[{chunk.seq}] {chunk.text}" for chunk in chunks)
    return f"标准条款清单：\n{clause_lines}\n\n合同原文：\n{text}"


def _normalize_decisions(value: Any, chunks: list[Chunk]) -> dict[str, dict]:
    if not isinstance(value, list):
        return {}
    result: dict[str, dict] = {}
    for raw in value:
        if not isinstance(raw, dict):
            continue
        clause = str(raw.get("clause") or "").strip()
        status = str(raw.get("status") or "").strip()
        if not clause or status not in {"sufficient", "partial", "missing"}:
            continue
        quote = str(raw.get("quote") or "").strip()
        located = _relocate(chunks, quote)
        if status in {"sufficient", "partial"} and not quote:
            status = "missing"
        result[clause] = {
            "clause": clause,
            "status": status,
            "quote": quote,
            "problem": str(raw.get("problem") or "").strip(),
            "suggestion": str(raw.get("suggestion") or "").strip(),
            **located,
        }
    return result


def _relocate(chunks: Iterable[Chunk], quote: str) -> dict:
    if not quote:
        return {"char_start": None, "char_end": None, "chunk_seq": None, "locate_status": "uncertain"}
    best: tuple[int, Chunk] | None = None
    for chunk in chunks:
        idx = chunk.text.find(quote)
        if idx >= 0:
            return {
                "char_start": chunk.char_start + idx,
                "char_end": chunk.char_start + idx + len(quote),
                "chunk_seq": chunk.seq,
                "locate_status": "located",
            }
        score = fuzz.partial_ratio(quote, chunk.text)
        if best is None or score > best[0]:
            best = (score, chunk)
    if best and best[0] >= 85:
        chunk = best[1]
        return {
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
            "chunk_seq": chunk.seq,
            "locate_status": "located",
        }
    return {"char_start": None, "char_end": None, "chunk_seq": None, "locate_status": "uncertain"}


def _partial_finding(clause: str, decision: dict) -> dict:
    return {
        "source": "llm",
        "category": "条款完整性复核",
        "level": "mid",
        "title": f"条款约定不明确：{clause}",
        "quote": decision.get("quote", ""),
        "problem": decision.get("problem") or f"已发现「{clause}」相关约定，但内容不够明确或不完整。",
        "basis": "智能体条款完整性复核",
        "suggestion": decision.get("suggestion") or f"建议补充或细化「{clause}」条款。",
        "chunk_seq": decision.get("chunk_seq"),
        "char_start": decision.get("char_start"),
        "char_end": decision.get("char_end"),
        "locate_status": decision.get("locate_status", "uncertain"),
    }


def _missing_finding(clause: str, decision: dict) -> dict:
    return {
        "source": "llm",
        "category": "条款完整性复核",
        "level": "high",
        "title": f"实质缺失条款：{clause}",
        "quote": "",
        "problem": decision.get("problem") or f"虽有关键词命中，但未发现「{clause}」的有效约定。",
        "basis": "智能体条款完整性复核",
        "suggestion": decision.get("suggestion") or f"建议补充「{clause}」条款。",
        "chunk_seq": None,
        "char_start": None,
        "char_end": None,
        "locate_status": "uncertain",
    }
