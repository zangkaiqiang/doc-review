# 前端重设计 · 设计文档

- 日期：2026-06-03
- 状态：已与用户确认设计方向，待审阅
- 范围：`frontend/` 前端重做 + 后端一个只读列表接口

## 1. 背景与目标

当前前端是纯手写 CSS 的 MVP 骨架（`frontend/src` 共 ~450 行，无任何组件库），功能完整但视觉朴素：扁平色块、系统字体、emoji 当图标、缺少层次与动效。后端实际已具备文件上传、文档解析（.docx/.pdf）等能力，但前端只暴露了「粘贴文本」一条路径，也没有历史记录入口。

目标：把前端做成一套**现代、精致、可信赖**的审查工作台，并补齐两个核心缺失能力（文件上传、历史列表），同时保留既有的核心价值——SSE 流式审查、可溯源定位、采纳/驳回。

## 2. 范围

**纳入：**
- 现有两个页面（新建审查、四区工作台）的视觉与交互重做。
- 新增「文件上传」（拖拽 .docx/.pdf）。
- 新增「历史/任务列表」页（需后端补一个只读接口）。
- 引入设计系统（Tailwind tokens）、组件库（Radix Primitives）、路由（react-router）、图标（lucide-react）。
- 把过重的 `Workspace.tsx`（205 行）按职责拆分。

**不纳入（留作后续独立小项目）：**
- 知识库（红线库）管理 UI。
- 评分配置 / 模型配置 UI。
- 深色模式。
- 多人协作、报告导出、OCR 等 Roadmap 项。

## 3. 决策记录

| 维度 | 决策 | 理由 |
|------|------|------|
| 设计气质 | 现代 SaaS · 浅色（方向 B） | 清爽、有呼吸感、好上手；用户在 B/C 间最终选浅色现代 |
| 深色模式 | 不做 | YAGNI；聚焦一种观感 |
| 组件库 | Radix UI **Primitives**（非 Themes） | 无障碍交互原语 + 完全自定义样式，能做出差异化设计；契合用户全局偏好 |
| 样式方案 | Tailwind CSS | 改样式快、风格统一、与 Radix 生态成熟 |
| 信息架构 | 侧边栏 App Shell + react-router | 历史/深链对审查工具实用，刷新不丢、链接可分享，给后续导航留位 |
| 图标 | lucide-react | 替换 emoji，统一风格 |

## 4. 信息架构与路由

App Shell：左侧常驻侧栏 + 主内容区。

```
┌─────────┬──────────────────────────┐
│ 文档审查 │                          │
│ ＋新建   │      主内容区              │
│ 历史记录 │   (随路由切换)            │
│ 知识库·  │                          │
│  (置灰)  │                          │
└─────────┴──────────────────────────┘
```

路由（`react-router-dom`）：

| 路径 | 页面 | 布局 |
|------|------|------|
| `/` | 重定向到 `/new` | — |
| `/new` | 新建审查 | App Shell（带侧栏） |
| `/history` | 历史列表 | App Shell（带侧栏） |
| `/review/:id` | 工作台 | **全屏**（侧栏隐藏，避免挤压四栏） |

- `/review/:id` 刷新/直达：直接对 `GET /api/reviews/{id}/stream` 拉流；后端对 `done` 任务会回放，对进行中任务会续推，前端无需区分。
- 侧栏「知识库」置灰并标注「后续」，不可点击。

## 5. 设计系统（Tailwind tokens）

在 `tailwind.config` 的 `theme.extend` 中定义，集中管理：

- **颜色**
  - 背景 `bg`: `#f7f8fa`；卡片 `surface`: `#ffffff`；边框 `border`: `#eef0f4`
  - 主色 `brand`: `#6366f1`（indigo-500），浅底 `#eef0ff`
  - 严重度：`high #f04438`、`mid #f5a623`、`low #98a0ac`；各自浅底用于徽章
  - 正向 `#12b76a`（已定位/采纳）；文本 `#11151c`（主）/`#667085`（次）/`#98a0ac`（弱）
