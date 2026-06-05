import { ArrowLeft, Bot, LayoutPanelLeft, ListChecks, Maximize2, SlidersHorizontal } from "lucide-react";
import type { Finding, Level } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SeverityDot } from "../../components/ui/SeverityDot";
import { cn } from "../../lib/cn";
import { LEVEL_LABEL } from "../../lib/labels";
import { findingSourceLabel } from "../../lib/findingSource";

type SourceFilter = Finding["source"] | "all";

const STAGES = [
  { key: "切分", label: "切分" },
  { key: "要素抽取", label: "要素抽取" },
  { key: "规则校验", label: "规则扫描" },
  { key: "LLM研判", label: "智能体审查" },
  { key: "评分", label: "评分" },
  { key: "完成", label: "完成" },
];

export function Dashboard(props: {
  docName: string;
  stance: string;
  templateLabel?: string;
  running: boolean;
  stage: string;
  score: number | null;
  level: Level | null;
  counts: { high: number; mid: number; low: number };
  sourceCounts: { rule: number; llm: number };
  levelFilter: Level | "all";
  onFilter: (l: Level | "all") => void;
  sourceFilter: SourceFilter;
  onSourceFilter: (source: SourceFilter) => void;
  onClearFilters: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onBack: () => void;
  version?: number;
  onAdjustRules?: () => void;
}) {
  const currentIndex = STAGES.findIndex((stage) => stage.key === props.stage);
  const total = props.counts.high + props.counts.mid + props.counts.low;
  const progress = props.running
    ? Math.max(8, ((Math.max(currentIndex, 0) + 1) / STAGES.length) * 100)
    : 100;
  const stageLabel = STAGES.find((stage) => stage.key === props.stage)?.label ?? props.stage;
  const allFiltersClear = props.levelFilter === "all" && props.sourceFilter === "all";

  return (
    <header className="border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={props.onBack} title="返回历史">
          <ArrowLeft size={17} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-ink">{props.docName || "审查中"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {props.stance && <Badge tone="brand">{props.templateLabel ?? props.stance}</Badge>}
            {props.running ? (
              <Badge tone="info">{stageLabel || "连接中"}</Badge>
            ) : props.level ? (
              <Badge tone={props.level}>风险 {props.score}/100 · {LEVEL_LABEL[props.level]}</Badge>
            ) : (
              <Badge tone="neutral">等待评分</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={props.onClearFilters}
            className={cn(
              "h-8 rounded-control px-2.5 text-xs font-medium transition-colors",
              allFiltersClear ? "bg-brand text-white" : "bg-panel text-muted hover:bg-line/70"
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
          {(["rule", "llm"] as const).map((source) => (
            <button
              key={source}
              onClick={() => props.onSourceFilter(props.sourceFilter === source ? "all" : source)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium transition-colors",
                props.sourceFilter === source ? "bg-ink text-white" : "bg-panel text-muted hover:bg-line/70 hover:text-ink2"
              )}
            >
              {source === "rule" ? <ListChecks size={13} /> : <Bot size={13} />}
              {findingSourceLabel(source)} {props.sourceCounts[source]}
            </button>
          ))}
          {props.onAdjustRules && (
            <Button variant="ghost" size="sm" onClick={props.onAdjustRules}>
              <SlidersHorizontal size={15} />
              调整规则{props.version ? ` · v${props.version}` : ""}
            </Button>
          )}
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
                  key={stage.key}
                  className={cn(
                    "truncate",
                    currentIndex === index && "font-medium text-brand",
                    currentIndex > index && "text-good"
                  )}
                >
                  {stage.label}
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
