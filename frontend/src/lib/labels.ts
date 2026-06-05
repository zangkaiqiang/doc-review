import type { Level } from "../types";

// 风险档位 / 任务状态 的中文标签，多处共享
export const LEVEL_LABEL: Record<Level, string> = { high: "高危", mid: "中危", low: "低危" };
export const STATUS_LABEL: Record<string, string> = {
  pending: "待执行", running: "审查中", done: "已完成", failed: "失败",
};
