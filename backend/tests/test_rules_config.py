from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import engine
from app.main import app
from app.models import ReviewTask
from app.services.chunker import Chunk
from app.services.rules_engine import default_rules_for_stance, run
from app.services.scoring_engine import default_scoring_for_stance, resolve_scoring_for_stance

client = TestClient(app)


def test_rules_setting_returns_defaults_and_accepts_updates():
    defaults = client.get("/api/settings/rules")
    assert defaults.status_code == 200
    body = defaults.json()
    assert body["party_a"]["checklist"]
    assert body["party_b"]["checklist"]
    assert body["neutral"]["vague_words"]
    assert body["tenderee"]["onesided_words"]

    cfg = {
        "party_a": {
            "checklist": [{"clause": "交付地点", "keywords": ["交付地点"], "enabled": True}],
            "vague_words": ["马上"],
            "onesided_words": ["单方取消"],
        },
        "party_b": {
            "checklist": [{"clause": "付款节点", "keywords": ["付款节点"], "enabled": True}],
            "vague_words": ["尽早"],
            "onesided_words": ["无限责任"],
        },
    }
    updated = client.put("/api/settings/rules", json=cfg)
    assert updated.status_code == 200
    assert updated.json()["party_a"] == cfg["party_a"]
    assert updated.json()["party_b"] == cfg["party_b"]

    one_stance = client.get("/api/settings/rules/party_b")
    assert one_stance.status_code == 200
    assert one_stance.json() == cfg["party_b"]


def test_create_review_persists_per_contract_rule_config_snapshot():
    cfg = {
        "checklist": [{"clause": "交付地点", "keywords": ["交付地点"], "enabled": True}],
        "vague_words": ["马上"],
        "onesided_words": ["单方取消"],
    }
    resp = client.post(
        "/api/reviews",
        json={"text": "甲方可以单方取消。", "name": "custom.txt", "stance": "party_a", "rule_config": cfg},
    )
    assert resp.status_code == 200
    task_id = resp.json()["task_id"]

    with Session(engine) as session:
        task = session.get(ReviewTask, task_id)

    assert task.rule_config == cfg


def test_rules_engine_uses_configurable_rules():
    cfg = {
        "checklist": [{"clause": "交付地点", "keywords": ["交付地点"], "enabled": True}],
        "vague_words": ["马上"],
        "onesided_words": ["单方取消"],
    }
    chunks = [Chunk(seq=0, text="甲方可以单方取消，乙方马上处理。", char_start=0, char_end=18)]

    findings, checklist = run(chunks, [], cfg)

    assert checklist == [{"clause": "交付地点", "present": False}]
    titles = [f["title"] for f in findings]
    assert "缺失条款：交付地点" in titles
    assert "模糊措辞：马上" in titles
    assert "单边/不利措辞：单方取消" in titles


