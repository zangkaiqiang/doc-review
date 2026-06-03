"""评分引擎：可自定义规则逻辑（UX 4.8 / 架构 §6.2）。

评分口径来自配置，而非写死：权重、一票否决、分档阈值。
"""
from __future__ import annotations

from typing import List

DEFAULT_SCORING = {
    "weights": {"high": 15, "mid": 6, "low": 2},   # 各等级扣分
    "veto_categories": ["红线命中"],                # 命中即判高危红档
    "thresholds": {"low": 80, "mid": 60},          # >=80 低危, >=60 中危, 否则高危
}


def score(findings: List[dict], config: dict | None = None) -> tuple[int, str]:
    cfg = {**DEFAULT_SCORING, **(config or {})}
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
