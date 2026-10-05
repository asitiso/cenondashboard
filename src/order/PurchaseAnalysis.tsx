import { useEffect, useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { Product } from "./types";
import type { useOrderData } from "./useOrderData";
import {
  buildPurchaseAnalysis,
  matchesAnalysis,
  groupVendorPrices,
  type VendorPrice,
} from "./analytics";
import "./analytics.css";

type Mode = "rises" | "gaps" | "frequent";
const labels: Record<Mode, string> = {
  rises: "가격 상승",
  gaps: "매입처별 가격",
  frequent: "자주 매입하는 품목",
};
const money = (n: number) =>
  n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const percent = (n: number) =>
  Math.abs(n) > 0 && Math.abs(n) < 0.05
    ? "0.1% 미만"
    : `${Math.abs(n).toFixed(1)}%`;
function PriceLine({ value, label }: { value: VendorPrice; label?: string }) {
  return (
    <span
      className={`pa-vendor-price ${label === "직전" ? "pa-previous" : ""}`}
    >
      {label && <span className="pa-price-label">{label}</span>}
      <strong>
        {money(value.amount)}원 / {value.unit || "단위"}
      </strong>
      <span>{value.supplier}</span>
      <small>{value.manual ? "직접 등록 · 날짜 없음" : value.date}</small>
    </span>
  );
}
export default function PurchaseAnalysis({
  data,
  onInspect,
}: {
  data: ReturnType<typeof useOrderData>;
  onInspect: (p: Product) => void;
}) {
  const { snapshot, preferences, loading, error } = data;
  const analysis = useMemo(
    () => buildPurchaseAnalysis(snapshot, preferences),
    [snapshot, preferences],
  );
  const [mode, setMode] = useState<Mode>("rises");
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState("");
  const [limit, setLimit] = useState(50);
  const [change, setChange] = useState("rise");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [top, setTop] = useState(false);
  useEffect(() => {
    setLimit(50);
  }, [mode, query, supplier, change]);
  useEffect(() => {
    const scroll = () => setTop(window.scrollY > 300);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  const source =
    mode === "rises"
      ? analysis.changes.filter(
          (item) =>
            change === "all" ||
            (change === "rise"
              ? item.increase!.difference > 0
              : change === "fall"
                ? item.increase!.difference < 0
                : item.increase!.difference === 0),
        )
      : analysis[mode];
  const title =
    mode === "rises"
      ? {
          rise: "가격 상승",
          fall: "가격 하락",
          same: "가격 동일",
          all: "가격 변화",
        }[change]
      : labels[mode];
  const filtered = source.filter((item) =>
    matchesAnalysis(item, query, supplier),
  );
  return (
    <div className="of-app pa-app">
      <main className="pa-main">
        <div className="of-heading">
          <h1>매입 분석</h1>
          <small>
            {snapshot ? `매입 자료: ${snapshot.asOf} 기준` : "매입 자료 없음"}
          </small>
        </div>
        <p className="of-muted">
          점검할 상품을 찾고, 상품명을 눌러 매입처·주문 정보를 확인하세요.
        </p>
        {error && <p role="alert">자료를 불러오지 못했습니다: {error}</p>}
        {loading && !snapshot ? (
          <p role="status">매입 자료를 불러오는 중입니다.</p>
        ) : !snapshot ? (
          <p>
            주문·업무 찾기의 관리에서 매입 자료를 가져오면 분석할 수 있습니다.
          </p>
        ) : (
          <>
            <nav className="pa-modes" aria-label="매입 분석 종류">
              {(["rises", "gaps", "frequent"] as Mode[]).map((value) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  className={mode === value ? "of-primary" : ""}
                  onClick={() => setMode(value)}
                >
                  {labels[value]}{" "}
                  <strong>{analysis[value].length.toLocaleString()}개</strong>
                </button>
              ))}
            </nav>
            <div className="pa-filters">
              <div className="of-search">
                <input
                  aria-label="매입 분석 검색"
                  placeholder="상품명 / 제약사 / 매입처 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    aria-label="분석 검색어 지우기"
                    onClick={() => setQuery("")}
                  >
                    ×
                  </button>
                )}
              </div>
              <label>
                관련 매입처
                <select
                  aria-label="분석 매입처"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">전체</option>
                  {analysis.suppliers.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              {mode === "rises" && (
                <label>
                  가격 변화
                  <select
                    aria-label="가격 변화 필터"
                    value={change}
                    onChange={(e) => setChange(e.target.value)}
                  >
                    <option value="rise">상승</option>
                    <option value="fall">하락</option>
                    <option value="same">동일</option>
                    <option value="all">전체</option>
                  </select>
                </label>
              )}
            </div>
            <div className="pa-caption">
              <h2>
                {title} · {filtered.length.toLocaleString()}개
              </h2>
              <small>
                {mode === "frequent"
                  ? "최근 1년 매입 기록 많은 순"
                  : "최근 매입 날짜순"}
              </small>
            </div>
            <p className="of-muted pa-scope">
              {mode === "frequent"
                ? `${analysis.start} ~ ${snapshot.asOf}의 매입 기록 수입니다. 주문 수량이나 현재 재고를 뜻하지 않습니다.`
                : mode === "gaps"
                  ? "매입처별 가격이 다른 상품만 표시합니다. 최근 1년 마지막 매입 가격과 직접 등록 가격을 비교합니다."
                  : "최근 1년 내 마지막 매입과 그보다 앞선 날짜의 매입 기록을 비교합니다. 다른 매입처도 포함합니다."}
            </p>
            <div className="pa-list">
              {filtered.slice(0, limit).map((item) => (
                <article
                  className={`pa-row pa-${mode}`}
                  key={item.product.baseId}
                >
                  <div className="pa-product">
                    <button
                      className="pa-product-name"
                      onClick={() => onInspect(item.product)}
                    >
                      {item.product.name}
                    </button>
                    <small>
                      {[item.product.manufacturer, item.product.code]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    {mode === "frequent" && (
                      <small className="pa-names">
                        {item.suppliers.slice(0, 3).join(" · ")}
                        {item.suppliers.length > 3
                          ? ` 외 ${item.suppliers.length - 3}곳`
                          : ""}
                      </small>
                    )}
                  </div>
                  <div className="pa-change">
                    {mode === "rises" && item.increase && (
                      <>
                        <strong
                          className={`pa-change-badge ${item.increase.difference > 0 ? "pa-rise" : item.increase.difference < 0 ? "pa-fall" : "pa-same"}`}
                        >
                          {item.increase.difference === 0
                            ? "가격 동일"
                            : `${item.increase.difference > 0 ? "▲" : "▼"} ${percent(item.increase.percent)}`}
                        </strong>
                        <strong
                          className={`pa-change-badge ${item.increase.difference > 0 ? "pa-rise" : item.increase.difference < 0 ? "pa-fall" : "pa-same"}`}
                        >
                          {item.increase.difference === 0
                            ? "변동 없음"
                            : `${item.increase.difference > 0 ? "+" : "−"}${money(Math.abs(item.increase.difference))}원`}
                        </strong>
                        {item.increase.current.supplier !==
                          item.increase.previous.supplier && (
                          <span className="pa-tag">매입처 변경</span>
                        )}
                      </>
                    )}
                    {mode === "gaps" && (
                      <>
                        <strong className="pa-change-badge pa-gap">
                          {money(item.vendorDifference ?? 0)}원
                        </strong>
                        <small>최고·최저 가격 차이</small>
                      </>
                    )}
                    {mode === "frequent" && (
                      <>
                        <strong className="pa-change-badge pa-same">
                          {item.frequency.toLocaleString()}건
                        </strong>
                        <small>매입 기록</small>
                      </>
                    )}
                  </div>
                  <div className="pa-info">
                    {mode === "rises" && item.increase && (
                      <>
                        <PriceLine value={item.increase.current} label="최근" />
                        <PriceLine
                          value={item.increase.previous}
                          label="직전"
                        />
                      </>
                    )}
                    {mode === "gaps" && (
                      <>
                        {groupVendorPrices(
                          item.vendors.slice(
                            0,
                            expanded.has(item.product.baseId) ? undefined : 3,
                          ),
                        ).map((value, index) => (
                          <PriceLine
                            key={`${value.supplier}-${index}`}
                            value={value}
                          />
                        ))}
                        {item.vendors.length > 3 && (
                          <button
                            className="pa-expand"
                            aria-expanded={expanded.has(item.product.baseId)}
                            onClick={() =>
                              setExpanded((previous) => {
                                const next = new Set(previous);
                                next.has(item.product.baseId)
                                  ? next.delete(item.product.baseId)
                                  : next.add(item.product.baseId);
                                return next;
                              })
                            }
                          >
                            {expanded.has(item.product.baseId)
                              ? "접기"
                              : `나머지 ${item.vendors.length - 3}곳 펼치기`}
                          </button>
                        )}
                      </>
                    )}
                    {mode === "frequent" && (
                      <>
                        <small>
                          최근 매입 {item.latestDate || "날짜 없음"}
                        </small>
                      </>
                    )}
                  </div>
                  <button
                    className="pa-open"
                    onClick={() => onInspect(item.product)}
                  >
                    주문 보기 ↗
                  </button>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <p className="pa-empty">
                {query || supplier
                  ? "조건에 맞는 상품이 없습니다."
                  : mode === "frequent"
                    ? "최근 1년 매입 빈도 자료가 없습니다."
                    : "해당하는 매입 기록이 없습니다."}
              </p>
            )}
            {filtered.length > limit && (
              <button
                className="pa-more"
                onClick={() => setLimit((n) => n + 50)}
              >
                50개 더 보기 · {filtered.length - limit}개 남음
              </button>
            )}
            <footer className="pa-footer">
              저장된 가격 기준이며 포장·수량 기준이 다를 수 있습니다. 직접 등록
              가격은 가격 변화 계산에서 제외합니다. 할인·할증 보정 없음.
            </footer>
          </>
        )}
      </main>
      {top && (
        <button
          className="of-back-top"
          aria-label="분석 목록 맨 위로"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            })
          }
        >
          <ArrowUp size={22} />
        </button>
      )}
    </div>
  );
}
