export type ItemKind = "change" | "manual" | "drug";
export type DrugCategory = "prescription" | "otc";
export type ChangeCategory = "약품변경" | "업무규칙" | "스케줄" | "고객응대" | "재고관리" | "장비/시설" | "기타";
export type ItemStatus = "new" | "review" | "inProgress" | "done" | "overdue" | "archived";
export type Urgency = "critical" | "high" | "normal" | "low";

export interface SourceRef {
  collection: string;
  path: string;
  team?: "Q1" | "Q2";
}

export interface DashboardItem {
  id: string;
  kind: ItemKind;
  title: string;
  description: string;
  status: ItemStatus;
  urgency: Urgency;
  owner: string;
  source: SourceRef;
  updatedAt?: Date;
  dueAt?: Date;
  createdAt?: Date;
  changeCategory?: ChangeCategory;
  category?: DrugCategory;
  isPriority?: boolean;
  tags: string[];
  raw: Record<string, unknown>;
}

export interface HomeSummary {
  activeChanges: number;
  manualWaiting: number;
  prescriptionDueSoon: number;
  otcDueSoon: number;
  overdue: number;
  staleOpen: number;
}
