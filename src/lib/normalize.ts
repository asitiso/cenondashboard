import type { DashboardItem, DrugCategory, ItemStatus, Urgency } from "../types";
import { normalizeChangeCategory } from "./changeCategories";

type RawDoc = Record<string, unknown>;

const STATUS_MAP: Record<string, ItemStatus> = {
  active: "new",
  "검토중": "review",
  "검토 중": "review",
  "검토대기": "review",
  "검토 대기": "review",
  "반영완료": "done",
  "반영 완료": "done",
  "완료": "done",
  "보류": "archived",
  pending: "review",
  waiting: "review",
  review: "review",
  open: "new",
  new: "new",
  "신규": "new",
  progress: "inProgress",
  inprogress: "inProgress",
  doing: "inProgress",
  "처리중": "inProgress",
  "처리 중": "inProgress",
  done: "done",
  complete: "done",
  completed: "done",
  overdue: "overdue",
  "기한초과": "overdue",
  "기한 초과": "overdue",
  archived: "archived",
  "보관": "archived"
};

function pickString(doc: RawDoc, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = doc[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function pickDate(doc: RawDoc, keys: string[]): Date | undefined {
  for (const key of keys) {
    const value = doc[key];
    if (!value) continue;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      return value.toDate();
    }
  }
  return undefined;
}

function normalizeStatus(raw: string): ItemStatus {
  const direct = STATUS_MAP[raw.trim()];
  if (direct) return direct;
  const compact = raw.toLowerCase().replace(/[\s_-]/g, "");
  return STATUS_MAP[compact] ?? "review";
}

function inferUrgency(status: ItemStatus, dueAt?: Date, importance?: string, priority?: string): Urgency {
  if (status === "overdue") return "critical";
  if (importance === "중요" || priority?.includes("★★★★★")) return "high";
  if (!dueAt) return status === "review" ? "high" : "normal";
  const days = Math.ceil((dueAt.getTime() - Date.now()) / 86400000);
  if (days < 0) return "critical";
  if (days <= 3) return "high";
  if (days <= 14) return "normal";
  return "low";
}

function normalizeTags(...values: unknown[]): string[] {
  return values.flatMap((value) => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string") return value.split(",").map((tag) => tag.trim());
    return [];
  }).filter(Boolean);
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" / ");
}

export function normalizeTopic(id: string, doc: RawDoc): DashboardItem {
  const dueAt = pickDate(doc, ["dueAt", "deadline", "targetDate"]);
  const status = normalizeStatus(pickString(doc, ["status", "state", "progress"], "active"));
  const importance = pickString(doc, ["importance"]);
  const changeCategory = normalizeChangeCategory(pickString(doc, ["category", "카테고리", "changeCategory", "type", "group"]));
  return {
    id,
    kind: "change",
    title: pickString(doc, ["title", "name", "topic", "subject"], "제목 없는 변경사항"),
    description: pickString(doc, ["content", "description", "body", "memo", "summary"], "내용이 등록되지 않았습니다."),
    status,
    urgency: inferUrgency(status, dueAt, importance),
    owner: pickString(doc, ["owner", "assignee", "writer", "createdBy", "updatedBy"], "담당 미지정"),
    source: { collection: "topics", path: `topics/${id}` },
    createdAt: pickDate(doc, ["createdAt", "created_at"]),
    updatedAt: pickDate(doc, ["lastUpdatedAt", "updatedAt", "updated_at", "modifiedAt"]),
    dueAt,
    changeCategory,
    tags: normalizeTags(changeCategory, importance, doc.tags, doc.keywords),
    raw: doc
  };
}

export function normalizeManualImprove(id: string, doc: RawDoc): DashboardItem {
  const dueAt = pickDate(doc, ["dueAt", "reviewDueAt", "deadline"]);
  const status = normalizeStatus(pickString(doc, ["status", "state", "reviewStatus"], "검토중"));
  const priority = pickString(doc, ["priority"]);
  const description = joinParts([
    pickString(doc, ["currentProblem"]),
    pickString(doc, ["confirmedFact"]),
    pickString(doc, ["proposal", "description", "reason", "memo"])
  ]);
  return {
    id,
    kind: "manual",
    title: pickString(doc, ["title", "manualTitle", "section", "subject"], "제목 없는 매뉴얼 개선"),
    description: description || "검토 내용이 등록되지 않았습니다.",
    status,
    urgency: inferUrgency(status, dueAt, undefined, priority),
    owner: pickString(doc, ["requester", "owner", "writer", "createdBy"], "요청자 미지정"),
    source: { collection: "manual_improve", path: `manual_improve/${id}` },
    createdAt: pickDate(doc, ["createdAt", "created_at", "submittedAt", "requestedAt", "requestDate", "inputAt", "date"]),
    updatedAt: pickDate(doc, ["updatedAt", "updated_at", "modifiedAt"]),
    dueAt,
    tags: normalizeTags(doc.category, priority, doc.tags, doc.keywords),
    raw: doc
  };
}

export function normalizeDrug(id: string, doc: RawDoc, team: "Q1" | "Q2"): DashboardItem {
  const category: DrugCategory = team === "Q1" ? "prescription" : "otc";
  const isPriority = doc.pinned === true || doc.priority === true || doc.isPriority === true;
  const dueAt = pickDate(doc, ["exp", "expiryDate", "expiresAt", "dueAt", "deadline", "expiration"]);
  const explicitStatus = pickString(doc, ["status", "state"], dueAt && dueAt < new Date() ? "overdue" : "review");
  const status = normalizeStatus(explicitStatus);
  const loc = pickString(doc, ["loc", "location"]);
  const qty = pickString(doc, ["qty", "quantity", "count"]);
  const exp = pickString(doc, ["exp", "expiryDate", "expiresAt", "dueAt", "deadline", "expiration"]);
  const description = pickString(doc, ["memo", "description", "note"], joinParts([
    loc ? `위치 ${loc}` : undefined,
    qty ? `수량 ${qty}` : undefined,
    !loc && !qty && exp ? `유효기간 ${exp}` : undefined
  ]));
  return {
    id,
    kind: "drug",
    title: pickString(doc, ["name", "drugName", "title", "productName"], "이름 없는 의약품"),
    description: description || "유기 관리 메모가 없습니다.",
    status,
    urgency: inferUrgency(status, dueAt),
    owner: pickString(doc, ["owner", "manager", "assignee", "addedBy", "editedBy"], team === "Q1" ? "전문약 담당" : "일반약 담당"),
    source: { collection: `teams/${team}/drugs`, path: `teams/${team}/drugs/${id}`, team },
    createdAt: pickDate(doc, ["addedAt", "createdAt", "created_at"]),
    updatedAt: pickDate(doc, ["editedAt", "updatedAt", "updated_at", "modifiedAt", "addedAt"]),
    dueAt,
    category,
    isPriority,
    tags: normalizeTags(isPriority ? "먼저" : undefined, doc.category, loc, doc.tags, doc.keywords),
    raw: doc
  };
}
