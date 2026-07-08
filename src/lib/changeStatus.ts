import type { DashboardItem } from "../types";

export function isCompletedChange(item: DashboardItem): boolean {
  return item.kind === "change" && item.status === "done";
}

export function shouldShowChangeInList(item: DashboardItem, includeCompleted: boolean): boolean {
  return item.kind !== "change" || includeCompleted || !isCompletedChange(item);
}
