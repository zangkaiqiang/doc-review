# 让审查规则成为核心 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把审查规则从边缘配置项升级为核心——新建审查页让规则占据主区（A），后端支持"改规则→派生新版本→重跑"（B），工作台内可见规则并一键改规则重跑（C）。

**Architecture:** A 是纯前端布局反转，独立先发。B 顺应现有"任务=不可变冻结快照"设计：`ReviewTask` 加 `parent_task_id`/`version` 两列 + `POST /reviews/{id}/rerun` 端点，重跑 = 基于同一文档克隆新任务（v+1）。C 在工作台拉 `getReview` 取规则快照、用 Radix Dialog 抽屉编辑规则、提交后 `navigate` 到新版本并靠路由 `key` 强制 remount 干净重流。

**Tech Stack:** 后端 FastAPI + SQLModel + SQLite（建表 `create_all` + `db.py` 手写 ALTER 兼容迁移，无 Alembic）；前端 React 18 + React Router 6 + Tailwind v4 + Radix UI。后端测试 pytest（`tests/conftest.py` 已隔离到临时库）；前端无单测框架，验证用 `tsc --noEmit` + `vite build` + 人工。

**Spec:** [docs/superpowers/specs/2026-06-04-review-rules-as-core-design.md](../specs/2026-06-04-review-rules-as-core-design.md)

---

## 文件结构

**A 块（纯前端）**
- 修改：`frontend/src/pages/NewReview.tsx` —— 反转布局，规则进主区。

**B 块（后端）**
- 修改：`backend/app/models.py` —— `ReviewTask` 加 `parent_task_id`/`version`。
- 修改：`backend/app/db.py` —— `_ensure_sqlite_columns` 加两条 ALTER + 支持传入 engine（便于测试）。
- 修改：`backend/app/api/reviews.py` —— 抽 `_freeze_and_create_task` helper、加 `ReviewRerun` schema、加 `POST /reviews/{id}/rerun`。
- 新建：`backend/tests/test_migration.py` —— 迁移加列 + 幂等。
- 新建：`backend/tests/test_rerun.py` —— 重跑端点契约与不变量。

**C 块（前端，依赖 B）**
- 修改：`frontend/src/routes.tsx` —— `/review/:id` 按 id 强制 remount。
- 修改：`frontend/src/types.ts` —— `ReviewTask` 加 `version`/`parent_task_id`。
- 修改：`frontend/src/lib/api.ts` —— 加 `rerunReview`。
- 修改：`frontend/src/styles.css` —— 抽屉滑入 keyframes。
- 修改：`frontend/src/pages/Workspace/index.tsx` —— 拉 `getReview`、挂快照卡与抽屉、重跑接线。
- 修改：`frontend/src/pages/Workspace/Dashboard.tsx` —— 顶栏"调整规则·v{n}"入口。
- 新建：`frontend/src/pages/Workspace/RuleSnapshotCard.tsx` —— 左栏只读规则快照卡。
- 新建：`frontend/src/pages/Workspace/RuleDrawer.tsx` —— 规则抽屉（Radix Dialog）。
- 修改：`frontend/package.json` —— 加 `@radix-ui/react-dialog` 依赖。

---

## 重要前置说明

- **前端无单测框架**（package.json 仅 `tsc && vite build`）。前端任务的验证 = `npx tsc --noEmit`（类型）+ `npm run build`（构建）+ 人工核对。不要为本计划引入 vitest/jest（YAGNI，遵循现有约定）。
- **后端测试已隔离**：`backend/tests/conftest.py` 在导入 app 前把 `DOCREVIEW_DATABASE_URL` 指向临时库并 `init_db()`，不污染开发库。无需新建 conftest。
- 后端测试运行目录为 `backend/`，命令用 `uv run pytest`。
- 前端命令运行目录为 `frontend/`。本地 dev 端口被占用时顺延到 5174/5175。
- **重跑会触发后台线程**跑新任务的 pipeline（进程内线程模式）。测试里这无害（无 LLM key 时规则审查很快），断言只校验同步创建结果，不等待审查完成。

---

# Phase A — 新建审查页规则占主区（纯前端，可独立先发）

### Task A1: NewReview 反转布局

**Files:**
- Modify: `frontend/src/pages/NewReview.tsx:125`（容器宽度）、`:126-138`（页头去掉开始按钮）、`:140-321`（主 grid 反转）

- [ ] **Step 1: 容器加宽**

把 `frontend/src/pages/NewReview.tsx:125` 这一行：

```tsx
    <div className="mx-auto max-w-6xl px-6 py-8">
```

改为：

```tsx
    <div className="mx-auto max-w-7xl px-6 py-8">
```

