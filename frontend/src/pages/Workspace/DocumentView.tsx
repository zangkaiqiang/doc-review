import { useEffect, useMemo, useRef } from "react";
import { FileText, MapPin, MapPinOff } from "lucide-react";
import type { Finding } from "../../types";

const HL: Record<"high" | "mid" | "low", string> = {
  high: "bg-high-soft ring-1 ring-high/20",
  mid: "bg-mid-soft ring-1 ring-mid/25",
  low: "bg-low-soft ring-1 ring-low/25",
};

export function DocumentView({ text, finding }: { text: string; finding: Finding | null }) {
  const markRef = useRef<HTMLElement | null>(null);
  const canHighlight =
    finding?.locate_status === "located" &&
    finding.char_start != null &&
    finding.char_end != null &&
    finding.char_start >= 0 &&
    finding.char_end > finding.char_start;

  const parts = useMemo(() => {
    if (!finding || !canHighlight) {
      return [{ text, highlight: false as const }];
    }
    const start = Math.min(finding.char_start!, text.length);
    const end = Math.min(finding.char_end!, text.length);
    return [
      { text: text.slice(0, start), highlight: false as const },
      { text: text.slice(start, end), highlight: true as const },
      { text: text.slice(end), highlight: false as const },
    ];
  }, [canHighlight, finding, text]);

  useEffect(() => {
    if (canHighlight) {
      markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [canHighlight, finding?.id]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2.5 text-sm">
        <FileText size={16} className="text-muted" />
        <span className="font-medium text-ink">原文定位</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          {finding ? (
            canHighlight ? (
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
          part.highlight && finding ? (
            <mark key={index} ref={markRef} className={`rounded-sm px-1 py-0.5 text-ink ${HL[finding.level]}`}>
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
