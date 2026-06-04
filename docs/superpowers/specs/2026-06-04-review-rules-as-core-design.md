# 设计文档：让审查规则成为核心

- 日期：2026-06-04
- 状态：待用户评审
- 作者：Claude（基于与 kai 的需求澄清 + 对照真实代码的可行性核验）

## 1. 背景与目标

用户反馈：前端"审查规则"所在的位置和占用空间都太小，而审查规则应当是这个工具的**核心和重点**。

调研发现审查规则当前出现在三处，越往操作流程里越被边缘化：

| 位置 | 现状 | 问题 |
|---|---|---|
| 规则配置页 `/rules` | 全宽页面 | 入口靠后、需专门导航；本次不动 |
| 新建审查页 `/new` | 右侧 320px 窄栏、compact、需滚动 | **位置小、空间小** |
| 工作台 `/review/:id` | 完全不显示 | **审查中看不到规则、改不了规则** |

目标：把规则从"可选配置项"升级为审查流程的主角——在新建页占据主区，在工作台可见且可调（改完重跑）。

## 2. 已确认的产品决策

1. **新建审查页**：规则占主区（反转布局）——规则编辑器移到中间主区全展开，文档输入/立场退为左窄栏。
2. **重跑语义**：派生新版本——改规则重跑 = 基于同一文档克隆出新任务（v+1），原任务作为历史保留。顺应现有"任务=不可变冻结快照、可溯源可重放"的设计。
3. **工作台规则呈现形式**：抽屉（Radix Dialog 右滑入），不是整页路由、不是占四区之一。
4. **C 块首版范围**：只做核心闭环（见 §4 范围）。
5. **发布次序**：A 块（纯前端）先独立发布。

## 3. 架构总览

三个改造块，依赖与发布次序如下：

```
A. 新建审查页反转布局   —— 纯前端，零 API 改动，独立先发
        （与 B/C 完全解耦）

B. 后端：版本派生 + 重跑 —— 数据模型 + 端点，是 C 的地基
        B0 测试隔离 → B1 模型+迁移 → B2 抽 helper → B3 rerun 端点 → B4 get_review 显式响应

C. 工作台：改规则重跑核心闭环 —— 前端，强依赖 B
        C0 路由 remount + getReview → C1 规则快照卡 → C2 抽屉 → C3 重跑提交闭环
```

## 4. 范围

### 4.1 本期实现（v1）

- **A**：新建审查页规则占主区。
- **B**：`ReviewTask` 加 `parent_task_id`/`version` 两列 + SQLite 迁移；抽 `_freeze_and_create_task` 共享 helper；`POST /api/reviews/{id}/rerun` 端点；`get_review` 显式响应暴露规则字段；测试隔离 fixture。
- **C**：工作台挂载拉 `getReview`；路由按 id 强制 remount；左栏"规则快照卡"（版本号 / 条款数 / 评分阈值）；规则抽屉（非 compact 编辑器）；"保存为新版本并重跑"闭环。

### 4.2 明确推迟（不在 v1，理由）

| 推迟项 | 理由 |
|---|---|
| 版本切换器（顶栏 v1/v2/v3 药丸 + `GET /versions` 端点） | 核心价值是"改规则→重跑"闭环；切换器引入 versions 端点 + lineage 语义歧义（按 doc_id 还是派生树）+ 分叉版本号冲突，复杂度高。新版本仍可通过 History 进入。 |
| History "派生自 #N · v2" 标记（+ `list_reviews` 补字段） | 纯锦上添花，依赖后端改造 + 前端三处联动，价值仅是历史列表认出派生关系。 |
| 规则快照卡显示"红线数" | 红线不进工作台、用户改不了，单显数字对决策价值低，却要专开 `redline_count` 数据通道。快照卡只显示来自 `getReview` 已有字段的 版本号/条款数/阈值。 |
| 规则 diff（并排对比版本规则差异） | YAGNI，设计正文从未要求。 |
| 红线在工作台内可编辑 | 红线是全局 KB，在 `/rules` 维护；工作台编辑范围限 `rule_config` + `scoring_config`。 |

---

## 5. A 块：新建审查页 — 规则占主区

**唯一改动文件**：`frontend/src/pages/NewReview.tsx`（单文件、复用已有非 compact 编辑器、无需新建组件、无 API 改动）。

### 5.1 现状（已核验）

