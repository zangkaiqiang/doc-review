"""规则引擎：确定性检查，零幻觉、可解释（架构 §6.1）。

MVP 内置三类规则：
  1. 缺失条款（对照标准条款清单）
  2. 模糊措辞扫描
  3. 单边/不利措辞 + 红线库命中
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any, List

from .chunker import Chunk

def _clause(clause: str, keywords: list[str]) -> dict:
    return {"clause": clause, "keywords": keywords, "enabled": True}


# 四立场公共标准条款基线（关键词贴近真实中文合同用语，用于正文子串匹配）。
_BASE_CHECKLIST = [
    _clause("合同标的", ["标的", "服务内容", "货物名称", "工作内容", "供货范围"]),
    _clause("合同金额", ["合同金额", "合同总价", "价款", "含税", "￥", "人民币"]),
    _clause("付款方式", ["付款方式", "支付", "结算", "电汇", "对公账户"]),
    _clause("履行期限", ["履行期限", "交付日期", "交货期", "工期", "完成时间"]),
    _clause("违约责任", ["违约责任", "违约金", "赔偿损失", "逾期违约"]),
    _clause("争议解决", ["争议解决", "仲裁委员会", "提起诉讼", "管辖法院", "协商解决"]),
    _clause("保密条款", ["保密", "保密义务", "商业秘密", "机密信息"]),
    _clause("签署落款", ["签字盖章", "授权代表", "签订地点", "签订日期", "合同生效"]),
]

_BASE_VAGUE = ["尽快", "适当", "合理", "另行约定", "另行协商", "视情况而定",
               "原则上", "等相关事宜", "相应", "酌情", "适时", "如有必要"]

# 中立立场单边词表：取双向显失公平措辞的并集（仅提示，不偏袒）。
_NEUTRAL_ONESIDED = ["最终解释权", "概不退还", "概不负责", "有权单方", "无条件配合",
                     "连带责任", "甲方有权随时终止", "乙方承担全部责任", "乙方有权随时",
                     "放弃追偿", "放弃抗辩", "不承担任何责任", "视为验收合格", "不得拒收"]

DEFAULT_RULES = {
    "checklist": [dict(c) for c in _BASE_CHECKLIST],
    "vague_words": list(_BASE_VAGUE),
    "onesided_words": list(_NEUTRAL_ONESIDED),
}

STANCE_KEYS = ("party_a", "party_b", "neutral", "tenderee")

# 立场专属默认模板（法务口径）：公共基线 + 各立场特别关注条款 + 按「对谁不利」的单边词表。
DEFAULT_RULE_TEMPLATES = {
    # 甲方/采购方：关注质量验收、知识产权、质保、履约担保；单边=利于乙方的让利/免责。
    "party_a": {
        "checklist": [dict(c) for c in _BASE_CHECKLIST] + [
            _clause("质量标准与验收", ["质量标准", "验收标准", "验收合格", "质量异议", "退换货"]),
            _clause("知识产权归属", ["知识产权归属", "著作权归甲方", "成果归属", "职务作品", "专利权"]),
            _clause("质保与售后", ["质保期", "保修期", "免费维护", "售后服务", "三包"]),
            _clause("履约担保", ["履约保证金", "履约担保", "质量保证金", "预留尾款"]),
        ],
        "vague_words": list(_BASE_VAGUE),
        "onesided_words": ["概不退还", "概不负责", "乙方有权单方", "乙方有权随时",
                           "最终解释权归乙方", "甲方不得拒收", "甲方应无条件", "甲方放弃追偿",
                           "乙方不承担任何责任", "本合同一经签订不得变更", "甲方提前付款",
                           "甲方承担全部费用", "视为甲方验收合格", "逾期付款乙方有权解除"],
    },
    # 乙方/供应方：关注验收时限、逾期付款利息、责任上限、不可抗力；单边=加重乙方/利甲方。
    "party_b": {
        "checklist": [dict(c) for c in _BASE_CHECKLIST] + [
            _clause("验收标准与期限", ["验收标准", "验收期限", "验收时限", "视为验收", "逾期不验收"]),
            _clause("逾期付款利息", ["逾期付款", "付款利息", "资金占用费", "滞纳金", "迟延付款违约金"]),
            _clause("责任限额上限", ["责任上限", "赔偿上限", "累计赔偿", "责任限额", "最高不超过"]),
            _clause("不可抗力免责", ["不可抗力", "免责", "情势变更", "政策调整", "疫情影响"]),
        ],
        "vague_words": list(_BASE_VAGUE),
        "onesided_words": ["乙方承担全部责任", "乙方承担全部费用", "甲方有权随时终止",
                           "甲方有权单方解除", "连带责任", "无限连带", "最终解释权归甲方",
                           "乙方无条件配合", "乙方无条件接受", "甲方有权扣款", "乙方放弃抗辩",
                           "乙方不得主张", "甲方逾期付款不承担", "质保金不予退还",
                           "乙方先行垫付", "甲方有权拒付"],
    },
    # 中立：仅公共基线 + 双向显失公平并集。
    "neutral": {
        "checklist": [dict(c) for c in _BASE_CHECKLIST],
        "vague_words": list(_BASE_VAGUE),
        "onesided_words": list(_NEUTRAL_ONESIDED),
    },
    # 招标方/审标：关注资质响应、偏离说明、报价、有效期、保证金；单边词表聚焦偏离类。
    "tenderee": {
        "checklist": [dict(c) for c in _BASE_CHECKLIST] + [
            _clause("资质要求响应", ["资质要求", "营业执照", "资格审查", "业绩要求", "类似项目"]),
            _clause("偏离情况说明", ["偏离表", "偏离说明", "正偏离", "负偏离", "响应一致"]),
            _clause("投标报价", ["投标报价", "报价表", "总报价", "单价", "下浮率"]),
            _clause("投标有效期", ["投标有效期", "投标文件有效期", "报价有效期", "有效期内"]),
            _clause("投标保证金", ["投标保证金", "保证金缴纳", "保函", "保证金退还"]),
        ],
        "vague_words": list(_BASE_VAGUE),
        "onesided_words": ["实质性偏离", "负偏离", "重大偏离", "不响应", "不满足要求",
                           "未提供", "不接受", "保留权利", "另行报价", "以最终为准",
                           "暂不响应", "部分响应", "不予承诺", "无法满足", "未按要求"],
    },
}


def default_rules() -> dict:
    return deepcopy(DEFAULT_RULES)


def default_rules_for_stance(stance: str | None = None) -> dict:
    return deepcopy(DEFAULT_RULE_TEMPLATES.get(stance or "", DEFAULT_RULES))


def default_rule_templates() -> dict:
    return {stance: default_rules_for_stance(stance) for stance in STANCE_KEYS}


def normalize_rules(config: dict | None = None, stance: str | None = None) -> dict:
    """Merge stored config with defaults and normalize list-like fields."""
    cfg = default_rules_for_stance(stance) if stance else default_rules()
    if config:
        cfg.update(config)

    checklist = []
    for item in cfg.get("checklist") or []:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            clause, keywords = item[0], item[1]
            enabled = True
        elif isinstance(item, dict):
            clause = item.get("clause") or item.get("name") or ""
            keywords = item.get("keywords") or []
            enabled = item.get("enabled", True)
        else:
            continue
        keywords = _as_list(keywords)
        if clause and keywords:
            checklist.append({"clause": str(clause), "keywords": keywords, "enabled": bool(enabled)})

    cfg["checklist"] = checklist
    cfg["vague_words"] = _as_list(cfg.get("vague_words"))
    cfg["onesided_words"] = _as_list(cfg.get("onesided_words"))
    return cfg


def normalize_rule_templates(config: dict | None = None) -> dict:
    """Normalize persisted per-stance templates.

    Older versions stored a single rule config. Treat that legacy shape as a
    shared template so existing deployments keep working.
    """
    if _looks_like_rule_config(config):
        return {stance: normalize_rules(config, stance) for stance in STANCE_KEYS}
    config = config or {}
    return {
        stance: normalize_rules(config.get(stance) if isinstance(config, dict) else None, stance)
        for stance in STANCE_KEYS
    }


def resolve_rules_for_stance(stance: str, config: dict | None = None) -> dict:
    if _looks_like_rule_config(config):
        return normalize_rules(config, stance)
    if isinstance(config, dict):
        return normalize_rules(config.get(stance), stance)
    return normalize_rules(None, stance)


def run(chunks: List[Chunk], redlines: List[dict], config: dict | None = None):
    """返回 (findings, checklist)。findings 为 dict 列表。"""
    cfg = normalize_rules(config)
    findings: List[dict] = []
    checklist = []

    # 1) 缺失条款
    for item in cfg["checklist"]:
        if not item.get("enabled", True):
            continue
        name = item["clause"]
        kws = item["keywords"]
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
        for w in cfg["vague_words"]:
            if w in c.text:
                findings.append(_locate({
                    "source": "rule", "category": "模糊措辞", "level": "low",
                    "title": f"模糊措辞：{w}",
                    "problem": f"表述「{w}」含义不确定，易引发争议。",
                    "basis": "模糊措辞规则", "suggestion": "建议明确具体标准/时限/金额。",
                }, c, w))

    # 3) 单边措辞
    for c in chunks:
        for w in cfg["onesided_words"]:
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


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw = value.replace("，", ",").split(",")
    elif isinstance(value, list):
        raw = value
    else:
        raw = list(value) if isinstance(value, tuple) else []
    return [str(x).strip() for x in raw if str(x).strip()]


def _looks_like_rule_config(value: Any) -> bool:
    return isinstance(value, dict) and any(k in value for k in ("checklist", "vague_words", "onesided_words"))


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
