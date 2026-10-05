import { expect, it } from "vitest";
import { toggleSitePin } from "./quickPin";
import { separateAutomaticSites } from "./orderSites";
import { emptyPreferences } from "./storage";
import { stableId } from "./core";

it("explicitly pins a supplier site and keeps it a favorite after unpinning and reloading", () => {
  const site = { id: stableId("wholesale|HMP몰"), title: "HMP몰", url: "https://example.com", folderId: "", category: "종합도매", memo: "" };
  const prefs = { ...emptyPreferences, orderSites: [site] };
  const fixed = toggleSitePin(prefs, site.id);
  expect(fixed.bookmarks[0].rank).toBe(0);
  expect(fixed.orderSites).toEqual([site]);
  const unpinned = separateAutomaticSites(toggleSitePin(fixed, site.id));
  expect(unpinned.bookmarks).toHaveLength(1);
  expect(unpinned.bookmarks[0].rank).toBeUndefined();
  expect(unpinned.bookmarks[0].url).toBe(site.url);
});
it("toggles an existing favorite without duplicating it or changing its address", () => {
  const site = { id: "favorite", title: "사이트", url: "https://example.com", folderId: "f", category: "기타", memo: "메모" };
  const prefs = { ...emptyPreferences, bookmarks: [site] };
  const next = toggleSitePin(toggleSitePin(prefs, site.id), site.id);
  expect(next.bookmarks).toHaveLength(1);
  expect(next.bookmarks[0]).toMatchObject(site);
  expect(next.bookmarks[0].rank).toBeUndefined();
  expect(prefs.bookmarks[0]).not.toHaveProperty("rank");
});
