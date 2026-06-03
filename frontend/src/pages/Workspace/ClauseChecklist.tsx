import { Check, X } from "lucide-react";
import type { ChecklistItem } from "../../types";

export function ClauseChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">条款完整性</div>
      {items.length === 0 && <div className="text-xs text-faint">审查中…</div>}
      <ul className="space-y-1 text-[13px]">
        {items.map((c) => (
          <li key={c.clause} className="flex items-center gap-2 text-ink2">
            {c.present ? <Check size={14} className="text-good" /> : <X size={14} className="text-high" />}
            {c.clause}
          </li>
        ))}
      </ul>
    </div>
  );
}
