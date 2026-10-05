import { expect, it } from "vitest";
import { editManualProduct, isManualProduct, isProductSite, saveProductSupplierInfo, renameRegisteredSupplier } from "./productSettings";
import { emptyPreferences } from "./storage";
import { stableId, normalizeName } from "./core";
import type { Product } from "./types";
const product: Product = { id: "p", baseId: stableId("manual|" + normalizeName("포장지")), name: "포장지", sourceName: "포장지", manufacturer: "", usage: "retail", matchStatus: "unclassified", latest: [], frequency: [] };
it("renames a registered supplier for one product while preserving its settings and other products", () => {
  const p = { ...product, manualSupplier: "네이버쇼핑" }, key = p.baseId + "|네이버쇼핑";
  const original = { ...emptyPreferences, additionalSuppliers: { [p.baseId]: ["온라인팜"] },
    suppliers: { 네이버쇼핑: { bookmarkId: "site", method: "사이트" as const, memo: "공통" } },
    referencePrices: { [key]: { amount: 100, unit: "롤", updatedAt: "date" } }, supplierNotes: { [key]: "배송비" } };
  const changed = renameRegisteredSupplier(original, p, "네이버쇼핑", "포장지 판매점");
  const next = p.baseId + "|포장지 판매점";
  expect(changed.manualSupplierNames?.[p.baseId]).toBe("포장지 판매점");
  expect(changed.productSuppliers?.[next].bookmarkId).toBe("site");
  expect(changed.referencePrices?.[next].amount).toBe(100);
  expect(changed.supplierNotes?.[next]).toBe("배송비");
  expect(changed.referencePrices?.[key]).toBeUndefined();
  expect(changed.suppliers).toEqual(original.suppliers);
  expect(changed.bookmarks).toEqual(original.bookmarks);
  expect(() => renameRegisteredSupplier(original, p, "네이버쇼핑", "온라인팜")).toThrow();
  expect(() => renameRegisteredSupplier(original, p, "원본 매입처", "수정")).toThrow();
  expect(renameRegisteredSupplier(original, p, "온라인팜", "새 이름").additionalSuppliers?.[p.baseId]).toEqual(["새 이름"]);
});
it("edits legacy manual names without changing identity or imported products", () => {
  expect(isManualProduct(product)).toBe(true);
  const edited = editManualProduct(emptyPreferences, product, "ATC 포장지");
  expect(edited.manualProductEdits?.[product.baseId].name).toBe("ATC 포장지");
  expect(editManualProduct(edited, product, "ATC 포장지", true).manualProductEdits?.[product.baseId].deleted).toBe(true);
  expect(() => editManualProduct(emptyPreferences, { ...product, baseId: "imported" }, "이름")).toThrow();
});
it("stores a reference price and note per product and supplier without inventing receipts", () => {
  const first = saveProductSupplierInfo(emptyPreferences, product, "네이버쇼핑", "12,000", "롤", "배송비 별도");
  const second = saveProductSupplierInfo(first, { ...product, baseId: "other" }, "네이버쇼핑", "8000", "박스", "다른 상품");
  expect(second.referencePrices?.[product.baseId + "|네이버쇼핑"].amount).toBe(12000);
  expect(product.latest).toEqual([]);
  expect(second.supplierNotes?.[product.baseId + "|네이버쇼핑"]).toBe("배송비 별도");
  expect(saveProductSupplierInfo(second, product, "네이버쇼핑", "", "", "").referencePrices?.[product.baseId + "|네이버쇼핑"]).toBeUndefined();
  expect(() => saveProductSupplierInfo(first, product, "네이버쇼핑", "-3", "롤", "")).toThrow();
  expect(isProductSite("네이버쇼핑")).toBe(true);
  expect(isProductSite("온라인팜")).toBe(false);
});
