import { useMemo } from "react";
import type { Finding } from "../../types";

const HL: Record<"high" | "mid" | "low", string> = {
  high: "bg-high-soft",
  mid: "bg-mid-soft",
  low: "bg-low-soft",
};

export function DocumentView({ text, finding }: { text: string; finding: Finding | null }) {
  const parts = useMemo(() => {
    if (!finding || finding.char_start == null || finding.char_end == null) {
      return [{ t: text, hl: false as const }];
    }
    const { char_start: s, char_end: e } = finding;
    return [
      { t: text.slice(0, s), hl: false as const },
      { t: text.slice(s, e), hl: true as const },
      { t: text.slice(e), hl: false as const },
    ];
  }, [text, finding]);

  return (
    <pre className="m-0 whitespace-pre-wrap break-words px-6 py-5 font-mono text-[13.5px] leading-[2.05] text-ink2">
      {parts.map((p, i) =>
        p.hl && finding ? (
          <mark key={i} className={`rounded-sm px-0.5 ${HL[finding.level]}`}>{p.t}</mark>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </pre>
  );
}
