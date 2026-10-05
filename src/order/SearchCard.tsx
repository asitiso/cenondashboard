import { useState } from "react";
import type { Product, Preferences, Purchase } from "./types";
import {
  displayPrice,
  priceIncrease,
  priceDecrease,
  supplierRows,
  allReceipts,
} from "./workspace";
import { yearStart } from "./core";
import { allOrderSites } from "./orderSites";
import { isManualProduct } from "./productSettings";
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
  onAddSupplier: (p: Product) => void;
  onChooseSite: (p: Product, name: string) => void;
  onSearchName: (p: Product) => void;
  onEditProduct: (p: Product) => void;
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
  onAddSupplier,
  onChooseSite,
  onSearchName,
  onEditProduct,
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
    rise = priceIncrease(p, setting),
    drop = priceDecrease(p, setting);
  const supplierSetting = (name: string) =>
    prefs.productSuppliers?.[p.baseId + "|" + name] ?? prefs.suppliers[name];
  const referenceSupplier = [...(prefs.additionalSuppliers?.[p.baseId] ?? []), ...(p.manualSupplier ? [p.manualSupplier] : [])]
    .find(name => (!scope.length || scope.includes(name)) && !!prefs.referencePrices?.[p.baseId + "|" + name]);
  const reference = referenceSupplier ? prefs.referencePrices?.[p.baseId + "|" + referenceSupplier] : undefined;
  const site = (name: string) =>
    allOrderSites(prefs).find(
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
                {!expanded && rise && (
                  <span
                    className={
                      "of-rise-tag " + (rise.percent >= 5 ? "high" : "")
                    }
                  >
                    ▲ {rise.percent.toFixed(1)}%
                  </span>
                )}
                {!expanded && drop && (
                  <span
                    className={
                      "of-drop-tag " + (drop.percent >= 5 ? "high" : "")
                    }
                  >
                    ▼ {drop.percent.toFixed(1)}%
                  </span>
                )}
              </div>
              <small title={selected.date + " · " + selected.supplier}>
                매입 {selected.date} · {selected.supplier}
              </small>
            </>
          ) : reference ? (
            <><div>{reference.amount.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원 / {reference.unit}</div><small>등록 가격 · {referenceSupplier}</small></>
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
              <button onClick={() => onAddSupplier(p)}>다른 매입처 등록</button>
              <button onClick={() => onUnit(p)}>단위 설정</button>
              <button onClick={() => onBarcode(p)}>
                {pending ? "바코드 연결" : "바코드 관리"}
              </button>
              {p.matchStatus !== "matched" && (
                <button onClick={() => onClassify(p)}>상품 연결</button>
              )}
              <button onClick={() => onSearchName(p)}>검색명 수정</button>
              {isManualProduct(p) && <button onClick={() => onEditProduct(p)}>상품 수정·삭제</button>}
            </div>
          </div>
          {rise && (
            <div
              className={"of-price-rise " + (rise.percent >= 5 ? "high" : "")}
            >
              <strong>
                ▲{" "}
                {rise.difference.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                원 상승 (+{rise.percent.toFixed(1)}%) · 가격 확인
              </strong>
              <small>
                최근 {rise.current.supplier}{" "}
                {displayPrice(
                  rise.current,
                  setting,
                  p.usage,
                ).amount.toLocaleString()}
                원 ({rise.current.date}) ← 직전 {rise.previous.supplier}{" "}
                {displayPrice(
                  rise.previous,
                  setting,
                  p.usage,
                ).amount.toLocaleString()}
                원 ({rise.previous.date})
                {rise.current.supplier !== rise.previous.supplier
                  ? " · 거래처 변경"
                  : ""}
              </small>
            </div>
          )}
          {drop && (
            <div
              className={"of-price-drop " + (drop.percent >= 5 ? "high" : "")}
            >
              <strong>
                ▼{" "}
                {drop.difference.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                원 하락 (-{drop.percent.toFixed(1)}%) · 가격 확인
              </strong>
              <small>
                최근 {drop.current.supplier}{" "}
                {displayPrice(
                  drop.current,
                  setting,
                  p.usage,
                ).amount.toLocaleString()}
                원 ({drop.current.date}) ← 직전 {drop.previous.supplier}{" "}
                {displayPrice(
                  drop.previous,
                  setting,
                  p.usage,
                ).amount.toLocaleString()}
                원 ({drop.previous.date})
                {drop.current.supplier !== drop.previous.supplier
                  ? " · 거래처 변경"
                  : ""}
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
                    {prefs.supplierNotes?.[p.baseId + "|" + r.supplier] && <small className="of-muted">{prefs.supplierNotes[p.baseId + "|" + r.supplier]}</small>}
                  </div>
                  <div className="of-price">
                    {price(r)}
                    <small>매입 {r.date}</small>
                  </div>
                  <div className="of-vendor-order"><button
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
                  {(config?.bookmarkIds?.length ?? 0) > 1 && <button onClick={() => onChooseSite(p, r.supplier)}>주문처 선택</button>}
                  </div>
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
          {[...new Set([...(prefs.additionalSuppliers?.[p.baseId] ?? []), ...(p.manualSupplier ? [p.manualSupplier] : [])])].filter(name => !rows.some(r => r.supplier === name)).map(name => (
            <div className="of-vendor-wrap" key={name}>
              <div className="of-vendor">
                <div><button className="of-vendor-name" onClick={() => onSupplier(p, name)}>{name}</button><small className="of-muted">등록한 매입처 · 매입 기록 없음</small>{prefs.supplierNotes?.[p.baseId + "|" + name] && <small className="of-muted">{prefs.supplierNotes[p.baseId + "|" + name]}</small>}</div>
                <div className="of-price">
                  {prefs.referencePrices?.[p.baseId + "|" + name] ? <><span>{prefs.referencePrices[p.baseId + "|" + name].amount.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원 / {prefs.referencePrices[p.baseId + "|" + name].unit}</span><small>등록 가격</small></> : <small>가격 미등록</small>}
                  <button onClick={() => onSupplier(p, name)}>가격·비고 수정</button>
                </div>
                <div className="of-vendor-order"><button className="of-primary of-order" onClick={() => hasOrder(name) ? onOrder(p, name) : onSupplier(p, name)}>{hasOrder(name) ? "바로주문 ↗" : "주소 등록"}</button>
                {(supplierSetting(name)?.bookmarkIds?.length ?? 0) > 1 && <button onClick={() => onChooseSite(p, name)}>주문처 선택</button>}
                </div>
              </div>
            </div>
          ))}
          {!rows.length && !prefs.additionalSuppliers?.[p.baseId]?.length && !p.manualSupplier && (
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
