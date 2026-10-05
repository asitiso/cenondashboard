import { useState } from "react";
import { normalizeName } from "./core";
import { isWholesaleSite, wholesaleTitles } from "./additionalSuppliers";
export function AddSupplier({ names, existing, busy, onAdd }: { names: string[]; existing: string[]; busy: boolean; onAdd: (name: string, wholesale: boolean) => void }) {
  const [query, setQuery] = useState("");
  const matching = names.filter(n => !existing.includes(n) && !isWholesaleSite(n) && normalizeName(n).includes(normalizeName(query)));
  return <>
    <p>매입 기록 없이 이 상품의 주문처만 추가합니다. 가격·매입 날짜는 생성하지 않습니다.</p>
    <div className="of-actions">{wholesaleTitles.filter(n => normalizeName(n).includes(normalizeName(query))).map(name => <button key={name} disabled={busy} onClick={() => onAdd(name, true)}>{name}</button>)}</div>
    <small>세 사이트 중 어느 곳을 선택해도 모두 연결됩니다. 기본 주문처는 HMP몰입니다. 즐겨찾기는 추가하지 않습니다.</small>
    <label>매입처 검색·새 이름 입력<input aria-label="추가할 매입처 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="거래처 이름 일부로 검색" /></label>
    <div className="of-actions">{matching.slice(0, 20).map(name => <button key={name} disabled={busy} onClick={() => onAdd(name, name === "종합도매")}>{name}</button>)}</div>
    {matching.length > 20 && <small>후보 {matching.length}곳 · 검색어를 입력하면 원하는 매입처로 좁혀집니다.</small>}
    {query.trim() && !isWholesaleSite(query) && !existing.includes(query.trim()) && !names.includes(query.trim()) && <button disabled={busy} onClick={() => onAdd(query.trim(), false)}>“{query.trim()}” 등록</button>}
    {existing.includes(query.trim()) && <p>이미 이 상품에 등록된 매입처입니다.</p>}
  </>;
}
