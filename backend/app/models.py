"""核心数据模型（简化版，覆盖架构文档 §8 主要表）。"""
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column, JSON


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    doc_type: str = "contract"          # contract | nda | tender ...
    storage_key: str = ""               # 本地/对象存储 key
    text: str = ""                      # 解析后的全文（MVP 直接存库）
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReviewTask(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    doc_id: int = Field(foreign_key="document.id")
    stance: str = "party_a"             # party_a | party_b | neutral | tenderee
    status: str = "pending"             # pending | running | done | failed
    stage: str = ""                     # 当前阶段（解析/抽取/规则/研判/评分/汇总）
    score: Optional[int] = None         # 风险评分 0-100
    level: Optional[str] = None         # low | mid | high
    profile: dict = Field(default_factory=dict, sa_column=Column(JSON))     # 合同档案卡
    checklist: list = Field(default_factory=list, sa_column=Column(JSON))   # 条款完整性
    rule_config: dict = Field(default_factory=dict, sa_column=Column(JSON)) # 本次审查规则快照
    scoring_config: dict = Field(default_factory=dict, sa_column=Column(JSON)) # 本次审查评分口径快照
    redline_snapshot: list = Field(default_factory=list, sa_column=Column(JSON)) # 本次适用红线冻结副本
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Finding(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="reviewtask.id")
    source: str = "rule"                # rule | llm
    category: str = ""                  # 风险类别
    level: str = "low"                  # low | mid | high
    title: str = ""
    quote: str = ""                     # 命中的原文引用
    problem: str = ""                   # 问题说明
    basis: str = ""                     # 依据（红线编号/法规）
    suggestion: str = ""                # 修改建议
    chunk_seq: Optional[int] = None     # 命中 chunk
    char_start: Optional[int] = None    # 可溯源定位
    char_end: Optional[int] = None
    locate_status: str = "located"      # located | uncertain
    status: str = "open"                # open | accepted | rejected | edited
    reject_reason: str = ""


class Redline(SQLModel, table=True):
    """企业红线条款库（支持批量导入存量）。"""
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = ""                      # 如 R012
    content: str = ""                   # 红线描述
    keywords: str = ""                  # 逗号分隔关键词（MVP 用关键词匹配代替向量）
    doc_type: str = "contract"
    stance: str = "any"
    level: str = "high"
    enabled: bool = True


class Setting(SQLModel, table=True):
    """键值配置：model / scoring。"""
    key: str = Field(primary_key=True)
    value: dict = Field(default_factory=dict, sa_column=Column(JSON))
