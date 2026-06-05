export type Level = "high" | "mid" | "low";

export interface ReviewTemplate {
  key: string;
  label: string;
  hint: string;
}

export interface Finding {
  id: number;
  source: "rule" | "llm";
  category: string;
  level: Level;
  title: string;
  quote: string;
  problem: string;
  basis: string;
  suggestion: string;
  chunk_seq: number | null;
  char_start: number | null;
  char_end: number | null;
  locate_status: "located" | "uncertain";
  status: "open" | "accepted" | "rejected" | "edited";
}

export interface ChecklistItem {
  clause: string;
  present: boolean;
  status?: "sufficient" | "partial" | "missing";
  review_source?: "rule" | "agent";
  quote?: string;
  problem?: string;
  suggestion?: string;
  char_start?: number | null;
  char_end?: number | null;
  locate_status?: "located" | "uncertain";
}

export interface ReviewTask {
  id: number;
  stance: string;
  status: string;
  score: number | null;
  level: Level | null;
  profile: Record<string, any>;
  checklist: ChecklistItem[];
  rule_config: RuleConfig;
  scoring_config?: ScoringConfig;
  version?: number;
  parent_task_id?: number | null;
}

export interface ReviewResult {
  task: ReviewTask;
  document: { id: number; name: string; text: string };
  findings: Finding[];
}

export interface ReviewListItem {
  id: number;
  doc_name: string;
  stance: string;
  status: string;
  score: number | null;
  level: Level | null;
  created_at: string;
}

export interface RuleChecklistItem {
  clause: string;
  keywords: string[];
  enabled: boolean;
}

export interface RuleConfig {
  checklist: RuleChecklistItem[];
  vague_words: string[];
  onesided_words: string[];
}

export type RuleConfigByStance = Record<string, RuleConfig>;
export type RuleConfigByTemplate = Record<string, RuleConfig>;

export interface ScoringConfig {
  weights: Record<Level, number>;
  veto_categories: string[];
  thresholds: { low: number; mid: number };
}

export type ScoringConfigByStance = Record<string, ScoringConfig>;
export type ScoringConfigByTemplate = Record<string, ScoringConfig>;

export interface Redline {
  id: number;
  code: string;
  content: string;
  keywords: string;
  doc_type: string;
  stance: string;
  level: Level;
  enabled: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReviewChatResponse {
  reply: string;
  model_available: boolean;
}
