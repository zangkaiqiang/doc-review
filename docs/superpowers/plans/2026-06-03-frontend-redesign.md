# 前端重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `frontend/` 重做成现代浅色（SaaS 气质）的审查工作台，补齐文件上传与历史列表，并保留 SSE 流式、可溯源定位、采纳/驳回。

**Architecture:** Vite + React 18 + TypeScript。Tailwind v4（`@tailwindcss/vite` 插件 + CSS `@theme` token）做样式，Radix Primitives 做无障碍交互（Toast/Tooltip/Tabs），react-router 做页面路由（Shell 包 `/new`、`/history`；`/review/:id` 全屏），lucide-react 做图标。后端仅新增一个只读列表接口 `GET /api/reviews`。

**Tech Stack:** React 18, TypeScript, Vite 5, Tailwind CSS v4, @radix-ui/react-{toast,tooltip,tabs}, react-router-dom 6, lucide-react；后端 FastAPI + SQLModel + pytest。

**设计依据：** `docs/superpowers/specs/2026-06-03-frontend-redesign-design.md`

**关于"完整代码"与 UI 打磨：** 本计划对逻辑文件（配置、api、类型、后端、路由、SSE 编排）给出可直接运行的完整代码；对展示型组件给出**可运行的 v1 完整代码**（真实 Tailwind 类与结构）。悬停/过渡/骨架等微观打磨在实现时按设计系统 token 顺手完善，不属于占位。

**验证模型：** 前端无单测框架（符合项目现状，门禁为类型检查 + 构建）。每个前端任务以 `npx tsc --noEmit` 和（必要时）`npm run build` 为静态门禁，最后一个任务做一次真实端到端验证。后端新接口用 pytest + TestClient 做契约测试（TDD）。

---

## 文件结构

```
frontend/
  vite.config.ts            # 改：加 @tailwindcss/vite 插件
  package.json              # 改：新增依赖
  src/
    main.tsx                # 改：挂 RouterProvider + ToastProvider
    routes.tsx              # 新：路由表
    styles.css             # 改：@import "tailwindcss" + @theme tokens + 少量 base
    types.ts                # 改：新增 ReviewListItem
    lib/
      cn.ts                 # 新：className 合并工具
      api.ts                # 新：接口层（迁自旧 src/api.ts 并扩展）
    components/
      ShellLayout.tsx       # 新：侧栏 + <Outlet/>
      Sidebar.tsx           # 新：左侧导航
      ui/
        Button.tsx          # 新
        Badge.tsx           # 新（含严重度/评分档位变体）
        Card.tsx            # 新
        SeverityDot.tsx     # 新
        EmptyState.tsx      # 新
        Skeleton.tsx        # 新
        toast.tsx           # 新：Radix Toast Provider + useToast
    pages/
      NewReview.tsx         # 新：上传 + 粘贴 + 立场（重构自旧 components/NewReview.tsx）
      History.tsx           # 新：历史列表
      Workspace/
        index.tsx           # 新：SSE 编排 + 四区布局（重构自旧 components/Workspace.tsx）
        Dashboard.tsx       # 新：顶部栏（阶段进度/评分/筛选/专注）
        ClauseChecklist.tsx # 新：条款完整性
        ProfileCard.tsx     # 新：合同档案卡
        DocumentView.tsx    # 新：原文 + 高亮定位
        FindingsList.tsx    # 新：意见列表
        FindingDetail.tsx   # 新：意见详情 + 采纳/驳回
  （删除）src/App.tsx                    # 由 routes.tsx + ShellLayout 取代
  （删除）src/components/NewReview.tsx   # 迁入 pages/
  （删除）src/components/Workspace.tsx   # 迁入 pages/Workspace/
  （删除）src/api.ts                     # 迁入 lib/

backend/
  pyproject.toml            # 改：加 dev 依赖 pytest + httpx
  app/api/reviews.py        # 改：新增 GET /reviews
  tests/
    conftest.py             # 新：测试用独立 sqlite（导入 app 前设置 env）
    test_reviews_list.py    # 新：GET /reviews 契约测试
```

---

## Task 1: 前端工具链（Tailwind v4 + 依赖 + 设计 token）

**Files:**
- Modify: `frontend/package.json`（经 npm 安装）
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/styles.css`（整体替换）

- [ ] **Step 1: 安装依赖**

Run:
```bash
cd frontend
npm install tailwindcss@latest @tailwindcss/vite@latest
npm install react-router-dom@^6 lucide-react @radix-ui/react-toast @radix-ui/react-tooltip @radix-ui/react-tabs
```
Expected: 安装成功，`package.json` 出现上述依赖。

- [ ] **Step 2: vite.config.ts 加 Tailwind 插件**

把 `frontend/vite.config.ts` 改为（保留已有的 `loadEnv`/代理逻辑）：

```ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Read .env / .env.local. Backend port is overridable to dodge local conflicts.
  const env = loadEnv(mode, process.cwd());
  const backendPort = env.VITE_BACKEND_PORT || "8000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": `http://localhost:${backendPort}`,
      },
    },
  };
});
```

- [ ] **Step 3: styles.css 换成 Tailwind v4 + 设计 token**

整体替换 `frontend/src/styles.css`：

```css
@import "tailwindcss";