- 路由：`frontend/src/routes.tsx:13` `{ path: "/new", element: <NewReview /> }`。
- 外层容器：`NewReview.tsx:125` `mx-auto max-w-6xl px-6 py-8`。
- 主 grid：`NewReview.tsx:140` `grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]`。
  - 主区（`:141` `<section>`）= 文档来源 `Tabs.Root`（上传 / 粘贴）。
  - 侧栏（`:244` `<aside>`）= 立场卡（`:245`）+ 当前输入卡（`:274`，底部含开始按钮 `:292`）+ 本次审查规则（`:298`，`RuleTemplateEditor compact :308` / `ScoringEditor compact :315`，外层 `max-h-[640px] overflow-y-auto :306`）。
- 状态/处理函数：`useState` 于 `:35-45`；`onFile`（上传）`:82`；`start`（提交）`:102`；立场切换 `useEffect :57-80` 拉默认规则；`canStart` useMemo `:48-55`；顶栏也有一个开始按钮 `:134`。

### 5.2 改法

1. **外层容器**：`:125` `max-w-6xl` → `max-w-7xl`（与 `RulesConfig.tsx:167` 对齐）。原因（核验确证）：Tailwind 断点是**视口**宽度不是容器宽度；非 compact `RuleTemplateEditor` 内部 `xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]`（`RuleTemplateEditor.tsx:46`）需要主区足够宽才能舒适分两栏，`max-w-6xl(1152px)` 下主区仅约 760px 会偏挤。
2. **主 grid 反转**：`:140` → `grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]`（左窄栏 360px 在前、右主区 1fr 在后）。右主区列加 `min-w-0` 防长内容 / textarea 溢出 grid。
3. **左窄栏**（原 `<aside>`）收纳顺序：文档来源 `Tabs.Root`（把原主区 `:141-242` 整段搬入）+ 立场卡（`:245-272` 原样）+ 当前输入卡（`:274-296` 原样，含底部开始按钮）。容器加 `sticky top-6 self-start space-y-4`，使开始按钮在长页面下常驻可见。
   - 窄栏内尺寸微调：上传拖拽区 `min-h-80`（`:188`）→ `min-h-56`/`min-h-64`；粘贴 textarea `rows={18}`（`:237`）→ `rows≈10`。
4. **右主区**：把原侧栏"本次审查规则" `<section>`（`:298-319`）整块移入；去掉 `max-h-[640px] overflow-y-auto`（主区不再内部滚动）；删除 `RuleTemplateEditor`（`:308`）与 `ScoringEditor`（`:315`）的 `compact` 属性（切非 compact 全展开）；保留两者间 `border-t border-line pt-4`（`:313`）分隔与"评分口径"小标题（`:314`）。
5. **开始按钮**：二选一保留——推荐保留左窄栏 sticky 的（`:292`），移除顶栏（`:134`）那个，避免反转后两个按钮位置割裂。提交流程完全不变：仍走 `start()`/`canStart`/`createReview`/`nav`。

### 5.3 不变量与响应式

- **提交流程零改动**：`createReview` body 仍区分 upload(`{doc_id}`)/paste(`{text,name}`) 并带 `stance` + normalize 后的 `rule_config`/`scoring_config`。
- **桌面优先**：仅 `:140` 的 `xl:` 断点参与分栏；`<xl(1280)` 自动单列堆叠，顺序为 左窄栏内容（文档/立场/开始）在前、右主区规则在后——符合窄屏操作流，不为窄屏额外反转。
- 非 compact 内部断点（`RuleTemplateEditor.tsx:46/:64`、`ScoringEditor.tsx:34`）沿用，`<lg` 条款行竖排回退，与 `RulesConfig` 现状一致，不改组件。

### 5.4 验证

`cd frontend && npx tsc --noEmit && npm run build`。无后端依赖，可单独发布。本地 dev 端口顺延到 5174/5175。

---

## 6. B 块：后端 — 版本派生 + 重跑

技术栈：FastAPI + SQLModel + SQLite，建表用 `SQLModel.metadata.create_all`（`backend/app/db.py:18`），**无 Alembic**。`main.py:26-29` startup 调 `init_db()+seed()`。

### 6.0 B0 — 测试隔离（先行，0 号任务）

**问题（核验确证）**：`backend/tests/*` 用 `TestClient(app.main)` 直打真实 app，`create_review` 会把行写进真实 `docreview.db`（已在污染历史数据）。

**改法**：新增 `backend/tests/conftest.py`，override `settings.database_url` 指向临时/内存 SQLite，每测试重建。后续 B1~B3 的测试都基于干净库，互不污染。

### 6.1 B1 — 数据模型 + 迁移（模型与迁移同一次提交，db.py 先行）

**`backend/app/models.py`** `ReviewTask` 加两列：

