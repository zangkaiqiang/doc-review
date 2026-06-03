import { ArrowLeft, LayoutPanelLeft, Maximize2 } from "lucide-react";
import type { Level } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { cn } from "../../lib/cn";
import { LEVEL_LABEL, STANCE_LABEL } from "../../lib/labels";

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
  const currentIndex = STAGES.indexOf(props.stage);
  const total = props.counts.high + props.counts.mid + props.counts.low;
  const progress = props.running
    ? Math.max(8, ((Math.max(currentIndex, 0) + 1) / STAGES.length) * 100)
    : 100;

  return (
    <header className="border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={props.onBack} title="返回历史">
          <ArrowLeft size={17} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-ink">{props.docName || "审查中"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {props.stance && <Badge tone="brand">{STANCE_LABEL[props.stance] ?? props.stance}</Badge>}
            {props.running ? (
              <Badge tone="info">{props.stage || "连接中"}</Badge>
            ) : props.level ? (
              <Badge tone={props.level}>风险 {props.score}/100 · {LEVEL_LABEL[props.level]}</Badge>
            ) : (
              <Badge tone="neutral">等待评分</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => props.onFilter("all")}
            className={cn(
              "h-8 rounded-control px-2.5 text-xs font-medium transition-colors",
              props.levelFilter === "all" ? "bg-brand text-white" : "bg-panel text-muted hover:bg-line/70"
            )}
          >
            全部 {total}
          </button>
          {(["high", "mid", "low"] as const).map((level) => (
            <button
              key={level}
              onClick={() => props.onFilter(props.levelFilter === level ? "all" : level)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium transition-colors",
                props.levelFilter === level ? "bg-brand text-white" : "bg-panel text-muted hover:bg-line/70 hover:text-ink2"
              )}
            >
              <SeverityDot level={level} className={props.levelFilter === level ? "bg-white" : undefined} />
              {level === "high" ? "高" : level === "mid" ? "中" : "低"} {props.counts[level]}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={props.onToggleFocus}>
            {props.focusMode ? <LayoutPanelLeft size={15} /> : <Maximize2 size={15} />}
            {props.focusMode ? "完整模式" : "专注模式"}
          </Button>
        </div>
      </div>

      <div className="border-t border-line bg-panel px-4 py-2.5">
        {props.running ? (
          <div className="grid gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="grid grid-cols-6 gap-1 text-center text-[11px] text-faint">
              {STAGES.map((stage, index) => (
                <span
                  key={stage}
                  className={cn(
                    "truncate",
                    currentIndex === index && "font-medium text-brand",
                    currentIndex > index && "text-good"
                  )}
                >
                  {stage}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>审查完成</span>
            <span className="tabular-nums">{total} 条意见</span>
          </div>
        )}
      </div>
    </header>
  );
}
