import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { ShellLayout } from "./components/ShellLayout";
import NewReview from "./pages/NewReview";
import History from "./pages/History";
import RulesConfig from "./pages/RulesConfig";
import Workspace from "./pages/Workspace";

// Use route param id as key so navigating to a new/derived version fully remounts
// Workspace, resets all state, and reconnects SSE
function WorkspaceRoute() {
  const { id } = useParams();
  return <Workspace key={id} />;
}

export const router = createBrowserRouter([
  {
    element: <ShellLayout />,
    children: [
      { path: "/", element: <Navigate to="/new" replace /> },
      { path: "/new", element: <NewReview /> },
      { path: "/history", element: <History /> },
      { path: "/rules", element: <RulesConfig /> },
    ],
  },
  { path: "/review/:id", element: <WorkspaceRoute /> },
]);
