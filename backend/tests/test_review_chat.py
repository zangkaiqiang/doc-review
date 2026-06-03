from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import engine
from app.main import app
from app.models import Document, Finding, ReviewTask
from app.services.model_gateway import gateway

client = TestClient(app)


def test_review_chat_falls_back_to_existing_findings_without_model(monkeypatch):
    monkeypatch.setitem(gateway._cfg, "api_key", "")

    with Session(engine) as session:
        doc = Document(name="chat.txt", text="甲方拥有最终解释权。")
        session.add(doc)
        session.commit()
        session.refresh(doc)
        task = ReviewTask(doc_id=doc.id, stance="party_a", status="done", score=55, level="high")
        session.add(task)
        session.commit()
        session.refresh(task)
        finding = Finding(
            task_id=task.id,
            source="rule",
            category="单边条款",
            level="high",
            title="单边/不利措辞：最终解释权",
            problem="最终解释权可能造成权责失衡。",
            basis="单边条款规则",
            suggestion="建议改为双方协商解释。",
            quote="甲方拥有最终解释权。",
        )
        session.add(finding)
        session.commit()
        session.refresh(finding)

        resp = client.post(
            f"/api/reviews/{task.id}/chat",
            json={"message": "解释这条风险", "finding_id": finding.id, "history": []},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["model_available"] is False
    assert "最终解释权" in body["reply"]
    assert "建议改为双方协商解释" in body["reply"]


def test_review_chat_stream_falls_back_without_model(monkeypatch):
    monkeypatch.setitem(gateway._cfg, "api_key", "")
    with Session(engine) as session:
        doc = Document(name="stream-chat.txt", text="甲方拥有最终解释权。")
        session.add(doc)
        session.commit()
        session.refresh(doc)
        task = ReviewTask(doc_id=doc.id, stance="party_a", status="done", score=55, level="high")
        session.add(task)
        session.commit()
        session.refresh(task)
        finding = Finding(
            task_id=task.id,
            source="rule",
            category="单边条款",
            level="high",
            title="单边/不利措辞：最终解释权",
            problem="最终解释权可能造成权责失衡。",
            basis="单边条款规则",
            suggestion="建议改为双方协商解释。",
            quote="甲方拥有最终解释权。",
        )
        session.add(finding)
        session.commit()
        session.refresh(finding)

        with client.stream(
            "POST",
            f"/api/reviews/{task.id}/chat/stream",
            json={"message": "解释这条风险", "finding_id": finding.id, "history": []},
        ) as resp:
            body = "".join(resp.iter_text())

    assert "data:" in body
    assert "最终解释权" in body
    assert '"type": "done"' in body
