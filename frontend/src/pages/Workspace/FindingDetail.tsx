import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, Check, MapPin, MapPinOff, PenLine, Quote, X } from "lucide-react";
import type { Finding } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { LEVEL_LABEL } from "../../lib/labels";

function DetailRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-control border border-line bg-surface p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {title}
      </div>
      <div className="text-sm leading-6 text-ink2">{body || "—"}</div>
    </div>
  );
}

export function FindingDetail({ finding, onPatch }: { finding: Finding; onPatch: (status: Finding["status"]) => void }) {
  const located = finding.locate_status === "located";
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="border-b border-line bg-panel px-4 py-3">
        <div className="flex items-start gap-2">
          <SeverityDot level={finding.level} className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-6 text-ink">{finding.title}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone={finding.level}>{LEVEL_LABEL[finding.level]}</Badge>
              <Badge tone="neutral">{finding.source === "rule" ? "规则" : "模型"}</Badge>
              {finding.status !== "open" && <Badge tone={finding.status === "accepted" ? "good" : "high"}>{finding.status === "accepted" ? "已采纳" : "已驳回"}</Badge>}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {finding.quote && (
          <blockquote className="mb-3 rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-muted">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-faint">
              <Quote size={13} /> 引用
            </div>
            {finding.quote}
          </blockquote>
        )}
        <div className="grid gap-3">
          <DetailRow icon={<AlertTriangle size={13} className="text-mid-fg" />} title="问题" body={finding.problem} />
          <DetailRow icon={<BookOpen size={13} />} title="依据" body={finding.basis} />
          <DetailRow icon={<PenLine size={13} className="text-brand" />} title="建议" body={finding.suggestion} />
        </div>
      </div>

      <div className="border-t border-line bg-surface p-3">
        <div className={`mb-3 flex items-center gap-1.5 text-xs ${located ? "text-good" : "text-mid-fg"}`}>
          {located ? <MapPin size={13} /> : <MapPinOff size={13} />}
          {located ? "已定位原文" : "定位存疑"}
        </div>
        <div className="flex gap-2">
          <Button variant="success" className="flex-1" disabled={finding.status === "accepted"} onClick={() => onPatch("accepted")}>
            <Check size={14} /> 采纳
          </Button>
          <Button variant="danger" className="flex-1" disabled={finding.status === "rejected"} onClick={() => onPatch("rejected")}>
            <X size={14} /> 驳回
          </Button>
        </div>
      </div>
    </div>
  );
}
