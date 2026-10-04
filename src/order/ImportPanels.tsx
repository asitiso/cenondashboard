import { useEffect, useRef, useState } from "react";
import { parseBookmarks, selectedBookmarkTree } from "./bookmarks";
import { todayKorea, yearStart } from "./core";
import type {
  Bookmark,
  BookmarkFolder,
  ImportPayload,
  Preferences,
  Snapshot,
} from "./types";
import { descendants, matchingImportLinks } from "./workspace";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href]",
          ) ?? [],
        ).filter((x) => !x.hasAttribute("disabled"));
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="order-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="order-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="order-modal-heading">
          <h2>{title}</h2>
          <button
            type="button"
            className="order-quiet"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function PurchaseImport({
  previous,
  preferences,
  onSave,
  onClose,
}: {
  previous?: Snapshot;
  preferences: Preferences;
  onSave: (s: Snapshot) => Promise<void>;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<{
    purchase?: File;
    dispensing?: File;
    retail?: File;
  }>({});
  const [asOf, setAsOf] = useState(todayKorea());
  const [progress, setProgress] = useState("");
  const [preview, setPreview] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fullYear, setFullYear] = useState(false);
  const worker = useRef<Worker | undefined>(undefined);
  useEffect(() => () => worker.current?.terminate(), []);
  async function analyze() {
    setError("");
    setPreview(undefined);
    try {
      if (!files.purchase) throw new Error("매입자료를 선택해 주세요.");
      if (Object.values(files).some((f) => f && f.size > 50 * 1024 * 1024))
        throw new Error("파일은 50MB 이하로 선택해 주세요.");
      if (!asOf || asOf > todayKorea())
        throw new Error("자료 기준일은 오늘 이전으로 입력해 주세요.");
      setProgress("파일을 준비하고 있습니다…");
      const [purchase, dispensing, retail] = await Promise.all([
        files.purchase.arrayBuffer(),
        files.dispensing?.arrayBuffer(),
        files.retail?.arrayBuffer(),
      ]);
      const w = new Worker(new URL("./import.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      w.onmessage = (e) => {
        if (e.data.error) {
          setError(e.data.error);
          setProgress("");
          w.terminate();
        } else if (e.data.result) {
          setPreview(e.data.result);
          setProgress("");
          w.terminate();
        } else setProgress(e.data.progress);
      };
      w.onerror = () => {
        setError(
          "파일 처리 중 문제가 생겼습니다. 다시 시도하거나 PMIT에서 파일을 다시 내보내 주세요.",
        );
        setProgress("");
        w.terminate();
      };
      const payload: ImportPayload = {
        purchase,
        dispensing,
        retail,
        asOf,
        previous,
        overrides: preferences.overrides,
      };
      w.postMessage(payload, [
        purchase,
        ...(dispensing ? [dispensing] : []),
        ...(retail ? [retail] : []),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress("");
    }
  }
  return (
    <Modal title="매입자료 가져오기" onClose={onClose}>
      <p className="order-help">
        최근 1년치 전체 매입자료를 가져옵니다. 적수·주문처·메모는 계속
        유지됩니다.
      </p>
      <div className="order-form-grid">
        {(["purchase", "dispensing", "retail"] as const).map((key) => (
          <label key={key}>
            {key === "purchase"
              ? "매입자료 (필수)"
              : key === "dispensing"
                ? "조제자료"
                : "판매자료"}
            <input
              type="file"
              aria-label={
                key === "purchase"
                  ? "매입자료 (필수)"
                  : key === "dispensing"
                    ? "조제자료"
                    : "판매자료"
              }
              accept=".xls,.xlsx,.csv"
              disabled={!!progress || saving}
              onChange={(e) => {
                setFiles((p) => ({ ...p, [key]: e.target.files?.[0] }));
                setPreview(undefined);
              }}
            />
            <small>
              {key !== "purchase" && previous
                ? "선택하지 않으면 기존 목록 사용"
                : ""}
            </small>
          </label>
        ))}
        <label>
          자료 기준일
          <input
            type="date"
            value={asOf}
            max={todayKorea()}
            disabled={!!progress || saving}
            onChange={(e) => {
              setAsOf(e.target.value);
              setPreview(undefined);
              setFullYear(false);
            }}
          />
        </label>
      </div>
      <label className="order-check">
        <input
          type="checkbox"
          checked={fullYear}
          onChange={(e) => setFullYear(e.target.checked)}
        />
        {yearStart(asOf)}~{asOf} 전체 매입자료를 내보냈습니다.
      </label>
      {error && (
        <p role="alert" className="order-error">
          {error}
        </p>
      )}
      {progress && <p role="status">{progress}</p>}
      {preview && (
        <div className="order-import-summary">
          <h3>가져오기 미리보기</h3>
          <dl>
            <div>
              <dt>매입 기록</dt>
              <dd>{preview.stats.rows.toLocaleString()}행</dd>
            </div>
            <div>
              <dt>원본 상품명</dt>
              <dd>{preview.stats.names.toLocaleString()}개</dd>
            </div>
            <div>
              <dt>분류된 기록</dt>
              <dd>{preview.stats.matchedRows.toLocaleString()}행</dd>
            </div>
            <div>
              <dt>미분류·확인 필요</dt>
              <dd>
                {(
                  preview.stats.unclassifiedRows + preview.stats.reviewRows
                ).toLocaleString()}
                행 · 즉시 검색 가능
              </dd>
            </div>
          </dl>
          <p>
            반품 {preview.stats.returnRows.toLocaleString()}행과 기준일 이후{" "}
            {preview.stats.futureRows.toLocaleString()}행은 최근 입고에서
            제외합니다.
            {preview.stats.missingNames > 0 &&
              ` 상품명이 없는 ${preview.stats.missingNames}행은 검색에 포함하지 않습니다.`}
          </p>
        </div>
      )}
      <div className="order-actions">
        {preview ? (
          <button
            className="order-primary"
            disabled={saving || !fullYear}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(preview);
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "저장 중…" : "이 자료로 갱신"}
          </button>
        ) : (
          <button
            className="order-primary"
            disabled={!files.purchase || !!progress || !fullYear}
            onClick={analyze}
          >
            미리보기
          </button>
        )}
        <button className="order-secondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}
export function BookmarkImport({
  onSave,
  onClose,
}: {
  onSave: (f: BookmarkFolder[], b: Bookmark[]) => Promise<void>;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ReturnType<typeof parseBookmarks>>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="업무용 북마크 가져오기" onClose={onClose}>
      <p className="order-help">
        폴더와 링크를 확인해 약국 업무용만 선택해 주세요. 개인 링크는 선택하지
        않습니다.
      </p>
      <label>
        Chrome 북마크 HTML
        <input
          type="file"
          accept=".html,.htm"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 10 * 1024 * 1024)
                throw new Error("10MB 이하의 북마크 파일을 선택해 주세요.");
              const p = parseBookmarks(await f.text());
              setPreview(p);
              setSelected(new Set());
              setQuery("");
              setError("");
            } catch (err) {
              setPreview(undefined);
              setSelected(new Set());
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        />
      </label>
      {error && (
        <p role="alert" className="order-error">
          {error}
        </p>
      )}
      {preview && (
        <>
          <input
            aria-label="가져올 폴더·사이트 이름 검색"
            placeholder="폴더·사이트 이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p>
            {preview.links.length}개 웹사이트 · 폴더 {preview.folders.length}개
            · 중복 URL {preview.duplicates}개
            {preview.skipped > 0 &&
              ` · 웹사이트가 아닌 ${preview.skipped}개 제외`}
          </p>
          <button
            type="button"
            className="order-secondary"
            onClick={() =>
              setSelected(
                new Set([
                  ...selected,
                  ...matchingImportLinks(
                    preview.folders,
                    preview.links,
                    query,
                  ).map((b) => b.id),
                ]),
              )
            }
          >
            표시된 목록 선택
          </button>
          <button
            type="button"
            onClick={() =>
              setSelected(
                new Set(
                  [...selected].filter(
                    (id) =>
                      !matchingImportLinks(
                        preview.folders,
                        preview.links,
                        query,
                      ).some((b) => b.id === id),
                  ),
                ),
              )
            }
          >
            표시된 목록 선택 해제
          </button>
          <span className="order-inline-help">선택 {selected.size}개</span>
          <div className="order-bookmark-preview">
            {preview.folders.map((f) => {
              const ids = descendants(preview.folders, f.id);
              const links = matchingImportLinks(
                preview.folders,
                preview.links,
                query,
              ).filter((b) => ids.has(b.folderId));
              if (!links.length) return null;
              return (
                <details key={f.id}>
                  <summary>
                    <input
                      type="checkbox"
                      ref={(node) => {
                        if (node)
                          node.indeterminate =
                            links.some((b) => selected.has(b.id)) &&
                            !links.every((b) => selected.has(b.id));
                      }}
                      aria-label={`${f.name} 폴더 선택`}
                      checked={links.every((b) => selected.has(b.id))}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setSelected((s) => {
                          const n = new Set(s);
                          links.forEach((b) =>
                            e.target.checked ? n.add(b.id) : n.delete(b.id),
                          );
                          return n;
                        })
                      }
                    />
                    {f.name} <small>{links.length}개</small>
                  </summary>
                  {links.map((b) => (
                    <label
                      className="order-check order-preview-link"
                      key={b.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={(e) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            e.target.checked ? n.add(b.id) : n.delete(b.id);
                            return n;
                          })
                        }
                      />
                      <span>
                        {b.title}
                        <small>{new URL(b.url).hostname}</small>
                      </span>
                    </label>
                  ))}
                </details>
              );
            })}
          </div>
          <div className="order-actions">
            <button
              className="order-primary"
              disabled={!selected.size || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const tree = selectedBookmarkTree(
                    preview.folders,
                    preview.links,
                    selected,
                  );
                  await onSave(tree.folders, tree.links);
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "저장 중…" : `선택한 ${selected.size}개 가져오기`}
            </button>
            <button className="order-secondary" onClick={onClose}>
              닫기
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
