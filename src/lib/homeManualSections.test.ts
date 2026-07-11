import { describe, expect, it } from "vitest";
import { buildHomeSections } from "./homeSections";
import { normalizeManualImprove } from "./normalize";

describe("home manual improvement section", () => {
  it("shows every manual item regardless of status by latest input first", () => {
    const pending = normalizeManualImprove("pending", {
      title: "pending",
      status: "pending",
      createdAt: "2026-07-08T09:00:00+09:00",
      updatedAt: "2026-07-08T09:00:00+09:00"
    });
    const done = normalizeManualImprove("done", {
      title: "done",
      status: "done",
      createdAt: "2026-07-07T09:00:00+09:00",
      updatedAt: "2026-07-10T09:00:00+09:00"
    });
    const archived = normalizeManualImprove("archived", {
      title: "archived",
      status: "archived",
      createdAt: "2026-07-09T09:00:00+09:00",
      updatedAt: "2026-07-09T09:00:00+09:00"
    });
    const completedWithoutCreatedAt = normalizeManualImprove("completed-without-created", {
      title: "completed-without-created",
      status: "done",
      updatedAt: "2026-07-11T09:00:00+09:00"
    });

    const manualSection = buildHomeSections([pending, done, archived, completedWithoutCreatedAt], 10).find((section) => section.key === "manual");

    expect(manualSection?.total).toBe(4);
    expect(manualSection?.items.map((item) => item.title)).toEqual(["archived", "pending", "done", "completed-without-created"]);
  });

  it("uses alternate manual input date fields when createdAt is missing", () => {
    const requested = normalizeManualImprove("requested", {
      title: "requested",
      requestedAt: "2026-07-10T09:00:00+09:00"
    });
    const created = normalizeManualImprove("created", {
      title: "created",
      createdAt: "2026-07-09T09:00:00+09:00"
    });

    const manualSection = buildHomeSections([created, requested], 10).find((section) => section.key === "manual");

    expect(manualSection?.items.map((item) => item.title)).toEqual(["requested", "created"]);
  });
});
