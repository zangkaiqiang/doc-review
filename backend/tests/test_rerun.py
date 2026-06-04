"""重跑端点：派生新版本、继承父快照、状态校验、懒起跑（不抢在 /stream 之前起跑）。"""
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.main import app
from app.db import engine
from app.models import Document, ReviewTask

client = TestClient(app)

_RULE = {"checklist": [{"clause": "违约责任", "keywords": ["违约"], "enabled": True}],
         "vague_words": [], "onesided_words": []}
_SCORING = {"weights": {"high": 15, "mid": 6, "low": 2},
            "veto_categories": [], "thresholds": {"low": 80, "mid": 60}}


def _seed_task(*, status="done", stance="party_a", rule_config=None,
               scoring_config=None, redline_snapshot=None, version=1):
    """Insert a Document + ReviewTask directly into the test DB and return task_id."""
    with Session(engine) as s:
        doc = Document(name="t.txt", text="第一条 标的：测试。第二条 违约责任：乙方承担。")
        s.add(doc)
        s.commit()
        s.refresh(doc)
        task = ReviewTask(
            doc_id=doc.id, stance=stance, status=status, version=version,
            rule_config=rule_config or _RULE,
            scoring_config=scoring_config or _SCORING,
            redline_snapshot=redline_snapshot if redline_snapshot is not None else [],
        )
        s.add(task)
        s.commit()
        s.refresh(task)
        return task.id


def test_rerun_creates_new_version_with_parent_link():
    """新任务应携带 version=2、parent_task_id 指向父、rule_config 按请求覆盖。"""
    pid = _seed_task(version=1)
    resp = client.post(f"/api/reviews/{pid}/rerun", json={
        "rule_config": {"checklist": [{"clause": "保密", "keywords": ["保密"], "enabled": True}],
                        "vague_words": [], "onesided_words": []},
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == 2
    new_id = data["task_id"]
    with Session(engine) as s:
        new = s.get(ReviewTask, new_id)
        assert new.parent_task_id == pid
        assert new.version == 2
        assert new.stance == "party_a"
        assert any(c["clause"] == "保密" for c in new.rule_config["checklist"])
        # 父任务原样保留
        parent = s.get(ReviewTask, pid)
        assert parent.version == 1
        assert any(c["clause"] == "违约责任" for c in parent.rule_config["checklist"])


def test_rerun_inherits_parent_snapshot_when_field_omitted():
    """body 未提供字段时应直接继承父快照，而非回落立场默认模板。"""
    custom = {"checklist": [{"clause": "专属条款", "keywords": ["专属"], "enabled": True}],
              "vague_words": ["大概"], "onesided_words": []}
    pid = _seed_task(rule_config=custom)
    resp = client.post(f"/api/reviews/{pid}/rerun", json={})
    assert resp.status_code == 200
    new_id = resp.json()["task_id"]
    with Session(engine) as s:
        new = s.get(ReviewTask, new_id)
        assert any(c["clause"] == "专属条款" for c in new.rule_config["checklist"])
        assert "大概" in new.rule_config["vague_words"]


def test_rerun_reuses_parent_redline_snapshot():
    """新任务的红线快照应与父任务完全一致。"""
    snap = [{"code": "R1", "content": "禁止单方解除", "keywords": "单方解除",
             "doc_type": "contract", "stance": "any", "level": "high", "enabled": True}]
    pid = _seed_task(redline_snapshot=snap)
    new_id = client.post(f"/api/reviews/{pid}/rerun", json={}).json()["task_id"]
    with Session(engine) as s:
        new = s.get(ReviewTask, new_id)
        assert new.redline_snapshot == snap


def test_rerun_rejects_unfinished_parent():
    """父任务处于 pending/running 时应返回 409。"""
    pid = _seed_task(status="running")
    resp = client.post(f"/api/reviews/{pid}/rerun", json={})
    assert resp.status_code == 409


def test_rerun_missing_parent_returns_404():
    """不存在的父任务 ID 应返回 404。"""
    resp = client.post("/api/reviews/999999/rerun", json={})
    assert resp.status_code == 404


def test_rerun_leaves_new_task_pending():
    """rerun 只建 pending 任务、不抢在 /stream 订阅前起跑（避免漏掉早期 SSE 事件）。"""
    pid = _seed_task()
    new_id = client.post(f"/api/reviews/{pid}/rerun", json={}).json()["task_id"]
    with Session(engine) as s:
        assert s.get(ReviewTask, new_id).status == "pending"


def test_rerun_then_stream_delivers_new_version_end_to_end():
    """端到端：连上新版本 /stream 后才起跑，应完整收到 start(含文档) 与 done。"""
    pid = _seed_task()
    new_id = client.post(f"/api/reviews/{pid}/rerun", json={}).json()["task_id"]
    # 连接 /stream 触发订阅+起跑；StreamingResponse 在 done 后结束，body 含全部事件
    resp = client.get(f"/api/reviews/{new_id}/stream")
    assert resp.status_code == 200
    body = resp.text
    assert '"type": "start"' in body          # 文档随 start 事件下发，不会丢失
    assert "违约责任" in body                   # start 事件携带的原文
    assert '"type": "done"' in body
    with Session(engine) as s:
        assert s.get(ReviewTask, new_id).status == "done"
