import { describe, expect, it } from "vitest";
import { normalizeDrug } from "./normalize";
import { sortForAction } from "./sort";

describe("sortForAction", () => {
  it("sorts drug lists by priority first, then earliest expiry", () => {
    const regularSoon = normalizeDrug("regular-soon", {
      name: "일반 빠름",
      exp: "2026-08-01"
    }, "Q2");
    const priorityLater = normalizeDrug("priority-later", {
      name: "우선 늦음",
      exp: "2026-12-01",
      pinned: true
    }, "Q2");
    const prioritySoon = normalizeDrug("priority-soon", {
      name: "우선 빠름",
      exp: "2026-09-01",
      pinned: true
    }, "Q2");

    const sorted = sortForAction([regularSoon, priorityLater, prioritySoon]);

    expect(sorted.map((item) => item.title)).toEqual(["우선 빠름", "우선 늦음", "일반 빠름"]);
  });
});
