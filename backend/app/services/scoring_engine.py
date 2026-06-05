"""评分引擎：可自定义规则逻辑（UX 4.8 / 架构 §6.2）。

评分口径来自配置，而非写死：权重、一票否决、分档阈值。
口径按立场分默认（甲方/乙方/中立/招标方各一套），并随任务快照保存。
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any, List

DEFAULT_SCORING = {
    "weights": {"high": 15, "mid": 6, "low": 2},   # 各等级扣分
    "veto_categories": ["红线命中"],                # 命中即判高危红档
    "thresholds": {"low": 80, "mid": 60},          # >=80 低危, >=60 中危, 否则高危
}

STANCE_KEYS = ("party_a", "party_b", "neutral", "tenderee")

# 立场专属默认评分口径：严苛度与一票否决类别按立场风险敞口区分（法务口径）。
STANCE_SCORING_DEFAULTS = {
    # 甲方/采购方：对利于乙方的单边让利容忍度低，单边条款入一票否决。
    "party_a": {
        "weights": {"high": 18, "mid": 7, "low": 2},
        "veto_categories": ["红线命中", "单边条款"],
        "thresholds": {"low": 82, "mid": 62},
    },
    # 乙方/供应方：风险敞口最大，对加重己方责任最敏感，mid/low 扣分与阈值最严。
    "party_b": {
        "weights": {"high": 18, "mid": 8, "low": 3},
        "veto_categories": ["红线命中", "单边条款"],
        "thresholds": {"low": 85, "mid": 65},
    },
    # 中立：只做合规体检、不偏袒，沿用基线，单边仅提示不否决。
    "neutral": {
        "weights": {"high": 15, "mid": 6, "low": 2},
        "veto_categories": ["红线命中"],
        "thresholds": {"low": 80, "mid": 60},
    },
    # 招标方/审标：符合性审查从严，缺失关键响应条款亦可构成废标，缺失条款一并入一票否决。
    "tenderee": {
        "weights": {"high": 20, "mid": 8, "low": 3},
        "veto_categories": ["红线命中", "单边条款", "缺失条款"],
        "thresholds": {"low": 88, "mid": 70},
    },
}


def default_scoring() -> dict:
    return deepcopy(DEFAULT_SCORING)


def default_scoring_for_stance(stance: str | None = None) -> dict:
    return deepcopy(STANCE_SCORING_DEFAULTS.get(stance or "", DEFAULT_SCORING))


def default_scoring_templates() -> dict:
    return {stance: default_scoring_for_stance(stance) for stance in STANCE_KEYS}


def normalize_scoring(config: dict | None = None, stance: str | None = None) -> dict:
    """以立场默认为底，按顶层字段覆盖；缺失字段回落默认。"""
    cfg = default_scoring_for_stance(stance) if stance else default_scoring()
    if isinstance(config, dict):
        for key in ("weights", "veto_categories", "thresholds"):
            if config.get(key) is not None:
                cfg[key] = config[key]
    return cfg


def normalize_scoring_templates(config: dict | None = None) -> dict:
    """规范化按审查模板存储的评分口径。

    旧版本存单份评分配置，视为四立场共享模板以保持兼容。
    """
    if _looks_like_scoring_config(config):
        return {stance: normalize_scoring(config, stance) for stance in STANCE_KEYS}
    config = config or {}
    if not isinstance(config, dict) or not config:
        return default_scoring_templates()
    return {str(key): normalize_scoring(value if isinstance(value, dict) else None, str(key)) for key, value in config.items()}


def resolve_scoring_for_stance(stance: str, config: dict | None = None) -> dict:
    if _looks_like_scoring_config(config):
        return normalize_scoring(config, stance)
    if isinstance(config, dict):
        return normalize_scoring(config.get(stance), stance)
    return normalize_scoring(None, stance)


def score(findings: List[dict], config: dict | None = None, stance: str | None = None) -> tuple[int, str]:
    # config 通常是已解析的完整快照；传 stance 仅在快照缺字段时兜底回落该立场默认。
    cfg = normalize_scoring(config, stance)
    weights = cfg["weights"]

    penalty = sum(weights.get(f.get("level", "low"), 0) for f in findings)
    value = max(0, 100 - penalty)

    veto = any(f.get("category") in cfg["veto_categories"] for f in findings)
    if veto:
        value = min(value, cfg["thresholds"]["mid"] - 1)

    th = cfg["thresholds"]
    if value >= th["low"]:
        level = "low"
    elif value >= th["mid"]:
        level = "mid"
    else:
        level = "high"
    return value, level


def _looks_like_scoring_config(value: Any) -> bool:
    return isinstance(value, dict) and any(
        k in value for k in ("weights", "veto_categories", "thresholds")
    )
