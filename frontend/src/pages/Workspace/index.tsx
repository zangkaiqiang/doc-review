import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getReview, updateFinding } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import type { ChecklistItem, Finding, Level, ReviewTask } from "../../types";
import { Dashboard } from "./Dashboard";
import { ClauseChecklist } from "./ClauseChecklist";
import { ProfileCard } from "./ProfileCard";
import { RuleSnapshotCard } from "./RuleSnapshotCard";
import { DocumentView } from "./DocumentView";
import { FindingsList } from "./FindingsList";
import { FindingDetail } from "./FindingDetail";
import { ReviewAgent } from "./ReviewAgent";
import { cn } from "../../lib/cn";

export default function Workspace() {
  const { id } = useParams();
  const taskId = Number(id);
  const nav = useNavigate();
  const { toast } = useToast();

  const [doc, setDoc] = useState<{ name: string; text: string } | null>(null);
  const [stance, setStance] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [score, setScore] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [stage, setStage] = useState("连接中");
  const [running, setRunning] = useState(true);
  const [task, setTask] = useState<ReviewTask | null>(null);

  const [selected, setSelected] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [sideWidth, setSideWidth] = useState(320);
  const [docHeight, setDocHeight] = useState<number | null>(null);
  const [findingsHeight, setFindingsHeight] = useState<number | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const centerRef = useRef<HTMLElement | null>(null);
  const docPanelRef = useRef<HTMLElement | null>(null);
  const rightRef = useRef<HTMLElement | null>(null);
  const findingsPanelRef = useRef<HTMLDivElement | null>(null);

  // SSE：阶段进度与意见边生成边接收（逻辑同旧实现，保持不变）
  useEffect(() => {
    const es = new EventSource(`/api/reviews/${taskId}/stream`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      switch (ev.type) {
        case "start":
          setDoc(ev.document);
          setStance(ev.stance);
          break;
        case "stage":
          setStage(ev.stage);
          break;
        case "finding": {
          const f = ev.finding;
          setFindings((prev) => [...prev, f]);
          setSelected((prev) => (prev === null ? f.id : prev));
          break;
        }
        case "done":
          setScore(ev.score);
          setLevel(ev.level);
          setChecklist(ev.checklist || []);
          setProfile(ev.profile || {});
          setStage("完成");
          setRunning(false);
          es.close();
          break;
        case "error":
          setStage("失败");
          setRunning(false);
          es.close();
          break;
      }
    };
    es.onerror = () => {
      setStage("连接中断");
      setRunning(false);
      es.close();
    };
    return () => es.close();
  }, [taskId]);

  // Fetch full task details (rule snapshot, version, parent id) for the rule snapshot card and rules drawer
  useEffect(() => {
    let alive = true;
    getReview(taskId)
      .then((r) => {
        if (alive) setTask(r.task);
      })
      // non-critical: task snapshot feeds the rule card / drawer; skip silently if unavailable
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [taskId]);

  const counts = {
    high: findings.filter((f) => f.level === "high").length,
    mid: findings.filter((f) => f.level === "mid").length,
    low: findings.filter((f) => f.level === "low").length,
  };
  const shown = levelFilter === "all" ? findings : findings.filter((f) => f.level === levelFilter);
  const current = findings.find((f) => f.id === selected) || null;

  async function patch(status: Finding["status"]) {
    if (!current) return;
    try {
      await updateFinding(current.id, { status });
      setFindings((prev) => prev.map((x) => (x.id === current.id ? { ...x, status } : x)));
      toast(status === "accepted" ? "已采纳" : "已驳回");
    } catch {
      toast("操作失败，请重试", "error");
    }
  }

  function startSideResize(edge: "left" | "right", event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sideWidth;
    const containerWidth = workspaceRef.current?.clientWidth ?? window.innerWidth;
    const maxWidth = Math.max(240, Math.min(460, Math.floor((containerWidth - 560) / 2)));

    const onMove = (move: globalThis.PointerEvent) => {
      const delta = move.clientX - startX;
      const next = edge === "left" ? startWidth + delta : startWidth - delta;
      setSideWidth(clamp(next, 240, maxWidth));
    };
    installDrag(onMove, "col-resize");
  }

  function startDocResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = docHeight ?? docPanelRef.current?.getBoundingClientRect().height ?? 320;
    const containerHeight = centerRef.current?.clientHeight ?? 640;
    const maxHeight = Math.max(220, containerHeight - 280);

    const onMove = (move: globalThis.PointerEvent) => {
      setDocHeight(clamp(startHeight + move.clientY - startY, 220, maxHeight));
    };
    installDrag(onMove, "row-resize");
  }

  function startFindingsResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = findingsHeight ?? findingsPanelRef.current?.getBoundingClientRect().height ?? 260;
    const containerHeight = rightRef.current?.clientHeight ?? 640;
    const maxHeight = Math.max(180, containerHeight - 300);

    const onMove = (move: globalThis.PointerEvent) => {
      setFindingsHeight(clamp(startHeight + move.clientY - startY, 180, maxHeight));
    };
    installDrag(onMove, "row-resize");
  }

  const centerRows = docHeight
    ? `${docHeight}px 12px minmax(220px,1fr)`
    : "minmax(240px,0.54fr) 12px minmax(260px,0.46fr)";
  const rightRows = findingsHeight
    ? `${findingsHeight}px 12px minmax(260px,1fr)`
    : "minmax(180px,0.38fr) 12px minmax(260px,1fr)";

  return (
    <div className="flex h-full flex-col bg-bg">
      <Dashboard
        docName={doc?.name ?? ""}
        stance={stance}
        running={running}
        stage={stage}
        score={score}
        level={level}
        counts={counts}
        levelFilter={levelFilter}
        onFilter={setLevelFilter}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((v) => !v)}
        onBack={() => nav("/history")}
      />

      <div
        ref={workspaceRef}
        className={cn(
          "grid min-h-0 flex-1 p-3",
          focusMode ? "grid-cols-[minmax(560px,1fr)]" : "grid-cols-[var(--side)_12px_minmax(460px,1fr)_12px_var(--side)]"
        )}
        style={{ "--side": `${sideWidth}px` } as CSSProperties}
      >
        {!focusMode && (
          <aside className="min-w-0 overflow-auto rounded-card border border-line bg-surface p-4 shadow-soft">
            {task && (
              <RuleSnapshotCard
                version={task.version ?? 1}
                clauseCount={task.rule_config?.checklist?.length ?? 0}
                thresholds={task.scoring_config?.thresholds ?? { low: 0, mid: 0 }}
              />
            )}
            <ClauseChecklist items={checklist} />
            <ProfileCard profile={profile} />
          </aside>
        )}

        {!focusMode && <ResizeHandle direction="x" onPointerDown={(event) => startSideResize("left", event)} />}

        <main ref={centerRef} className="grid min-h-0 min-w-0" style={{ gridTemplateRows: centerRows }}>
          <section ref={docPanelRef} className="min-h-0 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
            {doc ? <DocumentView text={doc.text} finding={current} /> : <div className="p-16 text-center text-muted">加载原文</div>}
          </section>
          <ResizeHandle direction="y" onPointerDown={startDocResize} />
          <section className="min-h-0 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
            <ReviewAgent taskId={taskId} currentFinding={current} />
          </section>
        </main>

        {!focusMode && <ResizeHandle direction="x" onPointerDown={(event) => startSideResize("right", event)} />}

        {!focusMode && (
          <aside ref={rightRef} className="grid min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-soft" style={{ gridTemplateRows: rightRows }}>
              <div ref={findingsPanelRef} className="min-h-0">
                <FindingsList findings={shown} selected={selected} running={running} onSelect={setSelected} />
              </div>
              <ResizeHandle direction="y" onPointerDown={startFindingsResize} />
              {current ? (
                <FindingDetail finding={current} onPatch={patch} />
              ) : (
                <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-faint">选择一条意见查看详情</div>
              )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ResizeHandle({ direction, onPointerDown }: { direction: "x" | "y"; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void }) {
  return (
    <div
      role="separator"
      aria-orientation={direction === "x" ? "vertical" : "horizontal"}
      title={direction === "x" ? "拖拽调整左右宽度" : "拖拽调整上下高度"}
      onPointerDown={onPointerDown}
      className={cn(
        "group flex items-center justify-center rounded-control transition-colors hover:bg-brand-soft",
        direction === "x" ? "cursor-col-resize" : "cursor-row-resize"
      )}
    >
      <span
        className={cn(
          "block rounded-full bg-line-strong transition-colors group-hover:bg-brand",
          direction === "x" ? "h-10 w-1" : "h-1 w-10"
        )}
      />
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function installDrag(onMove: (event: globalThis.PointerEvent) => void, cursor: string) {
  const originalCursor = document.body.style.cursor;
  const originalSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = "none";
  const cleanup = () => {
    document.removeEventListener("pointermove", onMove);
    document.body.style.cursor = originalCursor;
    document.body.style.userSelect = originalSelect;
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", cleanup, { once: true });
}
