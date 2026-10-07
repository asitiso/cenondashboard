import { describe, expect, it } from "vitest";
import { matchesMemo, searchGrams, sortMemos, isEmptyMemo, retainDirtyMemos } from "./memoLogic";
import type { Memo } from "./memoTypes";

const make = (overrides: Partial<Memo> = {}): Memo => ({
  id: "a", title: "", body: "", checklist: [], color: "yellow", pinned: false,
  revision: 0, createdAt: 1, updatedAt: 1, ...overrides
});

describe("memo behavior", () => {
  it("finds partial text in title, body and checklist", () => {
    const memo = make({ title: "백제 반품", body: "전화 확인", checklist: [{ id: "x", text: "재고 정리", done: false }] });
    expect(matchesMemo(memo, "반품")).toBe(true);
    expect(matchesMemo(memo, "확인")).toBe(true);
    expect(matchesMemo(memo, "정리")).toBe(true);
    expect(matchesMemo(memo, "없는말")).toBe(false);
    expect(searchGrams(memo)).toContain("반품");
  });

  it("sorts pinned first then recent edits", () => {
    expect(sortMemos([make({ id: "a", updatedAt: 9 }), make({ id: "b", pinned: true, updatedAt: 1 })]).map(m => m.id)).toEqual(["b", "a"]);
  });

  it("discards visually empty notes", () => {
    expect(isEmptyMemo(make({ checklist: [{ id: "x", text: " ", done: false }] }))).toBe(true);
    expect(isEmptyMemo(make({ body: "hello" }))).toBe(false);
  });

  it("keeps an unsaved card when search or paging hides it", () => {
    const seen = [make({ id: "dirty", body: "local edit" }), make({ id: "clean" })];
    expect(retainDirtyMemos([], seen, id => id === "dirty").map(note => note.id)).toEqual(["dirty"]);
    expect(retainDirtyMemos([seen[0]], seen, id => id === "dirty")).toEqual([]);
  });
});
