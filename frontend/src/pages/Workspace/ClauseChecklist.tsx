import { Check, ClipboardCheck, X } from "lucide-react";
import type { ChecklistItem } from "../../types";
import { cn } from "../../lib/cn";

export function ClauseChecklist({ items }: { items: ChecklistItem[] }) {
  const missing = items.filter((item) => !item.present).length;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ClipboardCheck size={16} className="text-brand" />
          条款完整性
        </div>
        {items.length > 0 && (
          <span className={cn("rounded-full px-2 py-1 text-xs font-medium", missing ? "bg-high-soft text-high" : "bg-good-soft text-good")}>
            {missing ? `缺 ${missing}` : "完整"}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-control border border-line bg-panel px-3 py-2 text-xs text-faint">审查中</div>
      ) : (
        <ul className="grid gap-1.5">
          {items.map((item) => (
            <li key={item.clause} className="flex items-center gap-2 rounded-control border border-line bg-panel px-2.5 py-2 text-[13px] text-ink2">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", item.present ? "bg-good-soft text-good" : "bg-high-soft text-high")}>
                {item.present ? <Check size={13} /> : <X size={13} />}
              </span>
              <span className="min-w-0 truncate">{item.clause}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
