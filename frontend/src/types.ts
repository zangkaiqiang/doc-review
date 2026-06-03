export type Level = "high" | "mid" | "low";

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
}

export interface ReviewTask {
  id: number;
  stance: string;
  status: string;
  score: number | null;
  level: Level | null;
  profile: Record<string, any>;
  checklist: ChecklistItem[];
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
