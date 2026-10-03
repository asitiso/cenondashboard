import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  normalizeName,
  getPrice,
  searchProducts,
  topBookmarks,
  pinBookmark,
} from "./core";

const rows = [
  {
    date: "2026-09-29",
    name: "박카스디액100ml",
    manufacturer: "동아제약",
    supplier: "동아",
    unitPrice: 5610,
    quantity: 500,
    amount: 280500,
    sourceRow: 2,
  },
  {
    date: "2026-09-15",
    name: "박카스디액100ml",
    manufacturer: "동아제약",
    supplier: "동아",
    unitPrice: 561,
    quantity: 600,
    amount: 336600,
    sourceRow: 3,
  },
  {
    date: "2026-10-02",
    name: "박카스디액100ml",
    manufacturer: "동아제약",
    supplier: "동아",
    unitPrice: 561,
    quantity: -10,
    amount: -5610,
    sourceRow: 4,
  },
  {
    date: "2026-12-31",
    name: "박카스디액100ml",
    manufacturer: "동아제약",
    supplier: "동아",
    unitPrice: 561,
    quantity: 10,
    amount: 5610,
    sourceRow: 5,
  },
  {
    date: "2025-10-02",
    name: "박카스디액100ml",
    manufacturer: "동아제약",
    supplier: "동아",
    unitPrice: 561,
    quantity: 10,
    amount: 5610,
    sourceRow: 6,
  },
  {
    date: "2026-09-20",
    name: "투약병20cc",
    manufacturer: "",
    supplier: "도우",
    unitPrice: 50,
    quantity: 500,
    amount: 25000,
    sourceRow: 7,
  },
];
const catalogs = [
  {
    code: "123",
    name: "박카스디액100ml",
    manufacturer: "동아제약",
    usage: "dispensing" as const,
  },
  {
    code: "123",
    name: "박카스디액100ml",
    manufacturer: "동아제약",
    usage: "retail" as const,
  },
];

