import { expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSnapshot, searchProducts } from "./core";
import { parsePurchase, parseCatalog } from "./importers";
function file(name: string): ArrayBuffer {
  const b = readFileSync(process.env[name]!);
  return b.buffer.slice(
    b.byteOffset,
    b.byteOffset + b.byteLength,
  ) as ArrayBuffer;
}
it.skipIf(!process.env.ORDER_TEST_PURCHASE)(
  "imports the supplied PMIT sources and keeps unmatched supplies searchable",
  () => {
    const rows = parsePurchase(file("ORDER_TEST_PURCHASE"));
    const catalogs = [
      ...parseCatalog(file("ORDER_TEST_DISPENSING"), "dispensing"),
      ...parseCatalog(file("ORDER_TEST_RETAIL"), "retail"),
    ];
    expect(rows).toHaveLength(33905);
    expect(catalogs.filter((c) => c.usage === "dispensing")).toHaveLength(1179);
    expect(catalogs.filter((c) => c.usage === "retail")).toHaveLength(3124);
    const value = buildSnapshot(rows, catalogs, "2026-10-03");
    expect(value.stats.names).toBe(4092);
    expect(value.stats.futureRows).toBe(1);
    expect(
      searchProducts(value.products, "투약병20cc").results.some(
        (p) => p.usage === "unclassified",
      ),
    ).toBe(true);
    expect(
      searchProducts(value.products, "아스피린프로텍트").results.some(
        (p) => p.usage === "dispensing",
      ),
    ).toBe(true);
    expect(
      searchProducts(value.products, "아스피린프로텍트").results.some(
        (p) => p.usage === "retail",
      ),
    ).toBe(true);
    if (process.env.ORDER_PREVIEW_OUTPUT)
      writeFileSync(process.env.ORDER_PREVIEW_OUTPUT, JSON.stringify(value));
    console.info(
      JSON.stringify({ stats: value.stats, products: value.products.length }),
    );
  },
  30000,
);
