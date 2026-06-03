import type { ReviewResult } from "./types";

export async function createReview(text: string, stance: string, name: string): Promise<{ task_id: number }> {
  const r = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, stance, name }),
  });
  if (!r.ok) throw new Error("发起审查失败");
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
