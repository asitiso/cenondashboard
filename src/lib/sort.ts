import type { DashboardItem } from "../types";

function latestActivityTime(item: DashboardItem): number {
  return item.updatedAt?.getTime() ?? item.createdAt?.getTime() ?? 0;
}

export function sortForAction(items: DashboardItem[]): DashboardItem[] {
  const urgencyScore = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...items].sort((a, b) => {
    const priority = Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority));
    if (priority !== 0) return priority;

    if (a.kind === "drug" && b.kind === "drug") {
      return (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
    }

    const urgent = urgencyScore[a.urgency] - urgencyScore[b.urgency];
    if (urgent !== 0) return urgent;
    return (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });
}

export function sortChangesLatestFirst(items: DashboardItem[]): DashboardItem[] {
  return [...items].sort((a, b) => latestActivityTime(b) - latestActivityTime(a));
}

export function sortCreatedLatestFirst(items: DashboardItem[]): DashboardItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}
