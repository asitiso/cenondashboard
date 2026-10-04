import { useState } from "react";
import type { Product, Preferences, Purchase } from "./types";
import {
  displayPrice,
  priceChange,
  supplierRows,
  allReceipts,
} from "./workspace";
import { yearStart } from "./core";
export type CardProps = {
  product: Product;
  preferences: Preferences;
  scope: string[];
  expanded: boolean;
  toggle: () => void;
  asOf: string;
  pending?: string;
  onOrder: (p: Product, supplier: string, method?: string) => void;
  onScopeOrder: (p: Product, supplier: string) => void;
  onSupplier: (p: Product, name: string) => void;
  onSearchName: (p: Product) => void;
  onUnit: (p: Product) => void;
  onBarcode: (p: Product) => void;
  onClassify: (p: Product) => void;
};
export function SearchCard({
  product: p,
  preferences: prefs,
  scope,
  expanded,
  toggle,
  asOf,
  pending,
  onOrder,
  onScopeOrder,
  onSupplier,
  onSearchName,
  onUnit,
  onBarcode,
  onClassify,
}: CardProps) {
  const [more, setMore] = useState(false),
    [history, setHistory] = useState("");
  const setting = prefs.units[p.baseId],
    rows = supplierRows(p),
    selected = scope.length
      ? rows.find((r) => scope.includes(r.supplier))
      : rows[0],
    change = priceChange(p, setting);
  const supplierSetting = (name: string) =>
    prefs.productSuppliers?.[p.baseId + "|" + name] ?? prefs.suppliers[name];
  const site = (name: string) =>
    prefs.bookmarks.find(
      (b) => !b.deletedAt && b.id === supplierSetting(name)?.bookmarkId,
    );
  const hasOrder = (name: string) =>
    !!site(name)?.url || !!site(name)?.phone || !!supplierSetting(name)?.phone;
  const price = (r: Purchase) => {
    const v = displayPrice(r, setting, p.usage);
    return (
      <>
        {v.amount.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원 /{" "}
        {v.unit}
      </>
    );
  };
  return (
    <article className="of-product">
      <div className="of-product-summary">
        <div className="of-product-name">
          <button aria-expanded={expanded} onClick={toggle}>
            {expanded ? "▾" : "▸"} {p.name}
          </button>
          {p.usage === "dispensing" && (p.manufacturer || p.code) ? (
            <small>
              {[p.manufacturer, p.code].filter(Boolean).join(" · ")}
            </small>
          ) : null}
        </div>
        <div className="of-product-price">
          {selected ? (
            <>
              <div>
                {price(selected)}{" "}
                {!expanded && change && (
                  <span
                    className={"of-price-change-tag " + change.direction}
                    title={
                      change.direction === "up"
                        ? "직전 매입 대비 단가 상승"
                        : "직전 매입 대비 단가 하락"
                    }
                  >
                    {change.direction === "up" ? "▲" : "▼"}{" "}
                    {change.direction === "up" ? "+" : "-"}
                    {Math.abs(change.difference).toLocaleString("ko-KR", {
                      maximumFractionDigits: 2,
                    })}
                    원
                  </span>
                )}
              </div>
              <small title={selected.date + " · " + selected.supplier}>
                매입 {selected.date} · {selected.supplier}
              </small>
            </>
          ) : (
            <small>매입 이력 없음</small>
          )}
        </div>
        {!expanded && selected && hasOrder(selected.supplier) && (
          <button
            className="of-primary of-order"
            onClick={() => onScopeOrder(p, selected.supplier)}
          >
            바로주문 ↗
          </button>
        )}
      </div>
      {expanded && (
        <div className="of-product-details">
          <div className="of-details-tools">
            <span className="of-muted">
              {p.usage === "dispensing"
                ? "조제"
                : p.usage === "retail"
                  ? "판매"
                  : "미분류"}
            </span>
            <div className="of-actions">
              <button onClick={() => onUnit(p)}>단위 설정</button>
              <button onClick={() => onBarcode(p)}>
                {pending ? "바코드 연결" : "바코드 관리"}
              </button>
              {p.matchStatus !== "matched" && (
                <button onClick={() => onClassify(p)}>상품 연결</button>
              )}
              <button onClick={() => onSearchName(p)}>검색명 수정</button>
            </div>
          </div>
          {change && (
            <div className={"of-price-change " + change.direction}>
              <strong>
                {change.direction === "up" ? "▲" : "▼"}{" "}
                {Math.abs(change.difference).toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                원 {change.direction === "up" ? "상승" : "하락"} (
                {change.direction === "up" ? "+" : "-"}
                {change.percent.toFixed(1)}%)
              </strong>
              <small>
                {change.current.supplier} · 직전{" "}
                {displayPrice(
                  change.previous,
                  setting,
                  p.usage,
                ).amount.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                원 → 현재{" "}
                {displayPrice(
                  change.current,
                  setting,
                  p.usage,
                ).amount.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                원 · {change.previous.date} → {change.current.date}
              </small>
            </div>
          )}
          {(more ? rows : rows.slice(0, 5)).map((r) => {
            const link = site(r.supplier),
              config = supplierSetting(r.supplier),
              methods = config?.methods ??
                link?.methods ?? [config?.method ?? "사이트"];
            const old = r.date < yearStart(asOf),
              receipts = allReceipts(p)
                .filter((x) => x.supplier === r.supplier)
                .slice(0, 3);
            return (
              <div className="of-vendor-wrap" key={r.supplier}>
                <div className="of-vendor">
                  <div>
                    <button
                      className="of-vendor-name"
                      aria-expanded={history === r.supplier}
                      onClick={() =>
                        setHistory(history === r.supplier ? "" : r.supplier)
                      }
                    >
                      {history === r.supplier ? "▾" : "▸"} {r.supplier}
                    </button>
                    <div className="of-badges">
                      {rows[0] === r && <span>최근 매입처</span>}
                      {scope.includes(r.supplier) && <span>검색 거래처</span>}
                      {old && <span>1년 이상 지난 가격</span>}
                    </div>
                  </div>
                  <div className="of-price">
                    {price(r)}
                    <small>매입 {r.date}</small>
                  </div>
                  <button
                    className="of-primary of-order"
                    onClick={() =>
                      hasOrder(r.supplier)
                        ? onOrder(p, r.supplier, methods[0])
                        : onSupplier(p, r.supplier)
                    }
                  >
                    {hasOrder(r.supplier)
                      ? methods[0] === "사이트"
                        ? "바로주문 ↗"
                        : methods[0]
                      : "주소 등록"}
                  </button>
                </div>
                {history === r.supplier && (
                  <div className="of-history">
                    <div className="of-actions">
                      <strong>최근 매입 3건</strong>
                      <button onClick={() => onSupplier(p, r.supplier)}>
                        주문 정보 수정
                      </button>
                    </div>
                    {receipts.map((h, i) => (
                      <div key={i}>
                        <span>{h.date}</span>
                        <span>{price(h)}</span>
                        {h.quantity > 0 && (
                          <span>
                            입고 {h.quantity.toLocaleString()}
                            {setting?.baseUnit ?? "단위"}
                          </span>
                        )}
                      </div>
                    ))}
                    {methods.length > 1 && (
                      <div className="of-actions">
                        {methods.slice(1).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => onOrder(p, r.supplier, mode)}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!rows.length && (
            <div className="of-empty">
              매입 이력이 없습니다.
              {p.manualSupplier && (
                <button onClick={() => onSupplier(p, p.manualSupplier!)}>
                  {p.manualSupplier} · 주문 정보
                </button>
              )}
            </div>
          )}
          {rows.length > 5 && (
            <button className="of-more" onClick={() => setMore(!more)}>
              {more
                ? "다른 거래처 접기"
                : "다른 거래처 보기 · " + (rows.length - 5) + "곳"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
