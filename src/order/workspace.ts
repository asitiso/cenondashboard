import { getPrice, normalizeName, safeUrl } from "./core";
import type {
  Product,
  Purchase,
  Preferences,
  Bookmark,
  BookmarkFolder,
  UnitSetting,
  Usage,
} from "./types";
export function allReceipts(p: Product): Purchase[] {
  return Object.values(p.supplierHistory ?? { legacy: p.latest })
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date) || a.sourceRow - b.sourceRow);
}
export function supplierRows(p: Product): Purchase[] {
  const seen = new Set<string>();
  return allReceipts(p).filter((r) => {
    if (seen.has(r.supplier)) return false;
    seen.add(r.supplier);
    return true;
  });
}
export function displayPrice(
  row: Purchase,
  setting: UnitSetting | undefined,
  usage: Usage,
) {
  const price = getPrice(row, setting, usage);
  return {
    amount: price.main,
    unit:
      price.mainUnit === "원본 단가"
        ? "단위"
        : price.mainUnit.replace(/당$/, ""),
  };
}
export function priceIncrease(p: Product, setting?: UnitSetting) {
  const [current, previous] = p.latest;
  if (!current || !previous) return null;
  const now = displayPrice(current, setting, p.usage).amount,
    old = displayPrice(previous, setting, p.usage).amount;
  if (old <= 0 || now <= old) return null;
  return {
    difference: now - old,
    percent: ((now - old) / old) * 100,
    current,
    previous,
  };
}
export function descendants(folders: BookmarkFolder[], id: string) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders)
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        changed = true;
      }
  }
  return ids;
}
export function moveFolder(
  p: Preferences,
  id: string,
  target: string | null,
  position: "inside" | "before" | "after" = "inside",
): Preferences {
  const source = p.folders.find((f) => f.id === id),
    other = p.folders.find((f) => f.id === target);
  if (!source || id === target || (target !== null && !other))
    throw Error("이동할 폴더를 확인하세요.");
  const parent = position === "inside" ? target : (other?.parentId ?? null);
  if (parent && descendants(p.folders, id).has(parent))
    throw Error("자기 자신이나 하위 폴더 안으로 이동할 수 없습니다.");
  if (
    p.folders.some(
      (f) => f.id !== id && f.parentId === parent && f.name === source.name,
    )
  )
    throw Error("같은 위치에 같은 이름의 폴더가 있습니다.");
  const rest = p.folders
    .filter((f) => f.id !== id)
    .sort((a, b) => a.order - b.order);
  const siblings = rest.filter((f) => f.parentId === parent);
  let at =
    position === "inside"
      ? siblings.length
        ? rest.indexOf(siblings[siblings.length - 1]) + 1
        : rest.length
      : rest.findIndex((f) => f.id === target) + (position === "after" ? 1 : 0);
  rest.splice(at, 0, { ...source, parentId: parent });
  return { ...p, folders: rest.map((f, order) => ({ ...f, order })) };
}
export function deleteFolder(p: Preferences, id: string) {
  const source = p.folders.find((f) => f.id === id);
  if (!source) return p;
  let folders = p.folders
    .filter((f) => f.id !== id)
    .map((f) => (f.parentId === id ? { ...f, parentId: source.parentId } : f));
  let destination = source.parentId;
  if (!destination) {
    const other = folders.find((f) => f.parentId === null && f.name === "기타");
    destination = other?.id ?? crypto.randomUUID();
    if (!other)
      folders.push({
        id: destination,
        name: "기타",
        parentId: null,
        category: "기타",
        order: folders.length,
      });
  }
  return {
    ...p,
    folders,
    bookmarks: p.bookmarks.map((b) =>
      b.folderId === id ? { ...b, folderId: destination! } : b,
    ),
  };
}
export function moveSite(
  p: Preferences,
  id: string,
  folderId: string,
  beforeId?: string,
) {
  if (!p.folders.some((f) => f.id === folderId))
    throw Error("폴더를 확인하세요.");
  const source = p.bookmarks.find((b) => b.id === id);
  if (!source) throw Error("사이트가 없습니다.");
  const links = p.bookmarks
    .filter((b) => b.id !== id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const siblings = links.filter((b) => b.folderId === folderId);
  const at = beforeId
    ? links.findIndex((b) => b.id === beforeId)
    : siblings.length
      ? links.indexOf(siblings[siblings.length - 1]) + 1
      : links.length;
  links.splice(at < 0 ? links.length : at, 0, {
    ...source,
    folderId,
    category: p.folders.find((f) => f.id === folderId)!.category,
  });
  return { ...p, bookmarks: links.map((b, order) => ({ ...b, order })) };
}
export function mergeBookmarks(
  p: Preferences,
  folders: BookmarkFolder[],
  links: Bookmark[],
) {
  const keys = new Set(
    p.bookmarks
      .filter((b) => !b.deletedAt)
      .map((b) => b.title + "\0" + safeUrl(b.url)),
  );
  const incoming = links.filter((b) => {
    const key = b.title + "\0" + safeUrl(b.url);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  if (!incoming.length)
    return { preferences: p, added: 0, skipped: links.length };
  const root = crypto.randomUUID(),
    ids = new Map(folders.map((f) => [f.id, crypto.randomUUID()]));
  const needed = new Set(incoming.map((b) => b.folderId));
  for (const id of [...needed]) {
    let parent = folders.find((f) => f.id === id)?.parentId;
    while (parent) {
      needed.add(parent);
      parent = folders.find((f) => f.id === parent)?.parentId;
    }
  }
  const names = new Set(p.bookmarks.map((b) => b.title));
  const added = incoming.map((b) => {
    let title = b.title,
      n = 2;
    while (names.has(title)) title = b.title + " (" + n++ + ")";
    names.add(title);
    return {
      ...b,
      id: crypto.randomUUID(),
      title,
      folderId: ids.get(b.folderId) ?? root,
    };
  });
  return {
    preferences: {
      ...p,
      bookmarks: [...p.bookmarks, ...added],
      folders: [
        ...p.folders,
        {
          id: root,
          name: "가져온 즐겨찾기",
          parentId: null,
          category: "기타",
          order: p.folders.length,
        },
        ...folders
          .filter((f) => needed.has(f.id))
          .map((f, i) => ({
            ...f,
            id: ids.get(f.id)!,
            parentId: ids.get(f.parentId ?? "") ?? root,
            order: p.folders.length + 1 + i,
          })),
      ],
    },
    added: added.length,
    skipped: links.length - added.length,
  };
}
export function barcodeLink(
  p: Preferences,
  id: string,
  code: string,
  transfer = false,
) {
  const map = { ...p.barcodes };
  const owner = Object.entries(map).find(
    ([key, values]) => key !== id && values.includes(code),
  );
  if (owner && !transfer) throw Error("이미 다른 상품에 연결된 바코드입니다.");
  if (owner) map[owner[0]] = owner[1].filter((v) => v !== code);
  map[id] = [...new Set([...(map[id] ?? []), code])];
  return { ...p, barcodes: map };
}
export function matchingImportLinks(
  folders: BookmarkFolder[],
  links: Bookmark[],
  query: string,
) {
  const q = normalizeName(query);
  return links.filter((b) => {
    if (!q || normalizeName(b.title).includes(q)) return true;
    let id: string | null = b.folderId;
    while (id) {
      const f = folders.find((f) => f.id === id);
      if (!f) break;
      if (normalizeName(f.name).includes(q)) return true;
      id = f.parentId;
    }
    return false;
  });
}
export function shortName(p: Product, prefs: Preferences) {
  return (
    prefs.searchNames?.[p.baseId] ??
    (p.sourceName
      .replace(/\d.*$/, "")
      .replace(/정$|캡슐$|밀리그램$/, "")
      .trim() ||
      p.name)
  );
}
