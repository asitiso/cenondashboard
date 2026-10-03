import { safeUrl, stableId } from "./core";
import type { Bookmark, BookmarkFolder } from "./types";
export function suggestCategory(value: string): string {
  if (/동물/.test(value)) return "동물의약품";
  if (/봉투|소모품/.test(value)) return "봉투·소모품";
  if (/세무|청구|약국인터넷업무|약국에서 필요한/.test(value))
    return "업무·청구";
  if (/제약|브랜드/.test(value)) return "제약사·브랜드 직거래";
  if (/도매/.test(value)) return "종합도매";
  return "기타";
}
export function parseBookmarks(source: string): {
  folders: BookmarkFolder[];
  links: Bookmark[];
  skipped: number;
  duplicates: number;
} {
  if (!/NETSCAPE-Bookmark|<DL[\s>]/i.test(source))
    throw new Error("Chrome에서 내보낸 북마크 HTML 파일을 선택해 주세요.");
  const folders: BookmarkFolder[] = [];
  const links: Bookmark[] = [];
  const stack: Array<string | null> = [];
  let pending: string | null = null;
  let skipped = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  const decode = (s: string) =>
    new DOMParser()
      .parseFromString(`<span>${s}</span>`, "text/html")
      .body.textContent?.trim() ?? "";
  const tokens =
    /<(\/?DL)\b[^>]*>|<H3\b[^>]*>([\s\S]*?)<\/H3>|<A\b([^>]*)>([\s\S]*?)<\/A>/gi;
  for (const match of source.matchAll(tokens)) {
    const parent = stack[stack.length - 1] ?? null;
    if (match[1]) {
      if (match[1].toUpperCase() === "DL") {
        stack.push(pending ?? parent);
        pending = null;
      } else {
        stack.pop();
        pending = null;
      }
      continue;
    }
    if (match[2] !== undefined) {
      const name = decode(match[2]);
      const id = stableId(`${parent ?? ""}|${name}|${folders.length}`);
      folders.push({
        id,
        name,
        parentId: parent,
        category: suggestCategory(name),
        order: folders.length,
      });
      pending = id;
      continue;
    }
    const el = new DOMParser()
      .parseFromString(`<a ${match[3]}>${match[4]}</a>`, "text/html")
      .querySelector("a");
    const url = safeUrl(el?.getAttribute("href") ?? "");
    if (!url) {
      skipped++;
      continue;
    }
    if (seen.has(url)) duplicates++;
    seen.add(url);
    const folderId = parent ?? "root";
    const category = folders.find((x) => x.id === folderId)?.category ?? "기타";
    links.push({
      id: stableId(`${folderId}|${url}|${links.length}`),
      title: el?.textContent?.trim() || url,
      url,
      folderId,
      category,
      memo: "",
      order: links.length,
    });
  }
  if (links.some((l) => l.folderId === "root"))
    folders.push({
      id: "root",
      name: "폴더 없는 북마크",
      parentId: null,
      category: "기타",
      order: folders.length,
    });
  if (!links.length)
    throw new Error("가져올 수 있는 웹사이트 링크가 없습니다.");
  return { folders, links, skipped, duplicates };
}
export function selectedBookmarkTree(
  folders: BookmarkFolder[],
  links: Bookmark[],
  selected: Set<string>,
) {
  const chosen = links.filter((x) => selected.has(x.id));
  const ids = new Set(chosen.map((x) => x.folderId));
  for (const f of folders)
    if (ids.has(f.id)) {
      let parent = f.parentId;
      while (parent) {
        ids.add(parent);
        parent = folders.find((x) => x.id === parent)?.parentId ?? null;
      }
    }
  return { folders: folders.filter((x) => ids.has(x.id)), links: chosen };
}
