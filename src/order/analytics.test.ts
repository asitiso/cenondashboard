import { expect, it } from "vitest";
import {
  buildPurchaseAnalysis,
  groupVendorPrices,
  sortPriceChanges,
} from "./analytics";
import { emptyPreferences } from "./storage";
import type { Product, Purchase, Snapshot } from "./types";
const receipt = (
  date: string,
  supplier: string,
  price: number,
  sourceRow = 1,
): Purchase => ({
  date,
  supplier,
  unitPrice: price,
  quantity: 10,
  amount: price * 10,
  sourceRow,
  name: "약",
  manufacturer: "회사",
});
const product = (rows: Purchase[]): Product => ({
  id: "p",
  baseId: "base",
  name: "약",
  sourceName: "약",
  manufacturer: "회사",
  usage: "dispensing",
  matchStatus: "matched",
  latest: rows,
  frequency: [
    { supplier: "A", count: 8 },
    { supplier: "B", count: 3 },
  ],
});
const snapshot = (products: Product[]) =>
  ({ asOf: "2026-10-03", products }) as Snapshot;
const prefs = {
  ...emptyPreferences,
  units: {
    base: {
      count: 1,
      baseUnit: "정",
      packUnit: "통",
      quantityBasis: "base" as const,
    },
  },
};
it("sorts price changes by date, percentage or absolute amount without changing the source", () => {
  const make = (
    baseId: string,
    date: string,
    current: number,
    previous: number,
  ) => ({
    ...product([
      receipt(date, "A", current),
      receipt("2026-01-01", "A", previous),
    ]),
    baseId,
  });
  const data = buildPurchaseAnalysis(
    snapshot([
      make("recent", "2026-10-03", 110, 100),
      make("rate", "2026-10-02", 20, 10),
      make("amount", "2026-10-01", 1500, 1000),
      make("fall", "2026-09-30", 100, 800),
    ]),
    emptyPreferences,
  ).changes;
  expect(sortPriceChanges(data, "recent").map((x) => x.product.baseId)).toEqual(
    ["recent", "rate", "amount", "fall"],
  );
  expect(sortPriceChanges(data, "rate").map((x) => x.product.baseId)).toEqual([
    "rate",
    "amount",
    "recent",
    "fall",
  ]);
  expect(sortPriceChanges(data, "amount").map((x) => x.product.baseId)).toEqual(
    ["fall", "amount", "recent", "rate"],
  );
  expect(data.map((x) => x.product.baseId)).toEqual([
    "recent",
    "rate",
    "amount",
    "fall",
  ]);
});
it("compares confirmed prices and records each supplier's date", () => {
  const p = product([
    receipt("2026-10-02", "A", 120),
    receipt("2026-09-01", "B", 100),
  ]);
  const data = buildPurchaseAnalysis(snapshot([p]), prefs);
  expect(data.rises[0].increase?.difference).toBe(20);
  expect(data.rises[0].increase?.percent).toBe(20);
  expect(data.gaps[0].vendors.map((v) => v.supplier)).toEqual(["A", "B"]);
  expect(data.frequent[0].frequency).toBe(11);
});
it("shows unknown units and manual prices without treating manual prices as purchases", () => {
  const p = product([
    receipt("2026-10-02", "A", 120),
    receipt("2026-09-01", "B", 100),
  ]);
  const data = buildPurchaseAnalysis(snapshot([p]), {
    ...emptyPreferences,
    referencePrices: { "base|B": { amount: 1, unit: "정", updatedAt: "now" } },
  });
  expect(data.rises[0].increase?.difference).toBe(20);
  expect(data.rises[0].increase?.current.unit).toBe("단위");
  expect(data.gaps[0].vendors.map((v) => [v.amount, v.manual])).toEqual([
    [120, undefined],
    [100, undefined],
    [1, true],
  ]);
  expect(data.frequent).toHaveLength(1);
});
it("excludes future, returned, zero quantity and old vendor prices", () => {
  const rows = [
    receipt("2027-01-01", "future", 999),
    { ...receipt("2026-10-02", "zero", 200), quantity: 0 },
    { ...receipt("2026-10-02", "return", 200), amount: -1 },
    receipt("2026-10-01", "A", 120),
    receipt("2024-01-01", "old", 10),
  ];
  const data = buildPurchaseAnalysis(snapshot([product(rows)]), prefs);
  expect(data.gaps).toEqual([]);
  expect(data.frequent[0].vendors.map((x) => x.supplier)).toEqual(["A"]);
  expect(data.frequent[0].latestDate).toBe("2026-10-01");
});
it("sorts by recent purchase dates and includes falling and unchanged prices", () => {
  const rising = product([
    receipt("2026-09-01", "A", 200),
    receipt("2026-08-01", "B", 100),
  ]);
  const falling = {
    ...product([
      receipt("2026-10-02", "B", 90),
      receipt("2026-09-01", "A", 100),
    ]),
    baseId: "fall",
  };
  const same = {
    ...product([
      receipt("2026-10-01", "A", 100),
      receipt("2026-09-01", "A", 100),
    ]),
    baseId: "same",
  };
  const data = buildPurchaseAnalysis(
    snapshot([rising, falling, same]),
    emptyPreferences,
  );
  expect(data.changes.map((x) => x.product.baseId)).toEqual([
    "fall",
    "same",
    "base",
  ]);
  expect(data.changes.map((x) => x.increase?.difference)).toEqual([
    -10, 0, 100,
  ]);
  expect(data.rises).toHaveLength(1);
});
it("includes a manual-only product in vendor prices but not change or frequency lists", () => {
  const p = { ...product([]), manual: true, frequency: [] };
  const data = buildPurchaseAnalysis(snapshot([p]), {
    ...emptyPreferences,
    referencePrices: {
      "base|Shop": { amount: 100, unit: "개", updatedAt: "2026-10-05" },
      "base|Other": { amount: 110, unit: "개", updatedAt: "2026-10-05" },
    },
  });
  expect(data.gaps[0].vendors[0]).toMatchObject({
    supplier: "Shop",
    date: "",
    manual: true,
    unit: "개",
  });
  expect(data.changes).toEqual([]);
  expect(data.frequent).toEqual([]);
});
it("only lists products with differing displayed prices at different suppliers", () => {
  const single = {
    ...product([receipt("2026-10-02", "A", 100)]),
    baseId: "single",
  };
  const same = {
    ...product([
      receipt("2026-10-02", "A", 100),
      receipt("2026-09-01", "B", 100),
    ]),
    baseId: "same",
  };
  const precise = {
    ...product([
      receipt("2026-10-02", "A", 100),
      receipt("2026-09-01", "B", 100.00000001),
    ]),
    baseId: "precise",
  };
  const differing = product([
    receipt("2026-10-02", "A", 120),
    receipt("2026-09-01", "B", 100),
  ]);
  const data = buildPurchaseAnalysis(
    snapshot([single, same, precise, differing]),
    emptyPreferences,
  );
  expect(data.gaps.map((p) => p.product.baseId)).toEqual(["base"]);
  expect(data.gaps[0].vendorDifference).toBe(20);
});
it("groups equal vendor prices only when date, unit and registration source match", () => {
  const value = { supplier: "A", amount: 100, unit: "정", date: "2026-10-02" };
  const groups = groupVendorPrices([
    value,
    { ...value, supplier: "B" },
    { ...value, supplier: "C", date: "2026-09-01" },
    { ...value, supplier: "D", unit: "통" },
    { ...value, supplier: "E", manual: true },
  ]);
  expect(groups).toHaveLength(4);
  expect(groups[0].supplier).toBe("A · B");
  expect(groups[1].date).toBe("2026-09-01");
});
it("analyzes public price-only receipts whose quantity and amount were omitted", () => {
  const rows = [
    receipt("2026-10-02", "A", 120),
    receipt("2026-09-01", "B", 100),
  ].map((r) => ({ ...r, quantity: 0, amount: 0, sourceRow: 0 }));
  const data = buildPurchaseAnalysis(snapshot([product(rows)]), prefs);
  expect(data.rises[0].increase?.difference).toBe(20);
  expect(data.rises[0].increase?.current.unit).toBe("단위");
  expect(data.gaps[0].vendors).toHaveLength(2);
});
it("deduplicates usage variants and hides deleted manual products", () => {
  const p = product([
    receipt("2026-10-02", "A", 120),
    receipt("2026-09-01", "B", 100),
  ]);
  const data = buildPurchaseAnalysis(
    snapshot([p, { ...p, id: "retail", usage: "retail" }]),
    prefs,
  );
  expect(data.frequent).toHaveLength(1);
  expect(data.frequent[0].frequency).toBe(11);
  expect(data.rises).toHaveLength(1);
  const manual = { ...p, baseId: "manual", manual: true };
  expect(
    buildPurchaseAnalysis(snapshot([manual]), {
      ...prefs,
      manualProductEdits: { manual: { deleted: true } },
    }).frequent,
  ).toEqual([]);
});
it("does not claim a time sequence between same-day receipts and sorts frequent products", () => {
  const p = product([
    receipt("2026-10-02", "A", 120),
    receipt("2026-10-02", "B", 100, 2),
  ]);
  const other = {
    ...p,
    baseId: "other",
    frequency: [{ supplier: "A", count: 15 }],
  };
  const data = buildPurchaseAnalysis(snapshot([p, other]), prefs);
  expect(data.rises).toEqual([]);
  expect(data.frequent[0].frequency).toBe(15);
});
