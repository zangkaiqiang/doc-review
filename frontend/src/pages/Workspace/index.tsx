import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getReview, getReviewTemplates, rerunReview } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import type { ChecklistItem, Finding, Level, ReviewTask, RuleConfig, ScoringConfig } from "../../types";
import { Dashboard } from "./Dashboard";
import { ClauseChecklist } from "./ClauseChecklist";
import { ProfileCard } from "./ProfileCard";
import { RuleSnapshotCard } from "./RuleSnapshotCard";
import { DocumentView, type DocumentAnchor } from "./DocumentView";
import { FindingsList } from "./FindingsList";
import { FindingDetail } from "./FindingDetail";
import { ReviewAgent } from "./ReviewAgent";
import { RuleDrawer } from "./RuleDrawer";
import { normalizeRuleConfig } from "../../components/RuleTemplateEditor";
import { normalizeScoringConfig, defaultScoring } from "../../components/ScoringEditor";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [templateLabels, setTemplateLabels] = useState<Record<string, string>>({});

  const [selected, setSelected] = useState<number | null>(null);
  const [clauseAnchor, setClauseAnchor] = useState<DocumentAnchor | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<Finding["source"] | "all">("all");
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

  useEffect(() => {
    let alive = true;
    getReviewTemplates()
      .then((items) => {
        if (alive) setTemplateLabels(Object.fromEntries(items.map((item) => [item.key, item.label])));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => ({
    high: findings.filter((f) => f.level === "high").length,
    mid: findings.filter((f) => f.level === "mid").length,
    low: findings.filter((f) => f.level === "low").length,
  }), [findings]);
  const sourceCounts = useMemo(() => ({
    rule: findings.filter((f) => f.source === "rule").length,
    llm: findings.filter((f) => f.source === "llm").length,
  }), [findings]);
  const shown = useMemo(() => findings.filter((f) => {
    const levelMatched = levelFilter === "all" || f.level === levelFilter;
    const sourceMatched = sourceFilter === "all" || f.source === sourceFilter;
    return levelMatched && sourceMatched;
  }), [findings, levelFilter, sourceFilter]);
  const clauseAnchors = useMemo(() => {
    if (!doc?.text) return {};
    const acc: Record<string, DocumentAnchor> = {};
    for (const item of checklist) {
      if (
        item.present &&
        item.char_start != null &&
        item.char_end != null &&
        item.char_start >= 0 &&
        item.char_end > item.char_start
      ) {
        acc[item.clause] = {
          id: `clause-review:${item.clause}:${item.char_start}:${item.char_end}`,
          label: item.clause,
          start: item.char_start,
          end: item.char_end,
          tone: "clause",
        };
      }
    }
    if (!task?.rule_config?.checklist) return acc;
    return task.rule_config.checklist.reduce<Record<string, DocumentAnchor>>((next, item) => {
      if (!item.enabled) return next;
      if (next[item.clause]) return next;
      let best: { keyword: string; start: number } | null = null;
      for (const raw of item.keywords || []) {
        const keyword = raw.trim();
        if (!keyword) continue;
        const start = doc.text.indexOf(keyword);
        if (start >= 0 && (!best || start < best.start || (start === best.start && keyword.length > best.keyword.length))) {
          best = { keyword, start };
        }
      }
      if (best) {
        next[item.clause] = {
          id: `clause:${item.clause}:${best.start}:${best.keyword}`,
          label: item.clause,
          start: best.start,
          end: best.start + best.keyword.length,
          tone: "clause",
        };
      }
      return next;
    }, acc);
  }, [checklist, doc?.text, task?.rule_config?.checklist]);
  const current = shown.find((f) => f.id === selected) || null;

  useEffect(() => {
    if (shown.length === 0) {
      if (selected !== null) setSelected(null);
      setClauseAnchor(null);
      return;
    }
    if (selected === null || !shown.some((finding) => finding.id === selected)) {
      setSelected(shown[0].id);
      setClauseAnchor(null);
    }
  }, [selected, shown]);

  function clearFilters() {
    setLevelFilter("all");
    setSourceFilter("all");
  }

  function selectFinding(id: number) {
    setSelected(id);
    setClauseAnchor(null);
  }

  function locateClause(anchor: DocumentAnchor) {
    setClauseAnchor(anchor);
  }

  async function handleRerun(rule: RuleConfig, scoring: ScoringConfig) {
    try {
      const { task_id } = await rerunReview(taskId, {
        rule_config: normalizeRuleConfig(rule),
        scoring_config: normalizeScoringConfig(scoring),
      });
      setDrawerOpen(false);
      nav(`/review/${task_id}`);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
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
    const maxHeight = Math.max(260, containerHeight - 180);

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
    ? `${docHeight}px 10px minmax(168px,1fr)`
    : "minmax(360px,1fr) 10px 188px";
  const rightRows = findingsHeight
    ? `${findingsHeight}px 10px minmax(220px,1fr)`
    : "minmax(280px,0.52fr) 10px minmax(220px,0.48fr)";

  return (
    <div className="flex h-full flex-col bg-bg">
      <Dashboard
        docName={doc?.name ?? ""}
        stance={stance}
        templateLabel={templateLabels[stance] ?? stance}
        running={running}
        stage={stage}
        score={score}
        level={level}
        counts={counts}
        sourceCounts={sourceCounts}
        levelFilter={levelFilter}
        onFilter={setLevelFilter}
        sourceFilter={sourceFilter}
        onSourceFilter={setSourceFilter}
        onClearFilters={clearFilters}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((v) => !v)}
        onBack={() => nav("/history")}
        version={task?.version ?? 1}
        onAdjustRules={task && !running ? () => setDrawerOpen(true) : undefined}
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
            <ClauseChecklist
              items={checklist}
              anchors={clauseAnchors}
              activeClause={clauseAnchor?.label ?? null}
              onLocate={locateClause}
            />
            <ProfileCard profile={profile} />
          </aside>
        )}

        {!focusMode && <ResizeHandle direction="x" onPointerDown={(event) => startSideResize("left", event)} />}

        <main ref={centerRef} className="grid min-h-0 min-w-0" style={{ gridTemplateRows: centerRows }}>
          <section ref={docPanelRef} className="min-h-0 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
            {doc ? <DocumentView text={doc.text} finding={current} anchor={clauseAnchor} /> : <div className="p-16 text-center text-muted">加载原文</div>}
          </section>
          <ResizeHandle direction="y" onPointerDown={startDocResize} />
          <section className="min-h-0 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
            <ReviewAgent taskId={taskId} currentFinding={current} />
          </section>
        </main>

        {!focusMode && <ResizeHandle direction="x" onPointerDown={(event) => startSideResize("right", event)} />}

        {!focusMode && (
          <aside ref={rightRef} className="grid min-w-0 overflow-hidden" style={{ gridTemplateRows: rightRows }}>
              <div ref={findingsPanelRef} className="min-h-0 overflow-hidden rounded-card border border-line-strong bg-surface shadow-soft">
                <FindingsList findings={shown} selected={selected} running={running} onSelect={selectFinding} />
              </div>
              <ResizeHandle direction="y" onPointerDown={startFindingsResize} />
              {current ? (
                <div className="h-full min-h-0 overflow-hidden rounded-card border border-line-strong bg-surface shadow-soft">
                  <FindingDetail finding={current} />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-card border border-line-strong bg-surface px-6 text-center text-sm text-faint shadow-soft">选择一条意见查看详情</div>
              )}
          </aside>
        )}
      </div>

      {task && (
        <RuleDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          version={task.version ?? 1}
          initialRule={task.rule_config}
          initialScoring={task.scoring_config ?? defaultScoring()}
          onSubmit={handleRerun}
        />
      )}
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
