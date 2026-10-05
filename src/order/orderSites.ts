import { stableId } from "./core";
import type { Bookmark, Preferences } from "./types";

export function allOrderSites(p: Preferences): Bookmark[] {
  return (p.orderSites ?? []).filter(b => !b.deletedAt);
}
export function connectionSites(p: Preferences): Bookmark[] {
  const sites = new Map(p.bookmarks.filter(b => !b.deletedAt).map(b => [b.id, b]));
  for (const site of allOrderSites(p)) {
    const favorite = sites.get(site.id);
    sites.set(site.id, { ...site, rank: favorite?.rank });
  }
  return [...sites.values()];
}
export function saveOrderSite(p: Preferences, site: Bookmark): Preferences {
  const { rank: _rank, favoriteExplicit: _explicit, deletedAt: _deleted, ...registered } = site;
  return {
    ...p,
    orderSites: [...(p.orderSites ?? []).filter(b => b.id !== site.id), registered],
  };
}
export function separateAutomaticSites(p: Preferences): Preferences {
  const names = [...Object.keys(p.suppliers), ...Object.keys(p.productSuppliers ?? {}).map(k => k.slice(k.indexOf("|") + 1))];
  const generated = new Set([...names.map(n => stableId("supplier-site|" + n)), ...["HMP몰", "바로팜", "theSHOP"].map(n => stableId("wholesale|" + n))]);
  const automatic = p.bookmarks.filter(b => generated.has(b.id) && !b.favoriteExplicit && !b.deletedAt && b.rank === undefined && b.order === undefined);
  const referenced = new Set(Object.values({ ...p.suppliers, ...p.productSuppliers }).flatMap(s => [s.bookmarkId, ...(s.bookmarkIds ?? [])]).filter(Boolean));
  const copied = p.bookmarks.filter(b => (referenced.has(b.id) || automatic.includes(b)) && !p.orderSites?.some(site => site.id === b.id)).map(b => {
    const { deletedAt: _deleted, rank: _rank, favoriteExplicit: _explicit, ...site } = b;
    return site;
  });
  if (!automatic.length && !copied.length) return p;
  const ids = new Set(automatic.map(b => b.id));
  return { ...p, bookmarks: p.bookmarks.filter(b => !ids.has(b.id)), orderSites: [...(p.orderSites ?? []), ...copied] };
}