```python
parent_task_id: Optional[int] = Field(default=None, foreign_key="reviewtask.id")  # v1 无父
version: int = Field(default=1)
```

**`backend/app/db.py`** —— 关键修正：`_ensure_sqlite_columns()`（`:22-36`）是**硬编码补丁**，只处理 `rule_config/scoring_config/redline_snapshot` 三列，**不是通用 diff 迁移**；`create_all` 只建不存在的表、绝不给已存在的表加列。现有 `docreview.db` 有 7 行 `done` 任务。必须在 `with engine.begin() as conn:` 块内手写两条：

```python
if "parent_task_id" not in columns:
    conn.execute(text("ALTER TABLE reviewtask ADD COLUMN parent_task_id INTEGER"))
if "version" not in columns:
    conn.execute(text("ALTER TABLE reviewtask ADD COLUMN version INTEGER DEFAULT 1"))
```

旧行迁移后 `parent_task_id=NULL`、`version=1`，语义正确。**若漏改 db.py 只改 models.py，启动后查询/插入立即 `no such column`。**

**迁移测试**（B0 之上）：在"只有旧三列"的库上跑 `_ensure_sqlite_columns` 验证两列被加且**幂等**（再跑一次不报错）。

### 6.2 B2 — 抽共享 helper（rerun 的前置，单独提交、回归验证）

把 `create_review`（`backend/app/api/reviews.py:95-122`）的"normalize 规则 + normalize 评分 + 冻结红线快照 + 建 pending 任务 + commit/refresh"整体抽成模块级函数：

```python
def _freeze_and_create_task(
    session, *, doc, stance, rule_config, scoring_config,
    redline_snapshot=None, parent_task_id=None, version=1,
) -> ReviewTask:
    ...
```

- `redline_snapshot=None` → 走现有"按 enabled + stance + doc_type 现场冻结"逻辑（`reviews.py:110-114`）。
- 传入列表 → 直接复用（rerun 拷父快照，绕开红线重过滤）。
- `create_review` 改为调它（行为不变，可单独回归验证）。

### 6.3 B3 — rerun 端点

**契约**：

```
POST /api/reviews/{task_id}/rerun
  request:  { "rule_config"?: object, "scoring_config"?: object }   # 不含 stance/doc_id
  response: { "task_id": int, "version": int }
```

**实现要点**：

1. `parent = session.get(ReviewTask, task_id)`，404 校验。
2. **状态校验**：`if parent.status in ("pending", "running"): raise HTTPException(409, "父任务尚未完成，无法派生")`。`done`/`failed` 放行（`failed` 重试是 rerun 正当用例）。
3. `doc = session.get(Document, parent.doc_id)`。
4. **缺省字段继承父快照**（核心不变量，核验确证的坑）：`normalize_*` 的默认底是按 `stance` 取**立场模板**，不是父快照。所以：
   - `rule_config = normalize_rules(body.rule_config, parent.stance) if body.rule_config is not None else parent.rule_config`
   - `scoring_config = normalize_scoring(body.scoring_config, parent.stance) if body.scoring_config is not None else parent.scoring_config`
   - 即：**传入=覆盖（并 normalize），缺省=直接继承父快照（不再走立场默认）**。
5. **红线**：`redline_snapshot = list(parent.redline_snapshot) if parent.redline_snapshot else None`。`None` 触发 helper 现场重冻（兼容迁移前空快照的旧 7 行）。
6. `version = (parent.version or 1) + 1`（线性递增，见 §8 已知边界）。
7. `new = _freeze_and_create_task(session, doc=doc, stance=parent.stance, rule_config=..., scoring_config=..., redline_snapshot=..., parent_task_id=parent.id, version=...)`。
8. `start_review(new.id)` 异步起跑（`runner._started` 去重对全新 id 天然安全）。
9. `return {"task_id": new.id, "version": new.version}`。

> 时序：rerun 只建 pending 任务并 `start_review`；前端拿 `task_id` 后再调 `/stream`。`stream_review`（`reviews.py:153-166`）对 pending 任务走"先 subscribe 再 start_review"，`pipeline.py:34` 进入即置 `running`，不漏早期事件。

### 6.4 B4 — get_review 显式响应（C 块抽屉/快照卡的唯一数据源）

**问题（核验确证）**：`get_review`（`reviews.py:169-177`）现在直接返回 task ORM 对象。前端 `getReview` 是**死代码**（全仓零调用），工作台数据全靠 SSE，而 SSE 的 `start`/`done` 事件（`pipeline.py:38-39/89-90`）**不含** `rule_config/scoring_config/version`。

