import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function ShellLayout() {
  return (
    <div className="flex min-h-full flex-col bg-bg lg:h-full lg:flex-row">
      <Sidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
