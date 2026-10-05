import type { Bookmark } from "./types";

export function SiteButton({ site, onOpen, onPin, busy }: { site: Bookmark; onOpen: (site: Bookmark) => void; onPin: (site: Bookmark) => void; busy?: boolean }) {
  const pinned = site.rank !== undefined;
  return <div className="of-site-button">
    <button className="of-site-open" onClick={() => onOpen(site)}>{site.title} ↗</button>
    <button className="of-site-pin" disabled={busy} aria-pressed={pinned} aria-label={`${site.title} ${pinned ? "고정 해제" : "고정"}`} title={pinned ? "고정 해제" : "고정 즐겨찾기에 추가"} onClick={() => onPin(site)}>{pinned ? "★" : "☆"}</button>
  </div>;
}