- **圆角**：卡片 `12px`、控件 `8px`、pill 全圆
- **阴影**：`soft = 0 2px 10px rgba(20,20,40,.05)`、`pop = 0 6px 24px rgba(20,20,40,.08)`（浮层）
- **间距**：8pt 栅格（Tailwind 默认即可）
- **字体**：沿用系统无衬线；评分、金额等数字用 `tabular-nums` 等宽对齐
- 全局 `styles.css` 改为 Tailwind 三段式（`@tailwind base/components/utilities`），保留极少量全局基样式

## 6. 组件清单

**Radix Primitives 封装：**
- `Dialog`（确认/二次确认）、`Tabs`、`Tooltip`、`Select`（立场/筛选）、`Toast`（采纳/驳回反馈）、`ScrollArea`、`Progress`（评分/阶段进度）

**自封装 UI 原子（`components/ui/`）：**
- `Button`（primary / ghost / danger 变体）
- `Badge` / `Pill`（含严重度变体）
- `Card`
- `SeverityDot`（按 level 着色的小圆点）
- `EmptyState`（空列表引导）
- `Skeleton`（加载骨架）

**图标**：`lucide-react`，统一替换现有 emoji（返回、上传、采纳/驳回、严重度等）。

## 7. 页面详细设计

### 7.1 新建审查 `/new`
- **上传区**：拖拽 + 点击选择，接受 `.docx`/`.pdf`。选中后调 `POST /api/documents`（multipart）→ 拿 `{id, name, chars}`；展示「解析中…」与解析后字符数。
- **粘贴文本**：「或粘贴文本」折叠区，保留现有 `SAMPLE` 演示文本；与上传二选一。
- **立场选择**：4 张卡片（甲方审合同 / 乙方·投标 / 中立把关 / 招标方审标），带一句说明，单选高亮。
- **开始审查**：有文件或文本时可点。走 `POST /api/reviews`：上传路径传 `doc_id`，粘贴路径传 `text`。成功后跳转 `/review/:task_id`。
- 错误（上传失败、解析失败）用 Toast 提示，不打断。

### 7.2 历史 `/history`
- 调 `GET /api/reviews` 取任务列表，渲染为**表格式列表行**，每行：文档名、立场徽章、状态、评分档位徽章（高/中/低危配色）、相对时间。
- 点击某项 → `/review/:id`（已完成走回放，进行中续推）。
- 空状态：`EmptyState` 引导「去新建第一份审查」。
- 排序：按 `created_at` 倒序（后端返回即按此序）。

### 7.3 工作台 `/review/:id`（四区重做，全屏）
保留现有数据流（`EventSource` 订阅 SSE，`start/stage/finding/done/error` 事件），仅重做结构与样式，并拆分组件。

- **① 顶部 `Dashboard`**：返回、文档名、立场 pill；运行中显示阶段进度（切分→要素抽取→规则校验→LLM研判→评分→完成），完成后显示风险评分 pill（按 level 配色）；右侧严重度计数 chip（可点筛选）+ 专注模式切换。
- **② 左栏**：`ClauseChecklist`（条款完整性，✓/✕ 配色）+ `ProfileCard`（合同档案卡：金额、大写金额、主体，key-value 卡片）。专注模式下隐藏。
- **③ 中栏 `DocumentView`**：原文渲染，按选中意见的 `char_start/char_end` 高亮（保留可溯源逻辑）；选中意见时平滑滚动定位。`locate_status=uncertain` 不高亮、标注「定位存疑」。
- **④ 右栏**：`FindingsList`（按严重度筛选，severityDot + 标题 + 来源标签 + 状态）+ `FindingDetail`（引用、问题、依据、建议、定位状态、采纳/驳回按钮）。采纳/驳回调 `PATCH /api/findings/{id}` 并就地更新 + Toast。

## 8. 数据流与 API

