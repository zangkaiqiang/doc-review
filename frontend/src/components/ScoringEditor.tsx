import type { ReactNode } from "react";
import type { ScoringConfig } from "../types";
import { LEVEL_LABEL } from "../lib/labels";
import { cn } from "../lib/cn";
import { joinWords, splitWords } from "./RuleTemplateEditor";

export function defaultScoring(): ScoringConfig {
  return {
    weights: { high: 15, mid: 6, low: 2 },
    veto_categories: ["红线命中"],
    thresholds: { low: 80, mid: 60 },
  };
}

export function normalizeScoringConfig(config: ScoringConfig): ScoringConfig {
  const num = (v: number) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    weights: { high: num(config.weights.high), mid: num(config.weights.mid), low: num(config.weights.low) },
    veto_categories: config.veto_categories.map((c) => c.trim()).filter(Boolean),
    thresholds: { low: num(config.thresholds.low), mid: num(config.thresholds.mid) },
  };
}

export function ScoringEditor({
  value,
  onChange,
  compact = false,
}: {
  value: ScoringConfig;
  onChange: (value: ScoringConfig) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-4", compact ? "" : "md:grid-cols-3")}>
      <div className="rounded-control border border-line bg-panel p-3">
        <div className="mb-3 text-sm font-medium text-ink2">严重度扣分</div>
        {(["high", "mid", "low"] as const).map((level) => (
          <Field key={level} label={`${LEVEL_LABEL[level]}扣分`}>
            <input
              type="number"
              value={value.weights[level]}
              onChange={(e) =>
                onChange({ ...value, weights: { ...value.weights, [level]: Number(e.target.value) } })
              }
              className={inputClass("mb-2")}
            />
          </Field>
        ))}
      </div>
      <div className="rounded-control border border-line bg-panel p-3">
        <div className="mb-3 text-sm font-medium text-ink2">风险分档阈值</div>
        <Field label="低危最低分">
          <input
            type="number"
            value={value.thresholds.low}
            onChange={(e) => onChange({ ...value, thresholds: { ...value.thresholds, low: Number(e.target.value) } })}
            className={inputClass("mb-2")}
          />
        </Field>
        <Field label="中危最低分">
          <input
            type="number"
            value={value.thresholds.mid}
            onChange={(e) => onChange({ ...value, thresholds: { ...value.thresholds, mid: Number(e.target.value) } })}
            className={inputClass()}
          />
        </Field>
      </div>
      <div className="rounded-control border border-line bg-panel p-3">
        <Field label="一票否决类别">
          <textarea
            value={joinWords(value.veto_categories)}
            onChange={(e) => onChange({ ...value, veto_categories: splitWords(e.target.value) })}
            rows={compact ? 4 : 8}
            className="w-full rounded-control border border-line bg-surface p-3 text-sm leading-6 text-ink2 outline-none focus:border-brand/50"
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
