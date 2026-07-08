import type { DashboardItem } from "../types";

export type DrugStatusLabel = "긴급" | "주의" | "양호";

function getDrugStatusThresholds(item: DashboardItem): { urgentDays: number; cautionDays: number } {
  if (item.category === "otc") return { urgentDays: 210, cautionDays: 420 };
  return { urgentDays: 180, cautionDays: 360 };
}

export function getDrugRemainingDays(item: DashboardItem, now = new Date()): number | undefined {
  if (!item.dueAt) return undefined;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(item.dueAt.getFullYear(), item.dueAt.getMonth(), item.dueAt.getDate());
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
}

export function getDrugStatusLabel(item: DashboardItem, now = new Date()): DrugStatusLabel {
  const days = getDrugRemainingDays(item, now);
  const { urgentDays, cautionDays } = getDrugStatusThresholds(item);
  if (days === undefined || days > cautionDays) return "양호";
  if (days > urgentDays) return "주의";
  return "긴급";
}
