import { describe, expect, it, vi } from "vitest";
import type { Memo } from "./memoTypes";

const state = vi.hoisted(() => ({ revision: 1, writes: [] as Record<string, unknown>[] }));
vi.mock("../lib/firebase", () => ({ getFirebaseServices: () => ({ db: {} }) }));
vi.mock("firebase/firestore", () => ({
  doc: () => ({ id: "memo-1" }),
  runTransaction: async (_db: unknown, work: (tx: unknown) => Promise<unknown>) => work({
    get: async () => ({ exists: () => true, data: () => ({ revision: state.revision }) }),
    update: (_ref: unknown, data: Record<string, unknown>) => state.writes.push(data),
    delete: () => state.writes.push({ deleted: true })
  })
}));

import { MemoConflictError, saveMemo } from "./memoRepository";

const note: Memo = { id: "memo-1", title: "제목", body: "본문", checklist: [], color: "yellow", pinned: false, revision: 1, createdAt: 1, updatedAt: 1 };

describe("memo revision guard", () => {
  it("rejects a stale edit without writing", async () => {
    state.revision = 2;
    state.writes.length = 0;
    await expect(saveMemo(note)).rejects.toBeInstanceOf(MemoConflictError);
    expect(state.writes).toHaveLength(0);
  });

  it("advances a matching revision in the same transaction", async () => {
    state.revision = 1;
    state.writes.length = 0;
    const saved = await saveMemo(note);
    expect(saved.revision).toBe(2);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].revision).toBe(2);
    expect(state.writes[0].searchGrams).toContain("제목");
  });
});
