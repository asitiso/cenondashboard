import { expect, it } from "vitest";
import { editManualProduct, isManualProduct, isProductSite, saveProductSupplierInfo } from "./productSettings";
import { emptyPreferences } from "./storage";
import { stableId, normalizeName } from "./core";
import type { Product } from "./types";
const product: Product = { id: "p", baseId: stableId("manual|" + normalizeName("포장지")), name: "포장지", sourceName: "포장지", manufacturer: "", usage: "retail", matchStatus: "unclassified", latest: [], frequency: [] };
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