原因：非 compact 规则编辑器内部 `xl:grid-cols-[1.4fr_0.6fr]` 是按视口宽度触发，`max-w-6xl(1152px)` 下主区不够宽会挤压；`max-w-7xl` 与 `RulesConfig` 一致。

- [ ] **Step 2: 页头去掉重复的开始按钮**

把 `frontend/src/pages/NewReview.tsx:126-138`（从 `<div className="mb-6 flex flex-wrap...` 到对应 `</div>`，含 `<Button ...>开始审查</Button>` 那段）整体替换为：

```tsx
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="brand">新任务</Badge>
          <Badge tone="neutral">流式审查</Badge>
        </div>
        <h1 className="text-2xl font-semibold text-ink">新建审查</h1>
      </div>
```

开始按钮反转后只保留左窄栏"当前输入"卡里的那个（见下一步），避免两处割裂。

- [ ] **Step 3: 主 grid 反转（左窄栏=文档/立场/开始，右主区=规则）**

把 `frontend/src/pages/NewReview.tsx` 当前的主 grid 整块（从 `<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">` 到它的闭合 `</div>`，即原 `:140-321`）整体替换为：

```tsx
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
            <Tabs.Root value={mode} onValueChange={(value) => setMode(value as "upload" | "paste")}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
                <Tabs.List className="flex rounded-control border border-line bg-surface p-1">
                  {[
                    { value: "upload", label: "上传文件", icon: UploadCloud },
                    { value: "paste", label: "粘贴文本", icon: ClipboardList },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Tabs.Trigger
                        key={tab.value}
                        value={tab.value}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-muted transition-colors data-[state=active]:bg-brand data-[state=active]:text-white"
                      >
                        <Icon size={15} />
                        {tab.label}
                      </Tabs.Trigger>
                    );
                  })}
                </Tabs.List>
                <div className="text-xs tabular-nums text-muted">
                  {mode === "upload" ? (docInfo ? `${docInfo.chars.toLocaleString()} 字` : "等待文件") : `${textChars.toLocaleString()} 字`}
                </div>
              </div>

              <Tabs.Content value="upload" className="p-5">
                <div
                  onClick={() => fileInput.current?.click()}
                  onDragEnter={() => setDragging(true)}
                  onDragLeave={() => setDragging(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) onFile(file);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInput.current?.click();
                    }
                  }}
                  className={cn(
                    "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-card border border-dashed px-6 py-10 text-center transition-colors",
                    dragging ? "border-brand bg-brand-soft" : "border-line-strong bg-panel hover:border-brand/50 hover:bg-brand-soft/30"
                  )}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".docx,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onFile(file);
                      e.target.value = "";
                    }}
                  />
                  {uploading ? (
                    <span className="flex h-14 w-14 items-center justify-center rounded-card bg-brand-soft text-brand">
                      <Loader2 className="animate-spin" size={24} />
                    </span>
                  ) : docId ? (
                    <span className="flex h-14 w-14 items-center justify-center rounded-card bg-good-soft text-good">
                      <FileText size={24} />
                    </span>
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-card bg-surface text-faint shadow-soft">
                      <UploadCloud size={24} />
                    </span>
                  )}
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {uploading ? "解析中" : docInfo ? docInfo.name : "选择 .docx / .pdf"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {docInfo ? `${docInfo.chars.toLocaleString()} 字已解析` : "拖拽到此处，或点击选择文件"}
                    </div>
                  </div>
                </div>
              </Tabs.Content>

              <Tabs.Content value="paste" className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-ink2">文档文本</div>
                  <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
                    填入示例
                  </Button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  className="min-h-56 w-full resize-y rounded-card border border-line bg-panel p-4 font-mono text-[13px] leading-7 text-ink2 outline-none transition-colors focus:border-brand/50 focus:bg-surface"
                />
              </Tabs.Content>
            </Tabs.Root>
          </section>

          <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
            <div className="mb-3 text-sm font-semibold text-ink">审查立场</div>
            <div className="grid gap-2">
              {STANCES.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setStance(item.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-control border px-3 py-2.5 text-left transition-colors",
                    stance === item.key ? "border-brand bg-brand-soft" : "border-line bg-panel hover:border-brand/40 hover:bg-surface"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      stance === item.key ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-transparent"
                    )}
                  >
                    <CheckCircle2 size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", stance === item.key ? "text-brand" : "text-ink2")}>{item.label}</span>
                    <span className="block text-xs text-muted">{item.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
            <div className="mb-3 text-sm font-semibold text-ink">当前输入</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">来源</span>
                <span className="text-right font-medium text-ink2">{mode === "upload" ? "文件" : "文本"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">内容</span>
                <span className="max-w-44 truncate text-right font-medium text-ink2">
                  {mode === "upload" ? docInfo?.name ?? "未选择" : `${textChars.toLocaleString()} 字`}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">立场</span>
                <span className="text-right font-medium text-ink2">{STANCE_LABEL[stance] ?? stance}</span>
              </div>
            </div>
            <Button className="mt-4 w-full" disabled={!canStart || submitting || uploading} onClick={start} size="lg">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {submitting ? "提交中" : "开始审查"}
            </Button>
          </section>
        </aside>

        <section className="min-w-0 rounded-card border border-line bg-surface shadow-soft">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-panel px-5 py-4">
            <div>
              <div className="text-base font-semibold text-ink">本次审查规则</div>
              <div className="mt-1 text-xs text-muted">{STANCE_LABEL[stance] ?? stance}默认模板，可在提交前覆盖。审查规则是本次任务的核心依据。</div>
            </div>
            {rulesLoading ? <Loader2 size={16} className="shrink-0 animate-spin text-muted" /> : <Badge tone="neutral">任务快照</Badge>}
          </div>
          <div className="space-y-6 p-5">
            {ruleConfig ? (
              <RuleTemplateEditor value={ruleConfig} onChange={setRuleConfig} />
            ) : (
              <div className="rounded-control border border-line bg-panel p-4 text-sm text-muted">规则模板加载中</div>
            )}
            {scoringConfig ? (
              <div className="border-t border-line pt-5">
                <div className="mb-3 text-sm font-medium text-ink2">评分口径</div>
                <ScoringEditor value={scoringConfig} onChange={setScoringConfig} />
              </div>
            ) : null}
          </div>
        </section>
      </div>
```

