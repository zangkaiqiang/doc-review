import type {
  ChatMessage,
  Redline,
  ReviewChatResponse,
  ReviewResult,
  ReviewListItem,
  ReviewTemplate,
  RuleConfig,
  RuleConfigByTemplate,
  ScoringConfig,
  ScoringConfigByTemplate,
} from "../types";

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
  rule_config?: RuleConfig;
  scoring_config?: ScoringConfig;
}): Promise<{ task_id: number }> {
  const r = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("发起审查失败");
  return r.json();
}

export async function rerunReview(
  taskId: number,
  body: { rule_config?: RuleConfig; scoring_config?: ScoringConfig }
): Promise<{ task_id: number; version: number }> {
  const r = await fetch(`/api/reviews/${taskId}/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("重跑失败");
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
  const r = await fetch(`/api/findings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("更新意见失败");
}

export async function getReviewTemplates(): Promise<ReviewTemplate[]> {
  const r = await fetch("/api/settings/templates");
  if (!r.ok) throw new Error("获取审查模板失败");
  return r.json();
}

export async function saveReviewTemplates(templates: ReviewTemplate[]): Promise<ReviewTemplate[]> {
  const r = await fetch("/api/settings/templates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(templates),
  });
  if (!r.ok) throw new Error("保存审查模板失败");
  return r.json();
}

export async function getRulesConfig(): Promise<RuleConfigByTemplate> {
  const r = await fetch("/api/settings/rules");
  if (!r.ok) throw new Error("获取规则配置失败");
  return r.json();
}

export async function getRulesConfigForStance(stance: string): Promise<RuleConfig> {
  const r = await fetch(`/api/settings/rules/${stance}`);
  if (!r.ok) throw new Error("获取规则配置失败");
  return r.json();
}

export async function saveRulesConfig(config: RuleConfigByTemplate): Promise<RuleConfigByTemplate> {
  const r = await fetch("/api/settings/rules", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!r.ok) throw new Error("保存规则配置失败");
  return r.json();
}

export async function getScoringConfig(): Promise<ScoringConfigByTemplate> {
  const r = await fetch("/api/settings/scoring");
  if (!r.ok) throw new Error("获取评分规则失败");
  return r.json();
}

export async function getScoringConfigForStance(stance: string): Promise<ScoringConfig> {
  const r = await fetch(`/api/settings/scoring/${stance}`);
  if (!r.ok) throw new Error("获取评分规则失败");
  return r.json();
}

export async function saveScoringConfig(config: ScoringConfigByTemplate): Promise<ScoringConfigByTemplate> {
  const r = await fetch("/api/settings/scoring", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!r.ok) throw new Error("保存评分规则失败");
  return r.json();
}

export async function listRedlines(): Promise<Redline[]> {
  const r = await fetch("/api/kb/redlines");
  if (!r.ok) throw new Error("获取红线库失败");
  return r.json();
}

export async function createRedline(redline: Omit<Redline, "id">): Promise<Redline> {
  const r = await fetch("/api/kb/redlines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(redline),
  });
  if (!r.ok) throw new Error("新增红线失败");
  return r.json();
}

export async function updateRedline(id: number, redline: Omit<Redline, "id">): Promise<Redline> {
  const r = await fetch(`/api/kb/redlines/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(redline),
  });
  if (!r.ok) throw new Error("保存红线失败");
  return r.json();
}

export async function deleteRedline(id: number): Promise<void> {
  const r = await fetch(`/api/kb/redlines/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("删除红线失败");
}

export async function chatWithReview(
  taskId: number,
  body: { message: string; history: ChatMessage[]; finding_id?: number | null }
): Promise<ReviewChatResponse> {
  const r = await fetch(`/api/reviews/${taskId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("对话请求失败");
  return r.json();
}

export async function streamReviewChat(
  taskId: number,
  body: { message: string; history: ChatMessage[]; finding_id?: number | null },
  onDelta: (delta: string) => void,
  onStatus?: (status: { model_available: boolean }) => void
): Promise<void> {
  const r = await fetch(`/api/reviews/${taskId}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) throw new Error("对话请求失败");

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.type === "delta") {
        onDelta(payload.delta ?? "");
        onStatus?.({ model_available: Boolean(payload.model_available) });
      }
      if (payload.type === "done") {
        onStatus?.({ model_available: Boolean(payload.model_available) });
      }
    }
  }
}
