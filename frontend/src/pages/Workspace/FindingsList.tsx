import { Bot, ListChecks, RadioTower } from "lucide-react";
import type { Finding } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { LEVEL_LABEL } from "../../lib/labels";
import { cn } from "../../lib/cn";
import { findingSourceLabel, findingSourceTone } from "../../lib/findingSource";

export function FindingsList(props: {
  findings: Finding[];
  selected: number | null;
  running: boolean;
  onSelect: (id: number) => void;
}) {
  const ruleCount = props.findings.filter((finding) => finding.source === "rule").length;
  const agentCount = props.findings.filter((finding) => finding.source !== "rule").length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-panel px-3.5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          审查意见列表
          <span className="font-normal text-faint">{props.findings.length}</span>
          {props.running && (
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-high-soft px-2 py-1 text-[11px] font-medium text-high">
              <RadioTower size={12} /> 实时
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SourceBadge source="rule" count={ruleCount} />
          <SourceBadge source="llm" count={agentCount} />
        </div>
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
                <span className="block truncate text-[13px] font-medium text-ink2">
                  {finding.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={findingSourceTone(finding.source)} className="px-2 py-0.5 text-[11px]">
                    {finding.source === "rule" ? <ListChecks size={11} /> : <Bot size={11} />}
                    {findingSourceLabel(finding.source)}
                  </Badge>
                  <Badge tone={finding.level} className="px-2 py-0.5 text-[11px]">{LEVEL_LABEL[finding.level]}</Badge>
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SourceBadge({ source, count }: { source: Finding["source"]; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-1 text-[11px] font-medium text-muted">
      {source === "rule" ? <ListChecks size={12} className="text-info" /> : <Bot size={12} className="text-brand" />}
      {findingSourceLabel(source)}
      <span className="tabular-nums text-faint">{count}</span>
    </span>
  );
}
