import type { Finding } from "../../types";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { cn } from "../../lib/cn";

export function FindingsList(props: {
  findings: Finding[];
  selected: number | null;
  running: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 text-sm font-semibold text-ink">
        审查意见 <span className="font-normal text-faint">{props.findings.length}</span>
        {props.running && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-high">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-high" /> 实时
          </span>
        )}
      </div>
      <div className="overflow-auto">
        {props.findings.length === 0 && <div className="px-3.5 py-3 text-xs text-faint">等待意见产出…</div>}
        {props.findings.map((f) => (
          <button
            key={f.id}
            onClick={() => props.onSelect(f.id)}
            className={cn(
              "flex w-full items-center gap-2.5 border-l-2 px-3.5 py-2.5 text-left text-[13px] transition-colors",
              f.id === props.selected ? "border-brand bg-brand-soft/50" : "border-transparent hover:bg-line/40"
            )}
          >
            <SeverityDot level={f.level} />
            <span className={cn("flex-1 truncate", f.status !== "open" ? "text-faint line-through" : "text-ink2")}>{f.title}</span>
            {f.status !== "open" && <span className="text-[11px] text-faint">{f.status === "accepted" ? "已采纳" : "已驳回"}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
