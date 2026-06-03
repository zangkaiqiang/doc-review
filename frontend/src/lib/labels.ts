import type { Level } from "../types";

// 审查立场 / 风险档位 / 任务状态 的中文标签，多处共享
export const STANCE_LABEL: Record<string, string> = {
  party_a: "甲方", party_b: "乙方/投标", neutral: "中立", tenderee: "招标方",
};
export const LEVEL_LABEL: Record<Level, string> = { high: "高危", mid: "中危", low: "低危" };
export const STATUS_LABEL: Record<string, string> = {
  pending: "待执行", running: "审查中", done: "已完成", failed: "失败",
};
