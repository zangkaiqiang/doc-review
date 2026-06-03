# 文档审查智能体（Doc Review Agent）

合同 / 招投标 / NDA 等文档的 AI 审查应用。自动解析文档、识别风险与缺漏、
逐条给出可溯源的审查意见与修改建议，人审复核后形成审查报告。

## 文档

- [需求文档 PRD](docs/PRD.md)
- [产品交互设计](docs/UX-交互设计.md)
- [技术架构方案](docs/技术架构.md)

## 仓库结构

```
backend/   FastAPI 后端：审查流水线 + 规则引擎 + 模型网关 + 评分引擎
frontend/  React 前端：四区审查工作台
docs/      需求 / 交互 / 架构文档
```

## 快速开始

### 后端（FastAPI）

```bash
cd backend
uv sync                                          # 创建虚拟环境并安装依赖（含 Python 3.12）
uv run uvicorn app.main:app --reload --port 8000
```

- 健康检查：http://localhost:8000/api/health
- 接口文档：http://localhost:8000/docs
- **无需 LLM key 也能跑**：未配置 `DOCREVIEW_LLM_API_KEY` 时，流水线自动降级，
  仅用规则引擎产出意见（架构「失败降级到规则兜底」）。
- 配置模型（OpenAI 兼容）：设置环境变量
  `DOCREVIEW_LLM_BASE_URL` / `DOCREVIEW_LLM_API_KEY` / `DOCREVIEW_LLM_MODEL`。

### 前端（React + Vite）

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173（已配置 /api 代理到 8000）
```

## MVP 已实现

- 审查流水线：解析 → 切分(带定位锚点) → 要素抽取 → 规则校验 → LLM 研判 → 定位回填 → 评分
- **异步执行 + SSE 流式**：审查不阻塞，阶段进度与意见边生成边推送到前端
- 规则引擎：缺失条款、模糊措辞、单边条款、红线库命中（确定性、可解释）
- 模型网关：OpenAI 兼容接口，可配置可替换，失败降级
- 可溯源：意见精确定位回原文偏移；逐字/模糊匹配失败标「定位存疑」，绝不瞎指
- 可配置评分引擎：权重 / 一票否决 / 分档阈值
- 知识库：红线库 CRUD + 批量导入存量条款
- 前端四区工作台：仪表盘(实时阶段进度) / 条款完整性+档案卡 / 原文高亮 / 意见列表+详情+采纳驳回

## 异步执行后端

审查走「创建任务 → SSE 拉流」两步：
1. `POST /api/reviews` 创建任务，返回 `task_id`（不阻塞）
2. `GET /api/reviews/{id}/stream` 订阅 SSE，接收 `start/stage/finding/done` 事件
   （已完成任务会从库中回放，支持刷新重连）

**两种执行后端**，由配置自动切换：
- **默认（零依赖）**：进程内后台线程执行，事件经内存事件总线推送。开箱即用。
- **Celery + Redis（跨进程）**：设置环境变量后启用，事件经 Redis pub/sub 跨进程：
  ```bash
  export DOCREVIEW_CELERY_BROKER_URL=redis://localhost:6379/0
  export DOCREVIEW_CELERY_RESULT_BACKEND=redis://localhost:6379/0
  uv run celery -A app.celery_app.celery worker --loglevel=info   # 另起 worker
  uv run uvicorn app.main:app --port 8000
  ```

## 待接入（Roadmap）

- 向量检索（pgvector）替代关键词匹配的 RAG
- OCR、招投标逐条响应比对、报告导出、多人协作
