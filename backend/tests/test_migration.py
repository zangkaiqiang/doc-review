"""Verify _ensure_sqlite_columns adds new columns to old schema and is idempotent."""
from sqlalchemy import create_engine, inspect, text

from app.db import _ensure_sqlite_columns


def test_ensure_columns_adds_new_columns_and_is_idempotent(tmp_path):
    db = tmp_path / "old_schema.db"
    eng = create_engine(f"sqlite:///{db}")
    # Simulate a pre-migration reviewtask table (missing new version columns)
    with eng.begin() as conn:
        conn.execute(text(
            "CREATE TABLE reviewtask (id INTEGER PRIMARY KEY, doc_id INTEGER, "
            "stance TEXT, status TEXT)"
        ))

    _ensure_sqlite_columns(eng)
    cols = {c["name"] for c in inspect(eng).get_columns("reviewtask")}
    assert "parent_task_id" in cols
    assert "version" in cols

    # Idempotent: running again should not raise or duplicate columns
    _ensure_sqlite_columns(eng)
    cols_again = {c["name"] for c in inspect(eng).get_columns("reviewtask")}
    assert cols_again == cols
