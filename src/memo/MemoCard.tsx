import { useEffect, useRef, useState } from "react";
import { Pin, Trash2, Plus, X } from "lucide-react";
import { createMemo, deleteMemo, fetchMemo, MemoConflictError, saveMemo } from "./memoRepository";
import { isEmptyMemo } from "./memoLogic";
import type { Memo, MemoCheckItem, MemoColor, MemoInput } from "./memoTypes";

const colors: MemoColor[] = ["yellow", "blue", "green", "pink", "purple", "gray"];
const blank: MemoInput = { title: "", body: "", checklist: [], color: "yellow", pinned: false };

export function MemoCard({ note, active, editable, resumeEpoch, isForeground, onSaved, onRemoved, onSaveError, registerFlush }: {
  note?: Memo;
  active: boolean;
  editable: boolean;
  resumeEpoch: number;
  isForeground: () => boolean;
  onSaved: (note: Memo) => void;
  onRemoved: (id: string) => void;
  onSaveError: (message: string) => void;
  registerFlush: (key: string, flush: () => Promise<void>, canDiscard: () => boolean, isDirty: () => boolean) => () => void;
}) {
  const key = note?.id ?? "new";
  const [draft, setDraft] = useState<MemoInput>(note ?? blank);
  const [status, setStatus] = useState("");
  const [conflictView, setConflictView] = useState<"mine" | "latest" | null>(null);
  const [latest, setLatest] = useState<Memo | null>(null);
  const statusRef = useRef("");
  const draftRef = useRef(draft);
  const noteRef = useRef(note);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const blocked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    if (version.current !== savedVersion.current || !note) return;
    if (noteRef.current && note.revision < noteRef.current.revision) return;
    draftRef.current = note;
    noteRef.current = note;
    setDraft(note);
  }, [note]);

  useEffect(() => {
    if (!active) return;
    setStatus(statusRef.current);
    if (statusRef.current.includes("저장되지") || blocked.current) onSaveError(statusRef.current);
    if (!note && noteRef.current && savedVersion.current > 0) onSaved(noteRef.current);
  // This runs only when returning to the memo screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, resumeEpoch]);

  function reportStatus(value: string) {
    statusRef.current = value;
    if (mounted.current && isForeground()) setStatus(value);
  }

  async function flush(): Promise<void> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current) { await pending.current; return; }
    if (blocked.current || version.current === savedVersion.current) return;
    if (!navigator.onLine) { reportStatus("오프라인으로 저장되지 않았습니다."); if (isForeground()) onSaveError("오프라인으로 저장되지 않은 메모가 있습니다."); return; }
    const job = (async () => {
      let latestSaved: Memo | undefined;
      while (version.current !== savedVersion.current && !blocked.current) {
        const currentVersion = version.current;
        const current = draftRef.current;
        if (isEmptyMemo(current)) {
          if (!noteRef.current) { savedVersion.current = currentVersion; reportStatus(""); return; }
          // Existing content is never deleted by clearing fields. Use the delete button.
        }
        try {
          reportStatus("저장 중");
          const saved = noteRef.current ? await saveMemo({ ...noteRef.current, ...current }) : await createMemo(current);
          noteRef.current = saved;
          savedVersion.current = currentVersion;
          latestSaved = saved;
          reportStatus("저장됨");
        } catch (error) {
          blocked.current = error instanceof MemoConflictError;
          const message = error instanceof Error ? error.message : "저장에 실패했습니다. 내용을 복사한 뒤 다시 시도해 주세요.";
          reportStatus(message);
          if (isForeground()) onSaveError(message);
          return;
        }
      }
      if (latestSaved && isForeground()) onSaved(latestSaved);
    })();
    pending.current = job;
    try { await job; } finally { pending.current = null; }
  }

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => registerFlush(key, () => flushRef.current(), () => Boolean(noteRef.current) || isEmptyMemo(draftRef.current), () => version.current !== savedVersion.current), [key, registerFlush]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      // Search/paging can remove a card. Keep its unsaved edit alive asynchronously.
      if (version.current !== savedVersion.current) void flushRef.current();
    };
  }, []);

  function change(next: MemoInput) {
    if (!active || !editable || blocked.current) return;
    draftRef.current = next;
    setDraft(next);
    version.current += 1;
    reportStatus("저장 대기");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (isForeground()) void flushRef.current(); }, 650);
  }

  async function remove() {
    if (!editable || !window.confirm("이 메모를 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.")) return;
    if (timer.current) clearTimeout(timer.current);
    if (pending.current) await pending.current;
    const current = noteRef.current;
    if (current) {
      try { await deleteMemo(current); }
      catch (error) { reportStatus(error instanceof Error ? error.message : "삭제하지 못했습니다."); return; }
    }
    onRemoved(key);
  }

  async function showLatest() {
    const current = noteRef.current;
    if (!current) return;
    try { setLatest(await fetchMemo(current.id)); setConflictView("latest"); }
    catch (error) { reportStatus(error instanceof Error ? error.message : "최신 메모를 가져오지 못했습니다."); }
  }

  function useLatest() {
    if (!latest || !window.confirm("현재 PC에서 작성한 내용은 사라집니다. 최신 메모로 바꿀까요?")) return;
    noteRef.current = latest;
    draftRef.current = latest;
    version.current = 0;
    savedVersion.current = 0;
    blocked.current = false;
    setDraft(latest);
    setConflictView(null);
    reportStatus("최신 메모를 불러왔습니다.");
  }

  const disabled = !active || !editable || blocked.current;
  return <article className={`memo-card memo-${draft.color}`}>
    <div className="memo-card-top">
      <button type="button" className={draft.pinned ? "selected" : ""} onClick={() => change({ ...draft, pinned: !draft.pinned })} disabled={disabled} aria-label={draft.pinned ? "고정 해제" : "고정"}><Pin size={17} /></button>
      <div className="memo-colors" aria-label="메모 색상">{colors.map(color => <button key={color} type="button" className={`memo-swatch ${color} ${draft.color === color ? "selected" : ""}`} onClick={() => change({ ...draft, color })} disabled={disabled} aria-label={`${color} 색상`} />)}</div>
      <button type="button" onClick={() => void remove()} disabled={disabled} aria-label="메모 삭제"><Trash2 size={17} /></button>
    </div>
    <div className="memo-card-scroll">
      <input className="memo-title" value={draft.title} onChange={event => change({ ...draft, title: event.target.value })} placeholder="제목 (선택)" disabled={disabled} maxLength={120} aria-label="메모 제목" />
      <textarea value={draft.body} onChange={event => change({ ...draft, body: event.target.value })} placeholder="메모 내용" disabled={disabled} maxLength={10000} aria-label="메모 내용" />
      <div className="memo-checklist">
        {draft.checklist.map((item: MemoCheckItem) => <div className="memo-check-row" key={item.id}>
          <input type="checkbox" checked={item.done} disabled={disabled} onChange={event => change({ ...draft, checklist: draft.checklist.map(row => row.id === item.id ? { ...row, done: event.target.checked } : row) })} aria-label="항목 완료" />
          <input value={item.text} disabled={disabled} maxLength={300} placeholder="체크 항목" onChange={event => change({ ...draft, checklist: draft.checklist.map(row => row.id === item.id ? { ...row, text: event.target.value } : row) })} aria-label="체크 항목" />
          <button type="button" disabled={disabled} onClick={() => change({ ...draft, checklist: draft.checklist.filter(row => row.id !== item.id) })} aria-label="항목 제거"><X size={14} /></button>
        </div>)}
        <button type="button" className="memo-add-check" disabled={disabled} onClick={() => change({ ...draft, checklist: [...draft.checklist, { id: crypto.randomUUID(), text: "", done: false }] })}><Plus size={14} /> 체크 항목</button>
      </div>
    </div>
    <div className="memo-card-status" role="status">{status}</div>
    {blocked.current && active && <div className="memo-conflict-actions"><button type="button" onClick={() => void showLatest()}>최신 메모 보기</button><button type="button" onClick={() => setConflictView("mine")}>내가 작성한 내용 확인</button></div>}
    {conflictView && <div className="memo-conflict-dialog" role="dialog" aria-label={conflictView === "mine" ? "내가 작성한 내용" : "최신 메모"}>
      <strong>{conflictView === "mine" ? "내가 작성한 내용" : "최신 메모"}</strong>
      <pre>{conflictView === "mine" ? [draft.title, draft.body, ...draft.checklist.map(item => `${item.done ? "☑" : "☐"} ${item.text}`)].join("\n") : latest ? [latest.title, latest.body, ...latest.checklist.map(item => `${item.done ? "☑" : "☐"} ${item.text}`)].join("\n") : "서버에서 삭제된 메모입니다."}</pre>
      {conflictView === "latest" && latest && <button type="button" onClick={useLatest}>최신 메모로 바꾸기</button>}
      <button type="button" onClick={() => setConflictView(null)}>닫기</button>
    </div>}
  </article>;
}
