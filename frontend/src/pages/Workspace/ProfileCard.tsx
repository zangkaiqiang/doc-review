import { Banknote, FileBadge, Users } from "lucide-react";

export function ProfileCard({ profile }: { profile: Record<string, any> }) {
  const rows = [
    { key: "金额", value: profile?.amount ?? "—", icon: Banknote },
    { key: "大写金额", value: profile?.has_amount_cn ? "有" : "缺", icon: FileBadge, warn: !profile?.has_amount_cn },
    { key: "主体", value: profile?.parties_hint ? "甲乙方" : "—", icon: Users },
  ];

  return (
    <section className="mt-5">
      <div className="mb-3 text-sm font-semibold text-ink">合同档案卡</div>
      <div className="grid gap-1.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.key} className="rounded-control border border-line bg-panel px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-faint">
                <Icon size={13} />
                {row.key}
              </div>
              <div className={`truncate text-sm font-medium tabular-nums ${row.warn ? "text-high" : "text-ink2"}`}>{row.value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