**改法**：把 `get_review` 响应建模为显式结构，确保 `task` 包含 `rule_config`、`scoring_config`、`version`、`parent_task_id`、`stance`、`status`、`score`、`level`、`profile`、`checklist`。（新增列本来就会被 Pydantic 自动序列化进 `task`；这里显式化是为了和前端类型对齐、稳定契约。）`redline_count` 不暴露（红线数已砍）。

### 6.5 数据不变量

- rerun 只改 `rule_config` + `scoring_config`；`stance`/`doc_id` 强制继承父；`redline_snapshot` 复用父（或空时重冻）。
- 父任务及其 `Finding` 行（含用户 `accepted`/`rejected` 决定）**原样保留、零触碰**：新版本 findings 由 pipeline 用 `new.id` 新建，`Finding.task_id` 指向新任务，天然隔离，无需额外代码。

### 6.6 B 块测试

- `_freeze_and_create_task` 抽取后 `create_review` 回归（行为不变）。
- rerun：生成新任务且 `version` 自增、`parent_task_id` 正确、复用父 `redline_snapshot`、`body.rule_config` 覆盖生效、缺省字段继承父快照（非立场默认）、父任务 findings 不受影响。
- rerun 状态校验：`running`/`pending` 父返回 409；`done`/`failed` 放行。
- 迁移幂等性（B1）。

---

## 7. C 块：工作台 — 改规则重跑核心闭环

依赖 B 就绪。内部次序：C0 → C1 → C2 → C3。

### 7.0 C0 — 路由 remount + Workspace 拉取 task 详情（修两个 HIGH）

**HIGH-1 状态残留**：`routes.tsx:18` 是单 element 无 key；navigate 到新版本 id 只改 `taskId` 触发 SSE effect 重连（`index.tsx:44-84` 依赖 `[taskId]`），但 `findings/checklist/profile/score/level/selected/stage/running/...`（`index.tsx:21-36`）**全不重置**，且 finding 事件是 append（`index.tsx:58` `[...prev,f]`）→ 切版本后旧 findings 与新流叠加错乱。

**改法**：`routes.tsx` 用 `<Workspace key={id} />`（包一层读 `useParams().id` 当 key 的 wrapper）。一行级改动让整组件按 id remount、所有 state 自然归零、SSE 重连。比手动 reset 十几个 state 更不易漏。

**HIGH-2 抽屉/快照卡无数据源**：Workspace 当前从不调 `getReview`，SSE 不带规则配置。

**改法**：Workspace mount 时 `getReview(taskId)` 取 `task.rule_config/scoring_config/version/parent_task_id`，存 state，供：(1) 左栏快照卡 (2) 抽屉初值 (3) "调整规则·v{n}" 按钮的版本号。新增 state：`task`、`drawerOpen`。

### 7.1 C1 — 规则快照卡（左栏，只读）

新建 `frontend/src/pages/Workspace/RuleSnapshotCard.tsx`：**纯只读展示**（不含交互入口；"调整规则"入口统一在 Dashboard 顶栏，见 C3）。

- props：`{ version, clauseCount, thresholds: {low, mid} }`（**不含红线数、不含 onAdjust**）。
- 数据：`task.version`、`task.rule_config.checklist.length`、`task.scoring_config.thresholds`。
- 样式套左栏卡片范式：参考 `ProfileCard.tsx:11-28`（`rounded-control border border-line bg-panel px-3 py-2.5`）与 `ClauseChecklist.tsx:8-19` 标题行（`text-sm font-semibold text-ink` + 右侧小 `Badge`）。
- 放置（`index.tsx:178-183` `<aside>` 内）：置于 `ClauseChecklist` **之前**，作为左栏第一张卡（规则是核心，置顶）。内部不要 `mt-5`，间距由下方卡片控制。

### 7.2 C2 — 规则抽屉

**新依赖**：`@radix-ui/react-dialog`（package.json 现仅 tabs/toast/tooltip）。与现有 Radix 栈一致，自带 a11y/焦点陷阱/Esc/Portal，避免自实现遮罩成本。

新建 `frontend/src/pages/Workspace/RuleDrawer.tsx`：

- `Dialog.Root open/onOpenChange` + `Dialog.Portal` + `Dialog.Overlay`（`fixed inset-0 bg-black/40 z-40`）+ `Dialog.Content` 右滑入（`fixed right-0 top-0 h-full w-[760px] max-w-[92vw] z-50 bg-surface border-l border-line`）。
- 进入动画用 Tailwind v4 `@theme` keyframes，仿现有 toast 滑入先例（commit `9d71049`）。无新动画依赖。
- 内容区复用 `<RuleTemplateEditor value onChange />` + `<ScoringEditor value onChange />`（**非 compact**；抽屉宽 760px 浮层不受左窄栏约束，多列断点正常）。
- 底部主按钮："保存为新版本并重跑"。

