"""初始化种子数据：内置几条示例红线，便于开箱演示。"""
from sqlmodel import Session, select

from .db import engine
from .models import Redline

SEED_REDLINES = [
    {"code": "R012", "content": "违约责任应双方对等，不得仅约定一方责任",
     "keywords": "概不负责,概不退还", "level": "high"},
    {"code": "R031", "content": "不得出现单方最终解释权等显失公平条款",
     "keywords": "最终解释权", "level": "high"},
    {"code": "R045", "content": "付款条件应明确，不得使用模糊时限",
     "keywords": "另行约定,视情况", "level": "mid"},
]


def seed() -> None:
    with Session(engine) as s:
        if s.exec(select(Redline)).first():
            return
        for r in SEED_REDLINES:
            s.add(Redline(**r))
        s.commit()
