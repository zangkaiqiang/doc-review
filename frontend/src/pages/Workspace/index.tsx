import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { updateFinding } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import type { ChecklistItem, Finding, Level } from "../../types";
import { Dashboard } from "./Dashboard";
import { ClauseChecklist } from "./ClauseChecklist";
import { ProfileCard } from "./ProfileCard";
import { DocumentView } from "./DocumentView";
import { FindingsList } from "./FindingsList";
import { FindingDetail } from "./FindingDetail";

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

  const [selected, setSelected] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");

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
    es.onerror = () => es.close();
    return () => es.close();
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

  return (
    <div className="flex h-full flex-col">
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

      <div className="flex min-h-0 flex-1">
        {!focusMode && (
          <aside className="w-52 shrink-0 overflow-auto border-r border-line bg-surface p-3.5">
            <ClauseChecklist items={checklist} />
            <ProfileCard profile={profile} />
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-auto bg-surface">
          {doc ? <DocumentView text={doc.text} finding={current} /> : <div className="p-16 text-center text-muted">加载原文…</div>}
        </main>

        <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-surface">
          <div className="max-h-[42%] shrink-0 overflow-hidden">
            <FindingsList findings={shown} selected={selected} running={running} onSelect={setSelected} />
          </div>
          {current && <FindingDetail finding={current} onPatch={patch} />}
        </aside>
      </div>
    </div>
  );
}