@theme {
  /* 表面与边框 */
  --color-bg: #f7f8fa;
  --color-surface: #ffffff;
  --color-line: #eef0f4;

  /* 品牌主色 */
  --color-brand: #6366f1;
  --color-brand-soft: #eef0ff;

  /* 严重度 */
  --color-high: #f04438;
  --color-high-soft: #fef3f2;
  --color-mid: #f5a623;
  --color-mid-soft: #fffaeb;
  --color-mid-fg: #b54708;
  --color-low: #98a0ac;
  --color-low-soft: #f4f5f7;

  /* 正向 / 文本层级 */
  --color-good: #12b76a;
  --color-good-soft: #ecfdf3;
  --color-ink: #11151c;
  --color-ink2: #344054;
  --color-muted: #667085;
  --color-faint: #98a0ac;

  /* 圆角与阴影 */
  --radius-card: 12px;
  --radius-control: 8px;
  --shadow-soft: 0 2px 10px rgb(20 20 40 / 0.05);
  --shadow-pop: 0 6px 24px rgb(20 20 40 / 0.08);
}

@layer base {
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    background: var(--color-bg);
    color: var(--color-ink);
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
}
```

注：token 命名即 Tailwind 工具类来源——`--color-high` → `bg-high` / `text-high` / `border-high`；`--radius-card` → `rounded-card`；`--shadow-soft` → `shadow-soft`。

- [ ] **Step 4: 临时占位 App 验证工具链可编译**

为让此刻能编译（旧 `App.tsx` 仍在），不改其他文件。直接验证：

Run: `cd frontend && npx tsc --noEmit`
Expected: 通过（无类型错误）。

Run: `cd frontend && npm run build`
Expected: 构建成功，Tailwind 正常注入（无 "Cannot find module @tailwindcss/vite" 等错误）。

- [ ] **Step 5: 提交**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/styles.css
git commit -m "build(frontend): 接入 Tailwind v4 + 路由/Radix/图标依赖与设计 token"
```

---

## Task 2: className 工具 + UI 原子组件

**Files:**
- Create: `frontend/src/lib/cn.ts`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/SeverityDot.tsx`
- Create: `frontend/src/components/ui/EmptyState.tsx`
- Create: `frontend/src/components/ui/Skeleton.tsx`

- [ ] **Step 1: cn 工具**

`frontend/src/lib/cn.ts`：

```ts
// Tiny className joiner; falsy values are dropped.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

- [ ] **Step 2: Button**

`frontend/src/components/ui/Button.tsx`：

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "danger" | "success";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand/90 disabled:opacity-50",
  ghost: "bg-transparent text-muted hover:bg-line/60 border border-line",
  danger: "bg-high-soft text-high border border-high/30 hover:bg-high-soft/70",
  success: "bg-good-soft text-good border border-good/30 hover:bg-good-soft/70",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-control px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        VARIANT[variant],
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Badge（含严重度/评分档位变体）**

`frontend/src/components/ui/Badge.tsx`：

```tsx
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "brand" | "high" | "mid" | "low" | "neutral";

const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  high: "bg-high-soft text-high",
  mid: "bg-mid-soft text-mid-fg",
  low: "bg-low-soft text-muted",
  neutral: "bg-line/70 text-muted",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

// level → tone 映射，severity 各处复用
export const levelTone: Record<"high" | "mid" | "low", Tone> = { high: "high", mid: "mid", low: "low" };
```

- [ ] **Step 4: Card**

`frontend/src/components/ui/Card.tsx`：

```tsx
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface shadow-soft", className)} {...props} />;
}
```

- [ ] **Step 5: SeverityDot**

`frontend/src/components/ui/SeverityDot.tsx`：

```tsx
import { cn } from "../../lib/cn";

const COLOR: Record<"high" | "mid" | "low", string> = {
  high: "bg-high",
  mid: "bg-mid",
  low: "bg-low",
};

export function SeverityDot({ level, className }: { level: "high" | "mid" | "low"; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", COLOR[level], className)} />;
}
```

- [ ] **Step 6: EmptyState**

`frontend/src/components/ui/EmptyState.tsx`：

```tsx
import type { ReactNode } from "react";

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="text-sm font-medium text-ink2">{title}</div>
      {hint && <div className="max-w-xs text-xs text-muted">{hint}</div>}
      {action}
    </div>
  );
}
```

- [ ] **Step 7: Skeleton**

`frontend/src/components/ui/Skeleton.tsx`：

```tsx
import { cn } from "../../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-line", className)} />;
}
```

- [ ] **Step 8: 类型检查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 通过（这些是独立纯组件，无外部依赖错误）。

- [ ] **Step 9: 提交**

```bash
git add frontend/src/lib/cn.ts frontend/src/components/ui
git commit -m "feat(frontend): UI 原子组件（Button/Badge/Card/SeverityDot/EmptyState/Skeleton）"
```

---

## Task 3: 类型扩展 + 接口层 lib/api.ts

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: types.ts 新增 ReviewListItem**

在 `frontend/src/types.ts` 末尾追加：

```ts
export interface ReviewListItem {
  id: number;
  doc_name: string;
  stance: string;
  status: string;
  score: number | null;
  level: Level | null;
  created_at: string;
}
```

- [ ] **Step 2: lib/api.ts（迁移旧 api.ts 并扩展）**

`frontend/src/lib/api.ts`：

```ts
import type { ReviewResult, ReviewListItem } from "../types";

export async function uploadDocument(file: File): Promise<{ id: number; name: string; chars: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/documents", { method: "POST", body: fd });
  if (!r.ok) throw new Error("文件上传或解析失败");
  return r.json();
}

export async function createReview(body: {
  doc_id?: number;
  text?: string;
  name?: string;
  stance: string;
}): Promise<{ task_id: number }> {
  const r = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("发起审查失败");
  return r.json();
}

export async function listReviews(): Promise<ReviewListItem[]> {
  const r = await fetch("/api/reviews");
  if (!r.ok) throw new Error("获取历史失败");
  return r.json();
}

export async function getReview(taskId: number): Promise<ReviewResult> {
  const r = await fetch(`/api/reviews/${taskId}`);
  if (!r.ok) throw new Error("获取结果失败");
  return r.json();
}

export async function updateFinding(
  id: number,
  body: { status?: string; reject_reason?: string; suggestion?: string }
): Promise<void> {
  await fetch(`/api/findings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

