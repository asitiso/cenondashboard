import type { DashboardItem, DrugCategory } from "../types";
import { isOpen } from "./summary";

export type HomeSectionKey = "changes" | "drugs" | "manual";
export type HomeDrugFilter = "all" | DrugCategory;

export interface HomeSection {
  key: HomeSectionKey;
  title: string;
  subtitle: string;
  total: number;
  items: DashboardItem[];
}

function sortForDashboard(items: DashboardItem[]): DashboardItem[] {
  const urgencyScore = { critical: 0, high: 1, normal: 2, low: 3 };
  const statusScore = { overdue: 0, review: 1, new: 2, inProgress: 3, done: 4, archived: 5 };
  return [...items].sort((a, b) => {
    const priority = Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority));
    if (priority !== 0) return priority;
    const status = statusScore[a.status] - statusScore[b.status];
    if (status !== 0) return status;
    const urgency = urgencyScore[a.urgency] - urgencyScore[b.urgency];
    if (urgency !== 0) return urgency;
    return (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });
}

export function buildHomeSections(items: DashboardItem[], limit = 6, drugFilter: HomeDrugFilter = "all"): HomeSection[] {
  const openFirst = items.filter(isOpen);
  const drugItems = openFirst.filter((item) => item.kind === "drug");
  const filteredDrugs = drugFilter === "all" ? drugItems : drugItems.filter((item) => item.category === drugFilter);
  const sections = [
    {
      key: "changes" as const,
      title: "변경사항",
      subtitle: "오늘 확인하거나 반영할 변경",
      source: openFirst.filter((item) => item.kind === "change")
    },
    {
      key: "drugs" as const,
      title: "유기관리",
      subtitle: "전문약/일반약 임박과 초과",
      source: filteredDrugs
    },
    {
      key: "manual" as const,
      title: "매뉴얼 개선",
      subtitle: "검토 대기와 장기 미처리",
      source: openFirst.filter((item) => item.kind === "manual")
    }
  ];

  return sections.map(({ source, ...section }) => {
    const sorted = sortForDashboard(source);
    return {
      ...section,
      total: sorted.length,
      items: sorted.slice(0, limit)
    };
  });
}
