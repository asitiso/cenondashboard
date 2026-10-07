import {
  collection, doc, getDocFromServer, getDocs, limit, onSnapshot, orderBy, query, runTransaction,
  startAfter, where, type DocumentSnapshot, type QueryDocumentSnapshot
} from "firebase/firestore";
import { getFirebaseServices } from "../lib/firebase";
import { matchesMemo, searchGrams, sortMemos } from "./memoLogic";
import type { Memo, MemoInput } from "./memoTypes";

export class MemoConflictError extends Error {
  constructor() { super("다른 PC에서 먼저 수정했습니다. 내용을 확인한 뒤 다시 편집해 주세요."); }
}

function db() {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase 설정이 없어 메모를 사용할 수 없습니다.");
  return services.db;
}

function decode(snapshot: DocumentSnapshot): Memo {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    title: typeof data.title === "string" ? data.title : "",
    body: typeof data.body === "string" ? data.body : "",
    checklist: Array.isArray(data.checklist) ? data.checklist : [],
    color: data.color ?? "yellow",
    pinned: data.pinned === true,
    revision: Number(data.revision) || 0,
    createdAt: Number(data.createdAt) || 0,
    updatedAt: Number(data.updatedAt) || 0
  };
}

const ordered = () => query(collection(db(), "sticky_notes"), orderBy("pinned", "desc"), orderBy("updatedAt", "desc"));

export function subscribeTopMemos(onData: (notes: Memo[], last: QueryDocumentSnapshot | null) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(ordered(), limit(9)), snapshot => {
    onData(snapshot.docs.map(decode), snapshot.docs[snapshot.docs.length - 1] ?? null);
  }, onError);
}

export async function fetchMoreMemos(after: QueryDocumentSnapshot): Promise<{ notes: Memo[]; last: QueryDocumentSnapshot | null }> {
  const snapshot = await getDocs(query(ordered(), startAfter(after), limit(20)));
  return { notes: snapshot.docs.map(decode), last: snapshot.docs[snapshot.docs.length - 1] ?? null };
}

export async function fetchMemoSearchPage(term: string, after: QueryDocumentSnapshot | null, isActive: () => boolean = () => true): Promise<{ notes: Memo[]; last: QueryDocumentSnapshot | null; more: boolean }> {
  const normalized = term.trim().toLocaleLowerCase();
  if (normalized.length < 2) return { notes: [], last: null, more: false };
  const found: Memo[] = [];
  let cursor = after;
  let more = false;
  while (found.length < 20) {
    if (!isActive()) return { notes: [], last: cursor, more: false };
    const base = query(collection(db(), "sticky_notes"), where("searchGrams", "array-contains", normalized.slice(0, 2)), orderBy("pinned", "desc"), orderBy("updatedAt", "desc"), limit(40));
    const snapshot = await getDocs(cursor ? query(base, startAfter(cursor)) : base);
    if (!isActive()) return { notes: [], last: cursor, more: false };
    for (const item of snapshot.docs) {
      cursor = item;
      const memo = decode(item);
      if (matchesMemo(memo, normalized)) found.push(memo);
      if (found.length === 20) break;
    }
    more = snapshot.size === 40 || (found.length === 20 && snapshot.docs[snapshot.docs.length - 1]?.id !== cursor?.id);
    if (found.length === 20 || snapshot.size < 40) break;
  }
  return { notes: sortMemos(found), last: cursor, more };
}

export async function createMemo(input: MemoInput): Promise<Memo> {
  const ref = doc(collection(db(), "sticky_notes"));
  const now = Date.now();
  const memo: Memo = { ...input, id: ref.id, revision: 1, createdAt: now, updatedAt: now };
  await runTransaction(db(), async tx => {
    if ((await tx.get(ref)).exists()) throw new MemoConflictError();
    tx.set(ref, { ...input, revision: 1, createdAt: now, updatedAt: now, searchGrams: searchGrams(input) });
  });
  return memo;
}

export async function saveMemo(memo: Memo): Promise<Memo> {
  const ref = doc(db(), "sticky_notes", memo.id);
  const now = Date.now();
  await runTransaction(db(), async tx => {
    const current = await tx.get(ref);
    if (!current.exists() || current.data().revision !== memo.revision) throw new MemoConflictError();
    tx.update(ref, {
      title: memo.title, body: memo.body, checklist: memo.checklist, color: memo.color,
      pinned: memo.pinned, revision: memo.revision + 1, updatedAt: now, searchGrams: searchGrams(memo)
    });
  });
  return { ...memo, revision: memo.revision + 1, updatedAt: now };
}

export async function deleteMemo(memo: Memo): Promise<void> {
  const ref = doc(db(), "sticky_notes", memo.id);
  await runTransaction(db(), async tx => {
    const current = await tx.get(ref);
    if (!current.exists() || current.data().revision !== memo.revision) throw new MemoConflictError();
    tx.delete(ref);
  });
}

export async function fetchMemo(id: string): Promise<Memo | null> {
  const snapshot = await getDocFromServer(doc(db(), "sticky_notes", id));
  return snapshot.exists() ? decode(snapshot) : null;
}
