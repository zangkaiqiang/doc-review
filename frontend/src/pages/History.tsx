import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, FileText, Inbox, Search } from "lucide-react";
import { getReviewTemplates, listReviews } from "../lib/api";
import { LEVEL_LABEL, STATUS_LABEL } from "../lib/labels";
import type { ReviewListItem, ReviewTemplate } from "../types";
import { Badge, levelTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { cn } from "../lib/cn";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "done", label: "已完成" },
  { key: "running", label: "审查中" },
  { key: "pending", label: "待执行" },
  { key: "failed", label: "失败" },
];

function when(iso: string): string {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusTone(status: string): "good" | "info" | "high" | "neutral" {
  if (status === "done") return "good";
  if (status === "running") return "info";
  if (status === "failed") return "high";
  return "neutral";
}

export default function History() {
  const nav = useNavigate();
  const [items, setItems] = useState<ReviewListItem[] | null>(null);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    Promise.all([listReviews(), getReviewTemplates()])
      .then(([reviewItems, templateItems]) => {
        setItems(reviewItems);
        setTemplates(templateItems);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const templateLabels = useMemo(
    () => Object.fromEntries(templates.map((item) => [item.key, item.label])),
    [templates]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      const templateLabel = templateLabels[item.stance] ?? item.stance;
      const matchQuery = !q || item.doc_name.toLowerCase().includes(q) || item.stance.toLowerCase().includes(q) || templateLabel.toLowerCase().includes(q);
      const matchStatus = filter === "all" || item.status === filter;
      return matchQuery && matchStatus;
    });
  }, [filter, items, query, templateLabels]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="neutral" className="mb-2">
            <Clock size={13} /> 任务记录
          </Badge>
          <h1 className="text-2xl font-semibold text-ink">历史记录</h1>
        </div>
        <Button onClick={() => nav("/new")}>新建审查</Button>
      </div>

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-3">
          <div className="relative min-w-60 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索文档名"
              className="h-9 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-sm text-ink2 outline-none transition-colors focus:border-brand/50"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "h-8 rounded-control px-3 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-brand text-white" : "bg-surface text-muted hover:bg-line/70 hover:text-ink2"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="p-6 text-sm text-high">{error}</div>}

        {!items && !error && (
          <div className="divide-y divide-line">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_110px_120px] items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <EmptyState
            icon={<Inbox size={28} />}
            title="还没有审查记录"
            action={<Button className="mt-1" onClick={() => nav("/new")}>新建审查</Button>}
          />
        )}

        {items && items.length > 0 && visible.length === 0 && (
          <EmptyState icon={<Search size={28} />} title="没有匹配记录" />
        )}

        {items && visible.length > 0 && (
          <div>
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_120px_130px] gap-4 border-b border-line px-4 py-2.5 text-xs font-medium text-faint md:grid">
              <span>文档</span>
              <span>模板</span>
              <span>状态</span>
              <span>评分</span>
              <span className="text-right">创建时间</span>
            </div>
            <div className="divide-y divide-line">
              {visible.map((item) => (
                <button
                  key={item.id}
                  onClick={() => nav(`/review/${item.id}`)}
                  className="grid w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-line/40 md:grid-cols-[minmax(0,1fr)_110px_110px_120px_130px] md:items-center md:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-panel text-muted">
                      <FileText size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{item.doc_name}</span>
                      <span className="mt-0.5 block text-xs text-faint md:hidden">{when(item.created_at)}</span>
                    </span>
                  </span>
                  <Badge tone="brand" className="w-fit">{templateLabels[item.stance] ?? item.stance}</Badge>
                  <Badge tone={statusTone(item.status)} className="w-fit">{STATUS_LABEL[item.status] ?? item.status}</Badge>
                  {item.level ? (
                    <Badge tone={levelTone[item.level]} className="w-fit">
                      {item.score} · {LEVEL_LABEL[item.level]}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" className="w-fit">未评分</Badge>
                  )}
                  <span className="hidden text-right text-xs tabular-nums text-faint md:block">{when(item.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
