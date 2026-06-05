import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  Loader2,
  Settings2,
  UploadCloud,
} from "lucide-react";
import { createReview, getReviewTemplates, getRulesConfigForStance, getScoringConfigForStance, uploadDocument } from "../lib/api";
import { cn } from "../lib/cn";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/toast";
import { RuleTemplateEditor, normalizeRuleConfig } from "../components/RuleTemplateEditor";
import { ScoringEditor, normalizeScoringConfig } from "../components/ScoringEditor";
import type { ReviewTemplate, RuleConfig, ScoringConfig } from "../types";

const SAMPLE = `采购合同
甲方：A公司    乙方：B公司
第一条 标的：B公司向A公司提供咨询服务。
第二条 合同金额：人民币1,200,000元。
第三条 付款方式：合同签订后A方尽快支付。
第四条 违约责任：乙方违约的，概不退还已付款项。
第五条 本合同最终解释权归甲方所有。`;

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function NewReview() {
  const nav = useNavigate();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [stance, setStance] = useState("party_a");
  const [text, setText] = useState(SAMPLE);
  const [docId, setDocId] = useState<number | null>(null);
  const [docInfo, setDocInfo] = useState<{ name: string; chars: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ruleConfig, setRuleConfig] = useState<RuleConfig | null>(null);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig | null>(null);
  const [defaultRuleConfig, setDefaultRuleConfig] = useState<RuleConfig | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);

  const textChars = text.trim().length;
  const inputReady = mode === "upload" ? Boolean(docId) : textChars > 0;
  const rulesReady = Boolean(ruleConfig) && Boolean(scoringConfig) && !rulesLoading;
  const canStart = useMemo(
    () => inputReady && rulesReady,
    [inputReady, rulesReady]
  );
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.key === stance) ?? { key: stance, label: stance, hint: "" },
    [templates, stance]
  );

  useEffect(() => {
    let alive = true;
    getReviewTemplates()
      .then((items) => {
        if (!alive) return;
        setTemplates(items);
        if (items.length && !items.some((item) => item.key === stance)) {
          setStance(items[0].key);
        }
      })
      .catch((e) => {
        if (alive) toast(String(e instanceof Error ? e.message : e), "error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setRulesLoading(true);
    Promise.all([getRulesConfigForStance(stance), getScoringConfigForStance(stance)])
      .then(([rules, scoring]) => {
        if (alive) {
          setRuleConfig(rules);
          setDefaultRuleConfig(cloneConfig(rules));
          setScoringConfig(scoring);
        }
      })
      .catch((e) => {
        if (alive) {
          setRuleConfig(null);
          setDefaultRuleConfig(null);
          setScoringConfig(null);
          toast(String(e instanceof Error ? e.message : e), "error");
        }
      })
      .finally(() => {
        if (alive) setRulesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [stance]);

  async function onFile(file: File) {
    if (!/\.(docx|pdf)$/i.test(file.name)) {
      toast("仅支持 .docx / .pdf", "error");
      return;
    }
    setUploading(true);
    setDocId(null);
    setDocInfo(null);
    try {
      const { id, name, chars } = await uploadDocument(file);
      setDocId(id);
      setDocInfo({ name, chars });
      setMode("upload");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    } finally {
      setUploading(false);
    }
  }

  async function start() {
    if (!canStart) return;
    setSubmitting(true);
    try {
      const config = {
        stance,
        rule_config: normalizeRuleConfig(ruleConfig!),
        scoring_config: normalizeScoringConfig(scoringConfig!),
      };
      const body =
        mode === "upload"
          ? { doc_id: docId!, ...config }
          : { text: text.trim(), name: "粘贴文本审查", ...config };
      const { task_id } = await createReview(body);
      nav(`/review/${task_id}`);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone="brand">新任务</Badge>
            <Badge tone="neutral">流式审查</Badge>
          </div>
          <h1 className="text-2xl font-semibold text-ink">新建审查</h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted sm:w-auto sm:justify-end">
          <FlowPill active={inputReady} icon={FileCheck2} label="输入文档" />
          <FlowPill active icon={ClipboardCheck} label={selectedTemplate.label} />
          <FlowPill active={rulesReady} icon={Settings2} label="规则快照" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[388px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-6 xl:flex xl:max-h-[calc(100vh-7.5rem)] xl:flex-col xl:self-start xl:space-y-0">
          <div className="space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
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
                    <div className="text-[11px] text-faint">支持 Word 与 PDF，解析完成后会进入任务摘要</div>
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
              <div className="mb-3 text-sm font-semibold text-ink">审查模板</div>
              <div className="grid gap-2">
                {templates.map((item) => (
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
                {!templates.length ? (
                  <div className="rounded-control border border-line bg-panel px-3 py-3 text-sm text-muted">模板加载中</div>
                ) : null}
              </div>
            </section>
          </div>

          <section className="mt-4 shrink-0 rounded-card border border-line bg-surface p-4 shadow-pop">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">任务摘要</div>
              <Badge tone={canStart ? "good" : "neutral"}>{canStart ? "可提交" : "待完善"}</Badge>
            </div>
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
                <span className="text-muted">模板</span>
                <span className="text-right font-medium text-ink2">{selectedTemplate.label}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">规则</span>
                <span className="text-right font-medium text-ink2">{rulesLoading ? "加载中" : rulesReady ? "已生成任务快照" : "未就绪"}</span>
              </div>
            </div>
            <Button className="mt-4 w-full" disabled={!canStart || submitting || uploading} onClick={start} size="lg">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {submitting ? "提交中" : "开始审查"}
            </Button>
            <div className="mt-2 text-xs leading-5 text-muted">
              {canStart ? "提交时会保存当前规则与评分口径。" : inputReady ? "等待规则模板加载完成后即可提交。" : "请先上传文件或粘贴文本。"}
            </div>
          </section>
        </aside>

        <section className="min-w-0 rounded-card border border-line bg-surface shadow-soft">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-panel px-5 py-4">
            <div>
              <div className="text-base font-semibold text-ink">本次审查规则</div>
              <div className="mt-1 text-xs text-muted">{selectedTemplate.label}，可在提交前覆盖。审查规则是本次任务的核心依据。</div>
            </div>
            {rulesLoading ? <Loader2 size={16} className="shrink-0 animate-spin text-muted" /> : <Badge tone="neutral">任务快照</Badge>}
          </div>
          <div className="space-y-6 p-5">
            {ruleConfig ? (
              <RuleTemplateEditor
                value={ruleConfig}
                onChange={setRuleConfig}
                onReset={defaultRuleConfig ? () => setRuleConfig(cloneConfig(defaultRuleConfig)) : undefined}
              />
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
    </div>
  );
}

function FlowPill({
  active,
  icon: Icon,
  label,
}: {
  active: boolean;
  icon: typeof FileCheck2;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors",
        active ? "border-good/20 bg-good-soft text-good" : "border-line bg-panel text-muted"
      )}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}
