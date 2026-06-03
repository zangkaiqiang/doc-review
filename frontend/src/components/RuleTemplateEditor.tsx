import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  compact = false,
}: {
  value: RuleConfig;
  onChange: (value: RuleConfig) => void;
  compact?: boolean;
}) {
  function updateChecklist(index: number, patch: Partial<RuleChecklistItem>) {
    onChange({
      ...value,
      checklist: value.checklist.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  return (
    <div className={cn("grid gap-5", compact ? "" : "xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]")}>
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-ink2">标准条款清单</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...value, checklist: [...value.checklist, { clause: "", keywords: [], enabled: true }] })}
          >
            <Plus size={14} /> 添加条款
          </Button>
        </div>
        <div className="grid gap-2">
          {value.checklist.map((item, index) => (
            <div
              key={index}
              className={cn(
                "grid gap-2 rounded-control border border-line bg-panel p-3",
                compact ? "" : "lg:grid-cols-[120px_minmax(0,1fr)_80px_36px] lg:items-end"
              )}
            >
              <Field label="条款">
                <input value={item.clause} onChange={(e) => updateChecklist(index, { clause: e.target.value })} className={inputClass()} />
              </Field>
              <Field label="关键词">
                <input
                  value={joinWords(item.keywords)}
                  onChange={(e) => updateChecklist(index, { keywords: splitWords(e.target.value) })}
                  className={inputClass()}
                />
              </Field>
              <label className="flex h-9 items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={item.enabled} onChange={(e) => updateChecklist(index, { enabled: e.target.checked })} />
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

      <div className="grid gap-4">
        <Field label="模糊措辞">
          <textarea
            value={joinWords(value.vague_words)}
            onChange={(e) => onChange({ ...value, vague_words: splitWords(e.target.value) })}
            rows={compact ? 4 : 7}
            className="w-full rounded-control border border-line bg-panel p-3 text-sm leading-6 text-ink2 outline-none focus:border-brand/50"
          />
        </Field>
        <Field label="单边 / 不利措辞">
          <textarea
            value={joinWords(value.onesided_words)}
            onChange={(e) => onChange({ ...value, onesided_words: splitWords(e.target.value) })}
            rows={compact ? 4 : 7}
            className="w-full rounded-control border border-line bg-panel p-3 text-sm leading-6 text-ink2 outline-none focus:border-brand/50"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function inputClass(extra = "") {
  return `h-9 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink2 outline-none transition-colors focus:border-brand/50 ${extra}`;
}
