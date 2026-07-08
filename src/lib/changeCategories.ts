import type { ChangeCategory, DashboardItem } from "../types";
import { sortChangesLatestFirst } from "./sort";

export const CHANGE_CATEGORIES: ChangeCategory[] = [
  "약품변경",
  "업무규칙",
  "스케줄",
  "고객응대",
  "재고관리",
  "장비/시설",
  "기타"
];

const CATEGORY_ALIASES: Record<string, ChangeCategory> = {
  약품변경: "약품변경",
  약품: "약품변경",
  업무규칙: "업무규칙",
  업무: "업무규칙",
  스케줄: "스케줄",
  일정: "스케줄",
  고객응대: "고객응대",
  응대: "고객응대",
  재고관리: "재고관리",
  재고: "재고관리",
  장비시설: "장비/시설",
  장비: "장비/시설",
  시설: "장비/시설",
  기타: "기타"
};

export interface ChangeCategoryGroup {
  category: ChangeCategory;
  items: DashboardItem[];
}

export function normalizeChangeCategory(value: unknown): ChangeCategory {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "기타";
  const compact = raw.trim().replace(/[\s_-]/g, "");
  return CATEGORY_ALIASES[compact] ?? "기타";
}

export function getChangeCategory(item: DashboardItem): ChangeCategory {
  return item.changeCategory ?? normalizeChangeCategory(item.raw.category);
}

export function groupChangesByCategory(items: DashboardItem[]): ChangeCategoryGroup[] {
  return CHANGE_CATEGORIES.map((category) => {
    const source = items.filter((item) => getChangeCategory(item) === category);
    return {
      category,
      items: sortChangesLatestFirst(source)
    };
  }).filter((group) => group.items.length > 0);
}
