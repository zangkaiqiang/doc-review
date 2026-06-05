import type { ReactNode } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import type { RuleChecklistItem, RuleConfig } from "../types";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";

export function splitWords(value: string): string[] {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
}

export function joinWords(value: string[]): string {
  return value.join("，");
}

export function normalizeRuleConfig(config: RuleConfig): RuleConfig {
  return {
    checklist: config.checklist
      .map((item) => ({
        clause: item.clause.trim(),
        keywords: item.keywords.map((kw) => kw.trim()).filter(Boolean),
        enabled: item.enabled,
      }))
      .filter((item) => item.clause && item.keywords.length),
    vague_words: config.vague_words.map((item) => item.trim()).filter(Boolean),
    onesided_words: config.onesided_words.map((item) => item.trim()).filter(Boolean),
  };
}

export function RuleTemplateEditor({
  value,
  onChange,
  onReset,
  compact = false,
}: {
  value: RuleConfig;
  onChange: (value: RuleConfig) => void;
  onReset?: () => void;
  compact?: boolean;
}) {
  const enabledCount = value.checklist.filter((item) => item.enabled).length;

  function updateChecklist(index: number, patch: Partial<RuleChecklistItem>) {
    onChange({
      ...value,
      checklist: value.checklist.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  function setAllChecklist(enabled: boolean) {
    onChange({
      ...value,
      checklist: value.checklist.map((item) => ({ ...item, enabled })),
    });
  }

  return (
    <div className={cn("grid gap-5", compact ? "" : "2xl:grid-cols-[minmax(0,1fr)_300px]")}>
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-ink2">标准条款清单</div>
            <div className="mt-1 text-xs text-muted">
              已启用 {enabledCount}/{value.checklist.length} 条，提交时随任务保存
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAllChecklist(true)}>
              全部启用
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAllChecklist(false)}>
              全部停用
            </Button>
            {onReset ? (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw size={14} /> 恢复默认
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...value, checklist: [...value.checklist, { clause: "", keywords: [], enabled: true }] })}
            >
              <Plus size={14} /> 添加条款
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-control border border-line bg-surface">
          <div
            className={cn(
              "hidden border-b border-line bg-panel px-3 py-2 text-xs font-medium text-muted",
              compact ? "" : "lg:grid lg:grid-cols-[128px_minmax(180px,1fr)_78px_38px] lg:gap-2"
            )}
          >
            <div>条款</div>
            <div>关键词</div>
            <div>状态</div>
            <div className="sr-only">操作</div>
          </div>
          {value.checklist.map((item, index) => (
            <div
              key={index}
              className={cn(
                "grid gap-2 border-b border-line bg-surface p-3 last:border-b-0",
                compact ? "" : "lg:grid-cols-[128px_minmax(180px,1fr)_78px_38px] lg:items-center"
              )}
            >
              <Field label="条款" compactLabel={!compact}>
                <input value={item.clause} onChange={(e) => updateChecklist(index, { clause: e.target.value })} className={inputClass()} />
              </Field>
              <Field label="关键词" compactLabel={!compact}>
                <input
                  value={joinWords(item.keywords)}
                  onChange={(e) => updateChecklist(index, { keywords: splitWords(e.target.value) })}
                  className={inputClass()}
                />
              </Field>
              <label className="flex h-9 items-center gap-2 rounded-control border border-line bg-panel px-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => updateChecklist(index, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-brand"
                />
                启用
              </label>
              <Button
                variant="ghost"
                size={compact ? "sm" : "icon"}
                onClick={() => onChange({ ...value, checklist: value.checklist.filter((_, i) => i !== index) })}
                title="删除条款"
              >
                <Trash2 size={15} /> {compact ? "删除" : null}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className={cn("grid gap-4", compact ? "" : "xl:sticky xl:top-6 xl:self-start")}>
        <Field label="模糊措辞">
          <textarea
            value={joinWords(value.vague_words)}
            onChange={(e) => onChange({ ...value, vague_words: splitWords(e.target.value) })}
            rows={compact ? 4 : 7}
            className="w-full resize-y rounded-control border border-line bg-panel p-3 text-sm leading-6 text-ink2 outline-none focus:border-brand/50"
          />
        </Field>
        <Field label="单边 / 不利措辞">
          <textarea
            value={joinWords(value.onesided_words)}
            onChange={(e) => onChange({ ...value, onesided_words: splitWords(e.target.value) })}
            rows={compact ? 4 : 7}
            className="w-full resize-y rounded-control border border-line bg-panel p-3 text-sm leading-6 text-ink2 outline-none focus:border-brand/50"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children, compactLabel = false }: { label: string; children: ReactNode; compactLabel?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className={cn("text-xs font-medium text-muted", compactLabel ? "lg:hidden" : "")}>{label}</span>
      {children}
    </label>
  );
}

function inputClass(extra = "") {
  return `h-9 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink2 outline-none transition-colors focus:border-brand/50 ${extra}`;
}
