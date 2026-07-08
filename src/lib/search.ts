import type { DashboardItem, ItemKind, ItemStatus } from "../types";
import { formatKoreanDate, getRemainingDaysLabel } from "./display";

const statusLabel: Record<ItemStatus, string> = {
  new: "신규",
  review: "검토 대기",
  inProgress: "처리 중",
  done: "완료",
  overdue: "기한 초과",
  archived: "보관"
};

const kindLabel: Record<ItemKind, string> = {
  change: "변경사항",
  manual: "매뉴얼 개선",
  drug: "유기관리"
};

function pickText(raw: Record<string, unknown>, keys: string[]): string[] {
  return keys.flatMap((key) => {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (typeof value === "number") return [String(value)];
    return [];
  });
}

function buildSearchTokens(item: DashboardItem): string[] {
  const visibleStatus = item.kind === "change" && item.raw.status === "active" ? "유효" : statusLabel[item.status];
  return [
    item.title,
    item.description,
    item.owner,
    kindLabel[item.kind],
    visibleStatus,
    item.isPriority ? "먼저" : "",
    item.dueAt ? formatKoreanDate(item.dueAt) : "",
    getRemainingDaysLabel(item) ?? "",
    ...item.tags,
    ...pickText(item.raw, ["loc", "location"])
  ];
}

export function matchesItemSearch(item: DashboardItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return buildSearchTokens(item).join(" ").toLowerCase().includes(normalized);
}
