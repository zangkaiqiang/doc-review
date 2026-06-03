import type { ReactNode } from "react";

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="text-sm font-medium text-ink2">{title}</div>
      {hint && <div className="max-w-xs text-xs text-muted">{hint}</div>}
      {action}
    </div>
  );
}
