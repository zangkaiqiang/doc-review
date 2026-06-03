import type { ReviewResult, ReviewListItem } from "../types";

export async function uploadDocument(file: File): Promise<{ id: number; name: string; chars: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/documents", { method: "POST", body: fd });
  if (!r.ok) throw new Error("文件上传或解析失败");
  return r.json();
}

export async function createReview(body: {
  doc_id?: number;
  text?: string;
  name?: string;
  stance: string;
}): Promise<{ task_id: number }> {
  const r = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("发起审查失败");
  return r.json();
}

export async function listReviews(): Promise<ReviewListItem[]> {
  const r = await fetch("/api/reviews");
  if (!r.ok) throw new Error("获取历史失败");
  return r.json();
}

export async function getReview(taskId: number): Promise<ReviewResult> {
  const r = await fetch(`/api/reviews/${taskId}`);
  if (!r.ok) throw new Error("获取结果失败");
  return r.json();
}

export async function updateFinding(
  id: number,
  body: { status?: string; reject_reason?: string; suggestion?: string }
): Promise<void> {
  await fetch(`/api/findings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
