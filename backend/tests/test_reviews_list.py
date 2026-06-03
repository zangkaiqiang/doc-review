from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_reviews_returns_created_task():
    created = client.post(
        "/api/reviews",
        json={"text": "第一条 标的：测试。第二条 金额：100元。", "stance": "party_a", "name": "样例.txt"},
    )
    assert created.status_code == 200
    task_id = created.json()["task_id"]

    resp = client.get("/api/reviews")
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    item = next((i for i in items if i["id"] == task_id), None)
    assert item is not None
    assert item["doc_name"] == "样例.txt"
    assert item["stance"] == "party_a"
    assert "created_at" in item
    assert "level" in item and "score" in item


def test_list_reviews_newest_first():
    a = client.post("/api/reviews", json={"text": "甲", "stance": "neutral", "name": "a.txt"}).json()["task_id"]
    b = client.post("/api/reviews", json={"text": "乙", "stance": "neutral", "name": "b.txt"}).json()["task_id"]
    ids = [i["id"] for i in client.get("/api/reviews").json()]
    assert ids.index(b) < ids.index(a)
