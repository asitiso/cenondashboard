import { useDeferredValue, useMemo, useState } from "react";
import {
  Folder,
  Search,
  Star,
  Upload,
  Settings2,
  Menu,
  ExternalLink,
  Plus,
} from "lucide-react";
import { BookmarkImport, Modal, PurchaseImport } from "./ImportPanels";
import { ProductPanel } from "./ProductPanel";
import {
  pinBookmark,
  normalizeName,
  safeUrl,
  searchProducts,
  stableId,
  todayKorea,
  topBookmarks,
} from "./core";
import { useOrderData } from "./useOrderData";
import { CATEGORIES, usageLabel } from "./types";
import type { Bookmark, BookmarkFolder, Product } from "./types";
import "./order.css";

function withoutRank(b: Bookmark): Bookmark {
  const { rank: _, ...rest } = b;
  return rest;
}
function restored(b: Bookmark): Bookmark {
  const { deletedAt: _, ...rest } = b;
  return rest;
}
export function TopNavigation({
  active,
  onNavigate,
}: {
  active: "order" | "operations";
  onNavigate: (v: "order" | "operations") => void;
}) {
  return (
    <nav className="order-top-tabs" aria-label="최상위 화면">
      <button
        className={active === "operations" ? "active" : ""}
        onClick={() => onNavigate("operations")}
      >
        운영 대시보드
      </button>
      <button
        className={active === "order" ? "active" : ""}
        onClick={() => onNavigate("order")}
      >
        주문·업무 찾기
      </button>
    </nav>
  );
}

