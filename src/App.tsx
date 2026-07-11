import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  Home,
  LogOut,
  Menu,
  Pill,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useDashboardData } from "./hooks/useDashboardData";
import type { ChangeCategory, DashboardItem, DrugCategory, ItemKind, ItemStatus } from "./types";
import { buildHomeSections, type HomeDrugFilter } from "./lib/homeSections";
import { buildHomeSummary } from "./lib/summary";
import { sortChangesLatestFirst, sortForAction } from "./lib/sort";
import { matchesItemSearch } from "./lib/search";
import { COMPACT_LAYOUT_MAX_WIDTH, DEFAULT_SIDEBAR_COLLAPSED } from "./lib/layout";
import { getViewForHomeSection, type HomeSectionTargetView } from "./lib/navigation";
import { CHANGE_CATEGORIES, getChangeCategory, groupChangesByCategory, type ChangeCategoryGroup } from "./lib/changeCategories";
import { shouldShowChangeInList } from "./lib/changeStatus";
import { getDrugStatusLabel, type DrugStatusLabel } from "./lib/drugStatus";
import type { ManualImproveInput } from "./lib/firebase";
import {
  formatKoreanDate,
  formatManualDetailTextForDisplay,
  getDenseRowMeta,
  getDenseRowTimeLabel,
  getDetailPresentation,
  getDetailSections,
  getDrugListFacts,
  shouldShowDenseStatusBadge,
  shouldShowStatusBadge
} from "./lib/display";

type ViewKey = "home" | "changes" | "manual" | "drugs" | "search";
type DrugTab = "all" | DrugCategory;
type DrugStatusFilter = "all" | DrugStatusLabel;
type ChangeListMode = "latest" | "category";

const statusLabel: Record<ItemStatus, string> = {
  new: "신규",
  review: "검토 대기",
  inProgress: "처리 중",
  done: "완료",
  overdue: "기한 초과",
  archived: "보관"
};

const kindLabel: Record<ItemKind, string> = {
  change: "변경사항",
  manual: "매뉴얼 개선",
  drug: "유기관리"
};

const navItems = [
  { key: "home" as const, label: "홈", icon: Home },
  { key: "changes" as const, label: "변경사항", icon: RefreshCw },
  { key: "drugs" as const, label: "유기관리", icon: Pill },
  { key: "manual" as const, label: "매뉴얼 개선", icon: FileSearch },
  { key: "search" as const, label: "통합 검색", icon: Search }
];

const homeDrugFilterLabel: Record<HomeDrugFilter, string> = {
  all: "전체",
  prescription: "전문약",
  otc: "일반약"
};

const manualStatusActions = [
  { label: "검토중", value: "검토중", status: "review" },
  { label: "반영완료", value: "반영완료", status: "done" },
  { label: "보류", value: "보류", status: "archived" }
] as const;

const emptyManualInput: ManualImproveInput = {
  title: "",
  currentProblem: "",
  confirmedFact: "",
  proposal: "",
  category: "",
  priority: ""
};

function pickRawString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function manualInputFromItem(item?: DashboardItem): ManualImproveInput {
  if (!item || item.kind !== "manual") return emptyManualInput;
  return {
    title: item.title,
    currentProblem: pickRawString(item.raw, ["currentProblem"]),
    confirmedFact: pickRawString(item.raw, ["confirmedFact"]),
    proposal: pickRawString(item.raw, ["proposal", "description", "reason", "memo"]),
    category: pickRawString(item.raw, ["category"]),
    priority: pickRawString(item.raw, ["priority"])
  };
}

function getNextHomeDrugFilter(filter: HomeDrugFilter): HomeDrugFilter {
  if (filter === "all") return "prescription";
  if (filter === "prescription") return "otc";
  return "all";
}

function formatDate(date?: Date): string {
  return formatKoreanDate(date);
}