def test_redlines_can_be_updated_and_deleted():
    created = client.post(
        "/api/kb/redlines",
        json={
            "code": "R999",
            "content": "测试红线",
            "keywords": "测试词",
            "doc_type": "contract",
            "stance": "any",
            "level": "mid",
            "enabled": True,
        },
    )
    assert created.status_code == 200
    redline_id = created.json()["id"]

    updated = client.put(
        f"/api/kb/redlines/{redline_id}",
        json={
            "code": "R999",
            "content": "已修改红线",
            "keywords": "修改词",
            "doc_type": "contract",
            "stance": "party_a",
            "level": "high",
            "enabled": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["content"] == "已修改红线"
    assert updated.json()["enabled"] is False

    deleted = client.delete(f"/api/kb/redlines/{redline_id}")
    assert deleted.status_code == 200
    assert deleted.json() == {"ok": True}


def test_rule_templates_have_stance_specific_clauses():
    party_a = default_rules_for_stance("party_a")
    tenderee = default_rules_for_stance("tenderee")
    neutral = default_rules_for_stance("neutral")
    a_clauses = " ".join(c["clause"] for c in party_a["checklist"])
    t_clauses = " ".join(c["clause"] for c in tenderee["checklist"])
    assert "知识产权" in a_clauses
    assert "投标保证金" in t_clauses
    # 中立与甲方的单边词表取向不同
    assert party_a["onesided_words"] != neutral["onesided_words"]


def test_scoring_defaults_differ_by_stance():
    a = default_scoring_for_stance("party_a")
    n = default_scoring_for_stance("neutral")
    t = default_scoring_for_stance("tenderee")
    assert "单边条款" in a["veto_categories"]
    assert "单边条款" not in n["veto_categories"]
    assert "缺失条款" in t["veto_categories"]
    assert t["thresholds"]["low"] == 88
    assert n["thresholds"]["low"] == 80
    assert a["weights"]["high"] == 18


def test_resolve_scoring_for_stance_merges_override():
    merged = resolve_scoring_for_stance("party_a", {"party_a": {"thresholds": {"low": 95, "mid": 80}}})
    assert merged["thresholds"]["low"] == 95
    assert merged["weights"]["high"] == 18  # 未覆盖项回落该立场默认


def test_scoring_api_returns_per_stance_shape():
    body = client.get("/api/settings/scoring").json()
    for stance in ("party_a", "party_b", "neutral", "tenderee"):
        assert {"weights", "veto_categories", "thresholds"} <= set(body[stance])

    one = client.get("/api/settings/scoring/party_b")
    assert one.status_code == 200
    assert {"weights", "veto_categories", "thresholds"} <= set(one.json())


def test_create_review_persists_scoring_config_snapshot():
    scfg = {
        "weights": {"high": 25, "mid": 9, "low": 4},
        "veto_categories": ["红线命中"],
        "thresholds": {"low": 70, "mid": 50},
    }
    resp = client.post(
        "/api/reviews",
        json={"text": "甲方可以单方取消。", "name": "s.txt", "stance": "party_b", "scoring_config": scfg},
    )
    assert resp.status_code == 200
    with Session(engine) as session:
        task = session.get(ReviewTask, resp.json()["task_id"])
    assert task.scoring_config["weights"]["high"] == 25
    assert task.scoring_config["thresholds"]["low"] == 70


def test_create_review_defaults_scoring_from_stance():
    resp = client.post("/api/reviews", json={"text": "占位文本。", "stance": "tenderee"})
    assert resp.status_code == 200
    with Session(engine) as session:
        task = session.get(ReviewTask, resp.json()["task_id"])
    assert task.scoring_config["thresholds"]["low"] == 88
    assert "缺失条款" in task.scoring_config["veto_categories"]


def test_create_review_rule_partial_override_keeps_stance_clauses():
    # 仅覆盖 vague_words，checklist/onesided 应回落 party_a 立场默认（含专属条款）
    resp = client.post(
        "/api/reviews",
        json={"text": "占位文本。", "stance": "party_a", "rule_config": {"vague_words": ["马上"]}},
    )
    assert resp.status_code == 200
    with Session(engine) as session:
        task = session.get(ReviewTask, resp.json()["task_id"])
    clauses = " ".join(c["clause"] for c in task.rule_config["checklist"])
    assert "知识产权" in clauses
    assert task.rule_config["vague_words"] == ["马上"]


def test_create_review_scoring_partial_override_falls_back_to_stance_default():
    # 仅覆盖 thresholds，weights/veto 应回落 party_b 立场默认
    resp = client.post(
        "/api/reviews",
        json={"text": "占位文本。", "stance": "party_b", "scoring_config": {"thresholds": {"low": 99, "mid": 88}}},
    )
    assert resp.status_code == 200
    with Session(engine) as session:
        task = session.get(ReviewTask, resp.json()["task_id"])
    assert task.scoring_config["thresholds"]["low"] == 99           # 用户覆盖
    assert task.scoring_config["weights"]["high"] == 18             # party_b 默认
    assert "单边条款" in task.scoring_config["veto_categories"]      # party_b 默认


def test_snapshot_isolated_per_task_and_stance():
    a = client.post("/api/reviews", json={"text": "占位文本。", "stance": "neutral"}).json()["task_id"]
    b = client.post("/api/reviews", json={"text": "占位文本。", "stance": "tenderee"}).json()["task_id"]
    with Session(engine) as session:
        ta = session.get(ReviewTask, a)
        tb = session.get(ReviewTask, b)
    assert ta.scoring_config["thresholds"]["low"] == 80
    assert tb.scoring_config["thresholds"]["low"] == 88
    assert ta.scoring_config != tb.scoring_config
    assert ta.rule_config != tb.rule_config


def test_create_review_snapshots_applicable_redlines():
    created = client.post(
        "/api/kb/redlines",
        json={"code": "RSNAP", "content": "快照红线", "keywords": "快照命中",
              "doc_type": "contract", "stance": "party_a", "level": "high", "enabled": True},
    ).json()
    tid = client.post("/api/reviews", json={"text": "占位文本。", "stance": "party_a"}).json()["task_id"]
    # 创建后删除全局红线：已建任务的快照应不受影响
    client.delete(f"/api/kb/redlines/{created['id']}")
    with Session(engine) as session:
        task = session.get(ReviewTask, tid)
    assert "RSNAP" in [r["code"] for r in task.redline_snapshot]


def test_scoring_put_per_stance_persists_and_falls_back():
    cfg = {
        "party_a": {
            "weights": {"high": 30, "mid": 10, "low": 5},
            "veto_categories": ["红线命中"],
            "thresholds": {"low": 90, "mid": 70},
        }
    }
    updated = client.put("/api/settings/scoring", json=cfg)
    assert updated.status_code == 200
    body = updated.json()
    assert body["party_a"]["weights"]["high"] == 30
    assert body["party_b"]["thresholds"]["low"] == 85  # 未指定立场回落默认
    assert client.get("/api/settings/scoring/party_a").json()["weights"]["high"] == 30
