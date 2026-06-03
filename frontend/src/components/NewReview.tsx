import { useState } from "react";
import { createReview } from "../api";

const STANCES = [
  { key: "party_a", label: "甲方审合同" },
  { key: "party_b", label: "乙方/投标" },
  { key: "neutral", label: "中立把关" },
  { key: "tenderee", label: "招标方审标" },
];

const SAMPLE = `采购合同
甲方：A公司    乙方：B公司
第一条 标的：B公司向A公司提供咨询服务。
第二条 合同金额：人民币1,200,000元。
第三条 付款方式：合同签订后A方尽快支付。
第四条 违约责任：乙方违约的，概不退还已付款项。
第五条 本合同最终解释权归甲方所有。`;

export default function NewReview({ onCreated }: { onCreated: (id: number) => void }) {
  const [text, setText] = useState(SAMPLE);
  const [stance, setStance] = useState("party_a");
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const { task_id } = await createReview(text, stance, "粘贴文本审查");
      onCreated(task_id);
    } catch (e) {
      alert(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="newreview">
      <h1>📄 文档审查智能体</h1>
      <p className="muted">MVP 骨架 · 粘贴合同文本，选择审查立场，开始审查</p>

      <div className="field">
        <label>审查立场</label>
        <div className="stances">
          {STANCES.map((s) => (
            <button
              key={s.key}
              className={stance === s.key ? "stance active" : "stance"}
              onClick={() => setStance(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>合同/文档文本</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} />
      </div>

      <button className="primary" disabled={loading || !text.trim()} onClick={start}>
        {loading ? "审查中…" : "开始审查"}
      </button>
    </div>
  );
}