要点：左 `<aside>` 用 `xl:sticky xl:top-6 xl:self-start` 让开始按钮长页常驻；右主区 `<section>` 加 `min-w-0` 防溢出；规则与评分编辑器去掉 `compact`（全展开）；去掉了原侧栏规则块的 `max-h-[640px] overflow-y-auto`。

- [ ] **Step 4: 类型检查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 无报错（所有用到的 import：Tabs/UploadCloud/ClipboardList/Loader2/FileText/CheckCircle2/ArrowRight/Badge/Button/RuleTemplateEditor/ScoringEditor/STANCE_LABEL/cn 都已在文件原有 import 中，未删改）。

- [ ] **Step 5: 构建**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 6: 人工验证**

启动后端 `cd backend && uv run python -m app`，前端 `cd frontend && npm run dev`，打开 `/new`：
- 桌面宽屏：左窄栏（文档来源 Tabs + 立场 + 当前输入 + 开始按钮）在左，规则编辑器占右主区全展开、不再有 640px 内滚动条。
- 切换立场，右主区规则随之刷新；编辑条款/词表/评分正常。
- 点"开始审查"能正常跳转 `/review/:id`（提交流程未变）。
- 窄屏（<1280）：单列堆叠，文档/立场/开始在前、规则在后。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/NewReview.tsx
git commit -m "feat(frontend): 新建审查页反转布局，审查规则占据主区"
```

---

# Phase B — 后端版本派生 + 重跑（TDD）

### Task B1: ReviewTask 加 parent_task_id/version + SQLite 迁移

**Files:**
- Test: `backend/tests/test_migration.py`（新建）
- Modify: `backend/app/models.py:29-30`（加两列）
- Modify: `backend/app/db.py:22-36`（engine 参数 + 两条 ALTER）

- [ ] **Step 1: 写失败测试（迁移加列 + 幂等）**

新建 `backend/tests/test_migration.py`：

```python
"""验证 _ensure_sqlite_columns 能给旧 schema 补齐新列，且可重复执行。"""
from sqlalchemy import create_engine, inspect, text

from app.db import _ensure_sqlite_columns


