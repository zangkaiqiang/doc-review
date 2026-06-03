"""数据库会话与初始化。"""
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

from .config import settings

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)


def init_db() -> None:
    # 导入模型以注册到元数据
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns() -> None:
    """Lightweight compatibility migration for local SQLite databases."""
    if not settings.database_url.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "reviewtask" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("reviewtask")}
    with engine.begin() as conn:
        if "rule_config" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN rule_config JSON DEFAULT '{}'"))
        if "scoring_config" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN scoring_config JSON DEFAULT '{}'"))
        if "redline_snapshot" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN redline_snapshot JSON DEFAULT '[]'"))


def get_session():
    with Session(engine) as session:
        yield session
