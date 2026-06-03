# 规则配置：按立场分默认 + 每合同审查前可自定义

日期：2026-06-03 ｜ 分支：claude/doc-review-agent-requirements-Xibkd

## 1. 背景与目标

合同/文档审查系统，强调规则确定性、零幻觉、可溯源。

用户诉求（原话）：规则配置应按**不同立场各有一套默认**；每个合同的规则**在审查前可自定义修改**，而不是规则配置页用同一套定死的配置。

立场枚举：`party_a` 甲方/采购方、`party_b` 乙方/投标供应方、`neutral` 中立、`tenderee` 招标方/审标。

配置三块：①确定性规则（`checklist` / `vague_words` / `onesided_words`）②红线库 ③评分规则（权重 / 一票否决 / 分档阈值）。

**核心不变量**：审查结论是不可变历史制品——本次审查使用的规则随任务快照保存，改全局默认不影响已建任务。

## 2. 现状（本会话前 + 既有部分实现）

「规则」一块已落地且跑通（共享组件 `RuleTemplateEditor`、配置页立场 Tab、新建审查页"本次规则"面板、`ReviewTask.rule_config` 任务快照、红线按 `stance`+`doc_type` 过滤）。

> 注：本会话设计阶段一个分析型子代理越权写入了上述「规则」实现（mtime 22:10–22:14）。代码经人工复核为干净可用，故在其上补全；越权产物已备份至 `/tmp/doc-review-agent-impl-backup-20260603`。

缺口：
- **评分未按立场分**（仍单份 `DEFAULT_SCORING`）——未满足"全部三块按立场"。
- 评分未随任务快照——重跑/可溯源不完整。
- 立场预设偏弱（简版关键词），立场差异不足。

## 3. 决策（方案，已拍板）

1. **数据模型走低风险加列**：保留已跑通的 `ReviewTask.rule_config`（规则快照），**新增** `scoring_config`（评分快照）。不改名、不搬数据，避免迁移风险。
2. **评分按立场分默认**：`scoring_engine.STANCE_SCORING_DEFAULTS` + `default_scoring_for_stance` + `normalize_scoring` + `resolve_scoring_for_stance`。`score()` 签名不变（仍吃已解析的 scoring dict），立场解析在 API/pipeline 边界完成。
3. **立场预设升级为法务版**（见 §4），替换偏弱的 `DEFAULT_RULE_TEMPLATES`，并定义 `STANCE_SCORING_DEFAULTS`。
4. **接口**：新增 `GET/PUT /api/settings/scoring/{stance}`；`GET /api/settings/scoring` 返回按立场 dict（与 `/rules` 对齐）；旧单份 scoring 数据读时补默认键并广播为四立场。具体路由声明在通配 `/{key}` 之前，防吞路由。
5. **快照与执行**：`create_review` 解析 stance 评分默认 ∪ 用户覆盖 → 写 `scoring_config`；`execute_review` 评分用 `task.scoring_config`（空则回落 stance 默认），不再实时读全局 scoring。
6. **前端**：配置页评分区加立场 Tab（复用规则 Tab 模式，按 stance PUT）；新建审查页"本次规则"面板加评分编辑，提交带 `scoring_config`。
7. **合并语义**：存"按立场完整 dict"（与既有 `/rules` 一致），字段缺失回落该立场预设；列表显式 `[]` = 用户清空。

## 4. 四立场预设（法务版，采用工作流法务结果）

**共享基线 checklist**（8 条）：合同标的 / 合同金额 / 付款方式 / 履行期限 / 违约责任 / 争议解决 / 保密条款 / 签署落款（关键词见实现）。
**共享 vague_words**：尽快/适当/合理/另行约定/另行协商/视情况而定/原则上/等相关事宜/相应/酌情/适时/如有必要。

| 立场 | checklist 追加 | onesided_words 取向 | scoring 权重 high/mid/low | 一票否决 | 阈值 low/mid |
|---|---|---|---|---|---|
| party_a 甲方 | 质量验收·知识产权·质保售后·履约担保 | 利乙方让利/免责 | 18/7/2 | 红线命中·单边条款 | 82/62 |
| party_b 乙方 | 验收时限·逾期付款利息·责任上限·不可抗力 | 加重乙方/利甲方 | 18/8/3 | 红线命中·单边条款 | 85/65 |
| neutral 中立 | （无追加） | 双向显失公平并集 | 15/6/2 | 红线命中 | 80/60 |
| tenderee 招标方 | 资质响应·偏离说明·报价·投标有效期·投标保证金 | 偏离类（实质性偏离/负偏离/不响应…） | 20/8/3 | 红线命中·单边条款·缺失条款 | 88/70 |

具体词表/关键词见 `rules_engine.STANCE_RULE_DEFAULTS` 与 `scoring_engine.STANCE_SCORING_DEFAULTS` 实现。

## 5. 测试计划

- 评分四立场默认数值/否决/阈值各异（断言关键差异）。
- `GET /api/settings/scoring` 返回按立场 dict；`GET /scoring/{stance}` 返回单份；`PUT /scoring` 存按立场并回读一致。
- `create_review` 落库 `scoring_config`（缺省=立场默认；带覆盖=覆盖生效）。
- pipeline 评分用任务 `scoring_config`（改全局 scoring 后重跑结论不变）。
- 规则法务预设：四立场默认含各自特有条款（如甲方含"知识产权"、招标方含"投标保证金"）。
- 路由：`/scoring/{stance}` 不被 `/{key}` 吞；旧单份 scoring 读时补默认键不崩。
- 既有规则相关测试保持通过。

## 6. 验收标准

- 三块配置（规则/红线/评分）均按四立场有实质不同默认；配置页可分立场编辑规则与评分并各自保存。
- 新建审查页可在立场默认上改规则与评分并提交，`rule_config`+`scoring_config` 完整落库。
- 改全局默认不影响已建任务结论。
- `uv run pytest` 与 `npx tsc --noEmit` / `npm run build` 通过。

## 7. 本轮范围外（记为后续）

- 红线"每合同勾选子集"（红线已按立场过滤且可在配置页增删；per-contract 勾选属增强）。
- 工作台/历史"本次所用规则/评分"只读展示（贯通 get_review→Workspace，面较大）。
- 红线内容冻结副本快照（当前 done 任务靠回放已存 findings 保证展示可复现）。
- 引入 Alembic 正式迁移（当前沿用 SQLite 轻量 ALTER）。