### 7.3 C3 — 重跑提交闭环 + Dashboard 入口

**新增 API**（`frontend/src/lib/api.ts`，沿用现有 `fetch + !r.ok throw` 风格）：

```ts
rerunReview(id: number, body: { rule_config?: RuleConfig; scoring_config?: ScoringConfig }): Promise<{ task_id: number; version: number }>
```

（`getReview` 已存在，C0 起真正调用。）

**抽屉数据流**：

```
打开抽屉 → 用 Workspace 已拉的 task.rule_config/scoring_config 作初始 state
  → 用户编辑（非 compact 编辑器）
  → 点"保存为新版本并重跑"
  → normalizeRuleConfig/normalizeScoringConfig（复用 RuleTemplateEditor.tsx:15 / ScoringEditor.tsx:15，与 NewReview 同一套）
  → rerunReview(taskId, {rule_config, scoring_config}) → { task_id }
  → nav(`/review/${task_id}`)
  → routes key 变化 → Workspace remount → SSE 重连 → 实时重审 → 快照卡显示 v2
```

提交失败 toast 错误（参考 `index.tsx:100` patch 的 try/catch toast 模式）。提交前总是带上当前两份完整 config（避免半空 body，与后端"缺省继承父快照"双保险）。

**Dashboard 入口**（`frontend/src/pages/Workspace/Dashboard.tsx`，右侧操作区 `:51` 附近）：加一个 `Button`（variant ghost）"调整规则·v{n}"触发 `onAdjustRules` 打开抽屉。Dashboard 新增 props：`version`、`onAdjustRules`。（**不加版本切换器**——已推迟。）

### 7.4 C 块测试

- 切换 taskId 后 Workspace remount、旧 findings 不残留。
- 抽屉加载当前 config → 编辑 → 提交 → 跳转新版本并正确流式。
- 快照卡正确显示 version/条款数/阈值。

---

## 8. 数据契约（前后端对齐）

**`frontend/src/types.ts`**：

- `ReviewTask` 加 `parent_task_id?: number | null`、`version: number`。（核验另发现前端 `ReviewTask` 缺 `stage/redline_snapshot/doc_id/created_at`，本期只补 rerun 必需的两个字段，其余不动以控制范围。）

**`frontend/src/lib/api.ts`**：

- 新增 `rerunReview`；`getReview` 由死代码转为实际使用。
- 不新增 `listVersions`（versions 端点已推迟）。

**后端端点**：见 §6.3（rerun）、§6.4（get_review 显式响应）。

## 9. 已知边界 / 接受的取舍（v1）

- **版本号线性递增**：`version = parent.version + 1`。若用户回到旧版本再 rerun（分叉），可能产生同号版本，靠 `task.id` 区分。v1 没有版本切换器，分叉不会在 UI 暴露，接受此取舍；将来上切换器时再定 lineage-max+1 策略。
- **红线看得到改不了**：工作台编辑范围限 `rule_config` + `scoring_config`；红线在 `/rules` 维护。快照卡不显示红线数。
- **History 不聚合派生版本**：派生版本按时间倒序散落在 History（不打标记、不折叠），v1 接受。
- **桌面优先**：A 块反转布局窄屏退化为单列（文档/立场在前、规则在后）。

## 10. 测试策略

- **A**：`tsc --noEmit` + `vite build`（纯前端）。
- **B**：pytest + `conftest.py` 内存库 fixture；覆盖 helper 回归、rerun 各不变量、状态校验、迁移幂等。
- **C**：前端类型/构建检查；关键交互（remount 重置、抽屉提交闭环）。

## 11. 发布次序

1. **A**（独立先发，无副作用）。
2. **B**：B0 测试隔离 → B1 模型+迁移（db.py 先行、同提交）→ B2 抽 helper（单独提交回归）→ B3 rerun 端点 → B4 get_review 显式响应。
3. **C**：C0 remount+getReview → C1 快照卡 → C2 抽屉 → C3 重跑闭环。

## 12. 未来迭代（已推迟项）

版本切换器（+ `GET /versions` + lineage 语义 + 版本号唯一性策略）、History "派生自 #N · v2" 标记（+ `list_reviews` 补字段 + 可选按 lineage 折叠）、快照卡红线数、规则 diff 对比。
