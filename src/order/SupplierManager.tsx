import { useState } from "react";
import { normalizeName } from "./core";
import type { Preferences } from "./types";

export function removeSupplierSettings(prefs: Preferences, name: string): Preferences {
  const suppliers = { ...prefs.suppliers };
  delete suppliers[name];
  return {
    ...prefs,
    suppliers,
    additionalSuppliers: Object.fromEntries(Object.entries(prefs.additionalSuppliers ?? {}).map(([id, names]) => [id, names.filter(n => n !== name)])),
    productSuppliers: Object.fromEntries(
      Object.entries(prefs.productSuppliers ?? {}).filter(([key]) => key.slice(key.indexOf("|") + 1) !== name),
    ),
    bookmarks: prefs.bookmarks.map((b) => ({
      ...b,
      ...(b.supplierNames ? { supplierNames: b.supplierNames.filter((n) => n !== name) } : {}),
    })),
  };
}

export function SupplierManager({ names, prefs, query, onQuery, onEdit, onRemove, busy }: {
  names: string[]; prefs: Preferences; query: string; onQuery: (value: string) => void;
  onEdit: (name: string) => void; onRemove: (name: string) => void; busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const q = normalizeName(query);
  const rows = names.filter((n) => {
    const conf = prefs.suppliers[n];
    const site = prefs.bookmarks.find((b) => !b.deletedAt && b.id === conf?.bookmarkId);
    return normalizeName([n, site?.title, site?.url, conf?.phone, conf?.memo].join(" ")).includes(q);
  });
  return <>
    <div className="of-actions">
      <input aria-label="매입처 검색" placeholder="거래처명·사이트·주소·전화 검색" value={query} onChange={(e) => onQuery(e.target.value)} />
      <button onClick={() => setAdding(!adding)}>+ 매입처 추가</button>
    </div>
    {adding && <div className="of-actions">
      <input aria-label="새 매입처 이름" placeholder="새 매입처 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={!name.trim() || busy} onClick={() => onEdit(name.trim())}>주문 정보 등록</button>
    </div>}
    <p className="of-muted">{rows.length.toLocaleString()}곳 · 매입 기록의 거래처명은 원본 그대로 유지합니다. 삭제는 주문 정보만 해제하며 매입 이력과 즐겨찾기 사이트는 보존합니다.</p>
    <div className="of-supplier-manager">
      {rows.map((n) => {
        const conf = prefs.suppliers[n];
        const site = prefs.bookmarks.find((b) => !b.deletedAt && b.id === conf?.bookmarkId);
        const configured = !!conf || Object.keys(prefs.productSuppliers ?? {}).some((k) => k.slice(k.indexOf("|") + 1) === n) || Object.values(prefs.additionalSuppliers ?? {}).some(names => names.includes(n));
        return <div className="of-supplier-manager-row" key={n}>
          <div><strong>{n}</strong><small>{site ? `${site.title} · ${site.url || "주소 미등록"}` : conf?.phone || "주문 정보 미등록"}</small></div>
          <div className="of-actions">
            <button onClick={() => onEdit(n)}>{conf ? "수정" : "등록"}</button>
            <button disabled={!configured || busy} onClick={() => onRemove(n)}>삭제</button>
          </div>
        </div>;
      })}
      {!rows.length && <p>검색 결과가 없습니다.</p>}
    </div>
  </>;
}
