"""审查相关接口：发起审查、SSE 流式获取、最终结果、更新意见状态。"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session
from ..events import bus
from ..models import Document, ReviewTask, Finding, Redline, Setting
from ..services import rules_engine, scoring_engine
from ..services.model_gateway import gateway
from ..runner import start_review

router = APIRouter(prefix="/api", tags=["reviews"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",   # 关闭 Nginx 缓冲，保证流式
}
_FIELDS = ("source", "category", "level", "title", "quote", "problem", "basis",
           "suggestion", "chunk_seq", "char_start", "char_end", "locate_status", "status")


class ReviewCreate(BaseModel):
    doc_id: int | None = None
    text: str | None = None          # 也支持直接贴文本审查（骨架演示用）
    name: str = "未命名文档"
    doc_type: str = "contract"
    stance: str = "party_a"
    rule_config: dict | None = None
    scoring_config: dict | None = None


class ReviewRerun(BaseModel):
    rule_config: dict | None = None
    scoring_config: dict | None = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ReviewChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)
    finding_id: int | None = None


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/reviews")
def list_reviews(session: Session = Depends(get_session)):
    """历史列表：返回审查任务（新建在前），联文档名。只读。"""
    tasks = session.exec(
        select(ReviewTask).order_by(ReviewTask.created_at.desc(), ReviewTask.id.desc())
    ).all()
    doc_ids = {t.doc_id for t in tasks}
    names = {}
    if doc_ids:
        docs = session.exec(select(Document).where(Document.id.in_(doc_ids))).all()
        names = {d.id: d.name for d in docs}
    return [
        {
            "id": t.id,
            "doc_name": names.get(t.doc_id, "未命名文档"),
            "stance": t.stance,
            "status": t.status,
            "score": t.score,
            "level": t.level,
            "created_at": t.created_at,
        }
        for t in tasks
    ]


def _freeze_and_create_task(
    session: Session, *, doc: Document, stance: str,
    rule_config: dict, scoring_config: dict,
    redline_snapshot: list | None = None,
    parent_task_id: int | None = None, version: int = 1,
) -> ReviewTask:
    """Freeze redline snapshot (if not provided) and create a pending ReviewTask.
    Shared by create and rerun endpoints."""
    if redline_snapshot is None:
        rows = session.exec(select(Redline).where(Redline.enabled == True)).all()  # noqa: E712
        redline_snapshot = [
            r.model_dump() for r in rows
            if r.stance in ("", "any", stance) and r.doc_type in ("", "any", doc.doc_type)
        ]
    task = ReviewTask(
        doc_id=doc.id, stance=stance, status="pending",
        rule_config=rule_config, scoring_config=scoring_config,
        redline_snapshot=redline_snapshot,
        parent_task_id=parent_task_id, version=version,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/reviews")
def create_review(body: ReviewCreate, session: Session = Depends(get_session)):
    """创建审查任务（异步执行，不在此阻塞）。返回 task_id，随后用 /stream 拉流。"""
    if body.doc_id:
        doc = session.get(Document, body.doc_id)
        if not doc:
            raise HTTPException(404, "文档不存在")
    elif body.text:
        doc = Document(name=body.name, doc_type=body.doc_type, text=body.text)
        session.add(doc)
        session.commit()
        session.refresh(doc)
    else:
        raise HTTPException(400, "需提供 doc_id 或 text")

    setting = session.get(Setting, "rules")
    rule_config = (
        rules_engine.normalize_rules(body.rule_config, body.stance)
        if body.rule_config is not None
        else rules_engine.resolve_rules_for_stance(body.stance, setting.value if setting else None)
    )
    scoring_setting = session.get(Setting, "scoring")
    scoring_config = (
        scoring_engine.normalize_scoring(body.scoring_config, body.stance)
        if body.scoring_config is not None
        else scoring_engine.resolve_scoring_for_stance(
            body.stance, scoring_setting.value if scoring_setting else None
        )
    )
    task = _freeze_and_create_task(
        session, doc=doc, stance=body.stance,
        rule_config=rule_config, scoring_config=scoring_config,
    )
    return {"task_id": task.id, "status": task.status}


@router.post("/reviews/{task_id}/rerun")
def rerun_review(task_id: int, body: ReviewRerun, session: Session = Depends(get_session)):
    """基于已完成/失败任务派生新版本：仅改规则/评分，沿用文档+立场+红线快照。"""
    parent = session.get(ReviewTask, task_id)
    if not parent:
        raise HTTPException(404, "任务不存在")
    if parent.status in ("pending", "running"):
        raise HTTPException(409, "父任务尚未完成，无法派生")
    doc = session.get(Document, parent.doc_id)
    if not doc:
        raise HTTPException(404, "文档不存在")

    # Inherit parent snapshot by default; only normalize when user explicitly provides a field
    rule_config = (
        rules_engine.normalize_rules(body.rule_config, parent.stance)
        if body.rule_config is not None else parent.rule_config
    )
    scoring_config = (
        scoring_engine.normalize_scoring(body.scoring_config, parent.stance)
        if body.scoring_config is not None else parent.scoring_config
    )
    redline_snapshot = list(parent.redline_snapshot) if parent.redline_snapshot else None

    new = _freeze_and_create_task(
        session, doc=doc, stance=parent.stance,
        rule_config=rule_config, scoring_config=scoring_config,
        redline_snapshot=redline_snapshot,
        parent_task_id=parent.id, version=(parent.version or 1) + 1,
    )
    start_review(new.id)
    return {"task_id": new.id, "version": new.version}


@router.get("/reviews/{task_id}/stream")
async def stream_review(task_id: int, session: Session = Depends(get_session)):
    """SSE：阶段进度与审查意见边生成边推送。"""
    task = session.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    bus.bind_loop(asyncio.get_running_loop())

    # 已完成的任务：直接从库中回放（支持刷新重连）
    if task.status == "done":
        doc = session.get(Document, task.doc_id)
        findings = session.exec(select(Finding).where(Finding.task_id == task_id)).all()
        payloads = [{"id": f.id, "task_id": task_id, **{k: getattr(f, k) for k in _FIELDS}}
                    for f in findings]
        done = {"type": "done", "status": "done", "score": task.score, "level": task.level,
                "checklist": task.checklist, "profile": task.profile}
        start = {"type": "start", "stance": task.stance,
                 "document": {"id": doc.id, "name": doc.name, "text": doc.text}}

        async def replay():
            yield _sse(start)
            for p in payloads:
                yield _sse({"type": "finding", "finding": p})
            yield _sse(done)

        return StreamingResponse(replay(), media_type="text/event-stream", headers=_SSE_HEADERS)

    # 进行中/待执行：先订阅再启动 worker，避免漏掉早期事件
    sub = await bus.subscribe(task_id)
    start_review(task_id)

    async def gen():
        try:
            async for ev in bus.events(sub):
                yield _sse(ev)
                if ev.get("type") in ("done", "error"):
                    break
        finally:
            await bus.close(sub)

    return StreamingResponse(gen(), media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get("/reviews/{task_id}")
def get_review(task_id: int, session: Session = Depends(get_session)):
    task = session.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    doc = session.get(Document, task.doc_id)
    findings = session.exec(select(Finding).where(Finding.task_id == task_id)).all()
    return {"task": task, "document": {"id": doc.id, "name": doc.name, "text": doc.text},
            "findings": findings}


@router.post("/reviews/{task_id}/chat")
def chat_review(task_id: int, body: ReviewChatRequest, session: Session = Depends(get_session)):
    """基于当前审查任务继续对话。模型不可用时返回规则兜底答复。"""
    task = session.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    doc = session.get(Document, task.doc_id)
    findings = session.exec(select(Finding).where(Finding.task_id == task_id)).all()
    selected = session.get(Finding, body.finding_id) if body.finding_id else None
    if selected and selected.task_id != task_id:
        selected = None

    system = (
        "你是文档审查对话 Agent。只基于给定文档、审查意见和配置结果回答，"
        "不要编造未提供的事实。回答要面向法务/采购用户，直接、可执行。"
    )
    user = _chat_context(task, doc, findings, selected, body)
    reply = gateway.chat_text(system, user)
    if reply:
        return {"reply": reply, "model_available": True}

    return {"reply": _fallback_chat(body.message, findings, selected), "model_available": False}


@router.post("/reviews/{task_id}/chat/stream")
def stream_chat_review(task_id: int, body: ReviewChatRequest, session: Session = Depends(get_session)):
    """流式对话：SSE 推送 delta，便于前端边生成边渲染。"""
    task = session.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    doc = session.get(Document, task.doc_id)
    findings = session.exec(select(Finding).where(Finding.task_id == task_id)).all()
    selected = session.get(Finding, body.finding_id) if body.finding_id else None
    if selected and selected.task_id != task_id:
        selected = None

    system = (
        "你是文档审查对话 Agent。只基于给定文档、审查意见和配置结果回答，"
        "不要编造未提供的事实。回答要面向法务/采购用户，直接、可执行。"
        "可以使用 Markdown 组织答案，例如项目符号、表格和代码块。"
    )
    user = _chat_context(task, doc, findings, selected, body)
    fallback = _fallback_chat(body.message, findings, selected)

    def gen():
        stream = gateway.stream_text(system, user)
        emitted = False
        if stream:
            for chunk in stream:
                emitted = True
                yield _sse({"type": "delta", "delta": chunk, "model_available": True})
        if not emitted:
            yield _sse({"type": "delta", "delta": fallback, "model_available": False})
            yield _sse({"type": "done", "model_available": False})
        else:
            yield _sse({"type": "done", "model_available": True})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=_SSE_HEADERS)


class FindingUpdate(BaseModel):
    status: str | None = None
    reject_reason: str | None = None
    suggestion: str | None = None


@router.patch("/findings/{finding_id}")
def update_finding(finding_id: int, body: FindingUpdate, session: Session = Depends(get_session)):
    f = session.get(Finding, finding_id)
    if not f:
        raise HTTPException(404, "意见不存在")
    if body.status is not None:
        f.status = body.status
    if body.reject_reason is not None:
        f.reject_reason = body.reject_reason
    if body.suggestion is not None:
        f.suggestion = body.suggestion
    session.add(f)
    session.commit()
    return {"ok": True}


def _chat_context(task: ReviewTask, doc: Document, findings: list[Finding], selected: Finding | None, body: ReviewChatRequest) -> str:
    findings_text = "\n".join(
        f"- #{f.id} [{f.level}/{f.category}] {f.title}；问题：{f.problem}；建议：{f.suggestion}"
        for f in findings[:30]
    )
    selected_text = ""
    if selected:
        selected_text = (
            f"\n当前选中意见：#{selected.id} [{selected.level}/{selected.category}] {selected.title}\n"
            f"引用：{selected.quote}\n问题：{selected.problem}\n依据：{selected.basis}\n建议：{selected.suggestion}\n"
        )
    history = "\n".join(f"{m.role}: {m.content}" for m in body.history[-8:])
    doc_text = doc.text[:8000]
    return (
        f"任务：#{task.id}，立场：{task.stance}，状态：{task.status}，评分：{task.score}，等级：{task.level}\n"
        f"文档名：{doc.name}\n文档摘录：\n{doc_text}\n\n"
        f"审查意见：\n{findings_text or '暂无意见'}\n"
        f"{selected_text}\n"
        f"最近对话：\n{history or '无'}\n\n"
        f"用户问题：{body.message}"
    )


def _fallback_chat(message: str, findings: list[Finding], selected: Finding | None) -> str:
    if selected:
        return (
            f"当前选中意见是「{selected.title}」。\n\n"
            f"问题：{selected.problem or '未提供'}\n"
            f"依据：{selected.basis or '未提供'}\n"
            f"建议：{selected.suggestion or '未提供'}\n\n"
            "当前未配置可用模型，因此只能基于已生成的审查意见做摘要式回答。"
        )

    high = [f for f in findings if f.level == "high"]
    if "高危" in message or "风险" in message:
        if not high:
            return "当前未检出高危意见。模型未配置时，我只能基于规则审查结果回答。"
        lines = "\n".join(f"- {f.title}：{f.problem}" for f in high[:5])
        return f"当前高危关注点：\n{lines}\n\n模型未配置时，我只能基于已生成意见回答。"

    if "修改" in message or "建议" in message:
        open_items = [f for f in findings if f.status == "open"]
        if not open_items:
            return "当前没有待处理意见。模型未配置时，我只能基于已生成意见回答。"
        lines = "\n".join(f"- {f.title}：{f.suggestion}" for f in open_items[:5])
        return f"可优先处理这些修改建议：\n{lines}\n\n模型未配置时，我只能基于已生成意见回答。"

    return (
        "我可以基于当前审查意见继续解释风险、整理修改建议或指出高危项。"
        "当前未配置可用模型，因此回答范围限于已生成的规则/模型审查意见。"
    )
