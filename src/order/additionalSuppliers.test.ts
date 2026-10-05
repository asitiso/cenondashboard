import { expect, it, vi } from "vitest";
import { addProductSupplier, connectWholesaleSites, confirmRestore, registerProductSupplier, wholesaleTitles } from "./additionalSuppliers";
import { emptyPreferences } from "./storage";
import { allOrderSites } from "./orderSites";

it("adds an unrecorded supplier once without inventing a purchase", () => {
  const next = addProductSupplier(emptyPreferences, "product", "새 매입처");
  expect(addProductSupplier(next, "product", "새 매입처").additionalSuppliers?.product).toEqual(["새 매입처"]);
  expect(next.suppliers).toEqual({});
  expect(emptyPreferences.additionalSuppliers).toBeUndefined();
});
it("connects all three wholesale sites, reusing addresses and defaulting to HMP", () => {
  const prefs = { ...emptyPreferences, bookmarks: [{ id: "shop", title: "theSHOP", url: "https://example.com", folderId: "f", category: "종합도매", memo: "" }] };
  const next = connectWholesaleSites(prefs, "거래처", "product");
  const conf = next.productSuppliers!["product|거래처"];
  expect(conf.bookmarkIds).toHaveLength(3);
  expect(allOrderSites(next).find(b => b.id === conf.bookmarkId)?.title).toBe("HMP몰");
  expect(next.bookmarks.find(b => b.id === "shop")?.url).toBe("https://example.com");
  expect(next.bookmarks).toEqual(prefs.bookmarks);
  expect(next.folders).toEqual(prefs.folders);
  expect(allOrderSites(connectWholesaleSites(next, "거래처", "product"))).toHaveLength(3);
  expect(next.suppliers).toEqual({});
});
it("requires both restoration confirmations and stops immediately on cancellation", () => {
  const yes = vi.fn(() => true), no = vi.fn(() => false);
  expect(confirmRestore(yes, "기준일 2026-10-03")).toBe(true);
  expect(yes).toHaveBeenCalledTimes(2);
  expect(confirmRestore(no, "기준일 2026-10-03")).toBe(false);
  expect(no).toHaveBeenCalledTimes(1);
  expect(confirmRestore(vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false), "이전 자료")).toBe(false);
});
it.each(wholesaleTitles)("selecting %s connects all sites with HMP as default without adding favorites", name => {
  const next = registerProductSupplier(emptyPreferences, "product", name);
  expect(next.additionalSuppliers?.product).toEqual(["종합도매"]);
  const conf = next.productSuppliers!["product|종합도매"];
  expect(conf.bookmarkIds?.map(id => allOrderSites(next).find(b => b.id === id)?.title)).toEqual(wholesaleTitles);
  expect(allOrderSites(next).find(b => b.id === conf.bookmarkId)?.title).toBe("HMP몰");
  expect(next.bookmarks).toEqual([]);
  expect(next.folders).toEqual([]);
});
