"""规则引擎：确定性检查，零幻觉、可解释（架构 §6.1）。

MVP 内置三类规则：
  1. 缺失条款（对照标准条款清单）
  2. 模糊措辞扫描
  3. 单边/不利措辞 + 红线库命中
"""
from __future__ import annotations

from typing import List
from rapidfuzz import fuzz

from .chunker import Chunk

# 合同标准条款清单（MVP 内置；后续可按 doc_type 配置）
CONTRACT_CHECKLIST = [
    ("合同标的", ["标的", "服务内容", "货物"]),
    ("合同金额", ["金额", "价款", "费用", "￥", "元"]),
    ("付款方式", ["付款", "支付", "结算"]),
    ("履行期限", ["期限", "交付", "工期"]),
    ("违约责任", ["违约", "赔偿"]),
    ("争议解决", ["争议", "仲裁", "诉讼", "管辖"]),
    ("保密条款", ["保密", "机密"]),
    ("签署落款", ["签字", "盖章", "签署"]),
]

VAGUE_WORDS = ["尽快", "适当", "另行约定", "另行协商", "视情况", "原则上", "等相关"]
ONESIDED_WORDS = ["最终解释权", "概不退还", "概不负责", "任何情况下乙方", "有权单方"]


def run(chunks: List[Chunk], redlines: List[dict]):
    """返回 (findings, checklist)。findings 为 dict 列表。"""
    full = "\n".join(c.text for c in chunks)
    findings: List[dict] = []
    checklist = []

    # 1) 缺失条款
    for name, kws in CONTRACT_CHECKLIST:
        present = any(any(kw in c.text for kw in kws) for c in chunks)
        checklist.append({"clause": name, "present": present})
        if not present:
            findings.append({
                "source": "rule", "category": "缺失条款", "level": "high",
                "title": f"缺失条款：{name}",
                "quote": "", "problem": f"未检出「{name}」相关约定，可能导致权责不清。",
                "basis": "标准条款清单", "suggestion": f"建议补充「{name}」条款。",
                "chunk_seq": None, "char_start": None, "char_end": None,
                "locate_status": "uncertain",
            })

    # 2) 模糊措辞
    for c in chunks:
        for w in VAGUE_WORDS:
            if w in c.text:
                findings.append(_locate({
                    "source": "rule", "category": "模糊措辞", "level": "low",
                    "title": f"模糊措辞：{w}",
                    "problem": f"表述「{w}」含义不确定，易引发争议。",
                    "basis": "模糊措辞规则", "suggestion": "建议明确具体标准/时限/金额。",
                }, c, w))

    # 3) 单边措辞
    for c in chunks:
        for w in ONESIDED_WORDS:
            if w in c.text:
                findings.append(_locate({
                    "source": "rule", "category": "单边条款", "level": "high",
                    "title": f"单边/不利措辞：{w}",
                    "problem": f"「{w}」可能造成权责失衡或显失公平。",
                    "basis": "单边条款规则", "suggestion": "建议改为权责对等表述。",
                }, c, w))

    # 4) 红线库命中
    for c in chunks:
        for r in redlines:
            kws = [k.strip() for k in (r.get("keywords") or "").split(",") if k.strip()]
            if kws and any(k in c.text for k in kws):
                findings.append(_locate({
                    "source": "rule", "category": "红线命中", "level": r.get("level", "high"),
                    "title": f"红线命中：{r.get('code', '')}",
                    "problem": r.get("content", ""),
                    "basis": f"红线#{r.get('code', '')}", "suggestion": "建议按企业红线要求修订。",
                }, c, next(k for k in kws if k in c.text)))

    return findings, checklist


def _locate(f: dict, chunk: Chunk, needle: str) -> dict:
    """把命中片段精确定位回原文偏移（可溯源）。"""
    idx = chunk.text.find(needle)
    f["chunk_seq"] = chunk.seq
    f["quote"] = chunk.text
    if idx >= 0:
        f["char_start"] = chunk.char_start + idx
        f["char_end"] = chunk.char_start + idx + len(needle)
        f["locate_status"] = "located"
    else:
        f["char_start"] = chunk.char_start
        f["char_end"] = chunk.char_end
        f["locate_status"] = "uncertain"
    return f
