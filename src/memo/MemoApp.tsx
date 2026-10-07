import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { getFirebaseServices } from "../lib/firebase";
import { retainDirtyMemos, sortMemos } from "./memoLogic";
import { freezeMemoActivity } from "./memoActivity";
import { fetchMemoSearchPage, fetchMoreMemos, subscribeTopMemos } from "./memoRepository";
import { MemoCard } from "./MemoCard";
import type { Memo } from "./memoTypes";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import "./memo.css";

export default function MemoApp({ active, registerFreeze, firstScreenAction }: {
  active: boolean;
  registerFreeze: (freeze: (() => void) | null) => void;
  firstScreenAction: React.ReactNode;
}) {
  const [notes, setNotes] = useState<Memo[]>([]);
  const [extra, setExtra] = useState<Memo[]>([]);
  const [creating, setCreating] = useState(false);
  const [resumeEpoch, setResumeEpoch] = useState(0);
  const [queryText, setQueryText] = useState("");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [moreList, setMoreList] = useState(false);
  const [moreSearch, setMoreSearch] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const activeRef = useRef(active);
  const unsub = useRef<(() => void) | null>(null);
  const topCursor = useRef<QueryDocumentSnapshot | null>(null);
  const listCursor = useRef<QueryDocumentSnapshot | null>(null);
  const searchCursor = useRef<QueryDocumentSnapshot | null>(null);
  const generation = useRef(0);
  const flushers = useRef(new Map<string, () => Promise<void>>());
  const discardable = useRef(new Map<string, () => boolean>());
  const dirtyChecks = useRef(new Map<string, () => boolean>());
  const seenNotes = useRef(new Map<string, Memo>());
  const wasFrozen = useRef(false);
  const frozenTree = useRef<React.ReactElement | null>(null);

  const registerFlush = useCallback((key: string, flush: () => Promise<void>, canDiscard: () => boolean, isDirty: () => boolean) => {
    flushers.current.set(key, flush);
    discardable.current.set(key, canDiscard);
    dirtyChecks.current.set(key, isDirty);
    return () => { flushers.current.delete(key); discardable.current.delete(key); dirtyChecks.current.delete(key); };
  }, []);

  const freeze = useCallback(() => {
    wasFrozen.current = true;
    freezeMemoActivity(activeRef, generation, work => {
      let finished = false;
      const once = () => { if (!finished) { finished = true; work(); } };
      if (document.visibilityState === "visible") requestAnimationFrame(() => setTimeout(once, 0));
      setTimeout(once, document.visibilityState === "visible" ? 1000 : 0);
    }, () => {
      unsub.current?.();
      unsub.current = null;
      for (const flush of flushers.current.values()) void flush();
    });
  }, []);

  useEffect(() => { registerFreeze(freeze); return () => registerFreeze(null); }, [freeze, registerFreeze]);
  useEffect(() => {
    if (!active) { freeze(); return; }
    activeRef.current = true;
    setOnline(navigator.onLine);
    if (navigator.onLine) for (const flush of flushers.current.values()) void flush();
    if (wasFrozen.current) {
      if (discardable.current.get("new")?.()) setCreating(false);
      setResumeEpoch(previous => previous + 1);
    }
    wasFrozen.current = false;
    if (!getFirebaseServices()) return;
    unsub.current?.();
    unsub.current = subscribeTopMemos((next, last) => {
      if (!activeRef.current) return;
      for (const note of next) seenNotes.current.set(note.id, note);
      topCursor.current = last;
      setNotes(next);
      setMoreList(next.length === 9);
    }, err => { if (activeRef.current) setError(err.message); });
    return () => { /* freeze performs cleanup after the next paint */ };
  }, [active, freeze]);

  useEffect(() => {
    const update = () => {
      if (!activeRef.current) return;
      setOnline(navigator.onLine);
      if (navigator.onLine) for (const flush of flushers.current.values()) void flush();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); unsub.current?.(); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const trimmed = queryText.trim();
    if (trimmed.length < 2) { setTerm(""); setResults([]); setMoreSearch(false); return; }
    const timer = setTimeout(() => setTerm(trimmed), 300);
    return () => clearTimeout(timer);
  }, [queryText, active]);

  useEffect(() => {
    if (!active || term.length < 2) return;
    const id = ++generation.current;
    searchCursor.current = null;
    setLoading(true);
    setResults([]);
    fetchMemoSearchPage(term, null, () => activeRef.current && id === generation.current).then(page => {
      if (id !== generation.current || !activeRef.current) return;
      for (const note of page.notes) seenNotes.current.set(note.id, note);
      setResults(page.notes);
      searchCursor.current = page.last;
      setMoreSearch(page.more);
      setError("");
    }).catch(err => { if (id === generation.current && activeRef.current) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (id === generation.current && activeRef.current) setLoading(false); });
  }, [term, active]);

  async function loadMore() {
    if (!activeRef.current) return;
    const cursor = listCursor.current ?? topCursor.current;
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await fetchMoreMemos(cursor);
      if (!activeRef.current) return;
      for (const note of page.notes) seenNotes.current.set(note.id, note);
      listCursor.current = page.last;
      setExtra(previous => [...previous, ...page.notes]);
      setMoreList(page.notes.length === 20);
    } catch (err) { if (activeRef.current) setError(err instanceof Error ? err.message : String(err)); }
    finally { if (activeRef.current) setLoading(false); }
  }

  async function loadMoreSearch() {
    if (!activeRef.current || !searchCursor.current) return;
    const id = generation.current;
    setLoading(true);
    try {
      const page = await fetchMemoSearchPage(term, searchCursor.current, () => activeRef.current && id === generation.current);
      if (id !== generation.current || !activeRef.current) return;
      for (const note of page.notes) seenNotes.current.set(note.id, note);
      searchCursor.current = page.last;
      setResults(previous => [...previous, ...page.notes]);
      setMoreSearch(page.more);
    } catch (err) { if (id === generation.current && activeRef.current) setError(err instanceof Error ? err.message : String(err)); }
    finally { if (id === generation.current && activeRef.current) setLoading(false); }
  }

  function saved(note: Memo) {
    if (!activeRef.current) return;
    seenNotes.current.set(note.id, note);
    setCreating(false);
    setNotes(previous => sortMemos([note, ...previous.filter(item => item.id !== note.id)]).slice(0, 9));
    setExtra(previous => previous.map(item => item.id === note.id ? note : item));
    setResults(previous => previous.map(item => item.id === note.id ? note : item));
  }

  function removed(id: string) {
    if (id === "new") { setCreating(false); return; }
    seenNotes.current.delete(id);
    setNotes(previous => previous.filter(item => item.id !== id));
    setExtra(previous => previous.filter(item => item.id !== id));
    setResults(previous => previous.filter(item => item.id !== id));
  }

  if (!active && frozenTree.current) return frozenTree.current;

  const configured = Boolean(getFirebaseServices());
  const editable = online && configured;
  const visible = term.length >= 2 ? results : sortMemos([...notes, ...(expanded ? extra : [])].filter((note, index, all) => all.findIndex(item => item.id === note.id) === index));
  const retained = retainDirtyMemos(visible, seenNotes.current.values(), id => Boolean(dirtyChecks.current.get(id)?.()));
  const mountedNotes = [...visible, ...retained];

  const content = <section className="memo-app" aria-label="메모">
    <div className="memo-header"><div><p className="eyebrow">전 직원 공용</p><h1>메모</h1></div><div className="memo-header-actions">{firstScreenAction}<button type="button" className="view-action-button" onClick={() => setCreating(true)} disabled={!editable || creating}><Plus size={16} /> 새 메모</button></div></div>
    {!online && <p className="memo-warning">오프라인에서는 메모를 편집할 수 없습니다.</p>}
    {!configured && <p className="memo-warning">Firebase 설정이 없어 메모를 사용할 수 없습니다.</p>}
    {error && <p className="memo-warning" role="alert">{error}</p>}
    <label className="memo-search"><Search size={17} /><input value={queryText} onChange={event => { generation.current += 1; setQueryText(event.target.value); }} placeholder="메모 검색 (2글자 이상)" aria-label="메모 검색" /></label>
    {queryText.trim().length === 1 && <p className="memo-hint">2글자 이상 입력해 주세요.</p>}
    {retained.length > 0 && <p className="memo-hint">저장되지 않은 메모는 검색 조건과 관계없이 계속 표시됩니다.</p>}
    <div className="memo-grid">
      {creating && <MemoCard key="new" active={active} editable={editable} resumeEpoch={resumeEpoch} isForeground={() => activeRef.current} onSaved={saved} onRemoved={removed} onSaveError={setError} registerFlush={registerFlush} />}
      {mountedNotes.map(note => <div key={note.id}><MemoCard note={note} active={active} editable={editable} resumeEpoch={resumeEpoch} isForeground={() => activeRef.current} onSaved={saved} onRemoved={removed} onSaveError={setError} registerFlush={registerFlush} /></div>)}
    </div>
    {!loading && visible.length === 0 && !creating && <p className="memo-hint">{term ? "검색 결과가 없습니다." : "메모가 없습니다. 새 메모를 추가해 주세요."}</p>}
    {loading && <p className="memo-hint">불러오는 중…</p>}
    {term ? (moreSearch && <button type="button" className="memo-more" onClick={() => void loadMoreSearch()} disabled={loading}>검색 결과 더보기</button>) : <div className="memo-footer">{expanded ? <button type="button" className="memo-more" onClick={() => { setExpanded(false); setExtra([]); listCursor.current = null; }}>접기</button> : moreList && <button type="button" className="memo-more" onClick={() => { setExpanded(true); void loadMore(); }} disabled={loading}>더보기</button>}{expanded && moreList && <button type="button" className="memo-more" onClick={() => void loadMore()} disabled={loading}>더보기</button>}</div>}
  </section>;
  frozenTree.current = content;
  return content;
}