> 注意：`createReview` 签名从旧的 `(text, stance, name)` 改为接收对象。旧 `src/api.ts` 在后续任务删除前不再被引用（Task 1 的占位 App 仍引用旧 `components/*`，它们引用旧 `../api`；本任务先并存，Task 5/6 切换到新结构时删除旧文件）。

- [ ] **Step 3: 类型检查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/types.ts frontend/src/lib/api.ts
git commit -m "feat(frontend): 接口层 lib/api.ts（上传/列表/创建支持 doc_id）+ ReviewListItem 类型"
```

---

## Task 4: 后端 `GET /api/reviews`（TDD）

**Files:**
- Modify: `backend/pyproject.toml`（dev 依赖）
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_reviews_list.py`
- Modify: `backend/app/api/reviews.py`

- [ ] **Step 1: 加 dev 测试依赖**

Run:
```bash
cd backend
uv add --dev pytest httpx
```
Expected: `pyproject.toml` 出现 `[dependency-groups]` 的 dev 组，含 `pytest`、`httpx`。

- [ ] **Step 2: conftest——测试用独立 sqlite（必须在导入 app 前设 env）**

`backend/tests/conftest.py`：

```python
"""测试隔离：用独立 sqlite 文件，避免污染开发库。

env 必须在导入 app（进而实例化 settings/engine）之前设置。
"""
import os
import pathlib
import tempfile

_DB = pathlib.Path(tempfile.gettempdir()) / "docreview_pytest.db"
if _DB.exists():
    _DB.unlink()
os.environ["DOCREVIEW_DATABASE_URL"] = f"sqlite:///{_DB}"
```

- [ ] **Step 3: 写失败测试**

`backend/tests/test_reviews_list.py`：

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_reviews_returns_created_task():
    # 先用粘贴文本创建一个任务
    created = client.post(
        "/api/reviews",
        json={"text": "第一条 标的：测试。第二条 金额：100元。", "stance": "party_a", "name": "样例.txt"},
    )
    assert created.status_code == 200
    task_id = created.json()["task_id"]

    # 列表应包含它，且带文档名/立场/时间
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
    # 后建的 b 排在 a 前面
    assert ids.index(b) < ids.index(a)
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `cd backend && uv run pytest tests/test_reviews_list.py -v`
Expected: FAIL —— `GET /api/reviews` 当前不存在，返回 405/404，断言不通过。

- [ ] **Step 5: 实现 GET /reviews**

在 `backend/app/api/reviews.py` 中，于 `create_review`（`@router.post("/reviews")`）**之前**插入列表接口（确保 `/reviews` 精确匹配优先于 `/reviews/{task_id}`，FastAPI 实际按声明顺序匹配）：

```python
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
```

（`select`、`Document`、`ReviewTask`、`get_session`、`Depends`、`Session` 均已在文件顶部导入，无需新增 import。）

- [ ] **Step 6: 运行测试，确认通过**

Run: `cd backend && uv run pytest tests/test_reviews_list.py -v`
Expected: PASS（2 passed）。

- [ ] **Step 7: 提交**

```bash
git add backend/pyproject.toml backend/uv.lock backend/tests backend/app/api/reviews.py
git commit -m "feat(backend): 新增只读 GET /api/reviews 历史列表接口 + pytest 契约测试"
```

---

## Task 5: 路由骨架 + ShellLayout + Sidebar + Toast Provider

本任务搭好 App 外壳与路由，让三页能跑通（页面先用最小占位，下一任务填充）。完成后删除旧 `App.tsx`。

**Files:**
- Create: `frontend/src/components/ui/toast.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/ShellLayout.tsx`
- Create: `frontend/src/routes.tsx`
- Modify: `frontend/src/main.tsx`
- Create（占位，下一任务填充）: `frontend/src/pages/NewReview.tsx`、`frontend/src/pages/History.tsx`、`frontend/src/pages/Workspace/index.tsx`
- Delete: `frontend/src/App.tsx`

- [ ] **Step 1: Toast（Radix）**

`frontend/src/components/ui/toast.tsx`：

```tsx
import * as Toast from "@radix-ui/react-toast";
import { createContext, useContext, useState, type ReactNode } from "react";

type ToastItem = { id: number; title: string; tone: "default" | "error" };
type ToastApi = { toast: (title: string, tone?: "default" | "error") => void };

const Ctx = createContext<ToastApi>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = (title: string, tone: "default" | "error" = "default") => {
    const id = ++_id;
    setItems((prev) => [...prev, { id, title, tone }]);
  };
  const remove = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <Ctx.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right" duration={2600}>
        {children}
        {items.map((t) => (
          <Toast.Root
            key={t.id}
            onOpenChange={(open) => !open && remove(t.id)}
            className="rounded-control border border-line bg-surface px-4 py-3 text-sm shadow-pop data-[state=open]:animate-in"
          >
            <Toast.Title className={t.tone === "error" ? "text-high" : "text-ink"}>{t.title}</Toast.Title>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2 outline-none" />
      </Toast.Provider>
    </Ctx.Provider>
  );
}
```

