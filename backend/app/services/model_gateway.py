"""模型网关：统一 OpenAI 兼容接口。业务层只依赖本模块，不绑定厂商。

无 api_key 或调用失败时返回 None，由流水线降级到规则兜底（架构 §4/§10）。
"""
from __future__ import annotations

import json
from typing import Optional

from ..config import settings


class ModelGateway:
    def __init__(self) -> None:
        self._cfg = {
            "base_url": settings.llm_base_url,
            "api_key": settings.llm_api_key,
            "model": settings.llm_model,
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
            "timeout": settings.llm_timeout,
        }

    def configure(self, cfg: dict) -> None:
        self._cfg.update({k: v for k, v in cfg.items() if v is not None})

    @property
    def available(self) -> bool:
        return bool(self._cfg.get("api_key"))

    def chat_json(self, system: str, user: str) -> Optional[list]:
        """请求结构化 JSON 输出。失败返回 None（触发降级）。"""
        if not self.available:
            return None
        try:
            from openai import OpenAI

            client = OpenAI(base_url=self._cfg["base_url"], api_key=self._cfg["api_key"],
                            timeout=self._cfg["timeout"])
            resp = client.chat.completions.create(
                model=self._cfg["model"],
                temperature=self._cfg["temperature"],
                max_tokens=self._cfg["max_tokens"],
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            content = resp.choices[0].message.content or "{}"
            data = json.loads(content)
            return data.get("findings", [])
        except Exception:
            # 失败降级：返回 None，流水线只保留规则类意见
            return None


gateway = ModelGateway()
