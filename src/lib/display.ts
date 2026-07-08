import type { DashboardItem } from "../types";
import { isCompletedChange } from "./changeStatus";
import { getDrugRemainingDays, getDrugStatusLabel } from "./drugStatus";

export interface DetailRow {
  label: string;
  value: string;
}

export interface DrugListFact {
  label: string;
  value: string;
}

export function shouldShowStatusBadge(item: DashboardItem): boolean {
  return item.kind !== "drug";
}

export function shouldShowDenseStatusBadge(item: DashboardItem): boolean {
  return item.kind !== "drug";
}

export function formatKoreanDate(date?: Date): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function getDenseRowMeta(item: DashboardItem): string {
  if (item.kind === "drug") return item.description;
  return item.owner;
}

export function getDenseRowTimeLabel(item: DashboardItem): string {
  const date = formatKoreanDate(item.dueAt);
  if (item.kind === "drug" && date !== "-") {
    const remaining = getRemainingDaysLabel(item);
    return remaining ?? `유효 ${date}`;
  }
  return date;
}

function pickText(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function present(rows: Array<DetailRow | undefined>): DetailRow[] {
  return rows.filter((row): row is DetailRow => Boolean(row?.value));
}

export function getDetailRows(item: DashboardItem): DetailRow[] {
  if (item.kind === "drug") {
    const location = pickText(item.raw, ["loc", "location"]);
    const quantity = pickText(item.raw, ["qty", "quantity", "count"]);
    return present([
      { label: "구분", value: item.category === "prescription" ? "전문약" : "일반약" },
      { label: "먼저", value: item.isPriority ? "예" : "아니오" },
      { label: "상태", value: getDrugStatusLabel(item) },
      item.dueAt ? { label: "유효기간", value: formatKoreanDate(item.dueAt) } : undefined,
      location ? { label: "위치", value: location } : undefined,
      quantity ? { label: "수량", value: quantity } : undefined,
      { label: "담당", value: item.owner },
      item.updatedAt ? { label: "최근 수정", value: formatKoreanDate(item.updatedAt) } : undefined,
      { label: "원본 경로", value: item.source.path }
    ]);
  }

  if (item.kind === "manual") {
    return present([
      { label: "현재 문제", value: pickText(item.raw, ["currentProblem"]) },
      { label: "확인된 사실", value: pickText(item.raw, ["confirmedFact"]) },
      { label: "개선 제안", value: pickText(item.raw, ["proposal", "description", "reason", "memo"]) },
      { label: "담당", value: item.owner },
      item.updatedAt ? { label: "최근 수정", value: formatKoreanDate(item.updatedAt) } : undefined,
      { label: "원본 경로", value: item.source.path }
    ]);
  }

  return present([
    item.changeCategory ? { label: "카테고리", value: item.changeCategory } : undefined,
    item.kind === "change" ? { label: "상태", value: isCompletedChange(item) ? "완료" : "유효" } : undefined,
    { label: "내용", value: item.description },
    { label: "담당", value: item.owner },
    item.dueAt ? { label: "기한", value: formatKoreanDate(item.dueAt) } : undefined,
    item.updatedAt ? { label: "최근 수정", value: formatKoreanDate(item.updatedAt) } : undefined,
    { label: "원본 경로", value: item.source.path }
  ]);
}

export function getDetailDescription(item: DashboardItem): string | undefined {
  const hasStructuredManualContent = item.kind === "manual" && Boolean(
    pickText(item.raw, ["currentProblem"]) ||
    pickText(item.raw, ["confirmedFact"]) ||
    pickText(item.raw, ["proposal", "description", "reason", "memo"])
  );
  if (hasStructuredManualContent) return undefined;
  return item.description;
}

export function getDrugListFacts(item: DashboardItem): DrugListFact[] {
  if (item.kind !== "drug") return [];
  const quantity = pickText(item.raw, ["qty", "quantity", "count"]);
  const location = pickText(item.raw, ["loc", "location"]);
  const remaining = getRemainingDaysLabel(item);
  return [
    { label: "먼저", value: "먼저" },
    { label: "상태", value: getDrugStatusLabel(item) },
    remaining ? { label: "남은", value: remaining } : undefined,
    item.dueAt ? { label: "유효", value: formatKoreanDate(item.dueAt) } : undefined,
    quantity ? { label: "수량", value: quantity } : undefined,
    location ? { label: "위치", value: location } : undefined
  ].filter((fact): fact is DrugListFact => Boolean(fact));
}

export function getRemainingDaysLabel(item: DashboardItem, now = new Date()): string | undefined {
  const days = getDrugRemainingDays(item, now);
  if (days === undefined) return undefined;
  if (days < 0) return `${Math.abs(days)}일 지남`;
  if (days === 0) return "오늘";
  return `${days}일 남음`;
}
