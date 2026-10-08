import { expect, it } from "vitest";
import { emptyPreferences } from "./storage";
import { getSupplierDirectory, getSearchableSites, manualProductIdsForSupplier } from "./supplierDirectory";
import type { Product, Snapshot } from "./types";

const manual = (baseId: string, supplier: string): Product => ({
  id: baseId + "-retail", baseId, name: baseId, sourceName: baseId,
  manufacturer: "", usage: "retail", matchStatus: "unclassified",
  latest: [], frequency: [], manual: true, manualSupplier: supplier,
});
const snapshot = (products: Product[]): Snapshot => ({
  version: "v", asOf: "2026-10-08", importedAt: "2026-10-08", products,
  catalogs: [], stats: { rows: 0, names: 0, matchedRows: 0, unclassifiedRows: 0,
    reviewRows: 0, futureRows: 0, returnRows: 0, missingNames: 0 },
});

it("keeps temporary suppliers manageable but excludes deleted product links from search", () => {
  const prefs = {
    ...emptyPreferences,
    manualProductEdits: { deleted: { deleted: true } },
    productSuppliers: { "deleted|HMP": { method: "사이트" as const, memo: "" } },
  };
  const result = getSupplierDirectory(snapshot([manual("deleted", "임시 URL"), manual("live", "NAUSPACK")]), prefs);
  expect(result.managed).toContain("임시 URL");
  expect(result.managed).toContain("HMP");
  expect(result.linked.has("임시 URL")).toBe(false);
  expect(result.linked.has("HMP")).toBe(false);
  expect(result.linked.has("NAUSPACK")).toBe(true);
  expect(result.purchased.has("NAUSPACK")).toBe(false);
  expect(manualProductIdsForSupplier(snapshot([manual("live", "NAUSPACK")]), prefs, "NAUSPACK")).toEqual(["live"]);
});

it("preserves suppliers backed by real purchase history after temporary deletion", () => {
  const purchased: Product = { ...manual("purchase", ""), manual: false,
    frequency: [{ supplier: "정식 매입처", count: 1 }] };
  const prefs = { ...emptyPreferences, hiddenSuppliers: ["임시 URL", "정식 매입처"] };
  const result = getSupplierDirectory(snapshot([purchased, manual("temp", "임시 URL")]), prefs);
  expect(result.purchased.has("정식 매입처")).toBe(true);
  expect(result.managed).toContain("정식 매입처");
  expect(result.managed).not.toContain("임시 URL");
  expect(result.linked.has("임시 URL")).toBe(false);
});

it("shows favorites and connected order sites once while hiding orphan copies", () => {
  const prefs = { ...emptyPreferences,
    bookmarks: [{ id: "favorite", title: "즐겨찾기", url: "https://favorite.example", folderId: "f", category: "기타", memo: "" }],
    suppliers: { "정식 매입처": { method: "사이트" as const, memo: "", bookmarkId: "live1", bookmarkIds: ["live1", "live2"] } },
    productSuppliers: { "deleted|삭제된 매입처": { method: "사이트" as const, memo: "", bookmarkId: "old1" } },
    orderSites: [
      { id: "old1", title: "JVM", url: "https://jvm.example", folderId: "", category: "기타", memo: "", supplierNames: ["삭제된 매입처"] },
      { id: "old2", title: "JVM", url: "https://jvm.example", folderId: "", category: "기타", memo: "", supplierNames: ["삭제된 매입처"] },
      { id: "live1", title: "정식몰", url: "https://mall.example", folderId: "", category: "기타", memo: "", supplierNames: ["정식 매입처"] },
      { id: "live2", title: "정식몰", url: "https://mall.example", folderId: "", category: "기타", memo: "", supplierNames: ["정식 매입처"] },
    ],
  };
  expect(getSearchableSites(prefs, new Set(["정식 매입처", "삭제된 매입처"]), new Set(["live"])).map(site => site.id)).toEqual(["favorite", "live1"]);
});
