import { NavLink } from "react-router-dom";
import { FileText, Plus, History, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { cn } from "../lib/cn";

const item = "flex h-9 items-center gap-2.5 rounded-control px-3 text-sm transition-colors";

export function Sidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-surface p-3 lg:h-full lg:w-60 lg:border-b-0 lg:border-r">
      <div className="mb-5 flex items-center gap-2 rounded-card border border-line bg-panel px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand text-white shadow-sm">
          <FileText size={17} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">文档审查</div>
          <div className="text-xs text-faint">合同风险工作台</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="px-3 pb-1 text-xs font-medium text-faint">审查</div>
        <NavLink to="/new" className={({ isActive }) => cn(item, isActive ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line/60 hover:text-ink2")}>
          <Plus size={16} /> 新建审查
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => cn(item, isActive ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line/60 hover:text-ink2")}>
          <History size={16} /> 历史记录
        </NavLink>
      </div>

      <div className="mt-5 space-y-1">
        <div className="px-3 pb-1 text-xs font-medium text-faint">配置</div>
        <NavLink to="/rules" className={({ isActive }) => cn(item, isActive ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line/60 hover:text-ink2")}>
          <SlidersHorizontal size={16} /> 规则配置
        </NavLink>
      </div>

      <div className="mt-auto hidden rounded-card border border-line bg-panel p-3 lg:block">
        <div className="flex items-center gap-2 text-xs font-medium text-ink2">
          <ShieldCheck size={15} className="text-good" />
          规则兜底已启用
        </div>
        <div className="mt-1 text-xs leading-5 text-muted">未命中自定义规则时，将使用默认审查规则补充判断。</div>
      </div>
    </aside>
  );
}
