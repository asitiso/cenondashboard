import { useRef, useState } from "react";
import type { Bookmark, BookmarkFolder, Preferences } from "./types";
import { Modal, BookmarkImport } from "./ImportPanels";
import { normalizeName, pinBookmark, safeUrl } from "./core";
import { SiteButton } from "./SiteButton";
import {
  deleteFolder,
  descendants,
  mergeBookmarks,
  moveFolder,
  moveSite,
} from "./workspace";
type Props = {
  preferences: Preferences;
  change: (fn: (p: Preferences) => Preferences) => Promise<void>;
  onClose: () => void;
  notify: (s: string) => void;
  suppliers: string[];
};
export function FolderTree({
  preferences,
  onOpen,
  onPin,
  busy,
}: {
  preferences: Preferences;
  onOpen: (b: Bookmark) => void;
  onPin: (b: Bookmark) => void;
  busy?: boolean;
}) {
  function tree(parent: string | null) {
    return preferences.folders
      .filter((f) => f.parentId === parent)
      .sort((a, b) => a.order - b.order)
      .map((f) => (
        <details key={f.id}>
          <summary>
            {f.name}{" "}
            <small>
              {
                preferences.bookmarks.filter(
                  (b) => !b.deletedAt && b.folderId === f.id,
                ).length
              }
            </small>
          </summary>
          {preferences.bookmarks
            .filter((b) => !b.deletedAt && b.folderId === f.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((b) => (
              <SiteButton key={b.id} site={b} onOpen={onOpen} onPin={onPin} busy={busy} />
            ))}
          <div className="of-nested">{tree(f.id)}</div>
        </details>
      ));
  }
  return <>{tree(null)}</>;
}
export function Favorites({
  preferences: p,
  change,
  onClose,
  notify,
  suppliers,
}: Props) {
  const [folderId, setFolderId] = useState(p.folders[0]?.id ?? "");
  const [panel, setPanel] = useState<
    "root" | "folder" | "site" | "import" | "delete" | "trash"
  >("root");
  const [folder, setFolder] = useState<Partial<BookmarkFolder>>({});
  const [site, setSite] = useState<Partial<Bookmark>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [marker, setMarker] = useState("");
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    pointer: number;
    active: boolean;
    target: string | null;
    position: "inside" | "before" | "after";
    valid: boolean;
  } | null>(null);
  const skip = useRef(false);
  const selected = p.folders.find((f) => f.id === folderId) ?? p.folders[0];
  const active = p.bookmarks.filter((b) => !b.deletedAt);
  const back = () => {
    setPanel("root");
    setError("");
  };
  async function save(fn: (p: Preferences) => Preferences) {
    setBusy(true);
    setError("");
    try {
      await change(fn);
      return true;
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const move = async (
    id: string,
    target: string | null,
    position: "inside" | "before" | "after" = "inside",
  ) => {
    if (await save((p) => moveFolder(p, id, target, position))) setMarker("");
  };
  function pointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    d.active = true;
    e.preventDefault();
    const node = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-of-folder]");
    d.valid = false;
    if (!node) {
      setMarker("");
      return;
    }
    const target =
      node.dataset.ofFolder === "root" ? null : node.dataset.ofFolder!;
    const rect = node.getBoundingClientRect(),
      ratio = (e.clientY - rect.top) / rect.height;
    const position =
      target === null
        ? "inside"
        : ratio < 0.25
          ? "before"
          : ratio > 0.75
            ? "after"
            : "inside";
    try {
      moveFolder(p, d.id, target, position);
      d.valid = true;
      d.target = target;
      d.position = position;
      setMarker((target ?? "root") + ":" + position);
    } catch {
      setMarker("");
    }
    const tree = node.closest<HTMLElement>(".of-folder-tree");
    if (tree) {
      const r = tree.getBoundingClientRect();
      if (e.clientY < r.top + 25) tree.scrollTop -= 12;
      else if (e.clientY > r.bottom - 25) tree.scrollTop += 12;
    }
  }
  function pointerEnd(e: React.PointerEvent, cancel = false) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    setMarker("");
    if (d.active) {
      skip.current = true;
      if (!cancel && d.valid) void move(d.id, d.target, d.position);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function nativeDrop(e: React.DragEvent, target: string, before?: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("application/order-site");
    if (id) void save((p) => moveSite(p, id, target, before));
  }
  function tree(parent: string | null, depth = 0): React.ReactNode {
    return p.folders
      .filter((f) => f.parentId === parent)
      .sort((a, b) => a.order - b.order)
      .map((f) => (
        <div key={f.id}>
          <div className="of-folder-row">
            <button
              data-of-folder={f.id}
              style={{ paddingLeft: 6 + depth * 10, touchAction: "none" }}
              className={
                (selected?.id === f.id ? "selected " : "") +
                (marker.startsWith(f.id + ":")
                  ? "of-drop-" + marker.split(":")[1]
                  : "")
              }
              onClick={() => {
                if (skip.current) {
                  skip.current = false;
                  return;
                }
                setFolderId(f.id);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                drag.current = {
                  id: f.id,
                  x: e.clientX,
                  y: e.clientY,
                  pointer: e.pointerId,
                  active: false,
                  target: null,
                  position: "inside",
                  valid: false,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={pointerMove}
              onPointerUp={pointerEnd}
              onPointerCancel={(e) => pointerEnd(e, true)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => nativeDrop(e, f.id)}
            >
              {depth ? "└ " : ""}
              {f.name}
            </button>
            <button
              onClick={() => {
                setFolder({ parentId: f.id });
                setPanel("folder");
              }}
            >
              +
            </button>
            <button
              onClick={() => {
                setFolder(f);
                setPanel("folder");
              }}
            >
              수정
            </button>
            <button
              onClick={() => {
                setFolder(f);
                setPanel("delete");
              }}
            >
              삭제
            </button>
          </div>
          {tree(f.id, depth + 1)}
        </div>
      ));
  }
  if (panel === "import")
    return (
      <BookmarkImport
        onClose={back}
        onSave={async (f, b) => {
          let message = "";
          await change((p) => {
            const out = mergeBookmarks(p, f, b);
            message =
              "추가 " + out.added + "개 · 중복 제외 " + out.skipped + "개";
            return out.preferences;
          });
          setResult(message);
          notify(message);
        }}
      />
    );
  return (
    <Modal
      title={
        panel === "root"
          ? "즐겨찾기 편집"
          : panel === "folder"
            ? "폴더 " + (folder.id ? "수정" : "추가")
            : panel === "delete"
              ? "폴더 삭제"
              : panel === "trash"
                ? "삭제된 사이트"
                : "사이트·주문처 편집"
      }
      onClose={panel === "root" ? onClose : back}
    >
      {error && (
        <p role="alert" className="of-error">
          {error}
        </p>
      )}
      {result && panel === "root" && <p role="status">{result}</p>}
      {panel === "root" && (
        <>
          <div className="of-actions">
            <button onClick={() => setPanel("import")}>가져오기</button>
            <button
              onClick={() => {
                setFolder({ parentId: null });
                setPanel("folder");
              }}
            >
              + 폴더
            </button>
            <button
              onClick={() => {
                setSite({ folderId: selected?.id });
                setPanel("site");
              }}
            >
              + 사이트
            </button>
            <button onClick={() => setPanel("trash")}>휴지통</button>
          </div>
          <p className="of-muted">
            폴더 위·아래 가장자리는 순서 변경, 가운데는 하위 폴더로 이동합니다.
          </p>
          <div className="of-edit-layout">
            <div className="of-folder-tree">
              <div
                data-of-folder="root"
                className={
                  "of-root-drop " +
                  (marker === "root:inside" ? "of-drop-inside" : "")
                }
              >
                최상위로 이동
              </div>
              {tree(null)}
            </div>
            <div className="of-edit-sites">
              {selected && (
                <>
                  <h3>{selected.name}</h3>
                  <details>
                    <summary>폴더 위치 변경</summary>
                    <div className="of-actions">
                      {(["before", "after"] as const).map((pos, i) => {
                        const siblings = p.folders
                            .filter((f) => f.parentId === selected.parentId)
                            .sort((a, b) => a.order - b.order),
                          index = siblings.findIndex(
                            (f) => f.id === selected.id,
                          ),
                          other = siblings[index + (i ? 1 : -1)];
                        return (
                          <button
                            key={pos}
                            disabled={!other}
                            onClick={() =>
                              void move(selected.id, other.id, pos)
                            }
                            aria-label={i ? "폴더 아래로" : "폴더 위로"}
                          >
                            {i ? "↓" : "↑"}
                          </button>
                        );
                      })}
                      <select
                        aria-label="폴더를 이동할 상위"
                        value={selected.parentId ?? ""}
                        onChange={(e) =>
                          void move(selected.id, e.target.value || null)
                        }
                      >
                        <option value="">최상위</option>
                        {p.folders
                          .filter(
                            (f) =>
                              !descendants(p.folders, selected.id).has(f.id),
                          )
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </details>
                  {active
                    .filter((b) => b.folderId === selected.id)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((b, i, items) => (
                      <div
                        className="of-site-row"
                        key={b.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/order-site",
                            b.id,
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => nativeDrop(e, selected.id, b.id)}
                      >
                        <span>
                          ⠿ {b.title}
                          <small>{b.url || "주소 미등록"}</small>
                        </span>
                        <div className="of-actions">
                          <button
                            onClick={() =>
                              void save((p) => ({
                                ...p,
                                bookmarks: pinBookmark(p.bookmarks, b.id),
                              }))
                            }
                          >
                            {b.rank !== undefined ? "★" : "☆"}
                          </button>
                          <button
                            onClick={() => {
                              setSite(b);
                              setPanel("site");
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() =>
                              void save((p) => ({
                                ...p,
                                bookmarks: p.bookmarks.map((x) => {
                                  if (x.id !== b.id) return x;
                                  const { rank: _, ...rest } = x;
                                  return {
                                    ...rest,
                                    deletedAt: new Date().toISOString(),
                                  };
                                }),
                              }))
                            }
                          >
                            삭제
                          </button>
                          <button
                            disabled={!i}
                            onClick={() =>
                              void save((p) =>
                                moveSite(p, b.id, selected.id, items[i - 1].id),
                              )
                            }
                          >
                            ↑
                          </button>
                          <button
                            disabled={i === items.length - 1}
                            onClick={() =>
                              void save((p) =>
                                moveSite(
                                  p,
                                  b.id,
                                  selected.id,
                                  items[i + 2]?.id,
                                ),
                              )
                            }
                          >
                            ↓
                          </button>
                        </div>
                        <select
                          aria-label={b.title + " 이동할 폴더"}
                          value={selected.id}
                          onChange={(e) =>
                            void save((p) => moveSite(p, b.id, e.target.value))
                          }
                        >
                          {p.folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  <div
                    className="of-root-drop"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => nativeDrop(e, selected.id)}
                  >
                    사이트를 놓으면 맨 뒤로 이동
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {panel === "folder" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              const name = folder.name?.trim();
              if (!name) {
                setError("폴더 이름을 입력하세요.");
                return;
              }
              if (
                await save((p) => {
                  if (
                    p.folders.some(
                      (f) =>
                        f.id !== folder.id &&
                        f.parentId === (folder.parentId ?? null) &&
                        f.name === name,
                    )
                  )
                    throw Error("같은 위치에 같은 이름의 폴더가 있습니다.");
                  const value: BookmarkFolder = {
                    id: folder.id ?? crypto.randomUUID(),
                    name,
                    parentId: folder.parentId ?? null,
                    category: folder.category ?? "기타",
                    order: folder.order ?? p.folders.length,
                  };
                  return {
                    ...p,
                    folders: folder.id
                      ? p.folders.map((f) => (f.id === folder.id ? value : f))
                      : [...p.folders, value],
                  };
                })
              )
                back();
            })();
          }}
        >
          <label>
            폴더 이름
            <input
              value={folder.name ?? ""}
              onChange={(e) => setFolder({ ...folder, name: e.target.value })}
            />
          </label>
          <button disabled={busy}>저장</button>
          <button type="button" onClick={back}>
            취소
          </button>
        </form>
      )}
      {panel === "delete" && (
        <>
          <p>
            {folder.name} 폴더만 삭제하고 사이트와 하위 폴더는 상위로 옮깁니다.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                if (await save((p) => deleteFolder(p, folder.id!))) back();
              })()
            }
          >
            폴더 삭제
          </button>
          <button onClick={back}>취소</button>
        </>
      )}
      {panel === "site" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              if (!site.title?.trim()) {
                setError("이름을 입력하세요.");
                return;
              }
              if (site.url?.trim() && !safeUrl(site.url)) {
                setError("http 또는 https 주소를 입력하세요.");
                return;
              }
              if (
                await save((p) => {
                  let folders = p.folders;
                  let folderId = site.folderId;
                  if (!folderId) {
                    folderId = folders[0]?.id ?? crypto.randomUUID();
                    if (!folders.length)
                      folders = [
                        {
                          id: folderId,
                          name: "기타",
                          parentId: null,
                          category: "기타",
                          order: 0,
                        },
                      ];
                  }
                  const value: Bookmark = {
                    ...site,
                    id: site.id ?? crypto.randomUUID(),
                    title: site.title!.trim(),
                    url: site.url?.trim() ? safeUrl(site.url)! : "",
                    folderId,
                    category: site.category ?? "기타",
                    memo: site.memo ?? "",
                  };
                  if (
                    p.bookmarks.some(
                      (b) =>
                        b.id !== site.id &&
                        !b.deletedAt &&
                        b.title === value.title,
                    )
                  )
                    throw Error("구분할 다른 이름을 입력하세요.");
                  const settings = { ...p.suppliers };
                  for (const name of suppliers) {
                    if (value.supplierNames?.includes(name)) {
                      const existing = settings[name];
                      if (
                        existing?.bookmarkId &&
                        existing.bookmarkId !== value.id
                      )
                        throw Error(
                          "다른 사이트에 연결된 거래처는 기존 사이트에서 수정하세요.",
                        );
                      settings[name] = {
                        ...existing,
                        bookmarkId: value.id,
                        method: (value.methods?.[0] ?? "사이트") as "사이트",
                        memo: value.memo,
                      };
                    } else if (settings[name]?.bookmarkId === value.id) {
                      const { bookmarkId: _, ...rest } = settings[name];
                      settings[name] = rest;
                    }
                  }
                  return {
                    ...p,
                    folders,
                    suppliers: settings,
                    bookmarks: p.bookmarks.some((b) => b.id === value.id)
                      ? p.bookmarks.map((b) => (b.id === value.id ? value : b))
                      : [...p.bookmarks, value],
                  };
                })
              )
                back();
            })();
          }}
        >
          <label>
            이름
            <input
              required
              value={site.title ?? ""}
              onChange={(e) => setSite({ ...site, title: e.target.value })}
            />
          </label>
          <label>
            사이트 주소 · 비워도 등록 가능
            <input
              value={site.url ?? ""}
              onChange={(e) => setSite({ ...site, url: e.target.value })}
            />
          </label>
          <label>
            폴더
            <select
              value={site.folderId ?? ""}
              onChange={(e) => setSite({ ...site, folderId: e.target.value })}
            >
              <option value="">폴더 선택</option>
              {p.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            기본 주문 방법
            <select
              value={site.methods?.[0] ?? "사이트"}
              onChange={(e) =>
                setSite({
                  ...site,
                  methods: [e.target.value, ...(site.methods?.slice(1) ?? [])],
                })
              }
            >
              {["사이트", "전화", "문자", "카카오톡"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            추가 주문 방법
            <select
              value={site.methods?.[1] ?? ""}
              onChange={(e) =>
                setSite({
                  ...site,
                  methods: [
                    site.methods?.[0] ?? "사이트",
                    e.target.value,
                  ].filter(Boolean),
                })
              }
            >
              <option value="">없음</option>
              {["사이트", "전화", "문자", "카카오톡"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            전화번호
            <input
              value={site.phone ?? ""}
              onChange={(e) => setSite({ ...site, phone: e.target.value })}
            />
          </label>
          <label>
            주문 메모
            <input
              value={site.memo ?? ""}
              onChange={(e) => setSite({ ...site, memo: e.target.value })}
            />
          </label>
          <details>
            <summary>연결할 매입 거래처</summary>
            {suppliers.map((name) => (
              <label className="of-check" key={name}>
                <input
                  type="checkbox"
                  checked={
                    site.supplierNames?.includes(name) ??
                    (!!site.id && p.suppliers[name]?.bookmarkId === site.id)
                  }
                  disabled={
                    !!p.suppliers[name]?.bookmarkId &&
                    p.suppliers[name].bookmarkId !== site.id
                  }
                  onChange={(e) =>
                    setSite({
                      ...site,
                      supplierNames: e.target.checked
                        ? [
                            ...(site.supplierNames ??
                              suppliers.filter(
                                (n) => p.suppliers[n]?.bookmarkId === site.id,
                              )),
                            name,
                          ]
                        : (
                            site.supplierNames ??
                            suppliers.filter(
                              (n) => p.suppliers[n]?.bookmarkId === site.id,
                            )
                          ).filter((n) => n !== name),
                    })
                  }
                />
                {name}
              </label>
            ))}
          </details>
          <button disabled={busy}>저장</button>
          <button type="button" onClick={back}>
            취소
          </button>
        </form>
      )}
      {panel === "trash" && (
        <>
          {p.bookmarks
            .filter(
              (b) =>
                b.deletedAt &&
                Date.now() - Date.parse(b.deletedAt) < 30 * 86400000,
            )
            .map((b) => (
              <div className="of-site-row" key={b.id}>
                {b.title}
                <button
                  onClick={() =>
                    void save((p) => ({
                      ...p,
                      bookmarks: p.bookmarks.map((x) => {
                        if (x.id !== b.id) return x;
                        const { deletedAt: _, ...rest } = x;
                        return rest;
                      }),
                    }))
                  }
                >
                  복원
                </button>
              </div>
            ))}
          <button onClick={back}>즐겨찾기 편집으로</button>
        </>
      )}
    </Modal>
  );
}
