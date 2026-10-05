import { describe, expect, it, vi } from "vitest";
import { getDenseRowMeta, getDenseRowTimeLabel } from "./display";
import { normalizeDrug } from "./normalize";

describe("home drug dense display", () => {
  it("shows expiry date and remaining days instead of operational details", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));
    const item = normalizeDrug("drug-1", {
      name: "Drug A",
      exp: "2026-09-06",
      loc: "K1",
      qty: "3"
    }, "Q1");

    expect(getDenseRowMeta(item)).toBe("26년9월6일");
    expect(getDenseRowMeta(item)).not.toContain("K1");
    expect(getDenseRowTimeLabel(item)).toContain("60");
    vi.useRealTimers();
  });
});
