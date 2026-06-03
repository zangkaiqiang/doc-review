"""LLM 语义研判：失衡/模糊/风险解读等需要研判的意见（架构流水线 ⑥）。

强制模型返回 chunk_seq + 逐字 quote，供后续可溯源定位回填（§5）。
无模型可用时返回空列表，由规则类意见兜底。
"""
from __future__ import annotations

import json
from typing import List

from rapidfuzz import fuzz

from .chunker import Chunk
from .model_gateway import gateway

STANCE_DESC = {
    "party_a": "甲方（采购/委托方），意见应倾向保护甲方利益",
    "party_b": "乙方（供应/承接方），意见应倾向保护乙方利益",
    "neutral": "中立法务，仅指出失衡与不合规，不偏向任一方",
    "tenderee": "招标方，核验投标响应的符合性",
}

SYSTEM = (
    "你是资深合同审查专家。请基于给定立场审查合同条款，"
    "只输出 JSON：{\"findings\":[{\"chunk_seq\":int,\"quote\":\"逐字引用原文\","
    "\"level\":\"high|mid|low\",\"category\":\"类别\",\"title\":\"简短标题\","
    "\"problem\":\"问题说明\",\"basis\":\"依据\",\"suggestion\":\"修改建议\"}]}。"
    "quote 必须是原文中真实存在的片段，不得改写。"
)


def run(chunks: List[Chunk], stance: str) -> List[dict]:
    if not gateway.available:
        return []
    numbered = "\n".join(f"[{c.seq}] {c.text}" for c in chunks)
    user = f"审查立场：{STANCE_DESC.get(stance, stance)}\n\n合同条款（[序号] 文本）：\n{numbered}"
    raw = gateway.chat_json(SYSTEM, user)
    if not raw:
        return []

    findings: List[dict] = []
    by_seq = {c.seq: c for c in chunks}
    for item in raw:
        seq = item.get("chunk_seq")
        chunk = by_seq.get(seq)
        f = {
            "source": "llm",
            "category": item.get("category", "语义研判"),
            "level": item.get("level", "mid"),
            "title": item.get("title", ""),
            "problem": item.get("problem", ""),
            "basis": item.get("basis", "模型研判"),
            "suggestion": item.get("suggestion", ""),
            "quote": item.get("quote", ""),
            "chunk_seq": seq,
        }
        findings.append(_relocate(f, chunk, item.get("quote", "")))
    return findings


def _relocate(f: dict, chunk, quote: str) -> dict:
    """可溯源回填：在 chunk 内模糊匹配 quote，定位精确偏移；失败标 uncertain。"""
    if chunk is None or not quote:
        f["char_start"] = f["char_end"] = None
        f["locate_status"] = "uncertain"
        return f
    idx = chunk.text.find(quote)
    if idx >= 0:
        f["char_start"] = chunk.char_start + idx
        f["char_end"] = chunk.char_start + idx + len(quote)
        f["locate_status"] = "located"
    else:
        # 逐字未命中 → 模糊匹配兜底；相似度低则标存疑，绝不瞎指
        score = fuzz.partial_ratio(quote, chunk.text)
        f["char_start"] = chunk.char_start
        f["char_end"] = chunk.char_end
        f["locate_status"] = "located" if score >= 85 else "uncertain"
    return f