- [ ] **Step 2: Sidebar**

`frontend/src/components/Sidebar.tsx`：

```tsx
import { NavLink } from "react-router-dom";
import { FileText, Plus, History, Library } from "lucide-react";
import { cn } from "../lib/cn";

const item = "flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors";

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-3">
      <div className="mb-3 flex items-center gap-2 px-2 py-1 font-semibold text-ink">
        <FileText size={18} className="text-brand" /> 文档审查
      </div>
      <NavLink to="/new" className={({ isActive }) => cn(item, isActive ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line/60")}>
        <Plus size={16} /> 新建审查
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => cn(item, isActive ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line/60")}>
        <History size={16} /> 历史记录
      </NavLink>
      <div className={cn(item, "cursor-not-allowed text-faint")} title="后续上线">
        <Library size={16} /> 知识库 <span className="ml-auto text-[10px]">后续</span>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: ShellLayout**

`frontend/src/components/ShellLayout.tsx`：

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function ShellLayout() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: 三个页面的最小占位**

`frontend/src/pages/NewReview.tsx`：

```tsx
export default function NewReview() {
  return <div className="p-8">新建审查（占位）</div>;
}
```

`frontend/src/pages/History.tsx`：

```tsx
export default function History() {
  return <div className="p-8">历史记录（占位）</div>;
}
```

`frontend/src/pages/Workspace/index.tsx`：

```tsx
import { useParams } from "react-router-dom";

export default function Workspace() {
  const { id } = useParams();
  return <div className="p-8">工作台（占位）task={id}</div>;
}
```

- [ ] **Step 5: routes.tsx**

`frontend/src/routes.tsx`：

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ShellLayout } from "./components/ShellLayout";
import NewReview from "./pages/NewReview";
import History from "./pages/History";
import Workspace from "./pages/Workspace";

export const router = createBrowserRouter([
  {
    element: <ShellLayout />,
    children: [
      { path: "/", element: <Navigate to="/new" replace /> },
      { path: "/new", element: <NewReview /> },
      { path: "/history", element: <History /> },
    ],
  },
  { path: "/review/:id", element: <Workspace /> },
]);
```

- [ ] **Step 6: main.tsx 挂路由 + Toast**

