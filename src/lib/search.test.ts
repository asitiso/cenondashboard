import { describe, expect, it, vi } from "vitest";
import { normalizeDrug, normalizeTopic } from "./normalize";
import { matchesItemSearch } from "./search";

describe("matchesItemSearch", () => {
  it("matches drug location even when location is not in the description", () => {
    const item = normalizeDrug("drug-1", {
      name: "박카스 디카페인",
      memo: "확인 필요",
      location: "냉장고",
      qty: "40매"
    }, "Q2");

    expect(matchesItemSearch(item, "냉장고")).toBe(true);
    expect(matchesItemSearch(item, "40매")).toBe(false);
  });

  it("matches visible status and priority labels", () => {
    const item = normalizeDrug("drug-1", {
      name: "케토톱",
      exp: "2026-09-11",
      pinned: true,
      status: "review"
    }, "Q2");

    expect(matchesItemSearch(item, "먼저")).toBe(true);
    expect(matchesItemSearch(item, "검토 대기")).toBe(true);
  });

  it("matches displayed remaining days and full expiry date", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));
    const item = normalizeDrug("drug-1", {
      name: "케토톱",
      exp: "2026-09-11"
    }, "Q2");

    expect(matchesItemSearch(item, "65일 남음")).toBe(true);
    expect(matchesItemSearch(item, "2026년 9월")).toBe(true);
    vi.useRealTimers();
  });

  it("keeps existing title and owner search behavior", () => {
    const item = normalizeTopic("topic-1", {
      title: "카드용지 주문",
      owner: "ChatGPT"
    });

    expect(matchesItemSearch(item, "카드용지")).toBe(true);
    expect(matchesItemSearch(item, "ChatGPT")).toBe(true);
  });
});
