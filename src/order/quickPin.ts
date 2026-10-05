import { pinBookmark } from "./core";
import { allOrderSites } from "./orderSites";
import type { Preferences } from "./types";

export function toggleSitePin(p: Preferences, id: string): Preferences {
  const existing = p.bookmarks.find(b => b.id === id && !b.deletedAt);
  if (existing) return { ...p, bookmarks: pinBookmark(p.bookmarks.map(b => b.id === id ? { ...b, favoriteExplicit: true } : b), id) };
  const site = allOrderSites(p).find(b => b.id === id);
  if (!site) throw Error("사이트가 변경되었습니다. 다시 선택해 주세요.");
  const folderId = p.folders.find(f => f.id === site.folderId)?.id ?? p.folders[0]?.id ?? "favorites-default";
  return { ...p,
    folders: p.folders.length ? p.folders : [{ id: folderId, name: "즐겨찾기", parentId: null, category: "기타", order: 0 }],
    bookmarks: pinBookmark([...p.bookmarks.filter(b => b.id !== id), { ...site, folderId, favoriteExplicit: true }], id),
  };
}
