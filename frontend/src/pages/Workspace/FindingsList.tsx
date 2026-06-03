import { RadioTower } from "lucide-react";
import type { Finding } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { LEVEL_LABEL } from "../../lib/labels";
import { cn } from "../../lib/cn";

export function FindingsList(props: {
  findings: Finding[];
  selected: number | null;
  running: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-panel px-3.5 py-3 text-sm font-semibold text-ink">
        审查意见
        <span className="font-normal text-faint">{props.findings.length}</span>
        {props.running && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-high-soft px-2 py-1 text-[11px] font-medium text-high">
            <RadioTower size={12} /> 实时
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {props.findings.length === 0 && (
          <div className="px-3.5 py-4 text-xs leading-5 text-faint">{props.running ? "等待意见产出" : "没有匹配意见"}</div>
        )}
        {props.findings.map((finding) => (
          <button
            key={finding.id}
            onClick={() => props.onSelect(finding.id)}
            className={cn(
              "grid w-full gap-2 border-l-2 px-3.5 py-3 text-left transition-colors",
              finding.id === props.selected ? "border-brand bg-brand-soft/55" : "border-transparent hover:bg-line/40"
            )}
          >
            <span className="flex min-w-0 items-start gap-2.5">
              <SeverityDot level={finding.level} className="mt-1.5" />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[13px] font-medium", finding.status !== "open" ? "text-faint line-through" : "text-ink2")}>
                  {finding.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={finding.level} className="px-2 py-0.5 text-[11px]">{LEVEL_LABEL[finding.level]}</Badge>
                  <Badge tone="neutral" className="px-2 py-0.5 text-[11px]">{finding.source === "rule" ? "规则" : "模型"}</Badge>
                  {finding.status !== "open" && (
                    <Badge tone={finding.status === "accepted" ? "good" : "high"} className="px-2 py-0.5 text-[11px]">
                      {finding.status === "accepted" ? "已采纳" : "已驳回"}
                    </Badge>
                  )}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
