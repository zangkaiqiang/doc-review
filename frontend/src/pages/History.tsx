import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { listReviews } from "../lib/api";
import type { ReviewListItem, Level } from "../types";
import { Badge, levelTone } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";

const STANCE_LABEL: Record<string, string> = {
  party_a: "甲方", party_b: "乙方/投标", neutral: "中立", tenderee: "招标方",
};
const LEVEL_LABEL: Record<Level, string> = { high: "高危", mid: "中危", low: "低危" };
const STATUS_LABEL: Record<string, string> = {
  pending: "待执行", running: "审查中", done: "已完成", failed: "失败",
};

function when(iso: string): string {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function History() {
  const nav = useNavigate();
  const [items, setItems] = useState<ReviewListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listReviews().then(setItems).catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold text-ink">历史记录</h1>
      <p className="mt-1 text-sm text-muted">过往的审查任务，点击查看详情。</p>

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        {error && <div className="p-6 text-sm text-high">{error}</div>}

        {!items && !error && (
          <div className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-5 w-14" />
              </div>
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <EmptyState
            icon={<Inbox size={28} />}
            title="还没有审查记录"
            hint="去新建一份审查，结果会出现在这里。"
            action={<Button className="mt-1" onClick={() => nav("/new")}>新建审查</Button>}
          />
        )}

        {items && items.length > 0 && (
          <div className="divide-y divide-line">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => nav(`/review/${it.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-line/40"
              >
                <span className="truncate font-medium text-ink">{it.doc_name}</span>
                <Badge tone="brand">{STANCE_LABEL[it.stance] ?? it.stance}</Badge>
                <span className="ml-auto text-xs text-muted">{STATUS_LABEL[it.status] ?? it.status}</span>
                {it.level && <Badge tone={levelTone[it.level]}>{it.score} · {LEVEL_LABEL[it.level]}</Badge>}
                <span className="w-28 text-right text-xs tabular-nums text-faint">{when(it.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
