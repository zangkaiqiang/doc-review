import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, Bot, ListChecks, MapPin, MapPinOff, PenLine, Quote } from "lucide-react";
import type { Finding } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { LEVEL_LABEL } from "../../lib/labels";
import { findingSourceDescription, findingSourceLabel, findingSourceTone } from "../../lib/findingSource";

function DetailRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {title}
      </div>
      <div className="text-sm leading-6 text-ink2">{body || "—"}</div>
    </div>
  );
}

export function FindingDetail({ finding }: { finding: Finding }) {
  const located = finding.locate_status === "located";
  const missingClause = finding.source === "rule" && finding.category === "缺失条款" && !finding.quote;
  const SourceIcon = finding.source === "rule" ? ListChecks : Bot;
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="shrink-0 border-b border-line bg-panel px-3.5 py-2.5">
        <div className="mb-1.5 text-sm font-semibold text-ink">意见详情</div>
        <div className="flex items-start gap-2">
          <SeverityDot level={finding.level} className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-5 text-ink">{finding.title}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone={findingSourceTone(finding.source)}>
                <SourceIcon size={12} />
                {findingSourceLabel(finding.source)}
              </Badge>
              <Badge tone={finding.level}>{LEVEL_LABEL[finding.level]}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        <div className="mb-2.5 rounded-control border border-line bg-surface px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
            <SourceIcon size={13} className={finding.source === "rule" ? "text-info" : "text-brand"} />
            {findingSourceLabel(finding.source)}
          </div>
          <div className="text-xs leading-5 text-ink2">{findingSourceDescription(finding.source)}</div>
        </div>
        {finding.quote && (
          <blockquote className="mb-2.5 rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-muted">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-faint">
              <Quote size={13} /> 引用
            </div>
            {finding.quote}
          </blockquote>
        )}
        <div className="grid gap-2.5">
          <DetailRow icon={<AlertTriangle size={13} className="text-mid-fg" />} title="问题" body={finding.problem} />
          <DetailRow icon={<BookOpen size={13} />} title="依据" body={finding.basis} />
          <DetailRow icon={<PenLine size={13} className="text-brand" />} title="建议" body={finding.suggestion} />
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface p-3">
        <div className={`flex items-center gap-1.5 text-xs ${located ? "text-good" : "text-mid-fg"}`}>
          {located ? <MapPin size={13} /> : <MapPinOff size={13} />}
          {located ? "已定位原文" : missingClause ? "未在原文中发现对应约定" : "定位存疑"}
        </div>
      </div>
    </div>
  );
}
