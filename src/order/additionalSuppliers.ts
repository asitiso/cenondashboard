import { normalizeName, stableId } from "./core";
import type { Preferences } from "./types";

const wholesaleTitles = ["HMP몰", "바로팜", "theSHOP"];
export const isWholesaleSite = (title: string) => wholesaleTitles.some(t => normalizeName(t) === normalizeName(title));
export function addProductSupplier(p: Preferences, id: string, name: string): Preferences {
  const clean = name.trim();
  if (!clean) throw Error("매입처 이름을 입력하세요.");
  return { ...p, additionalSuppliers: { ...p.additionalSuppliers, [id]: [...new Set([...(p.additionalSuppliers?.[id] ?? []), clean])] } };
}
export function connectWholesaleSites(p: Preferences, name: string, productId?: string): Preferences {
  const bookmarks = [...p.bookmarks];
  const folderId = p.folders[0]?.id ?? "order-default";
  const folders = p.folders.length ? p.folders : [{ id: folderId, name: "주문처", parentId: null, category: "종합도매", order: 0 }];
  const ids = wholesaleTitles.map(title => {
    let site = bookmarks.find(b => !b.deletedAt && normalizeName(b.title) === normalizeName(title));
    if (!site) {
      site = { id: stableId("wholesale|" + title), title, url: "", folderId, category: "종합도매", memo: "" };
      bookmarks.push(site);
    }
    return site.id;
  });
  const key = productId + "|" + name;
  const previous = productId ? p.productSuppliers?.[key] ?? p.suppliers[name] : p.suppliers[name];
  const conf = { ...previous, bookmarkId: ids[0], bookmarkIds: ids, method: "사이트" as const, methods: ["사이트"], memo: previous?.memo ?? "" };
  return { ...p, bookmarks, folders, ...(productId ? { productSuppliers: { ...p.productSuppliers, [key]: conf } } : { suppliers: { ...p.suppliers, [name]: conf } }) };
}
export function confirmRestore(confirm: (text: string) => boolean, description: string) {
  return confirm(`경고: 현재 공용 매입 자료가 이 브라우저에 보관된 직전 자료로 바뀝니다. 다른 직원의 조회 결과에도 적용됩니다.\n복원 대상: ${description}\n즐겨찾기·바코드·주문처 설정은 유지됩니다.\n복원을 진행할까요? (1/2)`)
    && confirm(`최종 확인 (2/2): ${description} 자료로 공용 매입 자료를 교체합니다. 현재 자료 이후 추가·수정한 상품 정보는 이전 상태로 바뀔 수 있습니다. 정말 복원할까요?`);
}
