import { useEffect, useMemo, useState } from "react";
import { getReview, updateFinding } from "../api";
import type { Finding, Level, ReviewResult } from "../types";

const LEVEL_LABEL: Record<Level, string> = { high: "高", mid: "中", low: "低" };
const LEVEL_CLASS: Record<Level, string> = { high: "lv-high", mid: "lv-mid", low: "lv-low" };

export default function Workspace({ taskId, onBack }: { taskId: number; onBack: () => void }) {
  const [data, setData] = useState<ReviewResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");

  useEffect(() => {
    getReview(taskId).then((d) => {
      setData(d);
      if (d.findings.length) setSelected(d.findings[0].id);
    });
  }, [taskId]);

  if (!data) return <div className="loading">加载审查结果…</div>;

  const { task, document: doc, findings } = data;
  const counts = {
    high: findings.filter((f) => f.level === "high").length,
    mid: findings.filter((f) => f.level === "mid").length,
    low: findings.filter((f) => f.level === "low").length,
  };
  const shown = levelFilter === "all" ? findings : findings.filter((f) => f.level === levelFilter);
  const current = findings.find((f) => f.id === selected) || null;

  async function patch(f: Finding, status: Finding["status"]) {
    await updateFinding(f.id, { status });
    setData((d) =>
      d ? { ...d, findings: d.findings.map((x) => (x.id === f.id ? { ...x, status } : x)) } : d
    );
  }

  return (
    <div className="workspace">
      {/* ① 顶部仪表盘 */}
      <header className="dashboard">
        <button className="link" onClick={onBack}>← 返回</button>
        <span className="docname">{doc.name}</span>
        <span className="stance-badge">立场：{task.stance}</span>
        <span className={`score ${task.level ? LEVEL_CLASS[task.level] : ""}`}>
          风险评分 {task.score}/100 · {task.level ? LEVEL_LABEL[task.level] + "危" : ""}
        </span>
        <span className="counts">
          <i className="lv-high" onClick={() => setLevelFilter("high")}>●高 {counts.high}</i>
          <i className="lv-mid" onClick={() => setLevelFilter("mid")}>●中 {counts.mid}</i>
          <i className="lv-low" onClick={() => setLevelFilter("low")}>●低 {counts.low}</i>
          <i className="reset" onClick={() => setLevelFilter("all")}>全部</i>
        </span>
        <button className="link" onClick={() => setFocusMode((v) => !v)}>
          {focusMode ? "完整模式" : "专注模式"}
        </button>
      </header>

      <div className="main">
        {/* ② 左栏：完整性 + 大纲 + 筛选 */}
        {!focusMode && (
          <aside className="left">
            <h4>条款完整性</h4>
            <ul className="checklist">
              {task.checklist.map((c) => (
                <li key={c.clause} className={c.present ? "ok" : "miss"}>
                  {c.present ? "✓" : "✕"} {c.clause}
                </li>
              ))}
            </ul>
            <h4>合同档案卡</h4>
            <ul className="profile">
              <li>金额：{task.profile?.amount ?? "—"}</li>
              <li>大写金额：{task.profile?.has_amount_cn ? "有" : "缺"}</li>
              <li>主体：{task.profile?.parties_hint ? "甲乙方" : "—"}</li>
            </ul>
          </aside>
        )}

        {/* ③ 中栏：原文 + 高亮定位 */}
        <main className="center">
          <DocumentText text={doc.text} finding={current} />
        </main>

        {/* ④ 右栏：意见列表 + 选中详情 */}
        <aside className="right">
          <div className="findings-head">审查意见（{shown.length}）</div>
          <div className="findings-list">
            {shown.map((f) => (
              <div
                key={f.id}
                className={"finding-row " + (f.id === selected ? "sel " : "") + (f.status !== "open" ? "done" : "")}
                onClick={() => setSelected(f.id)}
              >
                <span className={"dot " + LEVEL_CLASS[f.level]} />
                <span className="ftitle">{f.title}</span>
                {f.status !== "open" && <span className="status-tag">{f.status}</span>}
              </div>
            ))}
          </div>

          {current && (
            <div className="detail">
              <div className="detail-head">
                <span className={"dot " + LEVEL_CLASS[current.level]} /> {current.title}
                <span className="src">{current.source === "rule" ? "规则" : "模型"}</span>
              </div>
              {current.quote && <blockquote>📍 {current.quote}</blockquote>}
              <p>⚠ <b>问题：</b>{current.problem}</p>
              <p>📖 <b>依据：</b>{current.basis}</p>
              <p>✏ <b>建议：</b>{current.suggestion}</p>
              <p className="locate">
                定位：{current.locate_status === "located" ? "已定位原文" : "定位存疑（需人工确认）"}
              </p>
              <div className="actions">
                <button className="accept" onClick={() => patch(current, "accepted")}>✓ 采纳</button>
                <button className="reject" onClick={() => patch(current, "rejected")}>✕ 驳回</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** 中栏原文渲染：按选中意见的 char_start/char_end 高亮（可溯源） */
function DocumentText({ text, finding }: { text: string; finding: Finding | null }) {
  const parts = useMemo(() => {
    if (!finding || finding.char_start == null || finding.char_end == null) {
      return [{ t: text, hl: false }];
    }
    const s = finding.char_start;
    const e = finding.char_end;
    return [
      { t: text.slice(0, s), hl: false },
      { t: text.slice(s, e), hl: true },
      { t: text.slice(e), hl: false },
    ];
  }, [text, finding]);

  return (
    <pre className="doctext">
      {parts.map((p, i) =>
        p.hl ? (
          <mark key={i} className={finding ? "hl-" + finding.level : ""}>{p.t}</mark>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </pre>
  );
}