function LoginPanel({ onLogin, mockMode }: { onLogin: (email: string, password: string) => Promise<void>; mockMode: boolean }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await onLogin(loginId.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    }
  }

  if (mockMode) {
    return (
      <section className="login-card">
        <div>
          <p className="eyebrow">목업 모드</p>
          <h1>센트럴온누리약국 통합 관리</h1>
          <p>Firebase 설정 전이라 샘플 데이터로 대시보드를 바로 확인합니다.</p>
        </div>
      </section>
    );
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <div>
        <p className="eyebrow">Firebase 로그인</p>
        <h1>센트럴온누리약국 통합 관리</h1>
        <p>승인된 직원 계정으로 로그인하면 Firestore 실시간 데이터가 표시됩니다.</p>
      </div>
      <label>
        아이디
        <input value={loginId} onChange={(event) => setLoginId(event.target.value)} type="text" autoComplete="username" required />
      </label>
      <label>
        비밀번호
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button" type="submit">로그인</button>
    </form>
  );
}

function getStatusView(item: DashboardItem): { className: string; label: string } {
  if (item.kind === "change" && item.raw.status === "active") {
    return { className: "status-valid", label: "유효" };
  }
  if (item.kind === "manual" && item.status === "done") {
    return { className: "status-done", label: "반영완료" };
  }
  if (item.kind === "manual" && item.status === "archived") {
    return { className: "status-archived", label: "보류" };
  }
  return { className: `status-${item.status}`, label: statusLabel[item.status] };
}

function StatusBadge({ item }: { item: DashboardItem }) {
  const status = getStatusView(item);
  return <span className={`status-badge ${status.className}`}>{status.label}</span>;
}

function CompactMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`compact-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DenseItemRow({ item, onSelect }: { item: DashboardItem; onSelect: (item: DashboardItem) => void }) {
  return (
    <button className={`dense-row ${item.kind === "drug" ? "drug-row" : ""}`} onClick={() => onSelect(item)}>
      <span className={`urgency-dot ${item.urgency}`} />
      <strong>{item.title}</strong>
      {item.isPriority && <span className="priority-badge">먼저</span>}
      {shouldShowDenseStatusBadge(item) && <StatusBadge item={item} />}
      <span className="dense-meta">{getDenseRowMeta(item)}</span>
      <span className="dense-due">{getDenseRowTimeLabel(item)}</span>
    </button>
  );
}

function ItemRow({
  item,
  active,
  onSelect,
  onTogglePriority
}: {
  item: DashboardItem;
  active: boolean;
  onSelect: (item: DashboardItem) => void;
  onTogglePriority?: (item: DashboardItem) => Promise<void>;
}) {
  const drugFacts = getDrugListFacts(item);

  return (
    <div
      className={`item-row ${item.kind === "drug" ? "drug-list-row" : ""} ${active ? "active" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect(item);
      }}
    >
      <div className="row-main">
        <div className="row-title">
          <span className={`urgency-dot ${item.urgency}`} />
          <strong>{item.title}</strong>
          {item.kind !== "drug" && item.isPriority && <span className="priority-badge">먼저</span>}
          {item.kind !== "drug" && <StatusBadge item={item} />}
        </div>
        {item.kind === "drug" ? (
          <div className="drug-fact-strip">
            {drugFacts.map((fact) => (
              fact.label === "먼저" ? (
                <button
                  className={`drug-fact first-toggle ${item.isPriority ? "priority selected" : ""}`}
                  key={fact.label}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onTogglePriority?.(item);
                  }}
                  aria-pressed={Boolean(item.isPriority)}
                >
                  <strong>{fact.value}</strong>
                </button>
              ) : (
                <span className={`drug-fact ${fact.label === "상태" ? `drug-status ${fact.value}` : ""}`} key={fact.label}>
                  {fact.label !== "남은" && <small>{fact.label}</small>}
                  <strong>{fact.value}</strong>
                </span>
              )
            ))}
          </div>
        ) : (
          <p>{item.description}</p>
        )}
      </div>
      <div className="row-meta">
        <span>{kindLabel[item.kind]}</span>
        <span>{item.owner}</span>
        {item.kind !== "drug" && <span>기한 {formatDate(item.dueAt)}</span>}
      </div>
    </div>
  );
}

