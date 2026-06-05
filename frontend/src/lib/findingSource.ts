import type { Finding } from "../types";

export function findingSourceLabel(source: Finding["source"]) {
  return source === "rule" ? "规则扫描" : "智能体审查";
}

export function findingSourceTone(source: Finding["source"]) {
  return source === "rule" ? "info" : "brand";
}

export function findingSourceDescription(source: Finding["source"]) {
  return source === "rule"
    ? "基于标准条款、关键词、红线库和评分口径的确定性检查。"
    : "由模型结合全文上下文和审查模板生成的语义研判。";
}
