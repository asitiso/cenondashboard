import { describe, expect, it, vi } from "vitest";
import { normalizeDrug } from "./normalize";
import { getDrugStatusLabel } from "./drugStatus";

describe("drug status labels", () => {
  it("uses 180 and 360 day thresholds for prescription drugs", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));

    expect(getDrugStatusLabel(normalizeDrug("urgent", { name: "긴급", exp: "2027-01-04" }, "Q1"))).toBe("긴급");
    expect(getDrugStatusLabel(normalizeDrug("caution", { name: "주의", exp: "2027-01-05" }, "Q1"))).toBe("주의");
    expect(getDrugStatusLabel(normalizeDrug("good", { name: "양호", exp: "2027-07-04" }, "Q1"))).toBe("양호");

    vi.useRealTimers();
  });

  it("uses 210 and 420 day thresholds for otc drugs", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));

    expect(getDrugStatusLabel(normalizeDrug("urgent", { name: "긴급", exp: "2027-02-03" }, "Q2"))).toBe("긴급");
    expect(getDrugStatusLabel(normalizeDrug("caution", { name: "주의", exp: "2027-02-04" }, "Q2"))).toBe("주의");
    expect(getDrugStatusLabel(normalizeDrug("good", { name: "양호", exp: "2027-09-02" }, "Q2"))).toBe("양호");

    vi.useRealTimers();
  });
});
