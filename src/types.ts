export type ItemKind = "change" | "manual" | "drug";
export type DrugCategory = "prescription" | "otc";
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
