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


def _ensure_sqlite_columns(target_engine=None) -> None:
    """Lightweight compatibility migration for local SQLite databases."""
    eng = target_engine or engine
    if eng.url.get_backend_name() != "sqlite":
        return
    inspector = inspect(eng)
    if "reviewtask" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("reviewtask")}
    with eng.begin() as conn:
        if "rule_config" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN rule_config JSON DEFAULT '{}'"))
        if "scoring_config" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN scoring_config JSON DEFAULT '{}'"))
        if "redline_snapshot" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN redline_snapshot JSON DEFAULT '[]'"))
        if "parent_task_id" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN parent_task_id INTEGER"))
        if "version" not in columns:
            conn.execute(text("ALTER TABLE reviewtask ADD COLUMN version INTEGER DEFAULT 1"))


def get_session():
    with Session(engine) as session:
        yield session
