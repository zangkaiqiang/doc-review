import { ArrowLeft } from "lucide-react";
import type { Level } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/cn";
import { STANCE_LABEL, LEVEL_LABEL } from "../../lib/labels";

const STAGES = ["切分", "要素抽取", "规则校验", "LLM研判", "评分", "完成"];

export function Dashboard(props: {
  docName: string;
  stance: string;
  running: boolean;
  stage: string;
  score: number | null;
  level: Level | null;
  counts: { high: number; mid: number; low: number };
  levelFilter: Level | "all";
  onFilter: (l: Level | "all") => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onBack: () => void;
}) {
  const { counts } = props;
  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
      <button onClick={props.onBack} className="text-muted hover:text-ink">
        <ArrowLeft size={18} />
      </button>
      <span className="font-semibold text-ink">{props.docName || "审查中…"}</span>
      {props.stance && <Badge tone="brand">{STANCE_LABEL[props.stance] ?? props.stance}</Badge>}

      {props.running ? (
        <div className="flex items-center gap-1.5 text-xs">
          {STAGES.map((s) => {
            const cur = STAGES.indexOf(props.stage);
            const here = STAGES.indexOf(s);
            return (
              <span
                key={s}
                className={cn(
                  "rounded-full px-2 py-0.5",
                  s === props.stage ? "bg-brand-soft font-medium text-brand" : here < cur ? "bg-good-soft text-good" : "bg-line text-faint"
                )}
              >
                {s}
              </span>
            );
          })}
        </div>
      ) : (
        props.level && (
          <Badge tone={props.level}>风险 {props.score}/100 · {LEVEL_LABEL[props.level]}</Badge>
        )
      )}

      <div className="ml-auto flex items-center gap-2">
        {(["high", "mid", "low"] as const).map((l) => (
          <button
            key={l}
            onClick={() => props.onFilter(props.levelFilter === l ? "all" : l)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              l === "high" && "bg-high-soft text-high",
              l === "mid" && "bg-mid-soft text-mid-fg",
              l === "low" && "bg-low-soft text-muted",
              props.levelFilter === l && "ring-2 ring-brand/40"
            )}
          >
            ● {l === "high" ? "高" : l === "mid" ? "中" : "低"} {counts[l]}
          </button>
        ))}
        <button onClick={props.onToggleFocus} className="rounded-control border border-line px-3 py-1 text-xs text-muted hover:bg-line/60">
          {props.focusMode ? "完整模式" : "专注模式"}
        </button>
      </div>
    </header>
  );
}
