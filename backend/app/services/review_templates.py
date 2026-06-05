"""Review template metadata.

The persisted task field is still named ``stance`` for database compatibility,
but product-facing UI treats the value as a review template key.
"""
from __future__ import annotations

import re
from typing import Any

DEFAULT_TEMPLATES = [
    {"key": "party_a", "label": "甲方审合同", "hint": "采购方风险"},
    {"key": "party_b", "label": "乙方 / 投标", "hint": "履约义务"},
    {"key": "neutral", "label": "中立把关", "hint": "合规体检"},
    {"key": "tenderee", "label": "招标方审标", "hint": "响应偏差"},
]

_KEY_RE = re.compile(r"^[a-zA-Z0-9_-]{1,48}$")


def default_templates() -> list[dict]:
    return [dict(item) for item in DEFAULT_TEMPLATES]


def normalize_templates(value: Any) -> list[dict]:
    if not isinstance(value, list):
        return default_templates()
    result: list[dict] = []
    seen: set[str] = set()
    for raw in value:
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("key") or "").strip()
        label = str(raw.get("label") or "").strip()
        hint = str(raw.get("hint") or "").strip()
        if not key or not label or not _KEY_RE.match(key) or key in seen:
            continue
        seen.add(key)
        result.append({"key": key, "label": label, "hint": hint})
    return result or default_templates()


def label_for(key: str, templates: list[dict] | None = None) -> str:
    for item in templates or default_templates():
        if item.get("key") == key:
            return str(item.get("label") or key)
    return key
