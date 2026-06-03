import { cn } from "../../lib/cn";

const COLOR: Record<"high" | "mid" | "low", string> = {
  high: "bg-high",
  mid: "bg-mid",
  low: "bg-low",
};

export function SeverityDot({ level, className }: { level: "high" | "mid" | "low"; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", COLOR[level], className)} />;
}