def test_ensure_columns_adds_new_columns_and_is_idempotent(tmp_path):
    db = tmp_path / "old_schema.db"
    eng = create_engine(f"sqlite:///{db}")
    # 模拟迁移前的旧 reviewtask 表（缺新版本列）
    with eng.begin() as conn:
        conn.execute(text(
            "CREATE TABLE reviewtask (id INTEGER PRIMARY KEY, doc_id INTEGER, "
            "stance TEXT, status TEXT)"
        ))

    _ensure_sqlite_columns(eng)
    cols = {c["name"] for c in inspect(eng).get_columns("reviewtask")}
    assert "parent_task_id" in cols
    assert "version" in cols

    # 幂等：再跑一次不报错、不重复加列
    _ensure_sqlite_columns(eng)
    cols_again = {c["name"] for c in inspect(eng).get_columns("reviewtask")}
    assert cols_again == cols
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd backend && uv run pytest tests/test_migration.py -v`
Expected: FAIL —— 当前 `_ensure_sqlite_columns()` 不接受参数（`TypeError`）。

- [ ] **Step 3: 实现 —— models.py 加两列**

在 `backend/app/models.py` 的 `ReviewTask` 中，把第 29 行（`redline_snapshot` 那行）之后、`created_at` 那行之前，插入两列：

```python
    redline_snapshot: list = Field(default_factory=list, sa_column=Column(JSON)) # 本次适用红线冻结副本
    parent_task_id: Optional[int] = Field(default=None, foreign_key="reviewtask.id")  # 派生来源（重跑生成的新版本）
    version: int = Field(default=1)      # 版本号（派生新版本时 = 父 + 1）
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

（`Optional` 已在文件顶部 import。）

- [ ] **Step 4: 实现 —— db.py 支持传 engine + 两条 ALTER**

把 `backend/app/db.py:22-36` 的 `_ensure_sqlite_columns` 整个函数替换为：

```python
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
```

（`init_db()` 仍调用 `_ensure_sqlite_columns()`（无参），走全局 `engine`，行为不变；旧库 7 行迁移后 `parent_task_id=NULL`、`version=1`。）

- [ ] **Step 5: 运行测试，确认通过**

Run: `cd backend && uv run pytest tests/test_migration.py -v`
Expected: PASS

- [ ] **Step 6: 回归 —— 全量测试**

Run: `cd backend && uv run pytest -q`
Expected: 全绿（加列后 `create_all` 在临时库建出含新列的表，现有用例不受影响）。

- [ ] **Step 7: 提交**

```bash
git add backend/app/models.py backend/app/db.py backend/tests/test_migration.py
git commit -m "feat(backend): ReviewTask 加 parent_task_id/version + SQLite 兼容迁移"
```

---

### Task B2: 抽 `_freeze_and_create_task` 共享 helper

**Files:**
- Modify: `backend/app/api/reviews.py`（加 helper；create_review 改用它）

- [ ] **Step 1: 建立绿色基线（现有 create 测试）**

Run: `cd backend && uv run pytest tests/test_reviews_list.py -v`
Expected: PASS（这些用例覆盖 create_review 行为，作为重构回归基线）。

- [ ] **Step 2: 加 helper 函数**

在 `backend/app/api/reviews.py` 的 `create_review` 定义之前（约第 80 行 `@router.post("/reviews")` 上方）插入：

```python
def _freeze_and_create_task(
    session: Session, *, doc: Document, stance: str,
    rule_config: dict, scoring_config: dict,
    redline_snapshot: list | None = None,
    parent_task_id: int | None = None, version: int = 1,
) -> ReviewTask:
    """冻结红线快照（如未提供）并建 pending 任务。create 与 rerun 共用。"""
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
```

- [ ] **Step 3: create_review 改用 helper**

把 `backend/app/api/reviews.py` 中 create_review 的"冻结红线 + 建任务 + 返回"那段（原 `:109-123`，从注释 `# 冻结本次适用红线...` 到 `return {"task_id": task.id, "status": task.status}`）替换为：

```python
    task = _freeze_and_create_task(
        session, doc=doc, stance=body.stance,
        rule_config=rule_config, scoring_config=scoring_config,
    )
    return {"task_id": task.id, "status": task.status}
```

（保留其上方 `:95-108` 的 rule_config / scoring_config 解析逻辑不动。）

- [ ] **Step 4: 回归测试**

Run: `cd backend && uv run pytest tests/test_reviews_list.py -v`
Expected: PASS（行为不变）。

- [ ] **Step 5: 提交**

```bash
git add backend/app/api/reviews.py
git commit -m "refactor(backend): 抽取 _freeze_and_create_task helper 供 create/rerun 复用"
```

---

### Task B3: `POST /reviews/{id}/rerun` 重跑端点

**Files:**
- Test: `backend/tests/test_rerun.py`（新建）
- Modify: `backend/app/api/reviews.py`（加 `ReviewRerun` schema + `rerun_review` 端点）

- [ ] **Step 1: 写失败测试**

新建 `backend/tests/test_rerun.py`：

