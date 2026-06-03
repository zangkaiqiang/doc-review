import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function ShellLayout() {
  return (
    <div className="flex h-full bg-bg">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
