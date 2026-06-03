import { Quote, AlertTriangle, BookOpen, PenLine, MapPin, MapPinOff, Check, X } from "lucide-react";
import type { Finding } from "../../types";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { Button } from "../../components/ui/Button";

export function FindingDetail({ finding, onPatch }: { finding: Finding; onPatch: (status: Finding["status"]) => void }) {
  const located = finding.locate_status === "located";
  return (
    <div className="flex-1 overflow-auto border-t border-line bg-bg p-3.5 text-[13px] text-ink2">
      <div className="mb-2.5 flex items-center gap-2">
        <SeverityDot level={finding.level} />
        <b className="text-ink">{finding.title}</b>
        <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
          {finding.source === "rule" ? "规则" : "模型"}
        </span>
      </div>
      {finding.quote && (
        <blockquote className="mb-2 flex gap-1.5 rounded-control border border-line bg-surface px-2.5 py-2 text-muted">
          <Quote size={13} className="mt-0.5 shrink-0" /> {finding.quote}
        </blockquote>
      )}
      <p className="mb-1.5 flex gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-mid" /><span><b className="text-ink2">问题：</b>{finding.problem}</span></p>
      <p className="mb-1.5 flex gap-1.5"><BookOpen size={13} className="mt-0.5 shrink-0 text-muted" /><span><b className="text-ink2">依据：</b>{finding.basis}</span></p>
      <p className="mb-1.5 flex gap-1.5"><PenLine size={13} className="mt-0.5 shrink-0 text-brand" /><span><b className="text-ink2">建议：</b>{finding.suggestion}</span></p>
      <p className={`mb-3 flex items-center gap-1.5 text-xs ${located ? "text-good" : "text-mid"}`}>
        {located ? <MapPin size={13} /> : <MapPinOff size={13} />}
        {located ? "已定位原文" : "定位存疑（需人工确认）"}
      </p>
      <div className="flex gap-2">
        <Button variant="success" className="flex-1" onClick={() => onPatch("accepted")}><Check size={14} /> 采纳</Button>
        <Button variant="danger" className="flex-1" onClick={() => onPatch("rejected")}><X size={14} /> 驳回</Button>
      </div>
    </div>
  );
}
