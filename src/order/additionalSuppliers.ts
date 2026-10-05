import { normalizeName, stableId } from "./core";
import type { Preferences } from "./types";
import { allOrderSites, saveOrderSite } from "./orderSites";

export const wholesaleTitles = ["HMP몰", "바로팜", "theSHOP"];
export const isWholesaleSite = (title: string) => wholesaleTitles.some(t => normalizeName(t) === normalizeName(title));
export function addProductSupplier(p: Preferences, id: string, name: string): Preferences {
  const clean = name.trim();
  if (!clean) throw Error("매입처 이름을 입력하세요.");
  return { ...p, additionalSuppliers: { ...p.additionalSuppliers, [id]: [...new Set([...(p.additionalSuppliers?.[id] ?? []), clean])] } };
}
export function connectWholesaleSites(p: Preferences, name: string, productId?: string): Preferences {
  let next = p;
  const ids = wholesaleTitles.map(title => {
    let site = allOrderSites(next).find(b => normalizeName(b.title) === normalizeName(title));
    if (!site) {
      site = { id: stableId("wholesale|" + title), title, url: "", folderId: "", category: "종합도매", memo: "" };
      next = saveOrderSite(next, site);
    }
    return site.id;
  });
  const key = productId + "|" + name;
  const previous = productId ? p.productSuppliers?.[key] ?? p.suppliers[name] : p.suppliers[name];
  const conf = { ...previous, bookmarkId: ids[0], bookmarkIds: ids, method: "사이트" as const, methods: ["사이트"], memo: previous?.memo ?? "" };
  return { ...next, ...(productId ? { productSuppliers: { ...next.productSuppliers, [key]: conf } } : { suppliers: { ...next.suppliers, [name]: conf } }) };
}
export function registerProductSupplier(p: Preferences, id: string, name: string): Preferences {
  const wholesale = isWholesaleSite(name) || name === "종합도매";
  const next = addProductSupplier(p, id, wholesale ? "종합도매" : name);
  return wholesale ? connectWholesaleSites(next, "종합도매", id) : next;
}
export function confirmRestore(confirm: (text: string) => boolean, description: string) {
  return confirm(`경고: 현재 공용 매입 자료가 이 브라우저에 보관된 직전 자료로 바뀝니다. 다른 직원의 조회 결과에도 적용됩니다.\n복원 대상: ${description}\n즐겨찾기·바코드·주문처 설정은 유지됩니다.\n복원을 진행할까요? (1/2)`)
    && confirm(`최종 확인 (2/2): ${description} 자료로 공용 매입 자료를 교체합니다. 현재 자료 이후 추가·수정한 상품 정보는 이전 상태로 바뀔 수 있습니다. 정말 복원할까요?`);
}
