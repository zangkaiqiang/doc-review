import { useParams } from "react-router-dom";

export default function Workspace() {
  const { id } = useParams();
  return <div className="p-8">工作台（占位）task={id}</div>;
}