function DetailPanel({
  item,
  onSetManualStatus,
  onEditManual,
  onDeleteManual
}: {
  item?: DashboardItem;
  onSetManualStatus?: (item: DashboardItem, status: string) => Promise<void>;
  onEditManual?: (item: DashboardItem) => void;
  onDeleteManual?: (item: DashboardItem) => Promise<void>;
}) {
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  const [deletingManual, setDeletingManual] = useState(false);

  if (!item) {
    return (
      <aside className="detail-panel empty">
        <Settings2 size={22} />
        <p>항목을 선택하면 원본 경로와 처리 정보를 확인할 수 있습니다.</p>
      </aside>
    );
  }

  const detailSections = getDetailSections(item);
  const detailPresentation = getDetailPresentation(item);
  const showManualActions = item.kind === "manual" && Boolean(onSetManualStatus);

  async function setManualStatus(status: string) {
    if (!onSetManualStatus || !item) return;
    const currentItem = item;
    setSavingStatus(status);
    setStatusError("");
    try {
      await onSetManualStatus(currentItem, status);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "상태를 저장하지 못했습니다.");
    } finally {
      setSavingStatus(null);
    }
  }

  async function deleteManual() {
    if (!item || !onDeleteManual) return;
    const ok = window.confirm("이 매뉴얼 개선 항목을 삭제할까요? 삭제 후에는 되돌리기 어렵습니다.");
    if (!ok) return;
    setDeletingManual(true);
    setStatusError("");
    try {
      await onDeleteManual(item);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    } finally {
      setDeletingManual(false);
    }
  }

  return (
    <aside className="detail-panel">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">{kindLabel[item.kind]}</p>
          <h2>{item.title}</h2>
        </div>
        {shouldShowStatusBadge(item) && <StatusBadge item={item} />}
      </div>
      {showManualActions && (
        <div className="manual-status-actions" aria-label="매뉴얼 개선 처리 상태">
          {manualStatusActions.map((action) => (
            <button
              key={action.value}
              className={item.status === action.status ? "selected" : ""}
              type="button"
              disabled={Boolean(savingStatus)}
              onClick={() => void setManualStatus(action.value)}
              aria-pressed={item.status === action.status}
            >
              {savingStatus === action.value ? "저장중" : action.label}
            </button>
          ))}
          {statusError && <p>{statusError}</p>}
        </div>
      )}
      {item.kind === "manual" && (
        <div className="manual-edit-actions" aria-label="매뉴얼 개선 편집">
          <button type="button" onClick={() => onEditManual?.(item)} disabled={!onEditManual}>
            <Pencil size={14} /> 수정
          </button>
          <button className="danger" type="button" onClick={() => void deleteManual()} disabled={!onDeleteManual || deletingManual}>
            <Trash2 size={14} /> {deletingManual ? "삭제중" : "삭제"}
          </button>
        </div>
      )}
      <div className={`detail-section-list ${detailPresentation}`}>
        {detailSections.map((section) => (
          <section className={`detail-section ${section.tone ?? ""}`} key={section.title}>
            <h3>{section.title}</h3>
            <dl className="detail-list">
              {section.rows.map((row) => (
                <div className={row.label === section.title ? "duplicate-label" : ""} key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{detailPresentation === "manual-flow" ? formatManualDetailTextForDisplay(row.value) : row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {item.tags.length > 0 && (
        <div className="tag-list">
          {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}
    </aside>
  );
}

function DetailOverlay({
  item,
  onClose,
  onSetManualStatus,
  onEditManual,
  onDeleteManual
}: {
  item?: DashboardItem;
  onClose: () => void;
  onSetManualStatus?: (item: DashboardItem, status: string) => Promise<void>;
  onEditManual?: (item: DashboardItem) => void;
  onDeleteManual?: (item: DashboardItem) => Promise<void>;
}) {
  if (!item) return null;
  return (
    <div className="detail-overlay" role="dialog" aria-modal="true">
      <button className="overlay-backdrop" onClick={onClose} aria-label="상세 닫기" />
      <div className="overlay-panel">
        <button className="close-button" onClick={onClose} aria-label="상세 닫기"><X size={18} /></button>
        <DetailPanel item={item} onSetManualStatus={onSetManualStatus} onEditManual={onEditManual} onDeleteManual={onDeleteManual} />
      </div>
    </div>
  );
}

function ManualEditorOverlay({
  mode,
  item,
  onClose,
  onCreate,
  onUpdate
}: {
  mode: "create" | "edit";
  item?: DashboardItem;
  onClose: () => void;
  onCreate: (input: ManualImproveInput) => Promise<void>;
  onUpdate: (item: DashboardItem, input: ManualImproveInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ManualImproveInput>(() => manualInputFromItem(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(manualInputFromItem(item));
    setError("");
  }, [item]);

  function updateField(key: keyof ManualImproveInput, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (mode === "edit" && item) {
        await onUpdate(item, form);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="detail-overlay manual-editor-overlay" role="dialog" aria-modal="true">
      <button className="overlay-backdrop" onClick={onClose} aria-label="편집 닫기" />
      <form className="manual-editor-panel" onSubmit={submit}>
        <div className="manual-editor-head">
          <div>
            <p className="eyebrow">매뉴얼 개선</p>
            <h2>{mode === "edit" ? "수정" : "추가"}</h2>
            <span>저장하면 상태는 반영완료로 기록됩니다.</span>
          </div>
          <button className="close-button inline" type="button" onClick={onClose} aria-label="편집 닫기"><X size={18} /></button>
        </div>

        <label>
          제목
          <input value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
        </label>
        <label>
          현재 문제
          <textarea value={form.currentProblem} onChange={(event) => updateField("currentProblem", event.target.value)} rows={4} />
        </label>
        <label>
          확인된 사실
          <textarea value={form.confirmedFact} onChange={(event) => updateField("confirmedFact", event.target.value)} rows={4} />
        </label>
        <label>
          개선 제안
          <textarea value={form.proposal} onChange={(event) => updateField("proposal", event.target.value)} rows={5} />
        </label>
        <div className="manual-editor-grid">
          <label>
            카테고리
            <input value={form.category} onChange={(event) => updateField("category", event.target.value)} placeholder="예: 주문" />
          </label>
          <label>
            중요도
            <input value={form.priority} onChange={(event) => updateField("priority", event.target.value)} placeholder="예: ★★★★☆" />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="manual-editor-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "저장중" : "저장"}</button>
        </div>
      </form>
    </div>
  );
}

function FilterBar({
  status,
  setStatus,
  query,
  setQuery,
  showStatusFilters = true,
  placeholder = "제목, 위치, 상태 검색"
}: {
  status: "all" | ItemStatus;
  setStatus: (status: "all" | ItemStatus) => void;
  query: string;
  setQuery: (query: string) => void;
  showStatusFilters?: boolean;
  placeholder?: string;
}) {
  const statuses: Array<"all" | ItemStatus> = ["all", "review", "new", "inProgress", "overdue", "done"];
  return (
    <div className="filter-bar">
      {showStatusFilters && (
        <div className="segmented">
          {statuses.map((entry) => (
            <button key={entry} className={status === entry ? "selected" : ""} onClick={() => setStatus(entry)}>
              {entry === "all" ? "전체" : statusLabel[entry]}
            </button>
          ))}
        </div>
      )}
      <label className="search-box">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />
      </label>
    </div>
  );
}

function WorkList({
  items,
  selected,
  onSelect,
  onTogglePriority
}: {
  items: DashboardItem[];
  selected?: DashboardItem;
  onSelect: (item: DashboardItem) => void;
  onTogglePriority?: (item: DashboardItem) => Promise<void>;
}) {
  if (items.length === 0) return <div className="empty-list">조건에 맞는 항목이 없습니다.</div>;
  return (
    <div className="work-list">
      {items.map((item) => (
        <ItemRow
          key={`${item.source.path}-${item.id}`}
          item={item}
          active={selected?.source.path === item.source.path}
          onSelect={onSelect}
          onTogglePriority={onTogglePriority}
        />
      ))}
    </div>
  );
}

function GroupedWorkList({ groups, selected, onSelect }: { groups: ChangeCategoryGroup[]; selected?: DashboardItem; onSelect: (item: DashboardItem) => void }) {
  if (groups.length === 0) return <div className="empty-list">조건에 맞는 항목이 없습니다.</div>;
  return (
    <div className="category-group-list">
      {groups.map((group) => (
        <section className="category-group" key={group.category}>
          <header>
            <strong>{group.category}</strong>
            <span>{group.items.length}</span>
          </header>
          <WorkList items={group.items} selected={selected} onSelect={onSelect} />
        </section>
      ))}
    </div>
  );
}

function HomeDashboard({
  items,
  onSelect,
  onOpenSection
}: {
  items: DashboardItem[];
  onSelect: (item: DashboardItem) => void;
  onOpenSection: (view: HomeSectionTargetView) => void;
}) {
  const [drugFilter, setDrugFilter] = useState<HomeDrugFilter>("prescription");
  const summary = buildHomeSummary(items);
  const sections = buildHomeSections(items, items.length, drugFilter);

  return (
    <section className="home-dashboard">
      <div className="home-head">
        <div>
          <p className="eyebrow">PC 업무 화면</p>
          <h1>한 화면 처리 현황</h1>
        </div>
        <div className="metric-strip">
          <CompactMetric label="변경" value={summary.activeChanges} tone="blue" />
          <CompactMetric label="유기 임박" value={summary.prescriptionDueSoon + summary.otcDueSoon} tone="amber" />
          <CompactMetric label="매뉴얼" value={summary.manualWaiting} tone="green" />
          <CompactMetric label="기한 초과" value={summary.overdue} tone="red" />
          <CompactMetric label="장기 미처리" value={summary.staleOpen} tone="slate" />
        </div>
      </div>

      <div className="home-section-grid">
        {sections.map((section) => (
          <article className={`home-work-section ${section.key}`} key={section.key}>
            <header>
              <button className="home-section-nav" type="button" onClick={() => onOpenSection(getViewForHomeSection(section.key))}>
                <h2>{section.title}</h2>
              </button>
              <div className="home-section-actions">
                {section.key === "drugs" && (
                  <button
                    className="cycle-filter"
                    type="button"
                    onClick={() => setDrugFilter((current) => getNextHomeDrugFilter(current))}
                    aria-label={`유기관리 필터: ${homeDrugFilterLabel[drugFilter]}`}
                    title="전체, 전문약, 일반약 순서로 전환"
                  >
                    {homeDrugFilterLabel[drugFilter]}
                  </button>
                )}
                <strong>{section.total}</strong>
              </div>
            </header>
            <div className="dense-list">
              {section.items.length === 0 ? (
                <div className="compact-empty">현재 처리할 항목 없음</div>
              ) : (
                section.items.map((item) => <DenseItemRow key={item.source.path} item={item} onSelect={onSelect} />)
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ListView({
  title,
  eyebrow,
  items,
  selected,
  onSelect,
  onTogglePriority,
  headerAction,
  drugMode = false,
  changeMode = false,
  latestFirst = false
}: {
  title: string;
  eyebrow: string;
  items: DashboardItem[];
  selected?: DashboardItem;
  onSelect: (item: DashboardItem) => void;
  onTogglePriority?: (item: DashboardItem) => Promise<void>;
  headerAction?: React.ReactNode;
  drugMode?: boolean;
  changeMode?: boolean;
  latestFirst?: boolean;
}) {
  const [status, setStatus] = useState<"all" | ItemStatus>("all");
  const [query, setQuery] = useState("");
  const [drugTab, setDrugTab] = useState<DrugTab>("all");
  const [drugStatus, setDrugStatus] = useState<DrugStatusFilter>("all");
  const [changeListMode, setChangeListMode] = useState<ChangeListMode>("latest");
  const [changeCategory, setChangeCategory] = useState<"all" | ChangeCategory>("all");
  const [includeCompletedChanges, setIncludeCompletedChanges] = useState(false);

  const filtered = useMemo(() => {
    const sortedItems = changeMode || latestFirst ? sortChangesLatestFirst(items) : sortForAction(items);
    return sortedItems.filter((item) => {
      const statusMatch = drugMode || changeMode || status === "all" || item.status === status;
      const drugMatch = !drugMode || drugTab === "all" || item.category === drugTab;
      const drugStatusMatch = !drugMode || drugStatus === "all" || getDrugStatusLabel(item) === drugStatus;
      const categoryMatch = !changeMode || changeListMode !== "category" || changeCategory === "all" || getChangeCategory(item) === changeCategory;
      const changeStatusMatch = !changeMode || shouldShowChangeInList(item, includeCompletedChanges);
      return statusMatch && drugMatch && drugStatusMatch && categoryMatch && changeStatusMatch && matchesItemSearch(item, query);
    });
  }, [changeCategory, changeListMode, changeMode, drugMode, drugStatus, drugTab, includeCompletedChanges, items, latestFirst, query, status]);

  const changeGroups = useMemo(() => groupChangesByCategory(filtered), [filtered]);

  return (
    <section className="view">
      <div className="view-title">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        {headerAction}
      </div>
      {drugMode && (
        <div className="tabs">
          {[
            ["all", "전체"],
            ["prescription", "전문약"],
            ["otc", "일반약"]
          ].map(([key, label]) => (
            <button key={key} className={drugTab === key ? "selected" : ""} onClick={() => setDrugTab(key as DrugTab)}>{label}</button>
          ))}
        </div>
      )}
      {drugMode && (
        <div className="category-chips compact" aria-label="유기관리 상태">
          {(["all", "긴급", "주의", "양호"] as DrugStatusFilter[]).map((entry) => (
            <button key={entry} className={drugStatus === entry ? "selected" : ""} onClick={() => setDrugStatus(entry)}>
              {entry === "all" ? "전체" : entry}
            </button>
          ))}
        </div>
      )}
      {changeMode && (
        <div className="tabs">
          <button className={changeListMode === "latest" ? "selected" : ""} onClick={() => setChangeListMode("latest")}>최신순</button>
          <button className={changeListMode === "category" ? "selected" : ""} onClick={() => setChangeListMode("category")}>카테고리별</button>
        </div>
      )}
      {changeMode && changeListMode === "category" && (
        <div className="category-chips" aria-label="변경사항 카테고리">
          <button className={changeCategory === "all" ? "selected" : ""} onClick={() => setChangeCategory("all")}>전체</button>
          {CHANGE_CATEGORIES.map((category) => (
            <button key={category} className={changeCategory === category ? "selected" : ""} onClick={() => setChangeCategory(category)}>
              {category}
            </button>
          ))}
        </div>
      )}
      {changeMode && (
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={includeCompletedChanges}
            onChange={(event) => setIncludeCompletedChanges(event.target.checked)}
          />
          <span>완료 포함</span>
        </label>
      )}
      <FilterBar
        status={status}
        setStatus={setStatus}
        query={query}
        setQuery={setQuery}
        showStatusFilters={!drugMode && !changeMode}
        placeholder={drugMode ? "약명, 위치, 유효기간 검색" : changeMode ? "제목, 카테고리, 내용 검색" : "제목, 위치, 상태 검색"}
      />
      {changeMode && changeListMode === "category" ? (
        <GroupedWorkList groups={changeGroups} selected={selected} onSelect={onSelect} />
      ) : (
        <WorkList items={filtered} selected={selected} onSelect={onSelect} onTogglePriority={onTogglePriority} />
      )}
    </section>
  );
}

export default function App() {
  const {
    items,
    user,
    loading,
    mockMode,
    errors,
    login,
    logout,
    toggleDrugPriority,
    setManualReviewStatus,
    createManualImprove,
    updateManualImprove,
    deleteManualImprove
  } = useDashboardData();
  const [view, setView] = useState<ViewKey>("home");
  const [selected, setSelected] = useState<DashboardItem | undefined>();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(DEFAULT_SIDEBAR_COLLAPSED);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [manualEditor, setManualEditor] = useState<{ mode: "create" | "edit"; item?: DashboardItem } | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const [detailPanelOffset, setDetailPanelOffset] = useState(0);

  const viewItems = useMemo(() => ({
    changes: items.filter((item) => item.kind === "change"),
    manual: items.filter((item) => item.kind === "manual"),
    drugs: items.filter((item) => item.kind === "drug"),
    search: items
  }), [items]);

  const showLogin = false;
  const selectFromHome = (item: DashboardItem) => {
    setSelected(item);
    setOverlayOpen(true);
  };

  const selectFromList = (item: DashboardItem) => {
    setSelected(item);
    if (window.innerWidth <= COMPACT_LAYOUT_MAX_WIDTH) {
      setDetailPanelOffset(0);
      window.requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    window.requestAnimationFrame(() => {
      const activeRow = document.querySelector(".content-grid .item-row.active");
      const contentGrid = detailPanelRef.current?.closest(".content-grid");
      if (!(activeRow instanceof HTMLElement) || !(contentGrid instanceof HTMLElement)) return;
      const offset = activeRow.getBoundingClientRect().top - contentGrid.getBoundingClientRect().top;
      setDetailPanelOffset(Math.max(0, Math.round(offset)));
    });
  };

  const editManual = (item: DashboardItem) => {
    setManualEditor({ mode: "edit", item });
  };

  const deleteManual = async (item: DashboardItem) => {
    await deleteManualImprove(item);
    setSelected(undefined);
    setOverlayOpen(false);
  };

  useEffect(() => {
    if (!selected) return;
    const freshSelected = items.find((item) => item.source.path === selected.source.path);
    if (freshSelected && freshSelected !== selected) setSelected(freshSelected);
  }, [items, selected]);

  useEffect(() => {
    const closeMobileMenu = () => {
      if (window.innerWidth > COMPACT_LAYOUT_MAX_WIDTH) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", closeMobileMenu);
    return () => window.removeEventListener("resize", closeMobileMenu);
  }, []);

  function navigateView(nextView: ViewKey) {
    setView(nextView);
    setDetailPanelOffset(0);
    setMobileMenuOpen(false);
  }

  function openHomeSection(nextView: HomeSectionTargetView) {
    setSelected(undefined);
    setOverlayOpen(false);
    navigateView(nextView);
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <button className="sidebar-backdrop" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기" />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div className="brand-copy">
            <strong>센트럴온누리</strong>
            <span>통합 관리</span>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
            title={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            <Menu size={18} />
          </button>
        </div>
        <nav>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} className={view === key ? "active" : ""} onClick={() => navigateView(key)}>
              <Icon size={18} />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="account-box">
          <UserRound size={18} />
          <div className="account-copy">
            <strong>{mockMode ? "샘플 데이터" : user?.email ?? "로그인 없이 조회"}</strong>
            <span>{mockMode ? "Firebase 설정 전" : "실시간 Firestore"}</span>
          </div>
          {user && <button className="icon-button" onClick={logout} aria-label="로그아웃"><LogOut size={16} /></button>}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="메뉴 열기"><Menu size={18} /></button>
          <div>
            <strong>운영 대시보드</strong>
            <span>{loading ? "데이터 불러오는 중" : `${items.length}개 항목 연결됨`}</span>
          </div>
          {mockMode && <span className="mode-badge">목업 모드</span>}
          {!mockMode && <span className="mode-badge live"><CheckCircle2 size={14} /> 실시간</span>}
        </header>

        {errors.length > 0 && (
          <div className="error-strip">
            <AlertTriangle size={18} />
            <span>{errors.join(" / ")}</span>
          </div>
        )}

        {showLogin ? (
          <LoginPanel onLogin={login} mockMode={mockMode} />
        ) : view === "home" ? (
          <>
            <HomeDashboard items={items} onSelect={selectFromHome} onOpenSection={openHomeSection} />
            <DetailOverlay
              item={overlayOpen ? selected : undefined}
              onClose={() => setOverlayOpen(false)}
              onSetManualStatus={setManualReviewStatus}
              onEditManual={editManual}
              onDeleteManual={deleteManual}
            />
          </>
        ) : (
          <div className="content-grid">
            {view === "changes" && <ListView title="변경사항" eyebrow="현재 반영하거나 확인할 변경" items={viewItems.changes} selected={selected} onSelect={selectFromList} changeMode />}
            {view === "manual" && (
              <ListView
                title="매뉴얼 개선"
                eyebrow="검토 대기와 장기 미처리 확인"
                items={viewItems.manual}
                selected={selected}
                onSelect={selectFromList}
                latestFirst
                headerAction={(
                  <button className="view-action-button" type="button" onClick={() => setManualEditor({ mode: "create" })}>
                    <Plus size={16} /> 추가
                  </button>
                )}
              />
            )}
            {view === "drugs" && <ListView title="유기관리" eyebrow="전문약과 일반약을 함께 보되 원본 경로는 분리" items={viewItems.drugs} selected={selected} onSelect={selectFromList} onTogglePriority={toggleDrugPriority} drugMode />}
            {view === "search" && <ListView title="통합 검색" eyebrow="네 컬렉션을 한 번에 검색" items={viewItems.search} selected={selected} onSelect={selectFromList} />}
            <div
              className="detail-panel-anchor"
              ref={detailPanelRef}
              style={{ "--detail-panel-offset": `${detailPanelOffset}px` } as React.CSSProperties}
            >
              <DetailPanel item={selected} onSetManualStatus={setManualReviewStatus} onEditManual={editManual} onDeleteManual={deleteManual} />
            </div>
          </div>
        )}
        {manualEditor && (
          <ManualEditorOverlay
            mode={manualEditor.mode}
            item={manualEditor.item}
            onClose={() => setManualEditor(null)}
            onCreate={createManualImprove}
            onUpdate={updateManualImprove}
          />
        )}
      </main>
    </div>
  );
}
