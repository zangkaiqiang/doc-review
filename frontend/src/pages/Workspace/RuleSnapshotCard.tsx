import { Scale } from "lucide-react";

export function RuleSnapshotCard({
  version,
  clauseCount,
  thresholds,
}: {
  version: number;
  clauseCount: number;
  thresholds: { low: number; mid: number };
}) {
  return (
    <section className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Scale size={16} className="text-brand" />
          本次审查规则
        </div>
        <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand">v{version}</span>
      </div>
      <div className="grid gap-1.5">
        <div className="rounded-control border border-line bg-panel px-3 py-2.5">
          <div className="mb-1 text-xs text-faint">条款清单</div>
          <div className="text-sm font-medium tabular-nums text-ink2">{clauseCount} 条</div>
        </div>
        <div className="rounded-control border border-line bg-panel px-3 py-2.5">
          <div className="mb-1 text-xs text-faint">风险分档阈值</div>
          <div className="text-sm font-medium tabular-nums text-ink2">低 ≥ {thresholds.low} · 中 ≥ {thresholds.mid}</div>
        </div>
      </div>
    </section>
  );
}
