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
