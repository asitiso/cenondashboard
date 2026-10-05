import { normalizeName, stableId } from "./core";
import type { Preferences, Product } from "./types";
import { supplierRows } from "./workspace";

export const isManualProduct = (p: Product) => !!p.manual || p.baseId === stableId("manual|" + normalizeName(p.sourceName));
export const isProductSite = (name: string) => /네이버|naver|smartstore/i.test(name);
export function editManualProduct(prefs: Preferences, product: Product, name: string, deleted = false): Preferences {
  if (!isManualProduct(product)) throw Error("직접 등록한 상품만 수정·삭제할 수 있습니다.");
  if (!name.trim()) throw Error("상품 이름을 입력하세요.");
  return { ...prefs, manualProductEdits: { ...prefs.manualProductEdits, [product.baseId]: { name: name.trim(), deleted } } };
}
export function saveProductSupplierInfo(prefs: Preferences, product: Product, supplier: string, price: string, unit: string, note: string): Preferences {
  const key = product.baseId + "|" + supplier;
  const prices = { ...prefs.referencePrices };
  if (!supplierRows(product).some(row => row.supplier === supplier)) {
    if (!price.trim()) delete prices[key];
    else {
      const amount = Number(price.replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount < 0) throw Error("가격은 0 이상의 숫자로 입력하세요.");
      if (!unit.trim()) throw Error("가격의 단위를 입력하세요.");
      prices[key] = { amount, unit: unit.trim(), updatedAt: new Date().toISOString() };
    }
  }
  return { ...prefs, referencePrices: prices, supplierNotes: { ...prefs.supplierNotes, [key]: note.trim() } };
}