describe("PMIT import contracts", () => {
  it("keeps all other fixed positions when replacing a full slot and rejects a stale replacement", () => {
    const links = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      title: `P${i}`,
      url: `https://p${i}.test/`,
      folderId: "f",
      category: "기타",
      memo: "",
      rank: i,
    }));
    const all = [
      ...links,
      {
        id: "new",
        title: "New",
        url: "https://new.test/",
        folderId: "f",
        category: "기타",
        memo: "",
      },
    ];
    expect(() => pinBookmark(all, "new")).toThrow();
    const next = pinBookmark(all, "new", "p4");
    expect(next.find((b) => b.id === "new")?.rank).toBe(4);
    expect(next.find((b) => b.id === "p5")?.rank).toBe(5);
    expect(next.filter((b) => b.rank !== undefined)).toHaveLength(10);
    expect(() => pinBookmark(next, "p4", "p4")).toThrow();
  });
  it("transfers a duplicate site to the existing fixed position instead of wasting a second slot", () => {
    const links = [
      {
        id: "a",
        title: "A",
        url: "https://a.test/",
        folderId: "f",
        category: "기타",
        memo: "",
        rank: 3,
      },
      {
        id: "b",
        title: "B",
        url: "https://a.test/",
        folderId: "f",
        category: "기타",
        memo: "",
      },
    ];
    const next = pinBookmark(links, "b");
    expect(
      next.filter((b) => b.rank !== undefined).map((b) => [b.id, b.rank]),
    ).toEqual([["b", 3]]);
  });
  it("keeps decimal strength and variant identity", () => {
    expect(normalizeName("알프람정0.25밀리그램")).toBe(
      normalizeName("알프람정0.25mg"),
    );
    expect(normalizeName("알프람정0.25mg")).not.toBe(
      normalizeName("알프람정025mg"),
    );
    expect(normalizeName("크림(흑색)")).not.toBe(normalizeName("크림(갈색)"));
  });
  it("retains unclassified supplies and displays dual usage without doubling source rows", () => {
    const s = buildSnapshot(rows, catalogs, "2026-10-03");
    expect(s.stats.rows).toBe(6);
    expect(s.products.filter((p) => p.name === "박카스디액100ml")).toHaveLength(
      2,
    );
    expect(s.products.find((p) => p.name === "투약병20cc")?.usage).toBe(
      "unclassified",
    );
  });
  it("excludes returns/future records, retains old last receipt, and counts the current year", () => {
    const p = buildSnapshot(rows, catalogs, "2026-10-03").products[0];
    expect(p.latest.map((r) => r.date)).toEqual([
      "2026-09-29",
      "2026-09-15",
      "2025-10-02",
    ]);
    expect(p.frequency).toEqual([{ supplier: "동아", count: 2 }]);
  });
  it("replaces the current window on reimport and retains absent old products without stale counts", () => {
    const old = buildSnapshot(rows, catalogs, "2026-10-03");
    const next = buildSnapshot(rows, catalogs, "2026-10-03", old);
    expect(next.previousVersion).toBe(old.version);
    expect(next.products[0].frequency[0].count).toBe(2);
    expect(next.products[0].latest.map((r) => r.date)).toEqual([
      "2026-09-29",
      "2026-09-15",
      "2025-10-02",
    ]);
    const empty = buildSnapshot([], catalogs, "2027-10-03", old);
    expect(
      empty.products.find((p) => p.name === "투약병20cc")?.latest[0].date,
    ).toBe("2026-09-20");
    expect(
      empty.products.find((p) => p.name === "투약병20cc")?.frequency,
    ).toEqual([]);
    expect(
      searchProducts(empty.products, "도우").results.some(
        (p) => p.name === "투약병20cc",
      ),
    ).toBe(true);
  });
  it("keeps a three-record history outside the new annual window without copying a repeated historic line twice", () => {
    const historic = [
      { ...rows[0], date: "2025-01-01" },
      { ...rows[0], date: "2025-01-02" },
      { ...rows[0], date: "2025-01-03" },
    ];
    const old = buildSnapshot(historic, catalogs, "2026-10-03");
    const next = buildSnapshot(historic, catalogs, "2026-10-03", old);
    expect(next.products[0].latest.map((r) => r.date)).toEqual([
      "2025-01-03",
      "2025-01-02",
      "2025-01-01",
    ]);
  });
  it("uses confirmed base quantity for 10-bottle case price and leaves unknown units raw", () => {
    expect(getPrice(rows[0], undefined)).toEqual({
      main: 5610,
      mainUnit: "원본 단가",
    });
    expect(
      getPrice(
        rows[0],
        { count: 10, baseUnit: "병", packUnit: "박스", quantityBasis: "base" },
        "retail",
      ),
    ).toEqual({
      main: 5610,
      mainUnit: "박스당",
      secondary: 561,
      secondaryUnit: "병당",
    });
  });
  it("does not automatically connect conflicting manufacturers", () => {
    const s = buildSnapshot(
      [{ ...rows[0], manufacturer: "다른회사" }],
      catalogs,
      "2026-10-03",
    );
    expect(s.products[0].usage).toBe("unclassified");
    expect(s.products[0].matchStatus).toBe("review");
  });
  it("supports whitespace/unit searches and supplies typo candidates without changing identity", () => {
    const s = buildSnapshot(rows, catalogs, "2026-10-03");
    expect(searchProducts(s.products, "박카스 100ML").results).toHaveLength(2);
    expect(searchProducts(s.products, "박가스").suggested).toBe(true);
  });
  it("keeps ten fixed positions and excludes their shared URL from recent thirty-day top five", () => {
    const links = [
      {
        id: "a",
        title: "A",
        url: "https://a.test/",
        folderId: "f",
        category: "기타",
        memo: "",
        rank: 0,
      },
      {
        id: "b",
        title: "B",
        url: "https://a.test/",
        folderId: "f",
        category: "기타",
        memo: "",
      },
      {
        id: "c",
        title: "C",
        url: "https://c.test/",
        folderId: "f",
        category: "기타",
        memo: "",
      },
    ];
    const hot = topBookmarks(
      links,
      [
        { date: "2026-10-03", counts: { b: 10, c: 5 } },
        { date: "2026-08-01", counts: { c: 100 } },
      ],
      "2026-10-03",
    );
    expect(hot.fixed.map((x) => x.id)).toEqual(["a"]);
    expect(hot.frequent.map((x) => x.id)).toEqual(["c"]);
  });
  it("ranks duplicate URLs by combined usage rather than one bookmark alias", () => {
    const links = [
      {
        id: "a",
        title: "A",
        url: "https://a.test/",
        folderId: "f",
        category: "기타",
        memo: "",
      },
      {
        id: "b",
        title: "B",
        url: "https://a.test/",
        folderId: "f",
        category: "기타",
        memo: "",
      },
      {
        id: "c",
        title: "C",
        url: "https://c.test/",
        folderId: "f",
        category: "기타",
        memo: "",
      },
    ];
    expect(
      topBookmarks(
        links,
        [{ date: "2026-10-03", counts: { a: 10, b: 8, c: 12 } }],
        "2026-10-03",
      ).frequent.map((b) => b.id),
    ).toEqual(["a", "c"]);
  });
});

it("transfers older receipts by base product when classification changes", () => {
  const oldRow = { ...rows[0], date: "2024-09-01" };
  const previous = buildSnapshot([oldRow], [], "2024-10-03");
  const catalog = [
    {
      name: rows[0].name,
      manufacturer: rows[0].manufacturer,
      code: "123",
      usage: "retail" as const,
    },
  ];
  const next = buildSnapshot([rows[0]], catalog, "2026-10-03", previous);
  const product = next.products.find((p) => p.code === "123")!;
  expect(product.latest.map((r) => r.date)).toEqual([
    "2026-09-29",
    "2024-09-01",
  ]);
  expect(next.products.filter((p) => p.baseId === product.baseId)).toHaveLength(
    1,
  );
});

it("preserves both usage histories when a product is absent from the replacement year", () => {
  const catalog = ["retail", "dispensing"].map((usage) => ({
    name: rows[0].name,
    manufacturer: rows[0].manufacturer,
    code: "123",
    usage: usage as "retail" | "dispensing",
  }));
  const previous = buildSnapshot(
    [{ ...rows[0], date: "2024-09-01" }],
    catalog,
    "2024-10-03",
  );
  const next = buildSnapshot([], catalog, "2026-10-03", previous);
  expect(
    next.products.filter((p) => p.code === "123").map((p) => p.latest[0]?.date),
  ).toEqual(["2024-09-01", "2024-09-01"]);
});
