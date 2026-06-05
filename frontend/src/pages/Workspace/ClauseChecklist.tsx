import { Bot, Check, ClipboardCheck, ListChecks, MapPin, TriangleAlert, X } from "lucide-react";
import type { ChecklistItem } from "../../types";
import { cn } from "../../lib/cn";
import type { DocumentAnchor } from "./DocumentView";

export function ClauseChecklist({
  items,
  anchors = {},
  activeClause,
  onLocate,
}: {
  items: ChecklistItem[];
  anchors?: Record<string, DocumentAnchor>;
  activeClause?: string | null;
  onLocate?: (anchor: DocumentAnchor) => void;
}) {
  const missing = items.filter((item) => !item.present).length;
  const partial = items.filter((item) => item.status === "partial").length;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ClipboardCheck size={16} className="text-brand" />
          条款完整性
        </div>
        {items.length > 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-1 text-xs font-medium",
              missing ? "bg-high-soft text-high" : partial ? "bg-mid-soft text-mid-fg" : "bg-good-soft text-good"
            )}
          >
            {missing ? `缺 ${missing}` : partial ? `待补 ${partial}` : "完整"}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-control border border-line bg-panel px-3 py-2 text-xs text-faint">审查中</div>
      ) : (
        <ul className="grid gap-1.5">
          {items.map((item) => {
            const anchor = anchors[item.clause];
            const locatable = Boolean(item.present && anchor && onLocate);
            const active = activeClause === item.clause;
            const status = item.status ?? (item.present ? "sufficient" : "missing");
            const SourceIcon = item.review_source === "agent" ? Bot : ListChecks;
            return (
              <li key={item.clause}>
                <button
                  type="button"
                  disabled={!locatable}
                  onClick={() => {
                    if (anchor) onLocate?.(anchor);
                  }}
                  title={locatable ? "定位到原文" : item.present ? "未找到可定位关键词" : "原文未检出该条款"}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-control border px-2.5 py-2 text-left text-[13px] transition-colors",
                    active ? "border-info bg-info-soft text-ink2" : "border-line bg-panel text-ink2",
                    locatable ? "cursor-pointer hover:border-info/40 hover:bg-info-soft/60" : "cursor-default"
                  )}
                >
                  <span className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    status === "sufficient" ? "bg-good-soft text-good" : status === "partial" ? "bg-mid-soft text-mid-fg" : "bg-high-soft text-high"
                  )}>
                    {status === "sufficient" ? <Check size={13} /> : status === "partial" ? <TriangleAlert size={13} /> : <X size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.clause}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                      <SourceIcon size={11} />
                      {item.review_source === "agent" ? "智能体复核" : "规则扫描"}
                      {status === "partial" ? " · 待补充" : null}
                    </span>
                  </span>
                  {locatable && <MapPin size={13} className={active ? "text-info" : "text-faint"} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
