import { NavLink } from "react-router-dom";
import { FileText, Plus, History, Library } from "lucide-react";
import { cn } from "../lib/cn";

const item = "flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors";

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-3">
      <div className="mb-3 flex items-center gap-2 px-2 py-1 font-semibold text-ink">
        <FileText size={18} className="text-brand" /> 文档审查
      </div>
      <NavLink to="/new" className={({ isActive }) => cn(item, isActive ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line/60")}>
        <Plus size={16} /> 新建审查
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => cn(item, isActive ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-line/60")}>
        <History size={16} /> 历史记录
      </NavLink>
      <div className={cn(item, "cursor-not-allowed text-faint")} title="后续上线">
        <Library size={16} /> 知识库 <span className="ml-auto text-[10px]">后续</span>
      </div>
    </aside>
  );
}