```python
"""重跑端点：派生新版本、继承父快照、状态校验。"""
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
    custom = {"checklist": [{"clause": "专属条款", "keywords": ["专属"], "enabled": True}],
              "vague_words": ["大概"], "onesided_words": []}
    pid = _seed_task(rule_config=custom)
    resp = client.post(f"/api/reviews/{pid}/rerun", json={})
    assert resp.status_code == 200
    new_id = resp.json()["task_id"]
    with Session(engine) as s:
        new = s.get(ReviewTask, new_id)
        # 缺省继承父快照，而非回落立场默认
        assert any(c["clause"] == "专属条款" for c in new.rule_config["checklist"])
        assert "大概" in new.rule_config["vague_words"]


def test_rerun_reuses_parent_redline_snapshot():
    snap = [{"code": "R1", "content": "禁止单方解除", "keywords": "单方解除",
             "doc_type": "contract", "stance": "any", "level": "high", "enabled": True}]
    pid = _seed_task(redline_snapshot=snap)
    new_id = client.post(f"/api/reviews/{pid}/rerun", json={}).json()["task_id"]
    with Session(engine) as s:
        new = s.get(ReviewTask, new_id)
        assert new.redline_snapshot == snap


def test_rerun_rejects_unfinished_parent():
    pid = _seed_task(status="running")
    resp = client.post(f"/api/reviews/{pid}/rerun", json={})
    assert resp.status_code == 409


def test_rerun_missing_parent_returns_404():
    resp = client.post("/api/reviews/999999/rerun", json={})
    assert resp.status_code == 404
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd backend && uv run pytest tests/test_rerun.py -v`
Expected: FAIL —— rerun 路由不存在（404 路由 / 405），断言不通过。

- [ ] **Step 3: 实现 —— ReviewRerun schema**

在 `backend/app/api/reviews.py` 的 `ReviewCreate` 定义之后（约第 38 行后）插入：

```python
class ReviewRerun(BaseModel):
    rule_config: dict | None = None
    scoring_config: dict | None = None
```

- [ ] **Step 4: 实现 —— rerun_review 端点**

在 `backend/app/api/reviews.py` 的 `create_review` 函数之后（`@router.get("/reviews/{task_id}/stream")` 之前）插入：

```python
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

    # 缺省字段继承父快照（不回落立场默认），确保唯一差异是用户改的规则
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
```

（用到的 `rules_engine`/`scoring_engine`/`Redline`/`Document`/`select`/`start_review`/`HTTPException`/`BaseModel` 均已在文件顶部 import。）

- [ ] **Step 5: 运行测试，确认通过**

Run: `cd backend && uv run pytest tests/test_rerun.py -v`
Expected: PASS（5 条全过）。

- [ ] **Step 6: 回归 —— 全量测试**

Run: `cd backend && uv run pytest -q`
Expected: 全绿。

- [ ] **Step 7: 提交**

```bash
git add backend/app/api/reviews.py backend/tests/test_rerun.py
git commit -m "feat(backend): 新增 /reviews/{id}/rerun 派生新版本重跑端点"
```

---

# Phase C — 工作台核心闭环（前端，依赖 B）

### Task C1: 路由按 id remount + 工作台拉取 task 详情 + 类型补字段

**Files:**
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/types.ts:25-35`
- Modify: `frontend/src/pages/Workspace/index.tsx`（import、state、effect）

- [ ] **Step 1: types.ts —— ReviewTask 加字段**

把 `frontend/src/types.ts` 的 `ReviewTask` 接口（`:25-35`）替换为：

```ts
export interface ReviewTask {
  id: number;
  stance: string;
  status: string;
  score: number | null;
  level: Level | null;
  profile: Record<string, any>;
  checklist: ChecklistItem[];
  rule_config: RuleConfig;
  scoring_config?: ScoringConfig;
  version?: number;
  parent_task_id?: number | null;
}
```

- [ ] **Step 2: routes.tsx —— /review/:id 按 id 强制 remount**

把 `frontend/src/routes.tsx` 全文替换为：

```tsx
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { ShellLayout } from "./components/ShellLayout";
import NewReview from "./pages/NewReview";
import History from "./pages/History";
import RulesConfig from "./pages/RulesConfig";
import Workspace from "./pages/Workspace";

// 用路由参数 id 作 key，使切换/派生到新版本时 Workspace 整体 remount、状态归零、SSE 重连
function WorkspaceRoute() {
  const { id } = useParams();
  return <Workspace key={id} />;
}

export const router = createBrowserRouter([
  {
    element: <ShellLayout />,
    children: [
      { path: "/", element: <Navigate to="/new" replace /> },
      { path: "/new", element: <NewReview /> },
      { path: "/history", element: <History /> },
      { path: "/rules", element: <RulesConfig /> },
    ],
  },
  { path: "/review/:id", element: <WorkspaceRoute /> },
]);
```

- [ ] **Step 3: Workspace 拉取 task 详情**

在 `frontend/src/pages/Workspace/index.tsx`：

(a) 改 api import（`:3`）——加 `getReview`：

```tsx
import { getReview, updateFinding } from "../../lib/api";
```

(b) 改 type import（`:5`）——加 `ReviewTask`：

```tsx
import type { ChecklistItem, Finding, Level, ReviewTask } from "../../types";
```

(c) 在 state 区（`running` 那行 `:29` 之后）加：

```tsx
  const [task, setTask] = useState<ReviewTask | null>(null);
