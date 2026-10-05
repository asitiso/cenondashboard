import { stableId } from "./core";
import type { Bookmark, Preferences } from "./types";

export function allOrderSites(p: Preferences): Bookmark[] {
  return [...new Map([...(p.orderSites ?? []), ...p.bookmarks].filter(b => !b.deletedAt).map(b => [b.id, b])).values()];
}
export function saveOrderSite(p: Preferences, site: Bookmark): Preferences {
  const inFavorites = p.bookmarks.some(b => b.id === site.id && !b.deletedAt);
  return {
    ...p,
    ...(inFavorites ? { bookmarks: p.bookmarks.map(b => b.id === site.id ? { ...b, url: site.url } : b) } : {}),
    orderSites: [...(p.orderSites ?? []).filter(b => b.id !== site.id), site],
  };
}
export function separateAutomaticSites(p: Preferences): Preferences {
  const names = [...Object.keys(p.suppliers), ...Object.keys(p.productSuppliers ?? {}).map(k => k.slice(k.indexOf("|") + 1))];
  const generated = new Set([...names.map(n => stableId("supplier-site|" + n)), ...["HMP몰", "바로팜", "theSHOP"].map(n => stableId("wholesale|" + n))]);
  const automatic = p.bookmarks.filter(b => generated.has(b.id) && !b.favoriteExplicit && !b.deletedAt && b.rank === undefined && b.order === undefined);
  if (!automatic.length) return p;
  const ids = new Set(automatic.map(b => b.id));
  return { ...p, bookmarks: p.bookmarks.filter(b => !ids.has(b.id)), orderSites: [...new Map([...automatic, ...(p.orderSites ?? [])].map(b => [b.id, b])).values()] };
}
