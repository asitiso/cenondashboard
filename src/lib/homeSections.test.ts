import { describe, expect, it } from "vitest";
import { normalizeDrug, normalizeManualImprove, normalizeTopic } from "./normalize";
import { buildHomeSections } from "./homeSections";

describe("buildHomeSections", () => {
  it("returns dense home sections in the requested work order", () => {
    const items = [
      normalizeManualImprove("manual-1", { title: "매뉴얼 개선", status: "pending" }),
      normalizeDrug("drug-1", { name: "일반약", expiryDate: "2026-07-08" }, "Q2"),
      normalizeTopic("topic-1", { title: "변경사항", status: "open" })
    ];

    const sections = buildHomeSections(items);

    expect(sections.map((section) => section.key)).toEqual(["changes", "drugs", "manual"]);
    expect(sections[0].items[0].title).toBe("변경사항");
    expect(sections[1].items[0].title).toBe("일반약");
    expect(sections[2].items[0].title).toBe("매뉴얼 개선");
  });

  it("limits each section so the home screen stays scannable", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      normalizeTopic(`topic-${index}`, { title: `변경 ${index}`, status: "open" })
    );

    const sections = buildHomeSections(items, 5);

    expect(sections[0].items).toHaveLength(5);
    expect(sections[0].total).toBe(8);
  });

  it("shows change items by latest update first on the home dashboard", () => {
    const older = normalizeTopic("older", {
      title: "older",
      updatedAt: "2026-07-01T09:00:00+09:00"
    });
    const newer = normalizeTopic("newer", {
      title: "newer",
      updatedAt: "2026-07-08T09:00:00+09:00"
    });

    const sections = buildHomeSections([older, newer]);

    expect(sections[0].items.map((item) => item.title)).toEqual(["newer", "older"]);
  });

  it("puts priority drug items before other drug items", () => {
    const normal = normalizeDrug("normal", { name: "일반", exp: "2026-07-08" }, "Q2");
    const priority = normalizeDrug("priority", { name: "먼저", exp: "2027-08-20", pinned: true }, "Q2");

    const sections = buildHomeSections([normal, priority]);

    expect(sections[1].items.map((item) => item.title)).toEqual(["먼저", "일반"]);
  });

  it("filters the home drug section by selected category", () => {
    const prescription = normalizeDrug("rx", { name: "RX", exp: "2026-07-08" }, "Q1");
    const otc = normalizeDrug("otc", { name: "OTC", exp: "2026-07-08" }, "Q2");

    const prescriptionOnly = buildHomeSections([prescription, otc], 6, "prescription");
    const otcOnly = buildHomeSections([prescription, otc], 6, "otc");
    const all = buildHomeSections([prescription, otc], 6, "all");

    expect(prescriptionOnly[1].items.map((item) => item.title)).toEqual(["RX"]);
    expect(prescriptionOnly[1].total).toBe(1);
    expect(otcOnly[1].items.map((item) => item.title)).toEqual(["OTC"]);
    expect(otcOnly[1].total).toBe(1);
    expect(all[1].total).toBe(2);
  });
});