```

(d) 在 SSE `useEffect`（结束于 `:84`）之后，新增一个拉取 task 详情的 effect：

```tsx
  // 拉取任务详情（规则快照/版本号），供左栏快照卡与规则抽屉使用
  useEffect(() => {
    let alive = true;
    getReview(taskId)
      .then((r) => {
        if (alive) setTask(r.task);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [taskId]);
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 无报错、构建成功（`task` 暂未渲染，仅引入；getReview 已有定义）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/routes.tsx frontend/src/types.ts frontend/src/pages/Workspace/index.tsx
git commit -m "feat(frontend): 工作台拉取任务详情 + 路由按 id remount（为规则快照/重跑铺路）"
```

---

### Task C2: 左栏只读规则快照卡

**Files:**
- Create: `frontend/src/pages/Workspace/RuleSnapshotCard.tsx`
- Modify: `frontend/src/pages/Workspace/index.tsx:178-183`（插入卡片）

- [ ] **Step 1: 新建 RuleSnapshotCard 组件**

新建 `frontend/src/pages/Workspace/RuleSnapshotCard.tsx`：

```tsx
import { Scale } from "lucide-react";

export function RuleSnapshotCard({
  version,
  clauseCount,
  thresholds,
}: {
  version: number;
  clauseCount: number;
  thresholds: { low: number; mid: number };
}) {
  return (
    <section className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Scale size={16} className="text-brand" />
          本次审查规则
        </div>
        <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand">v{version}</span>
      </div>
      <div className="grid gap-1.5">
        <div className="rounded-control border border-line bg-panel px-3 py-2.5">
          <div className="mb-1 text-xs text-faint">条款清单</div>
          <div className="text-sm font-medium tabular-nums text-ink2">{clauseCount} 条</div>
        </div>
        <div className="rounded-control border border-line bg-panel px-3 py-2.5">
          <div className="mb-1 text-xs text-faint">风险分档阈值</div>
          <div className="text-sm font-medium tabular-nums text-ink2">低 ≥ {thresholds.low} · 中 ≥ {thresholds.mid}</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 在工作台左栏置顶插入快照卡**

在 `frontend/src/pages/Workspace/index.tsx`：

(a) 顶部加 import（与其它 Workspace 子组件 import 放一起）：

```tsx
import { RuleSnapshotCard } from "./RuleSnapshotCard";
```

(b) 把左栏 `<aside>`（`:178-183`）替换为：

```tsx
          <aside className="min-w-0 overflow-auto rounded-card border border-line bg-surface p-4 shadow-soft">
            {task && (
              <RuleSnapshotCard
                version={task.version ?? 1}
                clauseCount={task.rule_config?.checklist?.length ?? 0}
                thresholds={task.scoring_config?.thresholds ?? { low: 0, mid: 0 }}
              />
            )}
            <ClauseChecklist items={checklist} />
            <ProfileCard profile={profile} />
          </aside>
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 无报错、构建成功。

- [ ] **Step 4: 人工验证**

打开任一已完成审查 `/review/:id`：左栏顶部出现"本次审查规则 vN"卡片，显示条款数与阈值；其下是条款完整性、合同档案卡。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/Workspace/RuleSnapshotCard.tsx frontend/src/pages/Workspace/index.tsx
git commit -m "feat(frontend): 工作台左栏新增只读规则快照卡"
```

---

### Task C3: 规则抽屉 + 重跑闭环 + 顶栏入口

**Files:**
- Modify: `frontend/package.json`（加 `@radix-ui/react-dialog`）
- Modify: `frontend/src/styles.css`（抽屉 keyframes）
- Modify: `frontend/src/lib/api.ts`（`rerunReview`）
- Create: `frontend/src/pages/Workspace/RuleDrawer.tsx`
- Modify: `frontend/src/pages/Workspace/Dashboard.tsx`（入口按钮）
- Modify: `frontend/src/pages/Workspace/index.tsx`（接线）

- [ ] **Step 1: 安装 Radix Dialog 依赖**

Run: `cd frontend && npm install @radix-ui/react-dialog`
Expected: `package.json` dependencies 出现 `@radix-ui/react-dialog`（1.x，与现有 Radix 栈一致）；`package-lock.json` 更新。

- [ ] **Step 2: styles.css 加抽屉滑入动画**

在 `frontend/src/styles.css` 的 `@theme { ... }` 内，紧接 Toast 动画块（`:42` 的 `--animate-toast-out` 行）之后、`}`（`:52`）之前插入：

```css

  /* 抽屉（右侧滑入）与遮罩淡入 */
  --animate-drawer-in: drawer-in 200ms ease-out;
  --animate-overlay-in: overlay-in 160ms ease-out;

  @keyframes drawer-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  @keyframes overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
```

- [ ] **Step 3: api.ts 加 rerunReview**

在 `frontend/src/lib/api.ts` 的 `createReview` 之后（约 `:26` 后）插入：

```ts
export async function rerunReview(
  taskId: number,
  body: { rule_config?: RuleConfig; scoring_config?: ScoringConfig }
): Promise<{ task_id: number; version: number }> {
  const r = await fetch(`/api/reviews/${taskId}/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("重跑失败");
  return r.json();
}
```

（`RuleConfig`/`ScoringConfig` 已在文件首行 type import 中。）

- [ ] **Step 4: 新建 RuleDrawer 组件**

新建 `frontend/src/pages/Workspace/RuleDrawer.tsx`：

```tsx
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import type { RuleConfig, ScoringConfig } from "../../types";
import { RuleTemplateEditor } from "../../components/RuleTemplateEditor";
import { ScoringEditor } from "../../components/ScoringEditor";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export function RuleDrawer({
  open,
  onOpenChange,
  version,
  initialRule,
  initialScoring,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: number;
  initialRule: RuleConfig;
  initialScoring: ScoringConfig;
  onSubmit: (rule: RuleConfig, scoring: ScoringConfig) => Promise<void>;
}) {
  const [rule, setRule] = useState<RuleConfig>(initialRule);
  const [scoring, setScoring] = useState<ScoringConfig>(initialScoring);
  const [submitting, setSubmitting] = useState(false);

  // 每次打开抽屉用最新快照重置编辑态
  useEffect(() => {
    if (open) {
      setRule(initialRule);
      setScoring(initialScoring);
    }
  }, [open, initialRule, initialScoring]);

  async function submit() {
    setSubmitting(true);
    try {
      await onSubmit(rule, scoring);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="animate-drawer-in fixed right-0 top-0 z-50 flex h-full w-[760px] max-w-[92vw] flex-col border-l border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink">调整本次审查规则</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted">
                保存后基于当前文档派生新版本（v{version + 1}）并重新审查，原版本作为历史保留。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" title="关闭">
                <X size={17} />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <RuleTemplateEditor value={rule} onChange={setRule} />
            <div className="border-t border-line pt-5">
              <div className="mb-3 text-sm font-medium text-ink2">评分口径</div>
              <ScoringEditor value={scoring} onChange={setScoring} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-panel px-5 py-4">
            <Badge tone="neutral">当前 v{version}</Badge>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost">取消</Button>
              </Dialog.Close>
              <Button onClick={submit} disabled={submitting} size="lg">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {submitting ? "派生中" : "保存为新版本并重跑"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 5: Dashboard 加"调整规则·v{n}"入口**

在 `frontend/src/pages/Workspace/Dashboard.tsx`：

(a) 改 import（`:1`）加 `SlidersHorizontal`：

```tsx
import { ArrowLeft, LayoutPanelLeft, Maximize2, SlidersHorizontal } from "lucide-react";
```

(b) 在 props 类型里（`onBack: () => void;` 那行 `:23` 之后）加两个可选 props：

```tsx
  onBack: () => void;
  version?: number;
  onAdjustRules?: () => void;
```

(c) 在右侧操作区——"专注模式"那个 `<Button>`（`:74-77`）之前插入：

```tsx
          {props.onAdjustRules && (
            <Button variant="ghost" size="sm" onClick={props.onAdjustRules}>
              <SlidersHorizontal size={15} />
              调整规则{props.version ? ` · v${props.version}` : ""}
            </Button>
          )}
```

- [ ] **Step 6: index.tsx 接线（抽屉 + 重跑）**

在 `frontend/src/pages/Workspace/index.tsx`：

(a) 改 api import 行（C1 中已改为 `getReview, updateFinding`）为：

```tsx
import { getReview, rerunReview, updateFinding } from "../../lib/api";
```

(b) 改 type import 行为（加 `RuleConfig, ScoringConfig`）：

```tsx
import type { ChecklistItem, Finding, Level, ReviewTask, RuleConfig, ScoringConfig } from "../../types";
```

(c) 新增组件 import（与其它 Workspace 子组件 import 一起）：

```tsx
import { RuleDrawer } from "./RuleDrawer";
import { normalizeRuleConfig } from "../../components/RuleTemplateEditor";
import { normalizeScoringConfig, defaultScoring } from "../../components/ScoringEditor";
```

(d) 在 state 区加（`task` 那行之后）：

```tsx
  const [drawerOpen, setDrawerOpen] = useState(false);
```

(e) 在 `patch` 函数之后加重跑处理函数：

```tsx
  async function handleRerun(rule: RuleConfig, scoring: ScoringConfig) {
    try {
      const { task_id } = await rerunReview(taskId, {
        rule_config: normalizeRuleConfig(rule),
        scoring_config: normalizeScoringConfig(scoring),
      });
      setDrawerOpen(false);
      nav(`/review/${task_id}`);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }
```

(f) 给 `<Dashboard ... />` 传两个新 props（在 `onBack={() => nav("/history")}` 那行之后、`/>` 之前）：

```tsx
        version={task?.version ?? 1}
        onAdjustRules={task ? () => setDrawerOpen(true) : undefined}
```

(g) 在根 `<div className="flex h-full flex-col bg-bg">` 的最后一个子元素（外层布局 grid `</div>`）之后、根 `</div>` 之前，渲染抽屉：

```tsx
      {task && (
        <RuleDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          version={task.version ?? 1}
          initialRule={task.rule_config}
          initialScoring={task.scoring_config ?? defaultScoring()}
          onSubmit={handleRerun}
        />
      )}
```

- [ ] **Step 7: 类型检查 + 构建**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 无报错、构建成功。

- [ ] **Step 8: 人工验证（端到端核心闭环）**

后端 `cd backend && uv run python -m app`，前端 `cd frontend && npm run dev`：
1. 打开一个已完成的 `/review/:id`，顶栏出现"调整规则·v1"按钮。
2. 点击 → 右侧滑入抽屉，规则/评分编辑器以当前快照为初值、全展开。
3. 改一处条款关键词 → 点"保存为新版本并重跑"。
4. 抽屉关闭，URL 跳到新 `/review/:newId`，工作台 remount、SSE 重新流式，左栏快照卡显示 **v2**，意见随新规则重新生成。
5. 回到 `/history`，原 v1 任务仍在（结果与采纳/驳回未受影响）。

- [ ] **Step 9: 提交**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/styles.css frontend/src/lib/api.ts frontend/src/pages/Workspace/RuleDrawer.tsx frontend/src/pages/Workspace/Dashboard.tsx frontend/src/pages/Workspace/index.tsx
git commit -m "feat(frontend): 工作台规则抽屉 + 改规则派生新版本重跑闭环"
```

---

## 自审（Self-Review）覆盖核对

- **Spec 覆盖**：A（§5）→ Task A1；B 模型+迁移（§6.1）→ B1；helper（§6.2）→ B2；rerun 端点（§6.3）→ B3；C 路由 remount + getReview（§7.0）→ C1；快照卡（§7.1）→ C2；抽屉 + 重跑闭环 + 顶栏入口（§7.2/7.3）→ C3。
- **Spec §6.4 简化说明**：核验确认 `get_review` 已返回完整 task ORM（含 `rule_config`/`scoring_config`，加列后自动含 `version`/`parent_task_id`），故**无需**为 get_review 单独建显式响应 schema —— C1 直接消费即可，省一处后端改动。
- **Spec §6.0 修正**：测试隔离 `tests/conftest.py` **已存在**（指向临时库），无需新建；B 块直接按现有 pytest 模式加测试。
- **类型一致性**：`rerunReview` 返回 `{task_id, version}` 与后端 `rerun_review` 返回一致；`RuleDrawer.onSubmit(rule, scoring)` 与 index 的 `handleRerun(rule, scoring)` 签名一致；`_freeze_and_create_task` 关键字参数在 create/rerun 两处调用一致；`ReviewTask.version?` 在前端用 `?? 1` 兜底。
- **已知取舍（来自 spec §9）**：版本号线性 `parent+1`，回旧版重跑可能同号（靠 id 区分）；红线快照仅复用不在工作台编辑；History 不聚合派生版本。均为 v1 接受范围，不在本计划任务内。

---

## 执行交接

计划已保存到 `docs/superpowers/plans/2026-06-04-review-rules-as-core.md`。两种执行方式：

1. **Subagent-Driven（推荐）** —— 每个 Task 派一个全新 subagent 实现，任务间两段式审查，迭代快。
2. **Inline Execution** —— 在当前会话用 executing-plans 分批执行 + 检查点。

注：A / B / C 三相之间可独立成 PR；**A 可立即先发**。要选哪种执行方式？
