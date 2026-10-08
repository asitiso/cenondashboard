import { useState } from "react";
import { normalizeName } from "./core";
import type { Preferences } from "./types";
import { allOrderSites } from "./orderSites";

export function removeSupplierSettings(prefs: Preferences, name: string, temporary = false, manualProductIds: string[] = []): Preferences {
  const suppliers = { ...prefs.suppliers };
  delete suppliers[name];
  return {
    ...prefs,
    suppliers,
    ...(temporary ? {
      hiddenSuppliers: [...new Set([...(prefs.hiddenSuppliers ?? []), name])],
      manualSupplierNames: { ...prefs.manualSupplierNames, ...Object.fromEntries(manualProductIds.map(id => [id, ""])) },
      referencePrices: Object.fromEntries(Object.entries(prefs.referencePrices ?? {}).filter(([key]) => key.slice(key.indexOf("|") + 1) !== name)),
      supplierNotes: Object.fromEntries(Object.entries(prefs.supplierNotes ?? {}).filter(([key]) => key.slice(key.indexOf("|") + 1) !== name)),
    } : {}),
    additionalSuppliers: Object.fromEntries(Object.entries(prefs.additionalSuppliers ?? {}).map(([id, names]) => [id, names.filter(n => n !== name)])),
    ...(prefs.orderSites ? { orderSites: prefs.orderSites.map(b => ({ ...b, ...(b.supplierNames ? { supplierNames: b.supplierNames.filter(n => n !== name) } : {}) })) } : {}),
    productSuppliers: Object.fromEntries(
      Object.entries(prefs.productSuppliers ?? {}).filter(([key]) => key.slice(key.indexOf("|") + 1) !== name),
    ),
  };
}

export function SupplierManager({ names, purchased, prefs, query, onQuery, onEdit, onRemove, busy }: {
  names: string[]; purchased: Set<string>; prefs: Preferences; query: string; onQuery: (value: string) => void;
  onEdit: (name: string, scrollTop?: number) => void; onRemove: (name: string, temporary: boolean) => void; busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const q = normalizeName(query);
  const rows = names.filter((n) => {
    const conf = prefs.suppliers[n];
    const site = allOrderSites(prefs).find((b) => b.id === conf?.bookmarkId);
    return normalizeName([n, site?.title, site?.url, conf?.phone, conf?.memo].join(" ")).includes(q);
  });
  return <>
    <div className="of-actions">
      <input aria-label="매입처 검색" placeholder="거래처명·사이트·주소·전화 검색" value={query} onChange={(e) => onQuery(e.target.value)} />
      <button onClick={() => setAdding(!adding)}>+ 매입처 추가</button>
    </div>
    {adding && <div className="of-actions">
      <input aria-label="새 매입처 이름" placeholder="새 매입처 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={!name.trim() || busy} onClick={e => onEdit(name.trim(), e.currentTarget.closest<HTMLElement>('[role="dialog"]')?.scrollTop)}>주문 정보 등록</button>
    </div>}
    <p className="of-muted">{rows.length.toLocaleString()}곳 · 임시 매입처는 삭제할 수 있습니다. 매입 기록의 거래처명과 즐겨찾기는 보존합니다.</p>
    <div className="of-supplier-manager">
      {rows.map((n) => {
        const conf = prefs.suppliers[n];
        const site = allOrderSites(prefs).find((b) => b.id === conf?.bookmarkId);
        const configured = !!conf || Object.keys(prefs.productSuppliers ?? {}).some((k) => k.slice(k.indexOf("|") + 1) === n) || Object.values(prefs.additionalSuppliers ?? {}).some(names => names.includes(n));
        const temporary = !purchased.has(n);
        return <div className="of-supplier-manager-row" key={n}>
          <div><strong>{n}</strong><small>{site ? `${site.title} · ${site.url || "주소 미등록"}` : conf?.phone || "주문 정보 미등록"}</small></div>
          <div className="of-actions">
            <button onClick={e => onEdit(n, e.currentTarget.closest<HTMLElement>('[role="dialog"]')?.scrollTop)}>{conf ? "수정" : "등록"}</button>
            <button disabled={(!configured && !temporary) || busy} onClick={() => onRemove(n, temporary)}>삭제</button>
          </div>
        </div>;
      })}
      {!rows.length && <p>검색 결과가 없습니다.</p>}
    </div>
  </>;
}