**前端 `lib/api.ts` 变更：**
- 新增 `uploadDocument(file: File): Promise<{ id: number; name: string; chars: number }>`（multipart）
- `createReview` 支持 `doc_id`（保留 `text` 路径）
- 新增 `listReviews(): Promise<ReviewListItem[]>`

**后端唯一改动——新增只读接口 `GET /api/reviews`：**

返回任务列表（联 `Document.name`），按 `created_at` 倒序。契约：

```json
[
  {
    "id": 12,
    "doc_name": "采购合同.docx",
    "stance": "party_a",
    "status": "done",
    "score": 72,
    "level": "high",
    "created_at": "2026-06-03T08:21:00"
  }
]
```

- 实现：在 `backend/app/api/reviews.py` 加 `@router.get("/reviews")`，`select(ReviewTask)` 倒序 + 各取 `Document.name`。
- 数据模型无需改动：`ReviewTask` 已有 `created_at/stance/status/score/level/doc_id`，`Document` 已有 `name`。
- 审查创建、SSE 流式、结果回放、意见更新等现有接口与逻辑**不改**。

## 9. 文件组织

路由结构上，Shell（侧栏）只包裹 `/new` 与 `/history`；`/review/:id` 是独立顶层路由，不套 Shell，从而全屏：

```
<RouterProvider>
  ├─ <ShellLayout>          # 侧栏 + <Outlet/>
  │    ├─ /new
  │    └─ /history
  └─ /review/:id            # 顶层，无侧栏，全屏
```

```
frontend/src/
  main.tsx                 # 挂 RouterProvider
  routes.tsx               # 路由表（ShellLayout 包 /new、/history；/review/:id 独立）
  types.ts                 # 保留并扩展（新增 ReviewListItem）
  lib/
    api.ts                 # 接口（从现 api.ts 迁入并扩展）
  components/
    ShellLayout.tsx        # 侧栏 + <Outlet/>
    Sidebar.tsx
    ui/                    # Button / Badge / Card / SeverityDot / EmptyState / Skeleton ...
  pages/
    NewReview.tsx
    History.tsx
    Workspace/
      index.tsx            # 编排 SSE 状态 + 布局
      Dashboard.tsx
      ClauseChecklist.tsx
      ProfileCard.tsx
      DocumentView.tsx
      FindingsList.tsx
      FindingDetail.tsx
```

- 当前 `components/NewReview.tsx`、`components/Workspace.tsx` 迁入 `pages/` 并重构。
- `Workspace` 按职责拆为上述子组件，单文件聚焦、便于维护与测试。

## 10. 构建顺序

1. 依赖与配置：装 `tailwindcss` `@radix-ui/*` `react-router-dom` `lucide-react`，配置 Tailwind tokens 与全局样式。
2. UI 原子层：`components/ui/*`。
3. App Shell + 路由 + `Sidebar`。
4. 新建审查页（上传 + 粘贴 + 立场）。
5. 后端 `GET /api/reviews` + 历史页。
6. 工作台重做（拆组件 + 换样式，保留 SSE/定位逻辑）。
7. 走查 + 实际跑通验证。

## 11. 验证

- 静态：`npx tsc --noEmit`、`npm run build` 通过。
- 手动端到端：
  1. 上传 `.docx` → 解析 → 开始审查 → 流式意见逐条出现 → 采纳/驳回生效。
  2. 刷新 `/review/:id` → 正确回放。
  3. `/history` 列表显示该任务，点击可回到工作台。
  4. 粘贴文本路径仍可用。
- 边界：上传失败、解析为空、`locate_status=uncertain`、空历史列表、严重度筛选。

## 12. 风险与注意

- **引入构建链**：Tailwind/Radix/router 增加依赖与配置面，但均为成熟方案，风险低。
- **后端 DB 迁移**：无需迁移（不改模型），仅加只读查询。
- **保持后端兼容**：所有现有接口契约不变，前端改造不应触发后端行为变化（除新增列表接口）。
- **可溯源逻辑**：重做中栏时必须原样保留 `char_start/char_end` 高亮与「定位存疑」语义，不得回归到「瞎指」。
```
