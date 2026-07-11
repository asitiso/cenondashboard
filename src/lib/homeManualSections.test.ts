import { describe, expect, it } from "vitest";
import { buildHomeSections } from "./homeSections";
import { normalizeManualImprove } from "./normalize";

describe("home manual improvement section", () => {
  it("shows every manual item regardless of status by latest update first", () => {
    const pending = normalizeManualImprove("pending", {
      title: "pending",
      status: "검토중",
      updatedAt: "2026-07-08T09:00:00+09:00"
    });
    const done = normalizeManualImprove("done", {
      title: "done",
      status: "반영완료",
      updatedAt: "2026-07-10T09:00:00+09:00"
    });
    const archived = normalizeManualImprove("archived", {
      title: "archived",
      status: "보류",
      updatedAt: "2026-07-09T09:00:00+09:00"
    });

    const manualSection = buildHomeSections([pending, done, archived], 10).find((section) => section.key === "manual");

    expect(manualSection?.total).toBe(3);
    expect(manualSection?.items.map((item) => item.title)).toEqual(["done", "archived", "pending"]);
  });
});
