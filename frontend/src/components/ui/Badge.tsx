import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "brand" | "high" | "mid" | "low" | "neutral" | "good" | "info";

const TONE: Record<Tone, string> = {
  brand: "border-brand/15 bg-brand-soft text-brand",
  high: "border-high/15 bg-high-soft text-high",
  mid: "border-mid/20 bg-mid-soft text-mid-fg",
  low: "border-low/20 bg-low-soft text-muted",
  neutral: "border-line bg-panel text-muted",
  good: "border-good/15 bg-good-soft text-good",
  info: "border-info/15 bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

// level → tone 映射，severity 各处复用
export const levelTone: Record<"high" | "mid" | "low", Tone> = { high: "high", mid: "mid", low: "low" };
