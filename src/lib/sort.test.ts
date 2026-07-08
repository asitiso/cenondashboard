import { describe, expect, it } from "vitest";
import { normalizeDrug, normalizeTopic } from "./normalize";
import { sortChangesLatestFirst, sortForAction } from "./sort";

describe("sortForAction", () => {
  it("sorts drug lists by priority first, then earliest expiry", () => {
    const regularSoon = normalizeDrug("regular-soon", {
      name: "일반 빠름",
      exp: "2026-08-01"
    }, "Q2");
    const priorityLater = normalizeDrug("priority-later", {
      name: "먼저 늦음",
      exp: "2026-12-01",
      pinned: true
    }, "Q2");
    const prioritySoon = normalizeDrug("priority-soon", {
      name: "먼저 빠름",
      exp: "2026-09-01",
      pinned: true
    }, "Q2");

    const sorted = sortForAction([regularSoon, priorityLater, prioritySoon]);

    expect(sorted.map((item) => item.title)).toEqual(["먼저 빠름", "먼저 늦음", "일반 빠름"]);
  });
});

describe("sortChangesLatestFirst", () => {
  it("sorts change items by latest update first", () => {
    const older = normalizeTopic("older", {
      title: "older",
      updatedAt: "2026-07-01T09:00:00+09:00"
    });
    const newer = normalizeTopic("newer", {
      title: "newer",
      updatedAt: "2026-07-08T09:00:00+09:00"
    });
    const createdOnly = normalizeTopic("created", {
      title: "created",
      createdAt: "2026-07-05T09:00:00+09:00"
    });

    const sorted = sortChangesLatestFirst([older, newer, createdOnly]);

    expect(sorted.map((item) => item.title)).toEqual(["newer", "created", "older"]);
  });
});
