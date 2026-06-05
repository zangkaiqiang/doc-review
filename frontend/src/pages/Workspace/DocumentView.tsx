import { useEffect, useMemo, useRef } from "react";
import { FileText, MapPin, MapPinOff } from "lucide-react";
import type { Finding } from "../../types";

export interface DocumentAnchor {
  id: string;
  label: string;
  start: number;
  end: number;
  tone?: "clause" | "finding";
}

const HL: Record<"high" | "mid" | "low", string> = {
  high: "bg-high-soft ring-1 ring-high/20",
  mid: "bg-mid-soft ring-1 ring-mid/25",
  low: "bg-low-soft ring-1 ring-low/25",
};

export function DocumentView({ text, finding, anchor }: { text: string; finding: Finding | null; anchor?: DocumentAnchor | null }) {
  const markRef = useRef<HTMLElement | null>(null);
  const canHighlightFinding =
    finding?.locate_status === "located" &&
    finding.char_start != null &&
    finding.char_end != null &&
    finding.char_start >= 0 &&
    finding.char_end > finding.char_start;
  const canHighlightAnchor =
    anchor != null &&
    anchor.start >= 0 &&
    anchor.end > anchor.start;
  const highlight = canHighlightAnchor
    ? {
        id: anchor.id,
        label: anchor.label,
        start: anchor.start,
        end: anchor.end,
        className: "bg-info-soft ring-1 ring-info/25",
        kind: "条款定位",
      }
    : canHighlightFinding
      ? {
          id: String(finding!.id),
          label: finding!.title,
          start: finding!.char_start!,
          end: finding!.char_end!,
          className: HL[finding!.level],
          kind: "意见定位",
        }
      : null;

  const parts = useMemo(() => {
    if (!highlight) {
      return [{ text, highlight: false as const }];
    }
    const start = Math.min(highlight.start, text.length);
    const end = Math.min(highlight.end, text.length);
    return [
      { text: text.slice(0, start), highlight: false as const },
      { text: text.slice(start, end), highlight: true as const },
      { text: text.slice(end), highlight: false as const },
    ];
  }, [highlight, text]);

  useEffect(() => {
    if (highlight) {
      markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlight?.id]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2.5 text-sm">
        <FileText size={16} className="text-muted" />
        <span className="font-medium text-ink">原文定位</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          {highlight ? (
            <>
              <MapPin size={13} className="text-good" /> {highlight.kind}
            </>
          ) : finding ? (
            canHighlightFinding ? (
              <>
                <MapPin size={13} className="text-good" /> 已定位
              </>
            ) : (
              <>
                <MapPinOff size={13} className="text-mid-fg" /> 定位存疑
              </>
            )
          ) : (
            "未选择意见"
          )}
        </span>
      </div>
      <pre className="m-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[13px] leading-[1.85] text-ink2">
        {parts.map((part, index) =>
          part.highlight && highlight ? (
            <mark key={index} ref={markRef} className={`rounded-sm px-1 py-0.5 text-ink ${highlight.className}`}>
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          )
        )}
      </pre>
    </div>
  );
}
