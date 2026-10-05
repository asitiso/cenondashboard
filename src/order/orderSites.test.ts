import { expect, it } from "vitest";
import { allOrderSites, saveOrderSite, separateAutomaticSites } from "./orderSites";
import { emptyPreferences } from "./storage";
import { stableId } from "./core";

it("saves supplier addresses without adding favorites or folders", () => {
  const site = { id: "order", title: "새 매입처", url: "https://example.com", folderId: "", category: "기타", memo: "" };
  const next = saveOrderSite(emptyPreferences, site);
  expect(next.bookmarks).toEqual([]);
  expect(next.folders).toEqual([]);
  expect(allOrderSites(next)).toEqual([site]);
  expect(saveOrderSite(next, { ...site, url: "https://changed.example.com" }).orderSites).toHaveLength(1);
});
it("separates previously generated favorites without losing supplier addresses or intentional favorites", () => {
  const auto = { id: stableId("supplier-site|거래처"), title: "거래처", url: "https://example.com", folderId: "f", category: "종합도매", memo: "" };
  const favorite = { ...auto, id: "imported" };
  const pinned = { ...auto, id: stableId("wholesale|HMP몰"), title: "HMP몰", rank: 0 };
  const prefs = { ...emptyPreferences, suppliers: { 거래처: { bookmarkId: auto.id, method: "사이트" as const, memo: "" } }, bookmarks: [auto, favorite, pinned] };
  const next = separateAutomaticSites(prefs);
  expect(next.bookmarks).toEqual([favorite, pinned]);
  expect(next.orderSites).toEqual([auto]);
  expect(allOrderSites(next).find(b => b.id === auto.id)?.url).toBe(auto.url);
  expect(separateAutomaticSites(next)).toEqual(next);
});
it("keeps supplier links and addresses after a favorite is edited, trashed, or removed", () => {
  const site = { id: "shared", title: "사이트", url: "https://original.example.com", folderId: "f", category: "기타", memo: "" };
  const conf = { bookmarkId: site.id, method: "사이트" as const, memo: "" };
  const migrated = separateAutomaticSites({ ...emptyPreferences, bookmarks: [site], suppliers: { 거래처: conf }, productSuppliers: { "p|거래처": conf } });
  for (const bookmarks of [[{ ...site, url: "https://favorite.example.com" }], [{ ...site, deletedAt: "2026-10-05" }], []]) {
    const next = separateAutomaticSites({ ...migrated, bookmarks });
    expect(allOrderSites(next).find(b => b.id === site.id)?.url).toBe(site.url);
    expect(next.suppliers.거래처).toEqual(conf);
    expect(next.productSuppliers?.["p|거래처"]).toEqual(conf);
  }
  const edited = saveOrderSite(migrated, { ...site, url: "https://supplier.example.com" });
  expect(edited.bookmarks).toEqual([site]);
  expect(allOrderSites(edited)[0].url).toBe("https://supplier.example.com");
});
