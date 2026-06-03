import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "brand" | "high" | "mid" | "low" | "neutral";

const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  high: "bg-high-soft text-high",
  mid: "bg-mid-soft text-[#b54708]",
  low: "bg-low-soft text-muted",
  neutral: "bg-line/70 text-muted",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

// level → tone 映射，severity 各处复用
export const levelTone: Record<"high" | "mid" | "low", Tone> = { high: "high", mid: "mid", low: "low" };
