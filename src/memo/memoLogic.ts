import type { Memo, MemoInput } from "./memoTypes";

export function isEmptyMemo(memo: MemoInput): boolean {
  return !memo.title.trim() && !memo.body.trim() && memo.checklist.every(item => !item.text.trim());
}

export function memoText(memo: MemoInput): string {
  return [memo.title, memo.body, ...memo.checklist.map(item => item.text)].join(" ").toLocaleLowerCase();
}

export function matchesMemo(memo: MemoInput, query: string): boolean {
  return memoText(memo).includes(query.trim().toLocaleLowerCase());
}

export function searchGrams(memo: MemoInput): string[] {
  const text = memoText(memo);
  const grams = new Set<string>();
  for (let i = 0; i + 1 < text.length; i++) grams.add(text.slice(i, i + 2));
  return [...grams];
}

export function sortMemos(memos: Memo[]): Memo[] {
  return [...memos].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export function retainDirtyMemos(visible: Memo[], seen: Iterable<Memo>, isDirty: (id: string) => boolean): Memo[] {
  const shown = new Set(visible.map(note => note.id));
  return [...seen].filter(note => !shown.has(note.id) && isDirty(note.id));
}
