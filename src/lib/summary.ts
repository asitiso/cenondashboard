import type { DashboardItem, HomeSummary } from "../types";

const OPEN_STATUSES = new Set(["new", "review", "inProgress", "overdue"]);

export function isOpen(item: DashboardItem): boolean {
  return OPEN_STATUSES.has(item.status);
}

export function isDueSoon(item: DashboardItem, now = new Date()): boolean {
  if (!item.dueAt) return false;
  const days = Math.ceil((item.dueAt.getTime() - now.getTime()) / 86400000);
  return days >= 0 && days <= 14;
}

export function isOverdue(item: DashboardItem, now = new Date()): boolean {
  return item.status === "overdue" || Boolean(item.dueAt && item.dueAt < now);
}

export function isStale(item: DashboardItem, now = new Date()): boolean {
  const basis = item.updatedAt ?? item.createdAt;
  if (!basis || !isOpen(item)) return false;
  return now.getTime() - basis.getTime() > 1000 * 60 * 60 * 24 * 7;
}

export function buildHomeSummary(items: DashboardItem[], now = new Date()): HomeSummary {
  return {
    activeChanges: items.filter((item) => item.kind === "change" && isOpen(item)).length,
    manualWaiting: items.filter((item) => item.kind === "manual" && item.status === "review").length,
    prescriptionDueSoon: items.filter((item) => item.kind === "drug" && item.category === "prescription" && isDueSoon(item, now)).length,
    otcDueSoon: items.filter((item) => item.kind === "drug" && item.category === "otc" && isDueSoon(item, now)).length,
    overdue: items.filter((item) => isOverdue(item, now)).length,
    staleOpen: items.filter((item) => isStale(item, now)).length
  };
}
