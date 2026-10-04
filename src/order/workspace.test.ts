import { describe, it, expect } from "vitest";
import {
  buildSnapshot,
  pinBookmark,
  topBookmarks,
  searchProducts,
} from "./core";
import {
  supplierRows,
  moveFolder,
  deleteFolder,
  mergeBookmarks,
  barcodeLink,
  priceIncrease,
  displayPrice,
} from "./workspace";
import type { Product, Purchase, Preferences } from "./types";
const row = (supplier: string, date: string, price = 100): Purchase => ({
  date,
  name: "약품10mg",
  manufacturer: "제약",
  supplier,
  unitPrice: price,
  quantity: 10,
  amount: price * 10,
  sourceRow: 1,
});
const prefs: Preferences = {
  units: {},
  suppliers: {},
  overrides: {},
  folders: [
    { id: "a", name: "A", parentId: null, category: "기타", order: 0 },
    { id: "b", name: "B", parentId: "a", category: "기타", order: 1 },
    { id: "c", name: "C", parentId: null, category: "기타", order: 2 },
  ],
  bookmarks: [
    {
      id: "site",
      title: "사이트",
      url: "https://a.test/",
      folderId: "b",
      category: "기타",
      memo: "",
    },
  ],
};
describe("confirmed order workflows", () => {
  it("retains every supplier last three, with newest first and older suppliers across refresh", () => {
    const records = [
      row("A", "2026-10-01"),
      row("A", "2026-09-01"),
      row("A", "2026-08-01"),
      row("B", "2025-01-01", 90),
    ];
    const old = buildSnapshot(records, [], "2026-10-03");
    expect(supplierRows(old.products[0]).map((x) => x.supplier)).toEqual([
      "A",
      "B",
    ]);
    const next = buildSnapshot([row("A", "2026-10-03")], [], "2026-10-03", old);
    expect(supplierRows(next.products[0]).map((x) => x.supplier)).toEqual([
      "A",
      "B",
    ]);
  });
  it("preserves contents when reparenting and rejects cycles", () => {
    expect(() => moveFolder(prefs, "a", "b")).toThrow();
    const moved = moveFolder(prefs, "b", "c");
    expect(moved.folders.find((f) => f.id === "b")?.parentId).toBe("c");
    expect(moved.bookmarks).toEqual(prefs.bookmarks);
    const removed = deleteFolder(prefs, "a");
    expect(removed.folders.find((f) => f.id === "b")?.parentId).toBe(null);
  });
  it("imports selected trees without duplicate same name/address and preserves different names on shared URL", () => {
    const out = mergeBookmarks(
      prefs,
      [],
      [
        prefs.bookmarks[0],
        { ...prefs.bookmarks[0], id: "new", title: "다른 거래처" },
      ],
    );
    expect(out.added).toBe(1);
    expect(out.skipped).toBe(1);
    expect(out.preferences.bookmarks).toHaveLength(2);
  });
  it("supports multiple barcodes without deleting siblings and requires duplicate transfer confirmation", () => {
    const p = { ...prefs, barcodes: { old: ["111", "222"] } };
    expect(() => barcodeLink(p, "new", "111")).toThrow();
    const linked = barcodeLink(p, "new", "111", true);
    expect(linked.barcodes?.old).toEqual(["222"]);
    expect(linked.barcodes?.new).toEqual(["111"]);
  });
  it("compares emergency supplier rises without applying discounts and never guesses units", () => {
    const product = {
      latest: [
        row("urgent", "2026-10-01", 110),
        row("usual", "2026-09-01", 100),
      ],
    } as Product;
    expect(priceIncrease(product)?.percent).toBeCloseTo(10);
    expect(displayPrice(product.latest[0], undefined, "dispensing")).toEqual({
      amount: 110,
      unit: "단위",
    });
  });
  it("does not cap fixed bookmarks at ten", () => {
    let links = Array.from({ length: 11 }, (_, i) => ({
      ...prefs.bookmarks[0],
      id: String(i),
      url: "https://a.test/" + i,
    }));
    for (const b of links) links = pinBookmark(links, b.id);
    expect(topBookmarks(links, [], "2026-10-03").fixed).toHaveLength(11);
  });
});

it("keeps supplier-only matches out of the product name results", () => {
  const s = buildSnapshot([row("백제", "2026-10-01")], [], "2026-10-03");
  expect(searchProducts(s.products, "백제", false).results).toHaveLength(0);
  expect(searchProducts(s.products, "약품", false).results).toHaveLength(1);
});

it("keeps purchased matches ahead of unused catalog names", () => {
  const purchased = buildSnapshot([row("백제", "2026-10-01")], [], "2026-10-03")
    .products[0];
  const unused = {
    ...purchased,
    id: "unused",
    baseId: "unused",
    name: "약품 신규",
    sourceName: "약품 신규",
    latest: [],
    frequency: [],
    supplierHistory: {},
  };
  const recent = { ...purchased, name: "기존 약품", sourceName: "기존 약품" };
  expect(
    searchProducts([unused, recent], "약품", false).results.map(
      (p) => p.baseId,
    ),
  ).toEqual([recent.baseId, "unused"]);
});

it("pins sites with missing addresses independently", () => {
  const a = { ...prefs.bookmarks[0], id: "blank-a", url: "" };
  const b = { ...a, id: "blank-b", title: "담당자 주문" };
  const pinned = pinBookmark(pinBookmark([a, b], a.id), b.id);
  expect(pinned.filter((x) => x.rank !== undefined)).toHaveLength(2);
});
