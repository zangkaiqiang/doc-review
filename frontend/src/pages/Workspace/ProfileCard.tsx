export function ProfileCard({ profile }: { profile: Record<string, any> }) {
  const rows: [string, string][] = [
    ["金额", profile?.amount ?? "—"],
    ["大写金额", profile?.has_amount_cn ? "有" : "缺"],
    ["主体", profile?.parties_hint ? "甲乙方" : "—"],
  ];
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">合同档案卡</div>
      <div className="rounded-card border border-line bg-bg p-3 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5">
            <span className="text-faint">{k}</span>
            <span className={k === "大写金额" && v === "缺" ? "text-high" : "text-ink2"}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
