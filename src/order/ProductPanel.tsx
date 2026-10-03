import { useEffect, useState } from "react";
import { getPrice, normalizeName } from "./core";
import { usageLabel } from "./types";
import type {
  Bookmark,
  Preferences,
  Product,
  Snapshot,
  SupplierSetting,
  UnitSetting,
} from "./types";
const money = (n: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(n) + "원";
export function ProductPanel({
  product,
  preferences,
  snapshot,
  onUnit,
  onSupplier,
  onOpen,
  onMatch,
  onClose,
}: {
  product: Product;
  preferences: Preferences;
  snapshot: Snapshot;
  onUnit: (id: string, value: UnitSetting) => Promise<void>;
  onSupplier: (name: string, value: SupplierSetting) => Promise<void>;
  onOpen: (b: Bookmark, name?: string) => void;
  onMatch: (p: Product, code: string) => Promise<void>;
  onClose: () => void;
}) {
  const [unitOpen, setUnitOpen] = useState(false);
  const [count, setCount] = useState("");
  const [base, setBase] = useState("");
  const [pack, setPack] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [chosen, setChosen] = useState("");
  const [method, setMethod] = useState<SupplierSetting["method"]>("사이트");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("");
  const [matchOpen, setMatchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const unit = preferences.units[product.baseId];
  useEffect(() => {
    setUnitOpen(false);
    setSupplier("");
    setStatus("");
    setMatchOpen(false);
    setCount(unit ? String(unit.count) : "");
    setBase(unit?.baseUnit ?? (product.usage === "dispensing" ? "정" : "병"));
    setPack(unit?.packUnit ?? "박스");
    setConfirmed(false);
  }, [product.id, unit]);
  async function run(fn: () => Promise<void>) {
    setSaving(true);
    setStatus("");
    try {
      await fn();
      setStatus("저장했습니다.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  function supplierEditor(name: string) {
    const value = preferences.suppliers[name];
    setSupplier(name);
    setChosen(value?.bookmarkId ?? "");
    setMethod(value?.method ?? "사이트");
    setMemo(value?.memo ?? "");
  }
  const candidates =
    matchOpen && query.trim()
      ? snapshot.catalogs
          .filter((c) => normalizeName(c.name).includes(normalizeName(query)))
          .slice(0, 30)
      : [];
  return (
    <section className="order-product" aria-label="상품 상세">
      <div className="order-product-heading">
        <div>
          <span className={`order-badge ${product.usage}`}>
            {usageLabel[product.usage]}
          </span>
          <h2>{product.name}</h2>
          <p>
            {product.manufacturer}
            {product.code && ` · ${product.code}`}
          </p>
        </div>
        <button
          className="order-quiet"
          onClick={onClose}
          aria-label="상품 상세 닫기"
        >
          ✕
        </button>
      </div>
      {product.matchStatus === "review" && (
        <p className="order-help">
          같은 이름의 후보가 있어 상품 연결이 필요합니다. 아래 내역은 이 원본
          상품명의 매입 기록입니다.
        </p>
      )}
      <div className="order-product-tools">
        <button
          className="order-secondary"
          onClick={() => setUnitOpen((x) => !x)}
        >
          {unit ? `적수 ${unit.count} · 수정` : "적수·단위 입력"}
        </button>
        <button
          className="order-quiet"
          onClick={() => {
            void navigator.clipboard
              .writeText(product.name)
              .then(() => setStatus("상품명을 복사했습니다."))
              .catch(() =>
                setStatus(
                  "자동 복사가 허용되지 않았습니다. 상품명을 선택해 복사해 주세요.",
                ),
              );
          }}
        >
          상품명 복사
        </button>
        {product.usage === "unclassified" && (
          <button
            className="order-quiet"
            onClick={() => {
              setMatchOpen((x) => !x);
              setQuery(product.name);
            }}
          >
            분류·상품 연결
          </button>
        )}
      </div>
      {unitOpen && (
        <form
          className="order-inline-editor"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !confirmed ||
              Number(count) <= 0 ||
              !base.trim() ||
              !pack.trim()
            )
              return;
            void run(async () => {
              await onUnit(product.baseId, {
                count: Number(count),
                baseUnit: base.trim(),
                packUnit: pack.trim(),
                quantityBasis: "base",
              });
              setUnitOpen(false);
            });
          }}
        >
          <p>
            1{pack || "박스"} = {count || "?"}
            {base || "병"}. 입력 전에는 원본 단가를 표시합니다.
          </p>
          <div className="order-unit-fields">
            <label>
              적수
              <input
                required
                type="number"
                min="1"
                step="1"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </label>
            <label>
              낱개 단위
              <input
                required
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="정·캡슐·병"
              />
            </label>
            <label>
              포장 단위
              <input
                required
                value={pack}
                onChange={(e) => setPack(e.target.value)}
                placeholder="통·박스"
              />
            </label>
          </div>
          <label className="order-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            표시된 매입 기록의 수량이 낱개 기준이고, 포장 구성이 같은 것을
            확인했습니다.
          </label>
          <button className="order-primary" disabled={!confirmed || saving}>
            적수 저장
          </button>
        </form>
      )}
      {matchOpen && (
        <div className="order-inline-editor">
          <label>
            연결할 상품 검색
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="조제·판매 목록에서 찾기"
            />
          </label>
          <div className="order-match-list">
            {candidates.map((c, i) => (
              <button
                key={`${c.code}-${c.usage}-${i}`}
                disabled={saving}
                onClick={() =>
                  void run(async () => {
                    await onMatch(product, c.code);
                    setMatchOpen(false);
                  })
                }
              >
                {c.name}
                <small>
                  {usageLabel[c.usage]} · {c.manufacturer} · {c.code}
                </small>
              </button>
            ))}
          </div>
          <small>용량·제형·포장 규격을 확인하고 선택해 주세요.</small>
        </div>
      )}
      {product.manualSupplier && (
        <div className="order-inline-editor">
          <strong>등록한 주문처: {product.manualSupplier}</strong>
          {(() => {
            const setting = preferences.suppliers[product.manualSupplier!];
            const link = preferences.bookmarks.find(
              (b) => b.id === setting?.bookmarkId && !b.deletedAt,
            );
            return (
              <>
                {setting?.memo && <small>{setting.memo}</small>}
                {link ? (
                  <button
                    className="order-secondary"
                    onClick={() => onOpen(link, product.name)}
                  >
                    사이트 ↗
                  </button>
                ) : (
                  <button
                    className="order-secondary"
                    onClick={() => supplierEditor(product.manualSupplier!)}
                  >
                    주문처 연결
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
      <h3>최근 입고 3건</h3>
      {product.latest.length ? (
        <div className="order-receipts">
          {product.latest.map((r, i) => {
            const price = getPrice(r, unit, product.usage);
            const setting = preferences.suppliers[r.supplier];
            const link = preferences.bookmarks.find(
              (x) => x.id === setting?.bookmarkId && !x.deletedAt,
            );
            return (
              <div
                className="order-receipt"
                key={`${r.date}-${r.sourceRow}-${i}`}
              >
                <div>
                  <strong>{r.supplier}</strong>
                  <small>{r.date}</small>
                </div>
                <div className="order-price">
                  <strong>{money(price.main)}</strong>
                  <small>
                    {price.mainUnit}
                    {price.secondary !== undefined &&
                      ` · ${price.secondaryUnit} ${money(price.secondary)}`}
                  </small>
                </div>
                {link ? (
                  <button
                    className="order-secondary"
                    onClick={() => onOpen(link, product.name)}
                  >
                    사이트 ↗
                  </button>
                ) : (
                  <button
                    className="order-quiet"
                    onClick={() => supplierEditor(r.supplier)}
                  >
                    {setting?.method && setting.method !== "사이트"
                      ? setting.method
                      : "주문처 연결"}
                  </button>
                )}
                {setting?.memo && (
                  <small className="order-receipt-memo">{setting.memo}</small>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="order-help">
          등록된 매입 기록이 없습니다. 주문처를 연결해 두면 다음 검색에서 확인할
          수 있습니다.
        </p>
      )}
      <h3>최근 1년 매입 기록</h3>
      <p className="order-help">{snapshot.asOf} 자료 기준</p>
      <div className="order-frequency">
        {product.frequency.length ? (
          product.frequency.map((x) => (
            <button
              className="order-frequency-chip"
              key={x.supplier}
              onClick={() => supplierEditor(x.supplier)}
            >
              {x.supplier} <strong>{x.count}건</strong>
            </button>
          ))
        ) : (
          <span className="order-help">최근 1년 매입 기록이 없습니다.</span>
        )}
      </div>
      {supplier && (
        <form
          className="order-inline-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await onSupplier(supplier, {
                ...(chosen ? { bookmarkId: chosen } : {}),
                method,
                memo,
              });
              setSupplier("");
            });
          }}
        >
          <h3>{supplier} 주문처</h3>
          <label>
            주문방법
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as SupplierSetting["method"])
              }
            >
              {["사이트", "전화", "카카오톡·문자", "기타"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            업무용 사이트
            <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
              <option value="">아직 연결하지 않음</option>
              {preferences.bookmarks
                .filter((b) => !b.deletedAt)
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            한 줄 메모
            <input
              value={memo}
              maxLength={200}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="주문 시 참고사항"
            />
          </label>
          <button className="order-primary" disabled={saving}>
            주문처 저장
          </button>
        </form>
      )}
      <button
        className="order-quiet"
        onClick={() =>
          supplierEditor(
            product.manualSupplier ??
              product.frequency[0]?.supplier ??
              product.latest[0]?.supplier ??
              product.name,
          )
        }
      >
        + 주문처 등록
      </button>
      {status && (
        <p role="status" className="order-help">
          {status}
        </p>
      )}
    </section>
  );
}
