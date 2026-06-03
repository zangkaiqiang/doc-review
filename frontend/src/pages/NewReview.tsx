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