整体替换 `frontend/src/main.tsx`：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { ToastProvider } from "./components/ui/toast";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </React.StrictMode>
);
```

- [ ] **Step 7: 删除旧 App.tsx（已被路由取代）**

Run:
```bash
cd frontend && rm src/App.tsx
```
（旧 `src/components/NewReview.tsx`、`src/components/Workspace.tsx`、`src/api.ts` 仍在但已无引用；在 Task 6/8 内容迁移完成后删除。此刻它们不被 import，不影响构建。）

- [ ] **Step 8: 类型检查 + 构建**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 通过。注意旧 `components/*.tsx`、`api.ts` 仍会被 tsc 扫描——它们自身类型正确（引用旧 `../api`），应无报错。若 tsc 因未使用文件报错，确认无 import 指向它们即可（不会报"未使用文件"）。

- [ ] **Step 9: 手动验证路由**

Run（另开终端，假设后端已在 8001）: `cd frontend && npm run dev`
打开 http://localhost:5173 → 应重定向到 `/new`，左侧出现侧栏（新建审查高亮）；点「历史记录」切到 `/history`；地址栏手输 `/review/1` 显示工作台占位、无侧栏。

- [ ] **Step 10: 提交**

```bash
git add frontend/src/main.tsx frontend/src/routes.tsx frontend/src/components/ShellLayout.tsx frontend/src/components/Sidebar.tsx frontend/src/components/ui/toast.tsx frontend/src/pages
git add -u frontend/src/App.tsx
git commit -m "feat(frontend): App Shell + react-router 路由骨架 + Radix Toast Provider"
```

---

## Task 6: 新建审查页（上传 + 粘贴 + 立场）

**Files:**
- Modify（填充占位）: `frontend/src/pages/NewReview.tsx`
- Delete: `frontend/src/components/NewReview.tsx`

- [ ] **Step 1: 实现 NewReview**

整体替换 `frontend/src/pages/NewReview.tsx`：

```tsx
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { uploadDocument, createReview } from "../lib/api";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/cn";

const STANCES = [
  { key: "party_a", label: "甲方审合同", hint: "站在采购/甲方，挑对己方不利条款" },
  { key: "party_b", label: "乙方 / 投标", hint: "站在供方/投标方，关注义务与风险" },
  { key: "neutral", label: "中立把关", hint: "不偏不倚，整体合规体检" },
  { key: "tenderee", label: "招标方审标", hint: "审投标响应是否满足要求" },
];

const SAMPLE = `采购合同
甲方：A公司    乙方：B公司
第一条 标的：B公司向A公司提供咨询服务。
第二条 合同金额：人民币1,200,000元。
第三条 付款方式：合同签订后A方尽快支付。
第四条 违约责任：乙方违约的，概不退还已付款项。
第五条 本合同最终解释权归甲方所有。`;

export default function NewReview() {
  const nav = useNavigate();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [stance, setStance] = useState("party_a");
  const [text, setText] = useState(SAMPLE);
  const [docId, setDocId] = useState<number | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onFile(file: File) {
    setUploading(true);
    setDocId(null);
    try {
      const { id, name, chars } = await uploadDocument(file);
      setDocId(id);
      setDocName(`${name}（${chars} 字）`);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    } finally {
      setUploading(false);
    }
  }

  async function start(mode: "file" | "text") {
    setSubmitting(true);
    try {
      const body =
        mode === "file"
          ? { doc_id: docId!, stance }
          : { text, name: "粘贴文本审查", stance };
      const { task_id } = await createReview(body);
      nav(`/review/${task_id}`);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-xl font-semibold text-ink">新建审查</h1>
      <p className="mt-1 text-sm text-muted">上传合同文件或粘贴文本，选择审查立场后开始。</p>

      {/* 立场 */}
      <div className="mt-7">
        <div className="mb-2 text-sm font-medium text-ink2">审查立场</div>
        <div className="grid grid-cols-2 gap-2.5">
          {STANCES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStance(s.key)}
              className={cn(
                "rounded-card border p-3 text-left transition-colors",
                stance === s.key ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40"
              )}
            >
              <div className={cn("text-sm font-medium", stance === s.key ? "text-brand" : "text-ink")}>{s.label}</div>
              <div className="mt-0.5 text-xs text-muted">{s.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 上传 / 粘贴 */}
      <div className="mt-7">
        <Tabs.Root defaultValue="upload">
          <Tabs.List className="mb-3 flex gap-1 border-b border-line">
            {[
              { v: "upload", t: "上传文件" },
              { v: "paste", t: "粘贴文本" },
            ].map((x) => (
              <Tabs.Trigger
                key={x.v}
                value={x.v}
                className="px-3 py-2 text-sm text-muted data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:font-medium data-[state=active]:text-brand"
              >
                {x.t}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="upload">
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-line bg-surface px-6 py-10 text-center hover:border-brand/40"
            >
              <input
                ref={fileInput}
                type="file"
                accept=".docx,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              {uploading ? (
                <Loader2 className="animate-spin text-brand" />
              ) : docId ? (
                <FileText className="text-good" />
              ) : (
                <UploadCloud className="text-faint" />
              )}
              <div className="text-sm text-ink2">
                {uploading ? "解析中…" : docId ? docName : "拖入或点击选择 .docx / .pdf"}
              </div>
            </div>
            <Button className="mt-4" disabled={!docId || submitting || uploading} onClick={() => start("file")}>
              {submitting ? "提交中…" : "开始审查"}
            </Button>
          </Tabs.Content>

          <Tabs.Content value="paste">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              className="w-full rounded-card border border-line bg-surface p-3 font-mono text-[13px] outline-none focus:border-brand/50"
            />
            <Button className="mt-4" disabled={!text.trim() || submitting} onClick={() => start("text")}>
              {submitting ? "提交中…" : "开始审查"}
            </Button>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 删除旧 components/NewReview.tsx**

Run: `cd frontend && rm src/components/NewReview.tsx`

- [ ] **Step 3: 类型检查 + 构建**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 通过。

- [ ] **Step 4: 手动验证**

`npm run dev` →`/new`：切换上传/粘贴 Tab；拖入一个 .docx 应显示「解析中…」→ 文件名+字数；点「开始审查」跳转 `/review/:id`（工作台仍是占位，下个任务做）。粘贴路径同理。上传一个非法文件应弹 Toast 错误。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/NewReview.tsx
git add -u frontend/src/components/NewReview.tsx
git commit -m "feat(frontend): 新建审查页 — 文件上传 + 粘贴 + 立场选择"
```

---

## Task 7: 历史页

**Files:**
- Modify（填充占位）: `frontend/src/pages/History.tsx`

- [ ] **Step 1: 实现 History**

整体替换 `frontend/src/pages/History.tsx`：

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { listReviews } from "../lib/api";
import type { ReviewListItem, Level } from "../types";
import { Badge, levelTone } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";

const STANCE_LABEL: Record<string, string> = {
  party_a: "甲方", party_b: "乙方/投标", neutral: "中立", tenderee: "招标方",
};
const LEVEL_LABEL: Record<Level, string> = { high: "高危", mid: "中危", low: "低危" };
const STATUS_LABEL: Record<string, string> = {
  pending: "待执行", running: "审查中", done: "已完成", failed: "失败",
};

function when(iso: string): string {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function History() {
  const nav = useNavigate();
  const [items, setItems] = useState<ReviewListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listReviews().then(setItems).catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold text-ink">历史记录</h1>
      <p className="mt-1 text-sm text-muted">过往的审查任务，点击查看详情。</p>

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        {error && <div className="p-6 text-sm text-high">{error}</div>}

        {!items && !error && (
          <div className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-5 w-14" />
              </div>
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <EmptyState
            icon={<Inbox size={28} />}
            title="还没有审查记录"
            hint="去新建一份审查，结果会出现在这里。"
            action={<Button className="mt-1" onClick={() => nav("/new")}>新建审查</Button>}
          />
        )}

        {items && items.length > 0 && (
          <div className="divide-y divide-line">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => nav(`/review/${it.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-line/40"
              >
                <span className="truncate font-medium text-ink">{it.doc_name}</span>
                <Badge tone="brand">{STANCE_LABEL[it.stance] ?? it.stance}</Badge>
                <span className="ml-auto text-xs text-muted">{STATUS_LABEL[it.status] ?? it.status}</span>
                {it.level && <Badge tone={levelTone[it.level]}>{it.score} · {LEVEL_LABEL[it.level]}</Badge>}
                <span className="w-28 text-right text-xs tabular-nums text-faint">{when(it.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查 + 构建**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 通过。

- [ ] **Step 3: 手动验证**

`/history`：先建过 1-2 个任务后刷新，应看到列表行（文档名、立场徽章、状态、评分档位徽章、时间）；点击某行跳 `/review/:id`。清空 DB 或全新环境应显示空状态并能点「新建审查」。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/History.tsx
git commit -m "feat(frontend): 历史记录页（列表 + 空状态 + 骨架）"
```

---

## Task 8: 工作台重做（拆组件 + 换样式，保留 SSE/定位）

把旧 `Workspace.tsx` 的逻辑迁入 `pages/Workspace/index.tsx` 并拆成子组件。**SSE 事件处理、`char_start/char_end` 高亮、`locate_status` 语义原样保留。**

**Files:**
- Create: `frontend/src/pages/Workspace/Dashboard.tsx`
- Create: `frontend/src/pages/Workspace/ClauseChecklist.tsx`
- Create: `frontend/src/pages/Workspace/ProfileCard.tsx`
- Create: `frontend/src/pages/Workspace/DocumentView.tsx`
- Create: `frontend/src/pages/Workspace/FindingsList.tsx`
- Create: `frontend/src/pages/Workspace/FindingDetail.tsx`
- Modify（替换占位）: `frontend/src/pages/Workspace/index.tsx`
- Delete: `frontend/src/components/Workspace.tsx`、`frontend/src/api.ts`

- [ ] **Step 1: Dashboard（顶部栏）**

`frontend/src/pages/Workspace/Dashboard.tsx`：

```tsx
import { ArrowLeft } from "lucide-react";
import type { Level } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/cn";

const STAGES = ["切分", "要素抽取", "规则校验", "LLM研判", "评分", "完成"];
const LEVEL_LABEL: Record<Level, string> = { high: "高危", mid: "中危", low: "低危" };

export function Dashboard(props: {
  docName: string;
  stance: string;
  running: boolean;
  stage: string;
  score: number | null;
  level: Level | null;
  counts: { high: number; mid: number; low: number };
  levelFilter: Level | "all";
  onFilter: (l: Level | "all") => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onBack: () => void;
}) {
  const { counts } = props;
  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
      <button onClick={props.onBack} className="text-muted hover:text-ink">
        <ArrowLeft size={18} />
      </button>
      <span className="font-semibold text-ink">{props.docName || "审查中…"}</span>
      {props.stance && <Badge tone="brand">{props.stance}</Badge>}

      {props.running ? (
        <div className="flex items-center gap-1.5 text-xs">
          {STAGES.map((s) => {
            const cur = STAGES.indexOf(props.stage);
            const here = STAGES.indexOf(s);
            return (
              <span
                key={s}
                className={cn(
                  "rounded-full px-2 py-0.5",
                  s === props.stage ? "bg-brand-soft font-medium text-brand" : here < cur ? "bg-good-soft text-good" : "bg-line text-faint"
                )}
              >
                {s}
              </span>
            );
          })}
        </div>
      ) : (
        props.level && (
          <Badge tone={props.level}>风险 {props.score}/100 · {LEVEL_LABEL[props.level]}</Badge>
        )
      )}

      <div className="ml-auto flex items-center gap-2">
        {(["high", "mid", "low"] as const).map((l) => (
          <button
            key={l}
            onClick={() => props.onFilter(props.levelFilter === l ? "all" : l)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              l === "high" && "bg-high-soft text-high",
              l === "mid" && "bg-mid-soft text-mid-fg",
              l === "low" && "bg-low-soft text-muted",
              props.levelFilter === l && "ring-2 ring-brand/40"
            )}
          >
            ● {l === "high" ? "高" : l === "mid" ? "中" : "低"} {counts[l]}
          </button>
        ))}
        <button onClick={props.onToggleFocus} className="rounded-control border border-line px-3 py-1 text-xs text-muted hover:bg-line/60">
          {props.focusMode ? "完整模式" : "专注模式"}
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: ClauseChecklist + ProfileCard**

`frontend/src/pages/Workspace/ClauseChecklist.tsx`：

```tsx
import { Check, X } from "lucide-react";
import type { ChecklistItem } from "../../types";

export function ClauseChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">条款完整性</div>
      {items.length === 0 && <div className="text-xs text-faint">审查中…</div>}
      <ul className="space-y-1 text-[13px]">
        {items.map((c) => (
          <li key={c.clause} className="flex items-center gap-2 text-ink2">
            {c.present ? <Check size={14} className="text-good" /> : <X size={14} className="text-high" />}
            {c.clause}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`frontend/src/pages/Workspace/ProfileCard.tsx`：

```tsx
export function ProfileCard({ profile }: { profile: Record<string, any> }) {
  const rows: [string, string][] = [
    ["金额", profile?.amount ?? "—"],
    ["大写金额", profile?.has_amount_cn ? "有" : "缺"],
    ["主体", profile?.parties_hint ? "甲乙方" : "—"],
  ];
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">合同档案卡</div>
      <div className="rounded-card border border-line bg-bg p-3 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5">
            <span className="text-faint">{k}</span>
            <span className={k === "大写金额" && v === "缺" ? "text-high" : "text-ink2"}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: DocumentView（保留可溯源高亮）**

`frontend/src/pages/Workspace/DocumentView.tsx`：

```tsx
import { useMemo } from "react";
import type { Finding } from "../../types";

const HL: Record<"high" | "mid" | "low", string> = {
  high: "bg-high-soft",
  mid: "bg-mid-soft",
  low: "bg-low-soft",
};

export function DocumentView({ text, finding }: { text: string; finding: Finding | null }) {
  const parts = useMemo(() => {
    if (!finding || finding.char_start == null || finding.char_end == null) {
      return [{ t: text, hl: false as const }];
    }
    const { char_start: s, char_end: e } = finding;
    return [
      { t: text.slice(0, s), hl: false as const },
      { t: text.slice(s, e), hl: true as const },
      { t: text.slice(e), hl: false as const },
    ];
  }, [text, finding]);

  return (
    <pre className="m-0 whitespace-pre-wrap break-words px-6 py-5 font-mono text-[13.5px] leading-[2.05] text-ink2">
      {parts.map((p, i) =>
        p.hl && finding ? (
          <mark key={i} className={`rounded-sm px-0.5 ${HL[finding.level]}`}>{p.t}</mark>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </pre>
  );
}
```

- [ ] **Step 4: FindingsList**

`frontend/src/pages/Workspace/FindingsList.tsx`：

```tsx
import type { Finding } from "../../types";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { cn } from "../../lib/cn";

export function FindingsList(props: {
  findings: Finding[];
  selected: number | null;
  running: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 text-sm font-semibold text-ink">
        审查意见 <span className="font-normal text-faint">{props.findings.length}</span>
        {props.running && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-high">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-high" /> 实时
          </span>
        )}
      </div>
      <div className="overflow-auto">
        {props.findings.length === 0 && <div className="px-3.5 py-3 text-xs text-faint">等待意见产出…</div>}
        {props.findings.map((f) => (
          <button
            key={f.id}
            onClick={() => props.onSelect(f.id)}
            className={cn(
              "flex w-full items-center gap-2.5 border-l-2 px-3.5 py-2.5 text-left text-[13px] transition-colors",
              f.id === props.selected ? "border-brand bg-brand-soft/50" : "border-transparent hover:bg-line/40"
            )}
          >
            <SeverityDot level={f.level} />
            <span className={cn("flex-1 truncate", f.status !== "open" ? "text-faint line-through" : "text-ink2")}>{f.title}</span>
            {f.status !== "open" && <span className="text-[11px] text-faint">{f.status === "accepted" ? "已采纳" : "已驳回"}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: FindingDetail**

`frontend/src/pages/Workspace/FindingDetail.tsx`：

```tsx
import { Quote, AlertTriangle, BookOpen, PenLine, MapPin, MapPinOff, Check, X } from "lucide-react";
import type { Finding } from "../../types";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { Button } from "../../components/ui/Button";

export function FindingDetail({ finding, onPatch }: { finding: Finding; onPatch: (status: Finding["status"]) => void }) {
  const located = finding.locate_status === "located";
  return (
    <div className="flex-1 overflow-auto border-t border-line bg-bg p-3.5 text-[13px] text-ink2">
      <div className="mb-2.5 flex items-center gap-2">
        <SeverityDot level={finding.level} />
        <b className="text-ink">{finding.title}</b>
        <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
          {finding.source === "rule" ? "规则" : "模型"}
        </span>
      </div>
      {finding.quote && (
        <blockquote className="mb-2 flex gap-1.5 rounded-control border border-line bg-surface px-2.5 py-2 text-muted">
          <Quote size={13} className="mt-0.5 shrink-0" /> {finding.quote}
        </blockquote>
      )}
      <p className="mb-1.5 flex gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-mid" /><span><b className="text-ink2">问题：</b>{finding.problem}</span></p>
      <p className="mb-1.5 flex gap-1.5"><BookOpen size={13} className="mt-0.5 shrink-0 text-muted" /><span><b className="text-ink2">依据：</b>{finding.basis}</span></p>
      <p className="mb-1.5 flex gap-1.5"><PenLine size={13} className="mt-0.5 shrink-0 text-brand" /><span><b className="text-ink2">建议：</b>{finding.suggestion}</span></p>
      <p className={`mb-3 flex items-center gap-1.5 text-xs ${located ? "text-good" : "text-mid"}`}>
        {located ? <MapPin size={13} /> : <MapPinOff size={13} />}
        {located ? "已定位原文" : "定位存疑（需人工确认）"}
      </p>
      <div className="flex gap-2">
        <Button variant="success" className="flex-1" onClick={() => onPatch("accepted")}><Check size={14} /> 采纳</Button>
        <Button variant="danger" className="flex-1" onClick={() => onPatch("rejected")}><X size={14} /> 驳回</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Workspace/index.tsx（SSE 编排 + 布局）**

整体替换 `frontend/src/pages/Workspace/index.tsx`：

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { updateFinding } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import type { ChecklistItem, Finding, Level } from "../../types";
import { Dashboard } from "./Dashboard";
import { ClauseChecklist } from "./ClauseChecklist";
import { ProfileCard } from "./ProfileCard";
import { DocumentView } from "./DocumentView";
import { FindingsList } from "./FindingsList";
import { FindingDetail } from "./FindingDetail";

export default function Workspace() {
  const { id } = useParams();
  const taskId = Number(id);
  const nav = useNavigate();
  const { toast } = useToast();

  const [doc, setDoc] = useState<{ name: string; text: string } | null>(null);
  const [stance, setStance] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [score, setScore] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [stage, setStage] = useState("连接中");
  const [running, setRunning] = useState(true);

  const [selected, setSelected] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");

  // SSE：阶段进度与意见边生成边接收（逻辑同旧实现，保持不变）
  useEffect(() => {
    const es = new EventSource(`/api/reviews/${taskId}/stream`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      switch (ev.type) {
        case "start":
          setDoc(ev.document);
          setStance(ev.stance);
          break;
        case "stage":
          setStage(ev.stage);
          break;
        case "finding":
          setFindings((prev) => {
            if (prev.length === 0) setSelected(ev.finding.id);
            return [...prev, ev.finding];
          });
          break;
        case "done":
          setScore(ev.score);
          setLevel(ev.level);
          setChecklist(ev.checklist || []);
          setProfile(ev.profile || {});
          setStage("完成");
          setRunning(false);
          es.close();
          break;
        case "error":
          setStage("失败");
          setRunning(false);
          es.close();
          break;
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [taskId]);

  const counts = {
    high: findings.filter((f) => f.level === "high").length,
    mid: findings.filter((f) => f.level === "mid").length,
    low: findings.filter((f) => f.level === "low").length,
  };
  const shown = levelFilter === "all" ? findings : findings.filter((f) => f.level === levelFilter);
  const current = findings.find((f) => f.id === selected) || null;

  async function patch(status: Finding["status"]) {
    if (!current) return;
    await updateFinding(current.id, { status });
    setFindings((prev) => prev.map((x) => (x.id === current.id ? { ...x, status } : x)));
    toast(status === "accepted" ? "已采纳" : "已驳回");
  }

  return (
    <div className="flex h-full flex-col">
      <Dashboard
        docName={doc?.name ?? ""}
        stance={stance}
        running={running}
        stage={stage}
        score={score}
        level={level}
        counts={counts}
        levelFilter={levelFilter}
        onFilter={setLevelFilter}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((v) => !v)}
        onBack={() => nav("/history")}
      />

      <div className="flex min-h-0 flex-1">
        {!focusMode && (
          <aside className="w-52 shrink-0 overflow-auto border-r border-line bg-surface p-3.5">
            <ClauseChecklist items={checklist} />
            <ProfileCard profile={profile} />
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-auto bg-surface">
          {doc ? <DocumentView text={doc.text} finding={current} /> : <div className="p-16 text-center text-muted">加载原文…</div>}
        </main>

        <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-surface">
          <div className="max-h-[42%] shrink-0 overflow-hidden">
            <FindingsList findings={shown} selected={selected} running={running} onSelect={setSelected} />
          </div>
          {current && <FindingDetail finding={current} onPatch={patch} />}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 删除旧文件**

Run:
```bash
cd frontend && rm src/components/Workspace.tsx src/api.ts
```

- [ ] **Step 8: 类型检查 + 构建**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 通过（旧引用已删除）。

- [ ] **Step 9: 手动验证**

`npm run dev`，从 `/new` 发起一次审查 → 进入 `/review/:id`：
- 顶部阶段进度随 SSE 推进；意见逐条出现（右栏「● 实时」闪烁）。
- 点意见 → 中栏对应原文高亮；`locate_status=uncertain` 的意见不高亮且详情标「定位存疑」。
- 采纳/驳回 → 列表项置灰删除线 + Toast。
- 严重度 chip 筛选生效；专注模式隐藏左栏。
- 刷新页面 → 已完成任务从库回放，状态完整重建。

- [ ] **Step 10: 提交**

```bash
git add frontend/src/pages/Workspace
git add -u frontend/src/components/Workspace.tsx frontend/src/api.ts
git commit -m "feat(frontend): 工作台重做 — 四区拆分组件 + 现代浅色样式（保留 SSE/可溯源）"
```

---

## Task 9: 端到端验证与收尾

**Files:**
- 无新增；只验证与可能的小修。

- [ ] **Step 1: 后端测试全绿**

Run: `cd backend && uv run pytest -v`
Expected: 全部 PASS。

- [ ] **Step 2: 前端静态门禁**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 通过，无类型/构建错误。

- [ ] **Step 3: 完整端到端走查（后端 8001 + 前端 5173 同时起）**

按顺序验证并逐项确认：
1. `/new` 上传 `.docx` → 解析成功 → 开始审查 → 跳 `/review/:id`。
2. SSE 阶段推进 + 意见流式出现。
3. 点意见高亮原文；采纳/驳回生效 + Toast。
4. 刷新 `/review/:id` → 回放完整。
5. `/history` 出现该任务，点击可回工作台。
6. 粘贴文本路径同样可用。
7. 空历史（全新 DB）显示空状态。

- [ ] **Step 4: 残留检查**

Run: `cd frontend && grep -rn "components/NewReview\|components/Workspace\|from \"../api\"\|from \"./api\"" src || echo "无残留旧引用"`
Expected: 「无残留旧引用」。

- [ ] **Step 5: 最终提交（若 Step 3-4 有小修）**

```bash
git add -A
git commit -m "chore(frontend): 重设计端到端走查与收尾"
```

---

## Self-Review 记录（计划自检）

- **Spec 覆盖**：设计系统(Task1)、UI 原子(Task2)、api/类型(Task3)、后端列表接口(Task4)、Shell+路由(Task5)、新建审查含上传(Task6)、历史(Task7)、工作台四区重做含可溯源(Task8)、E2E(Task9)。知识库/评分配置/深色模式按 spec 明确排除。✅
- **占位扫描**：各步含真实代码/命令/预期；无 TBD/TODO。展示型组件为可运行 v1，微观打磨已在 header 声明，非占位。✅
- **类型一致**：`createReview` 全程用对象签名；`ReviewListItem` 字段与后端 `GET /reviews` 返回键一致（id/doc_name/stance/status/score/level/created_at）；`levelTone`、`SeverityDot`、`Badge tone` 的 level 取值统一为 high|mid|low。✅
- **Radix 范围**：v1 仅用 Toast/Tooltip 安装项中的 Toast 与 Tabs（Tooltip 已装备用，Dialog/Select/Progress/ScrollArea 按 YAGNI 推迟），相对 spec 的收窄已在此说明。