function BookmarkEditor({
  bookmark,
  folders,
  onSave,
  onClose,
}: {
  bookmark?: Bookmark;
  folders: BookmarkFolder[];
  onSave: (b: Bookmark) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(bookmark?.title ?? "");
  const [url, setUrl] = useState(bookmark?.url ?? "");
  const [category, setCategory] = useState(bookmark?.category ?? "기타");
  const [folderId, setFolderId] = useState(bookmark?.folderId ?? "");
  const [memo, setMemo] = useState(bookmark?.memo ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title={bookmark ? "즐겨찾기 수정" : "즐겨찾기 추가"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const valid = safeUrl(url);
          if (!valid) {
            setError("http 또는 https 웹사이트 주소를 입력해 주세요.");
            return;
          }
          if (!title.trim()) return;
          setSaving(true);
          try {
            await onSave({
              ...bookmark,
              id: bookmark?.id ?? stableId(`${valid}|${Date.now()}`),
              title: title.trim(),
              url: valid,
              category,
              folderId: folderId || `category-${stableId(category)}`,
              memo: memo.trim(),
              order: bookmark?.order ?? Date.now(),
            });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="order-form-grid">
          <label>
            사이트 이름
            <input
              required
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            URL
            <input
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
          <label>
            분류
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            폴더
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">분류 바로 아래</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            한 줄 메모
            <input
              value={memo}
              maxLength={200}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="order-error" role="alert">
            {error}
          </p>
        )}
        <div className="order-actions">
          <button className="order-primary" disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
          <button type="button" className="order-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </form>
    </Modal>
  );
}
export default function OrderApp({
  onNavigate,
}: {
  onNavigate: (v: "order" | "operations") => void;
}) {
  const data = useOrderData();
  const { snapshot, preferences, days } = data;
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [selectedId, setSelectedId] = useState("");
  const [usage, setUsage] = useState("all");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<
    "purchase" | "bookmarks" | "manage" | "newProduct" | null
  >(null);
  const [editor, setEditor] = useState<{ bookmark?: Bookmark } | null>(null);
  const [replace, setReplace] = useState<Bookmark | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("cenon-bookmark-sidebar") === "closed";
    } catch {
      return false;
    }
  });
  const [manageQuery, setManageQuery] = useState("");
  const [trash, setTrash] = useState(false);
  const visible = preferences.bookmarks.filter((b) => !b.deletedAt);
  const hot = useMemo(
    () => topBookmarks(preferences.bookmarks, days, todayKorea()),
    [preferences.bookmarks, days],
  );
  const found = useMemo(
    () => searchProducts(snapshot?.products ?? [], deferred),
    [snapshot, deferred],
  );
  const selected = snapshot?.products.find((p) => p.id === selectedId);
  const bookmarkResults = useMemo(
    () =>
      deferred.trim()
        ? visible
            .filter((b) =>
              normalizeName(`${b.title} ${b.memo} ${b.category}`).includes(
                normalizeName(deferred),
              ),
            )
            .slice(0, 30)
        : [],
    [deferred, preferences.bookmarks],
  );
  async function perform(fn: () => Promise<void>) {
    try {
      await fn();
      data.setError("");
    } catch (e) {
      data.setError(e instanceof Error ? e.message : String(e));
    }
  }
  function open(b: Bookmark, name?: string) {
    const url = safeUrl(b.url);
    if (!url) {
      data.setError("사이트 주소를 확인해 주세요.");
      return;
    }
    if (name) {
      void navigator.clipboard
        .writeText(name)
        .then(() => setNotice(`상품명 복사: ${name}`))
        .catch(() =>
          setNotice(
            "상품명을 자동 복사하지 못했습니다. 상품 상세의 복사 버튼을 이용해 주세요.",
          ),
        );
    }
    window.open(url, "_blank", "noopener,noreferrer");
    void perform(() => data.click(b.id));
  }
  function pin(b: Bookmark) {
    const alias = hot.fixed.some((x) => safeUrl(x.url) === safeUrl(b.url));
    if (b.rank === undefined && !alias && hot.fixed.length >= 10) {
      setReplace(b);
      return;
    }
    void perform(() =>
      data.change((p) => ({ ...p, bookmarks: pinBookmark(p.bookmarks, b.id) })),
    );
  }
  function dragStart(
    e: React.DragEvent,
    type: "bookmark" | "folder",
    id: string,
  ) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = "move";
  }
  function drop(
    e: React.DragEvent,
    category: string,
    folderId?: string,
    beforeId?: string,
  ) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const dragged = JSON.parse(e.dataTransfer.getData("text/plain")) as {
        type: string;
        id: string;
      };
      void perform(() =>
        data.change((p) => {
          if (dragged.type === "bookmark") {
            const before = p.bookmarks.find((x) => x.id === beforeId);
            return {
              ...p,
              bookmarks: p.bookmarks.map((b) =>
                b.id === dragged.id
                  ? {
                      ...b,
                      folderId: folderId ?? `category-${stableId(category)}`,
                      category,
                      order: before ? (before.order ?? 0) - 0.5 : Date.now(),
                    }
                  : b,
              ),
              folders: folderId
                ? p.folders
                : p.folders.some(
                      (f) => f.id === `category-${stableId(category)}`,
                    )
                  ? p.folders
                  : [
                      ...p.folders,
                      {
                        id: `category-${stableId(category)}`,
                        name: category,
                        parentId: null,
                        category,
                        order: Date.now(),
                      },
                    ],
            };
          }
          const moving = p.folders.find((f) => f.id === dragged.id);
          if (!moving) return p;
          let ancestor = folderId;
          while (ancestor) {
            if (ancestor === moving.id)
              throw new Error(
                "폴더를 자기 자신이나 하위 폴더로 옮길 수 없습니다.",
              );
            ancestor =
              p.folders.find((f) => f.id === ancestor)?.parentId ?? undefined;
          }
          const target = p.folders.find((f) => f.id === folderId);
          const sameParent = target && target.parentId === moving.parentId;
          const descendants = new Set([moving.id]);
          let added = true;
          while (added) {
            added = false;
            p.folders.forEach((f) => {
              if (
                f.parentId &&
                descendants.has(f.parentId) &&
                !descendants.has(f.id)
              ) {
                descendants.add(f.id);
                added = true;
              }
            });
          }
          return {
            ...p,
            folders: p.folders.map((f) =>
              f.id === moving.id
                ? {
                    ...f,
                    parentId: sameParent ? moving.parentId : (folderId ?? null),
                    order: sameParent ? target!.order - 0.5 : Date.now(),
                    category,
                  }
                : descendants.has(f.id)
                  ? { ...f, category }
                  : f,
            ),
            bookmarks: p.bookmarks.map((b) =>
              descendants.has(b.folderId) ? { ...b, category } : b,
            ),
          };
        }),
      );
    } catch (err) {
      data.setError(
        err instanceof Error ? err.message : "이동하지 못했습니다.",
      );
    }
  }
  function renderFolder(
    f: BookmarkFolder,
    category: string,
    depth = 0,
  ): React.ReactNode {
    if (depth > 32) return null;
    const links = visible
      .filter((b) => b.folderId === f.id && b.category === category)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const children = preferences.folders
      .filter((x) => x.parentId === f.id)
      .sort((a, b) => a.order - b.order)
      .map((x) => renderFolder(x, category, depth + 1))
      .filter(Boolean);
    if (!links.length && !children.length) return null;
    const content = (
      <>
        {links.map((b) => (
          <div
            className="order-tree-link"
            key={b.id}
            draggable
            onDragStart={(e) => dragStart(e, "bookmark", b.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e, category, f.id, b.id)}
          >
            <button onClick={() => open(b)} title={b.memo || b.title}>
              {b.title}
            </button>
            <button
              className="order-tree-star"
              aria-label={`${b.title} ${b.rank !== undefined ? "고정 해제" : "고정"}`}
              onClick={() => pin(b)}
            >
              <Star
                size={12}
                fill={b.rank !== undefined ? "currentColor" : "none"}
              />
            </button>
          </div>
        ))}
        {children}
      </>
    );
    return f.name === "북마크바" ? (
      <div key={f.id}>{content}</div>
    ) : (
      <details
        key={f.id}
        className="order-tree-folder"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => drop(e, category, f.id)}
      >
        <summary draggable onDragStart={(e) => dragStart(e, "folder", f.id)}>
          <Folder size={13} />
          {f.name}
        </summary>
        {content}
      </details>
    );
  }
  async function match(p: Product, code: string) {
    if (!snapshot) return;
    const candidates = snapshot.catalogs.filter((c) => c.code === code);
    if (!candidates.length) throw new Error("연결할 상품을 찾지 못했습니다.");
    const products = snapshot.products.filter((x) => x.baseId !== p.baseId);
    for (const c of candidates) {
      if (products.some((x) => x.baseId === p.baseId && x.usage === c.usage))
        continue;
      products.push({
        ...p,
        id: `${p.baseId}-${c.usage}`,
        name: c.name,
        code: c.code,
        usage: c.usage,
        matchStatus: "matched",
        candidateCodes: [],
      });
    }
    await data.saveSnapshot(
      {
        ...snapshot,
        previousVersion: snapshot.version,
        products,
        version: crypto.randomUUID(),
      },
      { baseId: p.baseId, code },
    );
    setSelectedId(`${p.baseId}-${candidates[0].usage}`);
  }
  const manageLinks = preferences.bookmarks
    .filter((b) =>
      trash
        ? !!b.deletedAt && Date.now() - Date.parse(b.deletedAt) <= 30 * 86400000
        : !b.deletedAt,
    )
    .filter((b) =>
      normalizeName(`${b.title} ${b.category}`).includes(
        normalizeName(manageQuery),
      ),
    );
  return (
    <div className={`order-shell ${collapsed ? "closed" : ""}`}>
      <aside className="order-sidebar">
        <div className="order-sidebar-brand">
          <strong>센트럴온누리</strong>
          <button
            className="order-quiet"
            aria-label={collapsed ? "즐겨찾기 펼치기" : "즐겨찾기 접기"}
            onClick={() => {
              setCollapsed((v) => !v);
              try {
                localStorage.setItem(
                  "cenon-bookmark-sidebar",
                  collapsed ? "open" : "closed",
                );
              } catch {}
            }}
          >
            <Menu size={18} />
          </button>
        </div>
        {!collapsed && (
          <>
            <div className="order-sidebar-label">
              즐겨찾기 <span>{visible.length}</span>
            </div>
            <div className="order-tree">
              {CATEGORIES.map((category) => (
                <details
                  key={category}
                  open={category === "종합도매"}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => drop(e, category)}
                >
                  <summary>
                    <Folder size={15} />
                    {category}
                    <small>
                      {visible.filter((b) => b.category === category).length}
                    </small>
                  </summary>
                  {preferences.folders
                    .filter(
                      (f) =>
                        !f.parentId ||
                        !preferences.folders.some((x) => x.id === f.parentId),
                    )
                    .sort((a, b) => a.order - b.order)
                    .map((f) => renderFolder(f, category))}
                </details>
              ))}
              {!visible.length && (
                <p className="order-help">
                  업무용 북마크를 가져오면 여기에서 찾을 수 있습니다.
                </p>
              )}
            </div>
            <button
              className="order-sidebar-import"
              onClick={() => setModal("bookmarks")}
            >
              <Upload size={15} /> 북마크 가져오기
            </button>
            <small className="order-sidebar-foot">
              {data.shared ? "약국 공용으로 저장" : "이 PC에 저장"} ·
              폴더·링크를 끌어 이동
            </small>
          </>
        )}
      </aside>
      <main className="order-main">
        <header className="order-topbar">
          <TopNavigation active="order" onNavigate={onNavigate} />
          <button
            className="order-quiet order-manage-button"
            onClick={() => setModal("manage")}
          >
            <Settings2 size={17} /> 관리
          </button>
        </header>
        <div className="order-content">
          {data.error && (
            <div className="order-error" role="alert">
              {data.error}
              <button
                onClick={() => data.setError("")}
                aria-label="오류 안내 닫기"
              >
                ✕
              </button>
            </div>
          )}
          {notice && (
            <div className="order-notice" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="안내 닫기">
                ✕
              </button>
            </div>
          )}
          <div className="order-search-heading">
            <div>
              <h1>주문·업무 찾기</h1>
              <p>상품과 주문처, 필요한 업무를 한 번에 찾으세요.</p>
            </div>
            <button
              className="order-secondary"
              onClick={() => setModal("purchase")}
            >
              <Upload size={15} /> 매입자료 갱신
            </button>
          </div>
          <div className="order-search-box">
            <Search size={20} />
            <input
              aria-label="상품 거래처 업무 검색"
              placeholder="약품 / 거래처 / 업무 / 소모품 검색"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId("");
              }}
            />
            <kbd>검색</kbd>
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setSelectedId("");
                }}
                aria-label="검색 지우기"
              >
                ✕
              </button>
            )}
          </div>
          {!query.trim() ? (
            <>
              <section className="order-shortcuts">
                <h2>
                  <Star size={16} /> 고정 즐겨찾기{" "}
                  <small>{hot.fixed.length}/10</small>
                </h2>
                <div className="order-shortcut-grid">
                  {hot.fixed.map((b) => (
                    <button
                      key={b.id}
                      className="order-shortcut"
                      onClick={() => open(b)}
                      title={b.memo}
                    >
                      {b.title}
                      <ExternalLink size={12} />
                    </button>
                  ))}
                  {!hot.fixed.length && (
                    <p className="order-help">
                      즐겨찾기 옆 별을 눌러 자주 쓰는 사이트를 고정하세요.
                    </p>
                  )}
                </div>
              </section>
              <section className="order-shortcuts">
                <h2>
                  자주 사용{" "}
                  <small>
                    최근 30일 · {data.shared ? "약국 전체" : "이 PC"} 상위 5개
                  </small>
                </h2>
                <div className="order-shortcut-grid automatic">
                  {hot.frequent.map((b) => (
                    <button
                      key={b.id}
                      className="order-shortcut"
                      onClick={() => open(b)}
                    >
                      {b.title}
                      <ExternalLink size={12} />
                    </button>
                  ))}
                  {!hot.frequent.length && (
                    <p className="order-help">
                      고정 사이트를 제외하고, 사용 기록이 쌓이면 자동으로
                      표시됩니다.
                    </p>
                  )}
                </div>
              </section>
              <div className="order-category-grid">
                {CATEGORIES.map((category) => (
                  <section key={category}>
                    <h2>{category}</h2>
                    {visible
                      .filter((b) => b.category === category)
                      .slice(0, 3)
                      .map((b) => (
                        <button key={b.id} onClick={() => open(b)}>
                          {b.title}
                          <ExternalLink size={12} />
                        </button>
                      ))}
                    {!visible.some((b) => b.category === category) && (
                      <p className="order-help">등록된 사이트가 없습니다.</p>
                    )}
                    <button
                      className="order-category-more"
                      onClick={() => {
                        setManageQuery(category);
                        setTrash(false);
                        setModal("manage");
                      }}
                    >
                      전체보기
                    </button>
                  </section>
                ))}
              </div>
              {!snapshot && !data.loading && (
                <div className="order-empty-import">
                  <strong>
                    매입자료를 가져오면 상품별 주문처를 찾을 수 있습니다.
                  </strong>
                  <p>
                    분류되지 않은 품목도 바로 검색됩니다. 적수는 필요한 상품만
                    입력하세요.
                  </p>
                  <button
                    className="order-primary"
                    onClick={() => setModal("purchase")}
                  >
                    매입자료 가져오기
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              className={`order-results-grid ${selected ? "has-detail" : ""}`}
            >
              <div className="order-results">
                <div className="order-result-header">
                  <h2>
                    {found.suggested ? "비슷한 상품을 찾았습니다" : "상품"}{" "}
                    <small>
                      {found.results.length === 80
                        ? "80개 이상"
                        : `${found.results.length}개`}
                    </small>
                  </h2>
                  <select
                    aria-label="상품 용도 필터"
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                  >
                    <option value="all">모두</option>
                    <option value="dispensing">조제용</option>
                    <option value="retail">판매용</option>
                    <option value="unclassified">미분류</option>
                  </select>
                </div>
                {found.suggested && (
                  <p className="order-help">
                    상품명과 규격을 확인하고 선택해 주세요.
                  </p>
                )}
                {found.results
                  .filter((p) => usage === "all" || p.usage === usage)
                  .map((p) => (
                    <button
                      key={p.id}
                      className={`order-product-row ${p.id === selectedId ? "selected" : ""}`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.manufacturer}
                          {p.matchStatus === "review"
                            ? " · 연결 확인 필요"
                            : ""}
                        </small>
                      </span>
                      <span className={`order-badge ${p.usage}`}>
                        {usageLabel[p.usage]}
                      </span>
                    </button>
                  ))}
                {!found.results.length && (
                  <p className="order-help">
                    검색되는 상품이 없습니다. 상품명 일부나 거래처명으로 다시
                    검색해 보세요.
                  </p>
                )}
                <button
                  className="order-quiet"
                  onClick={() => setModal("newProduct")}
                >
                  <Plus size={14} /> 주문처 직접 등록
                </button>
                <h2 className="order-link-results-heading">
                  업무·즐겨찾기 <small>{bookmarkResults.length}개</small>
                </h2>
                {bookmarkResults.map((b) => (
                  <button
                    className="order-bookmark-result"
                    key={b.id}
                    onClick={() => open(b)}
                  >
                    <span>
                      <strong>{b.title}</strong>
                      <small>{b.memo || b.category}</small>
                    </span>
                    <ExternalLink size={15} />
                  </button>
                ))}
              </div>
              {selected && snapshot && (
                <ProductPanel
                  key={selected.id}
                  product={selected}
                  snapshot={snapshot}
                  preferences={preferences}
                  onClose={() => setSelectedId("")}
                  onOpen={open}
                  onUnit={(id, value) =>
                    data.change((p) => ({
                      ...p,
                      units: { ...p.units, [id]: value },
                    }))
                  }
                  onSupplier={(name, value) =>
                    data.change((p) => ({
                      ...p,
                      suppliers: { ...p.suppliers, [name]: value },
                    }))
                  }
                  onMatch={match}
                />
              )}
            </div>
          )}
          <footer className="order-data-foot">
            {data.loading
              ? "자료를 불러오는 중…"
              : snapshot
                ? `매입 ${snapshot.stats.rows.toLocaleString()}행 · 자료 기준 ${snapshot.asOf} · ${data.shared ? "약국 공용" : "이 PC에 저장"}`
                : `${data.shared ? "약국 공용" : "이 PC에 저장"} · 업무용 북마크부터 가져올 수 있습니다.`}
          </footer>
        </div>
      </main>
      {modal === "purchase" && (
        <PurchaseImport
          previous={snapshot}
          preferences={preferences}
          onSave={data.saveSnapshot}
          onClose={() => setModal(null)}
        />
      )}{" "}
      {modal === "bookmarks" && (
        <BookmarkImport
          onClose={() => setModal(null)}
          onSave={async (f, b) => {
            await data.change((p) => {
              const urls = new Set(
                p.bookmarks.filter((x) => !x.deletedAt).map((x) => x.url),
              );
              const added = b.filter((x) => !urls.has(x.url));
              const allFolders = [
                ...p.folders,
                ...f.filter((x) => !p.folders.some((y) => y.id === x.id)),
              ];
              return {
                ...p,
                folders: allFolders,
                bookmarks: [...p.bookmarks, ...added],
              };
            });
            setNotice(
              "선택한 업무용 북마크를 가져왔습니다. 기존 URL은 그대로 유지했습니다.",
            );
          }}
        />
      )}
      {modal === "manage" && (
        <Modal title="주문·업무 관리" onClose={() => setModal(null)}>
          <div className="order-management-actions">
            <button
              className="order-secondary"
              onClick={() => setModal("purchase")}
            >
              매입자료 갱신
            </button>
            <button
              className="order-secondary"
              onClick={() => setModal("bookmarks")}
            >
              북마크 가져오기
            </button>
            <button className="order-secondary" onClick={() => setEditor({})}>
              즐겨찾기 추가
            </button>
          </div>
          <div className="order-manage-filter">
            <input
              aria-label="관리할 즐겨찾기 검색"
              placeholder="사이트 이름 또는 분류"
              value={manageQuery}
              onChange={(e) => setManageQuery(e.target.value)}
            />
            <button
              className="order-secondary"
              onClick={() => setTrash((t) => !t)}
            >
              {trash ? "전체 즐겨찾기" : "휴지통 (30일)"}
            </button>
          </div>
          <div className="order-manage-list">
            {manageLinks.map((b) => (
              <div key={b.id}>
                <span>
                  <strong>{b.title}</strong>
                  <small>
                    {b.category} · {b.memo || new URL(b.url).hostname}
                  </small>
                </span>
                {trash ? (
                  <button
                    className="order-secondary"
                    onClick={() =>
                      void perform(() =>
                        data.change((p) => ({
                          ...p,
                          bookmarks: p.bookmarks.map((x) =>
                            x.id === b.id ? restored(x) : x,
                          ),
                        })),
                      )
                    }
                  >
                    복원
                  </button>
                ) : (
                  <>
                    <button
                      className="order-quiet"
                      onClick={() => pin(b)}
                      aria-label={`${b.title} 고정 설정`}
                    >
                      <Star
                        size={15}
                        fill={b.rank !== undefined ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="order-secondary"
                      onClick={() => setEditor({ bookmark: b })}
                    >
                      수정
                    </button>
                    <button
                      className="order-quiet"
                      onClick={() =>
                        void perform(() =>
                          data.change((p) => ({
                            ...p,
                            bookmarks: p.bookmarks.map((x) =>
                              x.id === b.id
                                ? {
                                    ...withoutRank(x),
                                    deletedAt: new Date().toISOString(),
                                  }
                                : x,
                            ),
                          })),
                        )
                      }
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="order-help">
            폴더와 링크는 왼쪽 즐겨찾기에서 끌어 이동할 수 있습니다. 삭제한
            링크는 30일 동안 복원할 수 있습니다.
          </p>
        </Modal>
      )}
      {editor && (
        <BookmarkEditor
          bookmark={editor.bookmark}
          folders={preferences.folders}
          onClose={() => setEditor(null)}
          onSave={(b) =>
            data.change((p) => ({
              ...p,
              bookmarks: p.bookmarks.some((x) => x.id === b.id)
                ? p.bookmarks.map((x) => (x.id === b.id ? b : x))
                : [...p.bookmarks, b],
              folders: p.folders.some((f) => f.id === b.folderId)
                ? p.folders
                : [
                    ...p.folders,
                    {
                      id: b.folderId,
                      name: b.category,
                      parentId: null,
                      category: b.category,
                      order: Date.now(),
                    },
                  ],
            }))
          }
        />
      )}{" "}
      {replace && (
        <Modal title="고정 즐겨찾기 교체" onClose={() => setReplace(null)}>
          <p>
            고정 10개가 모두 채워졌습니다. {replace.title}로 교체할 위치를
            선택해 주세요.
          </p>
          {hot.fixed.map((b) => (
            <button
              className="order-replace-option"
              key={b.id}
              onClick={() =>
                void perform(async () => {
                  await data.change((p) => ({
                    ...p,
                    bookmarks: pinBookmark(p.bookmarks, replace.id, b.id),
                  }));
                  setReplace(null);
                })
              }
            >
              {(b.rank ?? 0) + 1}. {b.title}
            </button>
          ))}
        </Modal>
      )}
      {modal === "newProduct" && (
        <NewProduct
          initialName={query}
          onClose={() => setModal(null)}
          suppliers={[
            ...new Set(
              snapshot?.products.flatMap((p) =>
                p.frequency.map((f) => f.supplier),
              ) ?? [],
            ),
          ]}
          onSave={async (name, supplier) => {
            const id = stableId(`manual|${name}`);
            const link = preferences.bookmarks.find(
              (b) => b.title === supplier,
            );
            await data.change((p) => ({
              ...p,
              suppliers: {
                ...p.suppliers,
                [supplier]: p.suppliers[supplier] ?? {
                  method: "사이트",
                  memo: "",
                  ...(link ? { bookmarkId: link.id } : {}),
                },
              },
            }));
            const p: Product = {
              id: `${id}-unclassified`,
              baseId: id,
              name,
              sourceName: name,
              manufacturer: "",
              usage: "unclassified",
              matchStatus: "unclassified",
              latest: [],
              frequency: [],
              manualSupplier: supplier,
            };
            const next = snapshot ?? {
              version: "",
              asOf: todayKorea(),
              products: [],
              catalogs: [],
              stats: {
                rows: 0,
                names: 0,
                matchedRows: 0,
                unclassifiedRows: 0,
                reviewRows: 0,
                futureRows: 0,
                returnRows: 0,
                missingNames: 0,
              },
              importedAt: new Date().toISOString(),
            };
            await data.saveSnapshot({
              ...next,
              previousVersion: next.version || undefined,
              version: crypto.randomUUID(),
              products: next.products.some((x) => x.id === p.id)
                ? next.products.map((x) =>
                    x.id === p.id ? { ...x, manualSupplier: supplier } : x,
                  )
                : [...next.products, p],
            });
            setQuery(name);
            setSelectedId(p.id);
            setNotice(`${name}의 주문처: ${supplier}`);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
function NewProduct({
  initialName,
  suppliers,
  onSave,
  onClose,
}: {
  initialName: string;
  suppliers: string[];
  onSave: (n: string, s: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="주문처 직접 등록" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            if (!name.trim() || !supplier.trim())
              throw new Error("상품명과 주문처를 입력해 주세요.");
            await onSave(name.trim(), supplier.trim());
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          상품명
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          주문처
          <input
            required
            list="order-suppliers"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
          <datalist id="order-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        {error && (
          <p role="alert" className="order-error">
            {error}
          </p>
        )}
        <button className="order-primary" disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </form>
    </Modal>
  );
}
