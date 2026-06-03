import { useState } from "react";
import NewReview from "./components/NewReview";
import Workspace from "./components/Workspace";

export default function App() {
  const [taskId, setTaskId] = useState<number | null>(null);

  return taskId === null ? (
    <NewReview onCreated={setTaskId} />
  ) : (
    <Workspace taskId={taskId} onBack={() => setTaskId(null)} />
  );
}
