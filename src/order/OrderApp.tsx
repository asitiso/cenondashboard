import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ScanBarcode } from "lucide-react";
import { useOrderData } from "./useOrderData";
import { Modal, PurchaseImport } from "./ImportPanels";
import { Favorites, FolderTree } from "./Favorites";
import { SearchCard } from "./SearchCard";
import { BarcodeCamera } from "./BarcodeCamera";
import { SupplierManager, removeSupplierSettings } from "./SupplierManager";
import { AddSupplier } from "./AddSupplier";
import { registerProductSupplier, connectWholesaleSites, isWholesaleSite, confirmRestore } from "./additionalSuppliers";
import { allOrderSites, connectionSites, copiedSupplierSite, saveOrderSite } from "./orderSites";
import { editManualProduct, isManualProduct, isProductSite, saveRegisteredPrice, saveProductSupplierNote, renameRegisteredSupplier } from "./productSettings";
import { formatPhone } from "./phone";
import { SiteButton } from "./SiteButton";
import { toggleSitePin } from "./quickPin";
import {
  barcodeLink,
  displayPrice,
  shortName,
  supplierRows,
} from "./workspace";
import {
  normalizeName,
  safeUrl,
  searchProducts,
  stableId,
  todayKorea,
  topBookmarks,
} from "./core";
import { readCache } from "./storage";
import type {
  Bookmark,
  Product,
  Purchase,
  Snapshot,
  SupplierSetting,
  Usage,
} from "./types";
import "./order.css";
export function TopNavigation({
  active,
  onNavigate,
}: {
  active: "order" | "operations" | "analysis";
  onNavigate: (v: "order" | "operations" | "analysis") => void;
}) {
  return (
    <nav className="order-top-tabs" aria-label="최상위 화면">
      <button
        className={active === "operations" ? "active" : ""}
        onClick={() => onNavigate("operations")}
      >
        운영 대시보드
      </button>
      <button
        className={active === "order" ? "active" : ""}
        onClick={() => onNavigate("order")}
      >
        주문·업무 찾기
      </button>
      <button className={active === "analysis" ? "active" : ""} onClick={() => onNavigate("analysis")}>매입 분석</button>
    </nav>
  );
}
type Dialog = {
  kind:
    | "manage"
    | "favorites"
    | "purchase"
    | "camera"
    | "productEdit"
    | "price"
    | "short"
    | "unit"
    | "barcode"
    | "supplier"
    | "suppliers"
    | "contact"
    | "new"
    | "classify"
    | "mall"
    | "addSupplier"
    | "mallSites";
  p?: Product;
  supplier?: string;
  mode?: string;
  from?: "manage" | "suppliers";
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export default function OrderApp({ data, focusProduct }: { data: ReturnType<typeof useOrderData>; focusProduct?: { product: Product; token: number } }) {
  const { snapshot, preferences: prefs } = data;
  const [query, setQuery] = useState(""),
    deferred = useDeferredValue(query);
  const [scope, setScope] = useState<{ name: string; names: string[] } | null>(
    null,
  );
  const [usage, setUsage] = useState<Usage | "all">("all"),
    [sort, setSort] = useState("recent");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState(""),
    [pending, setPending] = useState("");
  const [top, setTop] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const appRoot = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState(() => {
    try {
      return localStorage.getItem("order-mobile-font") ?? "default";
    } catch {
      return "default";
    }
  });
  const [field, setField] = useState(""),
    [baseUnit, setBaseUnit] = useState("정"),
    [packUnit, setPackUnit] = useState("포장"),
    [count, setCount] = useState("1"),
    [address, setAddress] = useState(""),
    [registeredPrice, setRegisteredPrice] = useState(""),
    [registeredUnit, setRegisteredUnit] = useState("개"),
    [productNote, setProductNote] = useState(""),
    [registeredSupplierName, setRegisteredSupplierName] = useState(""),
    [phone, setPhone] = useState(""),
    [method, setMethod] = useState("사이트"),
    [extra, setExtra] = useState(""),
    [memo, setMemo] = useState(""),
    [onlyProduct, setOnlyProduct] = useState(false),
    [chosenSite, setChosenSite] = useState(""),
    [siteQuery, setSiteQuery] = useState(""),
    [busy, setBusy] = useState(false);
  const [newUsage, setNewUsage] = useState<Usage>("retail");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [deleteProductConfirm, setDeleteProductConfirm] = useState(false);
  const supplierScroll = useRef(0);
  const active = prefs.bookmarks.filter((b) => !b.deletedAt),
    orderSites = allOrderSites(prefs),
    products = useMemo(() => {
      const grouped = new Map<string, Product[]>();
      for (const original of snapshot?.products ?? []) {
        const change = prefs.manualProductEdits?.[original.baseId];
        if (change?.deleted && isManualProduct(original)) continue;
        const p = { ...original,
          ...(change?.name && isManualProduct(original) ? { name: change.name } : {}),
          ...(original.manualSupplier && prefs.manualSupplierNames?.[original.baseId] ? { manualSupplier: prefs.manualSupplierNames[original.baseId] } : {}),
        };
        grouped.set(p.baseId, [...(grouped.get(p.baseId) ?? []), p]);
      }
      return [...grouped.values()]
        .map((list) =>
          usage === "all" ? list[0] : list.find((p) => p.usage === usage),
        )
        .filter((p): p is Product => !!p);
    }, [snapshot, usage, prefs.manualProductEdits, prefs.manualSupplierNames]);
  const suppliers = useMemo(
    () =>
      [
        ...new Set(
          (snapshot?.products ?? []).flatMap((p) => [
            ...supplierRows(p).map((r) => r.supplier),
            ...p.frequency.map((x) => x.supplier),
            ...(p.manualSupplier ? [p.manualSupplier] : []),
          ]),
        ),
      ].sort((a, b) => a.localeCompare(b, "ko")),
    [snapshot],
  );
  const managedSuppliers = [...new Set([
    ...suppliers,
    ...Object.keys(prefs.suppliers),
    ...Object.values(prefs.manualSupplierNames ?? {}),
    ...Object.values(prefs.additionalSuppliers ?? {}).flat(),
  ])].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  const namesForSite = (b?: Bookmark) => [
    ...new Set([
      ...(b?.supplierNames ?? []),
      ...Object.entries(prefs.suppliers)
        .filter(([, s]) => !!b && (s.bookmarkId === b.id || s.bookmarkIds?.includes(b.id)))
        .map(([n]) => n),
      ...Object.entries(prefs.productSuppliers ?? {})
        .filter(([, s]) => !!b && (s.bookmarkId === b.id || s.bookmarkIds?.includes(b.id)))
        .map(([key]) => key.slice(key.indexOf("|") + 1)),
    ]),
  ];
  const q = normalizeName(deferred),
    supplierCandidates =
      !scope && q ? managedSuppliers.filter((n) => normalizeName(n).includes(q)) : [];
  const siteCandidates =
    !scope && q
      ? connectionSites(prefs).filter((b) => normalizeName(b.title + " " + b.memo).includes(q))
      : [];
  const exact = supplierCandidates.find((n) => normalizeName(n) === q);
  const context = scope?.names ?? (exact ? [exact] : []);
  const nameMatches = useMemo(
    () => searchProducts(products, deferred, false),
    [products, deferred],
  );
  const found = useMemo(() => {
    let items: Product[];
    const direct = products.filter(
      (p) =>
        (prefs.barcodes?.[p.baseId] ?? []).includes(deferred.trim()) ||
        p.code === deferred.trim(),
    );
    if (direct.length && deferred.trim()) items = direct;
    else if (context.length) {
      items = products.filter(
        (p) =>
          supplierRows(p).some((r) => context.includes(r.supplier)) ||
          (prefs.additionalSuppliers?.[p.baseId] ?? []).some(name => context.includes(name)) ||
          context.includes(p.manualSupplier ?? ""),
      );
      if (q && !exact) items = searchProducts(items, deferred, false).results;
    } else
      items =
        q &&
        !(
          (supplierCandidates.length || siteCandidates.length) &&
          nameMatches.suggested
        )
          ? nameMatches.results
          : [];
    if (context.length)
      items.sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "ko");
        if (sort === "count")
          return (
            b.frequency
              .filter((x) => context.includes(x.supplier))
              .reduce((s, x) => s + x.count, 0) -
            a.frequency
              .filter((x) => context.includes(x.supplier))
              .reduce((s, x) => s + x.count, 0)
          );
        const ad =
            supplierRows(a).find((r) => context.includes(r.supplier))?.date ??
            "",
          bd =
            supplierRows(b).find((r) => context.includes(r.supplier))?.date ??
            "";
        return bd.localeCompare(ad) || a.name.localeCompare(b.name, "ko");
      });
    return items;
  }, [
    products,
    deferred,
    prefs.barcodes,
    prefs.bookmarks,
    prefs.orderSites,
    prefs.additionalSuppliers,
    scope,
    sort,
    exact,
    nameMatches,
  ]);
  const hot = topBookmarks(prefs.bookmarks, data.days, todayKorea());
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (e) {
      setNotice(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function edit(d: Dialog) {
    setNotice("");
    setField(d.p ? shortName(d.p, prefs) : query);
    if (d.kind === "productEdit" && d.p) { setField(d.p.name); setDeleteProductConfirm(false); }
    if (d.kind === "price" && d.p && d.supplier) {
      const reference = prefs.referencePrices?.[d.p.baseId + "|" + d.supplier];
      setRegisteredPrice(reference ? String(reference.amount) : "");
      setRegisteredUnit(reference?.unit ?? prefs.units[d.p.baseId]?.baseUnit ?? "개");
    }
    if (d.kind === "unit" && d.p) {
      const unit = prefs.units[d.p.baseId];
      setCount(String(unit?.count ?? 1));
      setBaseUnit(unit?.baseUnit ?? (d.p.usage === "dispensing" ? "정" : "개"));
      setPackUnit(unit?.packUnit ?? "포장");
    }
    if ((d.kind === "supplier" || d.kind === "contact") && d.supplier) {
      const conf =
          prefs.productSuppliers?.[d.p?.baseId + "|" + d.supplier] ??
          prefs.suppliers[d.supplier],
        link = orderSites.find((b) => b.id === conf?.bookmarkId);
      setChosenSite(link?.id ?? "");
      setSiteQuery("");
      setAddress(link?.url ?? "");
      setPhone(conf?.phone ?? link?.phone ?? "");
      setMethod(
        d.mode ??
          conf?.methods?.[0] ??
          link?.methods?.[0] ??
          conf?.method ??
          "사이트",
      );
      setExtra(conf?.methods?.[1] ?? link?.methods?.[1] ?? "");
      setMemo(conf?.memo ?? link?.memo ?? "");
      setProductNote(prefs.supplierNotes?.[d.p?.baseId + "|" + d.supplier] ?? "");
      setRegisteredSupplierName(d.supplier ?? "");
      setOnlyProduct(
        (!!d.p && isProductSite(d.supplier + " " + (link?.title ?? "") + " " + (link?.url ?? ""))) || !!prefs.productSuppliers?.[d.p?.baseId + "|" + d.supplier],
      );
    }
    if (d.kind === "barcode") setField(pending);
    setDialog(d);
  }
  function close() {
    if (dialog?.from === "suppliers") {
      setDialog({ kind: "suppliers", from: "manage" });
      return;
    }
    if (dialog?.from === "manage") setDialog({ kind: "manage" });
    else setDialog(null);
  }
  function focus() {
    input.current?.focus();
  }
  function search(value: string) {
    setQuery(value);
    setUsage("all");
    setOpen(new Set());
    setClosed(new Set());
  }
  useEffect(() => {
    if (!focusProduct) return;
    const p = focusProduct.product;
    search(p.code ?? p.name);
    setScope(null);
    setDialog(null);
    setPending("");
    setOpen(new Set([p.baseId]));
  }, [focusProduct]);
  function selectScope(name: string, names: string[]) {
    setScope({ name, names });
    setQuery("");
    setUsage("all");
    setSort("recent");
    setOpen(new Set());
    setClosed(new Set());
    if (!window.matchMedia("(pointer:coarse)").matches) focus();
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("검색명 복사: " + value);
    } catch {
      setNotice("검색명을 복사하지 못했습니다. 직접 입력할 이름: " + value);
    }
  }
  function openSite(b: Bookmark) {
    const url = safeUrl(b.url);
    if (!url) {
      if (active.some(site => site.id === b.id)) {
        edit({ kind: "favorites" });
        setNotice("즐겨찾기 편집에서 사이트 주소를 입력해 주세요.");
        return;
      }
      edit({ kind: "supplier", supplier: b.supplierNames?.[0] ?? b.title });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    void run(() => data.click(b.id));
  }
  function pinSite(b: Bookmark) {
    void run(async () => {
      await data.change(p => toggleSitePin(p, b.id));
      setNotice("고정 즐겨찾기를 변경했습니다.");
    });
  }
  function order(p: Product, name: string, selectedMode?: string, siteId?: string) {
    const conf =
        prefs.productSuppliers?.[p.baseId + "|" + name] ??
        prefs.suppliers[name],
      link =
        orderSites.find((b) => b.id === (siteId ?? conf?.bookmarkId)) ??
        orderSites.find((b) => b.title === name),
      mode =
        selectedMode ??
        conf?.methods?.[0] ??
        link?.methods?.[0] ??
        conf?.method ??
        "사이트";
    if (mode === "사이트") {
      if (!link?.url) {
        edit({ kind: "supplier", p, supplier: name });
        if (siteId && link) { setChosenSite(siteId); setAddress(link.url); setOnlyProduct(true); }
        return;
      }
      void copy(shortName(p, prefs));
      openSite(link);
    } else edit({ kind: "contact", p, supplier: name, mode });
  }
  function scan(code: string) {
    setDialog(null);
    setScope(null);
    search(code);
    const match = (snapshot?.products ?? []).some(
      (p) =>
        (prefs.barcodes?.[p.baseId] ?? []).includes(code) || p.code === code,
    );
    setPending(match ? "" : code);
    if (!match) {
      setNotice("미등록 바코드 · 상품명 일부로 찾은 뒤 연결하세요.");
      setQuery("");
      focus();
    }
  }
  const scanRef = useRef(scan);
  scanRef.current = scan;
  useEffect(() => {
    if (
      !window.matchMedia("(pointer:coarse)").matches &&
      window.innerWidth > 800
    )
      input.current?.focus();
    const update = () =>
      setTop(window.scrollY > Math.max(300, window.innerHeight * 0.5));
    window.addEventListener("scroll", update, { passive: true });
    let buffer = "",
      last = 0;
    const keys = (e: KeyboardEvent) => {
      if (!appRoot.current || appRoot.current.closest("[hidden]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focus();
        return;
      }
      const node = e.target as HTMLElement;
      if (
        node.closest('[role="dialog"]') ||
        node.isContentEditable ||
        ((node.tagName === "INPUT" ||
          node.tagName === "TEXTAREA" ||
          node.tagName === "SELECT") &&
          node !== input.current)
      )
        return;
      const now = performance.now();
      if (now - last > 90) buffer = "";
      if (e.key === "Enter") {
        if (/^\d{8,14}$/.test(buffer)) {
          e.preventDefault();
          scanRef.current(buffer);
        }
        buffer = "";
      } else if (/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        buffer += e.key;
      } else buffer = "";
      last = now;
    };
    document.addEventListener("keydown", keys, true);
    return () => {
      window.removeEventListener("scroll", update);
      document.removeEventListener("keydown", keys, true);
    };
  }, []);
  async function saveSupplier() {
    if (!dialog?.supplier) return;
    const name = dialog.supplier,
      product = dialog.p;
    const productOnly = !!product && (onlyProduct || registeredSupplierName.trim() !== name || isProductSite(name + " " + address + " " + (connectionSites(prefs).find(b => b.id === chosenSite)?.title ?? "")));
    const url = address.trim() ? safeUrl(address) : "";
    if (address.trim() && !url) {
      setNotice("http 또는 https 주소를 입력하세요.");
      return;
    }
    if (
      await run(() =>
        data.change((p) => {
          const conf: SupplierSetting = {
            bookmarkId: chosenSite || stableId("supplier-site|" + name),
            method:
              method === "문자" || method === "카카오톡"
                ? "카카오톡·문자"
                : (method as SupplierSetting["method"]),
            methods: [method, ...(extra ? [extra] : [])],
            memo,
            phone: formatPhone(phone),
          };
          const productSuppliers = { ...p.productSuppliers };
          if (!productOnly && product)
            delete productSuppliers[product.baseId + "|" + name];
          const existing = connectionSites(p).find((b) => b.id === conf.bookmarkId);
          const site: Bookmark = {
            ...existing,
            id: conf.bookmarkId!,
            title: existing?.title ?? name,
            url: url || "",
            folderId: existing?.folderId ?? "",
            category: existing?.category ?? "종합도매",
            memo,
            phone: formatPhone(phone),
            methods: conf.methods,
            supplierNames: [
              ...new Set([...(existing?.supplierNames ?? []), name]),
            ],
          };
          if (!isWholesaleSite(site.title)) {
            const copied = copiedSupplierSite(site, name, productOnly ? product?.baseId : undefined);
            Object.assign(site, copied);
            conf.bookmarkId = site.id;
          }
          const next = {
            ...saveOrderSite(p, site),
            ...(productOnly && product
              ? {
                  productSuppliers: {
                    ...p.productSuppliers,
                    [product.baseId + "|" + name]: conf,
                  },
                }
              : {
                  productSuppliers,
                  suppliers: { ...p.suppliers, [name]: conf },
                }),
          };
          const withInfo = product ? saveProductSupplierNote(next, product, name, productNote) : next;
          const connected = isWholesaleSite(site.title) ? connectWholesaleSites(withInfo, name, productOnly ? product?.baseId : undefined) : withInfo;
          return product && !supplierRows(product).some(row => row.supplier === name)
            ? renameRegisteredSupplier(connected, product, name, registeredSupplierName)
            : connected;
        }),
      )
    )
      close();
  }
  async function createProduct() {
    const name = field.trim();
    if (!name) {
      setNotice("상품명을 입력하세요.");
      return;
    }
    const baseId = stableId("manual|" + normalizeName(name));
    const p: Product = {
      id: baseId + "-" + newUsage,
      baseId,
      name,
      sourceName: name,
      manufacturer: "",
      usage: newUsage,
      matchStatus: "unclassified",
      latest: [],
      frequency: [],
      manualSupplier: memo.trim(),
      manual: true,
    };
    const empty: Snapshot = {
      version: "",
      asOf: todayKorea(),
      products: [],
      catalogs: [],
      stats: {
        rows: 0,
        names: 0,
        matchedRows: 0,
        unclassifiedRows: 0,
        reviewRows: 0,
        futureRows: 0,
        returnRows: 0,
        missingNames: 0,
      },
      importedAt: new Date().toISOString(),
    };
    const previous = snapshot ?? empty;
    if (
      await run(async () => {
        await data.saveSnapshot({
          ...previous,
          previousVersion: previous.version || undefined,
          version: crypto.randomUUID(),
          products: [
            ...previous.products.filter((x) => x.baseId !== baseId),
            p,
          ],
        });
        if (prefs.manualProductEdits?.[baseId]) {
          await data.change(value => editManualProduct(value, p, name));
        }
      })
    ) {
      setDialog(null);
      search(name);
    }
  }
  async function classify(p: Product, code: string) {
    if (!snapshot) return;
    const matches = snapshot.catalogs.filter((c) => c.code === code);
    if (!matches.length) {
      setNotice("등록된 약품코드를 선택하세요.");
      return;
    }
    const next = snapshot.products.filter((x) => x.baseId !== p.baseId);
    for (const c of matches)
      if (!next.some((x) => x.baseId === p.baseId && x.usage === c.usage))
        next.push({
          ...p,
          id: p.baseId + "-" + c.usage,
          name: c.name,
          code: c.code,
          usage: c.usage,
          matchStatus: "matched",
          candidateCodes: [],
        });
    if (
      await run(() =>
        data.saveSnapshot(
          {
            ...snapshot,
            previousVersion: snapshot.version,
            version: crypto.randomUUID(),
            products: next,
          },
          { baseId: p.baseId, code },
        ),
      )
    )
      setDialog(null);
  }
  return (
    <div ref={appRoot} className={"of-app of-font-" + font}>
      <div className="of-layout">
        <aside className="of-sidebar">
          <h2>즐겨찾기 폴더</h2>
          <button
            className="of-edit-button"
            onClick={() => edit({ kind: "favorites" })}
          >
            즐겨찾기 편집
          </button>
          <FolderTree preferences={prefs} onOpen={openSite} onPin={pinSite} busy={busy} />
        </aside>
        <main className="of-main">
          <div className="of-heading">
            <h1>주문·업무 찾기</h1>
            <div>
              <small>매입 자료: {snapshot?.asOf ?? "미등록"} 기준</small>
              <button
                onClick={() => {
                  setScope(null);
                  setPending("");
                  search("");
                }}
              >
                처음으로
              </button>
              <button onClick={() => edit({ kind: "manage" })}>관리</button>
            </div>
          </div>
          <div className="of-search">
            {scope && (
              <button
                className="of-scope"
                title={scope.name + " 범위 해제"}
                onClick={() => {
                  setScope(null);
                  setUsage("all");
                  setSort("recent");
                }}
              >
                {scope.name} ×
              </button>
            )}
            <input
              ref={input}
              aria-label="상품·거래처·바코드 검색"
              placeholder="상품명 일부 / 거래처 / 바코드 / 약품코드"
              value={query}
              onChange={(e) => search(e.target.value)}
            />
            {query && (
              <button
                aria-label="검색어 지우기"
                onClick={() => {
                  search("");
                  setPending("");
                  focus();
                }}
              >
                ×
              </button>
            )}
            <button
              className="of-scan"
              aria-label="바코드 촬영"
              title="바코드 촬영"
              onClick={() => edit({ kind: "camera" })}
            >
              <ScanBarcode size={21} />
            </button>
            <kbd>Ctrl K</kbd>
          </div>
          {pending && (
            <div className="of-pending">
              미등록 바코드: {pending} · 상품명으로 찾은 뒤 연결하세요.
              <button onClick={() => setPending("")}>연결 취소</button>
            </div>
          )}
          {(data.error || notice) && (
            <p
              className={data.error ? "of-error" : "of-notice"}
              role={data.error ? "alert" : "status"}
            >
              {data.error || notice}
            </p>
          )}
          {!query && !scope ? (
            <>
              {snapshot && (
                <p className="of-muted" role="status">
                  검색 가능한 상품 {snapshot.products.length.toLocaleString()}품목
                  · 위 검색창에 상품명이나 거래처를 입력하세요.
                </p>
              )}
              <section>
                <div className="of-section-heading">
                  <h2>고정 즐겨찾기</h2>
                  <button onClick={() => edit({ kind: "favorites" })}>
                    편집
                  </button>
                </div>
                <div className="of-home-sites">
                  {hot.fixed.map((b) => (
                    <SiteButton key={b.id} site={b} onOpen={openSite} onPin={pinSite} busy={busy} />
                  ))}
                </div>
                {!hot.fixed.length && (
                  <p className="of-muted">
                    사이트 옆 ☆를 누르면 여기에 고정됩니다.
                  </p>
                )}
                {hot.frequent.length > 0 && (
                  <>
                    <h2>자주 쓰는 사이트</h2>
                    <div className="of-home-sites">
                      {hot.frequent.map((b) => (
                        <SiteButton key={b.id} site={b} onOpen={openSite} onPin={pinSite} busy={busy} />
                      ))}
                    </div>
                  </>
                )}
              </section>
              {active.length > 0 && <h2>업무 사이트</h2>}
              <div className="of-directory">
                {prefs.folders.map((f) => {
                  const links = active.filter((b) => b.folderId === f.id);
                  return links.length ? (
                    <section key={f.id}>
                      <h3>{f.name}</h3>
                      <div>
                        {links.map((b) => (
                          <SiteButton key={b.id} site={b} onOpen={openSite} onPin={pinSite} busy={busy} />
                        ))}
                      </div>
                    </section>
                  ) : null;
                })}
              </div>
              {!snapshot && (
                <p>
                  <button onClick={() => edit({ kind: "purchase" })}>
                    매입 자료 가져오기
                  </button>
                </p>
              )}
            </>
          ) : (
            <>
              {!scope && supplierCandidates.length > 0 && (
                <>
                  <h2>거래처 · {supplierCandidates.length}곳</h2>
                  {supplierCandidates.map((name) => (
                    <div
                      className="of-supplier-card"
                      key={name}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectScope(name, [name])}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectScope(name, [name]);
                        }
                      }}
                    >
                      <div>
                        <strong>{name}</strong>
                        <small>
                          연결 품목{" "}
                          {
                            (snapshot?.products ?? [])
                              .filter(
                                (p) =>
                                  supplierRows(p).some(
                                    (r) => r.supplier === name,
                                  ) || (prefs.manualSupplierNames?.[p.baseId] ?? p.manualSupplier) === name || (prefs.additionalSuppliers?.[p.baseId] ?? []).includes(name),
                              )
                              .reduce(
                                (s, p) => s.add(p.baseId),
                                new Set<string>(),
                              ).size
                          }
                          개
                        </small>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const link =
                            orderSites.find(
                              (b) => b.id === prefs.suppliers[name]?.bookmarkId,
                            ) ?? orderSites.find((b) => b.title === name);
                          if (link) openSite(link);
                          else edit({ kind: "supplier", supplier: name });
                        }}
                      >
                        사이트 열기 ↗
                      </button>
                    </div>
                  ))}
                </>
              )}
              {scope && (
                <div className="of-supplier-card">
                  <div>
                    <strong>{scope.name}</strong>
                    <small>연결된 전체 품목 · 과거 매입 이력 포함</small>
                  </div>
                  <button
                    onClick={() => {
                      const link =
                        orderSites.find((b) => b.title === scope.name) ??
                        orderSites.find(
                          (b) =>
                            b.id ===
                            prefs.suppliers[scope.names[0]]?.bookmarkId,
                        );
                      if (link) openSite(link);
                      else edit({ kind: "supplier", supplier: scope.names[0] });
                    }}
                  >
                    사이트 열기 ↗
                  </button>
                </div>
              )}
              <div className="of-result-heading">
                <h2>
                  {context.length
                    ? "연결 품목"
                    : nameMatches.suggested &&
                        !supplierCandidates.length &&
                        !siteCandidates.length
                      ? "비슷한 이름 후보"
                      : "상품"}{" "}
                  · {found.length.toLocaleString()}개
                </h2>
                {context.length > 0 && (
                  <div className="of-sort">
                    {[
                      ["recent", "최근 매입순"],
                      ["name", "가나다순"],
                      ["count", "매입 기록 많은 순"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={sort === id ? "selected" : ""}
                        onClick={() => setSort(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <select
                  aria-label="상품 용도"
                  value={usage}
                  onChange={(e) => setUsage(e.target.value as Usage | "all")}
                >
                  <option value="all">전체</option>
                  <option value="dispensing">조제</option>
                  <option value="retail">판매</option>
                  <option value="unclassified">미분류</option>
                </select>
              </div>
              <p className="of-muted">
                상품명을 누르면 거래처·가격이 펼쳐집니다.
              </p>
              {found.map((p) => (
                <SearchCard
                  key={p.baseId}
                  product={p}
                  preferences={prefs}
                  scope={context}
                  expanded={
                    open.has(p.baseId) ||
                    (found.length === 1 && !closed.has(p.baseId))
                  }
                  toggle={() =>
                    setOpen((previous) => {
                      const next = new Set(previous);
                      if (
                        next.has(p.baseId) ||
                        (found.length === 1 && !closed.has(p.baseId))
                      ) {
                        next.delete(p.baseId);
                        setClosed((v) => new Set([...v, p.baseId]));
                      } else {
                        next.add(p.baseId);
                        setClosed(
                          (v) =>
                            new Set([...v].filter((id) => id !== p.baseId)),
                        );
                      }
                      return next;
                    })
                  }
                  asOf={snapshot?.asOf ?? todayKorea()}
                  pending={pending}
                  onOrder={order}
                  onScopeOrder={(p, name) =>
                    context.length > 1
                      ? edit({ kind: "mall", p })
                      : order(p, name)
                  }
                  onSupplier={(p, supplier) =>
                    edit({ kind: "supplier", p, supplier })
                  }
                  onAddSupplier={(p) => edit({ kind: "addSupplier", p })}
                  onChooseSite={(p, supplier) => edit({ kind: "mallSites", p, supplier })}
                  onEditProduct={(p) => edit({ kind: "productEdit", p })}
                  onPrice={(p, supplier) => edit({ kind: "price", p, supplier })}
                  onSearchName={(p) => edit({ kind: "short", p })}
                  onUnit={(p) => edit({ kind: "unit", p })}
                  onBarcode={(p) => edit({ kind: "barcode", p })}
                  onClassify={(p) => {
                    edit({ kind: "classify", p });
                    setField(p.code ?? "");
                  }}
                />
              ))}
              {!found.length && !supplierCandidates.length && (
                <div className="of-empty">
                  검색 결과가 없습니다.
                  {scope && query && (
                    <button
                      onClick={() => {
                        setScope(null);
                        setUsage("all");
                      }}
                    >
                      전체 거래처에서 검색
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMemo("");
                      edit({ kind: "new" });
                    }}
                  >
                    + 새 상품 등록
                  </button>
                </div>
              )}
              {!scope && siteCandidates.length > 0 && (
                <>
                  <h2>업무 사이트</h2>
                  {siteCandidates.map((b) => (
                    <div className="of-supplier-card" key={b.id}>
                      <SiteButton site={b} onOpen={openSite} onPin={pinSite} busy={busy} />
                      {namesForSite(b).length > 0 && (
                        <button
                          onClick={() => selectScope(b.title, namesForSite(b))}
                        >
                          연결 품목 보기
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          <footer>
            {data.loading
              ? "자료를 불러오는 중…"
              : data.shared
                ? "약국 공용 자료"
                : "이 기기에 저장"}{" "}
            ·{" "}
            {snapshot
              ? `${snapshot.products.length.toLocaleString()}품목 · 할인/할증 보정 없음`
              : "자료를 가져오면 상품 검색을 사용할 수 있습니다."}
          </footer>
        </main>
      </div>
      {top && !dialog && (
        <button
          className="of-back-top"
          aria-label="맨 위로 이동"
          title="맨 위로"
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
      {dialog?.kind === "favorites" && (
        <Favorites
          preferences={prefs}
          change={data.change}
          suppliers={suppliers}
          notify={setNotice}
          onClose={close}
        />
      )}
      {dialog?.kind === "purchase" && (
        <PurchaseImport
          previous={snapshot}
          preferences={prefs}
          onSave={data.saveSnapshot}
          onClose={close}
        />
      )}
      {dialog?.kind === "camera" && (
        <BarcodeCamera
          onScan={scan}
          onClose={close}
          onName={() => {
            setDialog(null);
            setPending("");
            setScope(null);
            search("");
            focus();
          }}
        />
      )}
      {dialog?.kind === "manage" && (
        <Modal title="관리 · 직원 누구나 수정" onClose={close}>
          <div className="of-actions">
            <button onClick={() => edit({ kind: "suppliers", from: "manage" })}>
              매입처·주문 정보 관리
            </button>
            <button onClick={() => edit({ kind: "favorites", from: "manage" })}>
              즐겨찾기 편집·가져오기
            </button>
            <button onClick={() => edit({ kind: "purchase", from: "manage" })}>
              매입 자료 갱신
            </button>
            <button
              onClick={() => {
                setMemo("");
                edit({ kind: "new", from: "manage" });
              }}
            >
              새 상품 등록
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const old = await readCache<Snapshot>("previousSnapshot");
                  if (!old) throw Error("복원할 직전 자료가 없습니다.");
                  if (!confirmRestore(text => window.confirm(text), `${old.asOf} 기준 · ${old.products.length.toLocaleString()}품목 · 저장 ${old.importedAt}`))
                    return;
                  await data.saveSnapshot({
                    ...old,
                    previousVersion: snapshot?.version,
                    version: crypto.randomUUID(),
                  });
                  setNotice("직전 매입 자료를 복원했습니다.");
                })
              }
            >
              직전 자료 복원
            </button>
          </div>
          {notice && <p role="status">{notice}</p>}
          <p className="of-muted">직전 자료 복원: 이 브라우저에 보관된 이전 매입 자료로 공용 자료를 교체합니다. 즐겨찾기·바코드·주문처 설정은 유지됩니다.</p>
          <p>모바일 글자 크기 · 이 기기만 적용</p>
          <div className="of-actions">
            {[
              ["small", "작게"],
              ["default", "기본"],
              ["large", "크게"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={font === id ? "selected" : ""}
                onClick={() => {
                  setFont(id);
                  try {
                    localStorage.setItem("order-mobile-font", id);
                  } catch {}
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="of-muted">자료 갱신: 분기 1회 · 월 1회 목표</p>
        </Modal>
      )}
      {dialog?.kind === "suppliers" && (
        <Modal title="매입처·주문 정보 관리" onClose={close} initialScrollTop={supplierScroll.current} backToTop>
          {notice && <p role="status">{notice}</p>}
          <SupplierManager
            names={managedSuppliers} prefs={prefs} query={supplierQuery}
            onQuery={setSupplierQuery} busy={busy}
            onEdit={(name, scrollTop) => { supplierScroll.current = scrollTop ?? 0; edit({ kind: "supplier", supplier: name, from: "suppliers" }); }}
            onRemove={(name) => {
              if (!window.confirm(`${name}의 주문 정보를 삭제할까요? 매입 이력과 즐겨찾기 사이트는 보존됩니다.`)) return;
              void run(async () => {
                await data.change((p) => removeSupplierSettings(p, name));
                setNotice("주문 정보를 해제했습니다. 필요하면 다시 등록할 수 있습니다.");
              });
            }}
          />
        </Modal>
      )}
      {dialog &&
        [
          "productEdit",
          "price",
          "short",
          "unit",
          "barcode",
          "supplier",
          "contact",
          "new",
          "classify",
          "mall",
          "addSupplier",
          "mallSites",
        ].includes(dialog.kind) && (
          <Modal
            title={
              {
                productEdit: "직접 등록한 상품 수정·삭제",
                price: "상품·매입처별 가격 등록·수정",
                short: "주문 사이트 검색명",
                unit: "매입 단위 확인",
                barcode: "바코드 연결 관리",
                supplier: "주소·주문 방법",
                contact: "주문 연락처",
                new: "새 상품 등록",
                classify: "약품코드 연결",
                mall: "주문할 거래처 선택",
                addSupplier: "다른 매입처 등록",
                mallSites: "종합도매 주문처 선택",
              }[dialog.kind as "short"]
            }
            onClose={close}
          >
            {notice && <p role="status">{notice}</p>}
            {dialog.kind === "price" && dialog.p && dialog.supplier && (
              <>
                <strong>{dialog.p.name}</strong>
                <p>{dialog.supplier}</p>
                <p className="of-muted">이 상품의 이 매입처 가격만 저장합니다. 실제 매입 이력에는 추가하지 않습니다.</p>
                <label>등록 가격 (원)<input aria-label="등록 가격" inputMode="decimal" value={registeredPrice} onChange={e => setRegisteredPrice(e.target.value)} placeholder="가격 입력 · 비우면 해제" /></label>
                <label>가격 단위<input aria-label="가격 단위" value={registeredUnit} onChange={e => setRegisteredUnit(e.target.value)} placeholder="개·롤·박스 등" /></label>
                <button disabled={busy} onClick={() => void run(async () => {
                  await data.change(p => saveRegisteredPrice(p, dialog.p!, dialog.supplier!, registeredPrice, registeredUnit));
                  close();
                })}>저장</button>
              </>
            )}
            {dialog.kind === "productEdit" && dialog.p && (
              <>
                <label>상품 이름<input value={field} onChange={e => setField(e.target.value)} /></label>
                <div className="of-actions">
                  <button disabled={busy} onClick={() => void run(async () => {
                    await data.change(p => editManualProduct(p, dialog.p!, field));
                    close();
                    search(field.trim());
                  })}>저장</button>
                  <button disabled={busy} onClick={() => setDeleteProductConfirm(true)}>상품 삭제</button>
                </div>
                {deleteProductConfirm && <div role="alert">
                  <p>직접 등록한 상품 ‘{dialog.p.name}’을 삭제할까요? 매입처와 즐겨찾기는 유지됩니다.</p>
                  <div className="of-actions">
                    <button disabled={busy} onClick={() => void run(async () => {
                      await data.change(p => editManualProduct(p, dialog.p!, dialog.p!.name, true));
                      close();
                      setNotice("직접 등록한 상품을 삭제했습니다.");
                    })}>삭제 확인</button>
                    <button onClick={() => setDeleteProductConfirm(false)}>취소</button>
                  </div>
                </div>}
              </>
            )}
            {dialog.kind === "addSupplier" && dialog.p && <AddSupplier names={managedSuppliers} existing={[...supplierRows(dialog.p).map(r => r.supplier), ...(prefs.additionalSuppliers?.[dialog.p.baseId] ?? [])]} busy={busy} onAdd={(name) => void run(async () => {
              await data.change(p => {
                return registerProductSupplier(p, dialog.p!.baseId, name);
              });
              close();
            })} />}
            {dialog.kind === "mallSites" && dialog.p && dialog.supplier && <div className="of-actions">
              {((prefs.productSuppliers?.[dialog.p.baseId + "|" + dialog.supplier] ?? prefs.suppliers[dialog.supplier])?.bookmarkIds ?? []).map((id, i) => {
                const b = orderSites.find(site => site.id === id);
                return b ? <button key={id} onClick={() => order(dialog.p!, dialog.supplier!, "사이트", id)}>{b.title}{i === 0 ? " · 기본" : ""}{!b.url ? " · 주소 등록 필요" : " ↗"}</button> : null;
              })}
            </div>}
            {dialog.kind === "mall" && dialog.p && (
              <div className="of-actions">
                {supplierRows(dialog.p)
                  .filter((r) => context.includes(r.supplier))
                  .map((r) => {
                    const v = displayPrice(
                      r,
                      prefs.units[dialog.p!.baseId],
                      dialog.p!.usage,
                    );
                    return (
                      <button
                        key={r.supplier}
                        onClick={() => {
                          setDialog(null);
                          order(dialog.p!, r.supplier);
                        }}
                      >
                        {r.supplier} · {v.amount.toLocaleString()}원 / {v.unit}{" "}
                        · {r.date}
                      </button>
                    );
                  })}
              </div>
            )}
            {dialog.kind === "short" && (
              <>
                <p>{dialog.p?.name}</p>
                <input
                  aria-label="복사할 짧은 검색명"
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                />
                <button
                  disabled={busy || !field.trim()}
                  onClick={() =>
                    void run(async () => {
                      await data.change((p) => ({
                        ...p,
                        searchNames: {
                          ...p.searchNames,
                          [dialog.p!.baseId]: field.trim(),
                        },
                      }));
                      close();
                    })
                  }
                >
                  저장
                </button>
              </>
            )}
            {dialog.kind === "unit" && (
              <>
                <p className="of-muted">
                  확인한 단위만 입력하세요. 미확인 단가는 추정하지 않습니다.
                </p>
                <label>
                  기본 매입 단위
                  <input
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                  />
                </label>
                {dialog.p?.usage !== "dispensing" && (
                  <>
                    <label>
                      포장 안 기본 단위 수
                      <input
                        type="number"
                        min="1"
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                      />
                    </label>
                    <label>
                      판매 포장 단위
                      <input
                        value={packUnit}
                        onChange={(e) => setPackUnit(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const n =
                        dialog.p?.usage === "dispensing" ? 1 : Number(count);
                      if (!baseUnit.trim() || !Number.isFinite(n) || n <= 0)
                        throw Error("기본 단위와 수량을 확인하세요.");
                      await data.change((p) => ({
                        ...p,
                        units: {
                          ...p.units,
                          [dialog.p!.baseId]: {
                            count: n,
                            baseUnit: baseUnit.trim(),
                            packUnit: packUnit.trim() || baseUnit,
                            quantityBasis: "base",
                          },
                        },
                      }));
                      close();
                    })
                  }
                >
                  확인하여 저장
                </button>
              </>
            )}
            {dialog.kind === "barcode" && (
              <>
                <strong>{dialog.p?.name}</strong>
                <p className="of-muted">{dialog.p?.manufacturer}</p>
                {(prefs.barcodes?.[dialog.p!.baseId] ?? []).map((code) => (
                  <div className="of-actions" key={code}>
                    <span>{code}</span>
                    <button
                      onClick={() =>
                        void run(() =>
                          data.change((p) => ({
                            ...p,
                            barcodes: {
                              ...p.barcodes,
                              [dialog.p!.baseId]: (
                                p.barcodes?.[dialog.p!.baseId] ?? []
                              ).filter((c) => c !== code),
                            },
                          })),
                        )
                      }
                    >
                      해제
                    </button>
                  </div>
                ))}
                <label>
                  연결할 바코드
                  <input
                    inputMode="numeric"
                    value={field}
                    onChange={(e) => setField(e.target.value.trim())}
                  />
                </label>
                <button
                  disabled={busy || !field}
                  onClick={() =>
                    void run(async () => {
                      if (!/^\d{8,14}$/.test(field))
                        throw Error("8~14자리 바코드를 입력하세요.");
                      const old = Object.entries(prefs.barcodes ?? {}).find(
                        ([id, codes]) =>
                          id !== dialog.p!.baseId && codes.includes(field),
                      );
                      if (
                        old &&
                        !window.confirm(
                          "이 바코드는 " +
                            (snapshot?.products.find((p) => p.baseId === old[0])
                              ?.name ?? "다른 상품") +
                            "에 연결되어 있습니다. 선택한 상품으로 옮길까요?",
                        )
                      )
                        return;
                      await data.change((p) =>
                        barcodeLink(p, dialog.p!.baseId, field, !!old),
                      );
                      setPending("");
                      close();
                      setNotice("바코드를 연결했습니다.");
                    })
                  }
                >
                  이 상품에 연결
                </button>
              </>
            )}
            {dialog.kind === "supplier" && (
              <>
                <h3>{dialog.supplier}</h3>
                <p className="of-muted">즐겨찾기에서 주소를 복사해 저장할 수 있습니다. 같은 주소를 여러 매입처에 사용할 수 있으며, 즐겨찾기는 변경되지 않습니다.</p>
                <label>
                  주소를 가져올 사이트
                  <input
                    aria-label="연결 사이트 검색"
                    placeholder="사이트 이름 일부로 검색"
                    value={siteQuery}
                    onChange={(e) => setSiteQuery(e.target.value)}
                  />
                  <select
                    aria-label="연결 사이트 선택"
                    value={chosenSite}
                    onChange={(e) => {
                      setChosenSite(e.target.value);
                      const site = connectionSites(prefs).find((b) => b.id === e.target.value);
                      setAddress(site?.url ?? "");
                      setPhone(site?.phone ?? "");
                      if (dialog.p && isProductSite(dialog.supplier + " " + (site?.title ?? "") + " " + (site?.url ?? ""))) setOnlyProduct(true);
                    }}
                  >
                    <option value="">새 주문처 등록</option>
                    {connectionSites(prefs)
                      .filter((b) =>
                        b.id === chosenSite ||
                        normalizeName(b.title).includes(normalizeName(siteQuery)),
                      )
                      .sort((a, b) => a.title.localeCompare(b.title, "ko", { numeric: true }))
                      .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  매입처 사이트 주소 · 비워도 등록
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
                {dialog.p && !supplierRows(dialog.p).some(r => r.supplier === dialog.supplier) && (
                  <>
                    <label>매입처 이름<input value={registeredSupplierName} onChange={e => setRegisteredSupplierName(e.target.value)} /></label>
                    <p className="of-muted">이 상품에 등록한 매입처 이름만 변경합니다.</p>
                  </>
                )}
                {dialog.p && <label>이 상품의 매입처 비고<textarea value={productNote} onChange={e => setProductNote(e.target.value)} placeholder="배송비, 주문 조건 등" /></label>}
                <label>
                  기본 주문 방법
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {["사이트", "전화", "문자", "카카오톡"].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  추가 주문 방법
                  <select
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                  >
                    <option value="">없음</option>
                    {["사이트", "전화", "문자", "카카오톡"].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  전화번호
                  <input
                    type="tel"
                    value={phone}
                    onBlur={e => setPhone(formatPhone(e.target.value))}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label>
                  주문 메모
                  <input
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </label>
                {dialog.p && (
                  <label className="of-check">
                    <input
                      type="checkbox"
                      checked={onlyProduct || isProductSite(dialog.supplier + " " + address + " " + (connectionSites(prefs).find(b => b.id === chosenSite)?.title ?? ""))}
                      disabled={isProductSite(dialog.supplier + " " + address + " " + (connectionSites(prefs).find(b => b.id === chosenSite)?.title ?? ""))}
                      onChange={(e) => setOnlyProduct(e.target.checked)}
                    />
                    이 상품에만 적용하는 주소·주문 방법 (네이버쇼핑은 상품별 저장)
                  </label>
                )}
                <button disabled={busy} onClick={() => void saveSupplier()}>
                  저장
                </button>
              </>
            )}
            {dialog.kind === "contact" && (
              <>
                <strong>
                  {dialog.supplier} · {method}
                </strong>
                <p>{phone || "전화번호 미등록"}</p>
                <p>{memo}</p>
                {dialog.p && (
                  <button
                    onClick={() => void copy(shortName(dialog.p!, prefs))}
                  >
                    검색명 복사
                  </button>
                )}
                {phone && (method === "문자" || method === "전화") && (
                  <a href={method === "문자" ? "sms:" + phone : "tel:" + phone}>
                    {method === "문자" ? "문자 작성" : "전화 걸기"}
                  </a>
                )}
                <button onClick={() => void copy(phone)}>전화번호 복사</button>
                <button onClick={() => edit({ ...dialog, kind: "supplier" })}>
                  주문 정보 수정
                </button>
              </>
            )}
            {dialog.kind === "new" && (
              <>
                <label>
                  상품명 · 일반약은 포장별로 등록
                  <input
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                  />
                </label>
                <label>
                  용도
                  <select
                    value={newUsage}
                    onChange={(e) => setNewUsage(e.target.value as Usage)}
                  >
                    <option value="retail">판매</option>
                    <option value="dispensing">조제</option>
                  </select>
                </label>
                <label>
                  주문 거래처
                  <input
                    list="of-suppliers"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </label>
                <datalist id="of-suppliers">
                  {suppliers.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </datalist>
                <button disabled={busy} onClick={() => void createProduct()}>
                  등록
                </button>
              </>
            )}
            {dialog.kind === "classify" && (
              <>
                <p>
                  {dialog.p?.sourceName} · {dialog.p?.manufacturer}
                </p>
                <label>
                  약품코드
                  <input
                    list="of-catalog"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                  />
                </label>
                <datalist id="of-catalog">
                  {snapshot?.catalogs
                    .filter(
                      (c) =>
                        !field ||
                        c.code.includes(field) ||
                        normalizeName(c.name).includes(normalizeName(field)),
                    )
                    .slice(0, 100)
                    .map((c, i) => (
                      <option key={i} value={c.code}>
                        {c.name} · {c.manufacturer}
                      </option>
                    ))}
                </datalist>
                <button
                  disabled={busy}
                  onClick={() => void classify(dialog.p!, field)}
                >
                  확인하여 연결
                </button>
              </>
            )}
          </Modal>
        )}
    </div>
  );
}
