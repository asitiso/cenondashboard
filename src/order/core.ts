import type {
  Bookmark,
  CatalogItem,
  Product,
  Purchase,
  Snapshot,
  UnitSetting,
  Usage,
  UsageDay,
} from "./types";

export function stableId(value: string): string {
  let hash = 2166136261;
  for (const c of value) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/마이크로그램/g, "mcg")
    .replace(/밀리그램|밀리그람/g, "mg")
    .replace(/밀리리터/g, "ml")
    .replace(/그램|그람/g, "g")
    .replace(/[^가-힣a-z0-9.%/]/g, "");
}
function maker(value: string) {
  return normalizeName(value.replace(/주식회사|\(주\)|㈜/g, ""));
}
export function yearStart(asOf: string) {
  const [y, m, d] = asOf.split("-").map(Number);
  const maxDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, maxDay)).padStart(2, "0")}`;
}
export function todayKorea(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function buildSnapshot(
  rows: Purchase[],
  catalogs: CatalogItem[],
  asOf: string,
  previous?: Snapshot,
  overrides: Record<string, string> = {},
): Snapshot {
  const index = new Map<string, CatalogItem[]>();
  for (const c of catalogs) {
    const key = normalizeName(c.name);
    index.set(key, [...(index.get(key) ?? []), c]);
  }
  const groups = new Map<string, Purchase[]>();
  const stats = {
    rows: rows.length,
    names: 0,
    matchedRows: 0,
    unclassifiedRows: 0,
    reviewRows: 0,
    futureRows: 0,
    returnRows: 0,
    missingNames: 0,
  };
  for (const r of rows) {
    if (!r.name.trim()) {
      stats.missingNames++;
      continue;
    }
    if (r.date > asOf) stats.futureRows++;
    if (r.quantity < 0 || r.amount < 0) stats.returnRows++;
    const key = `${normalizeName(r.name)}|${maker(r.manufacturer)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  stats.names = new Set(rows.filter((r) => r.name).map((r) => r.name)).size;
  const start = yearStart(asOf);
  const products: Product[] = [];
  const seenCatalog = new Set<string>();
  for (const [key, group] of groups) {
    const r = group[0];
    const baseId = stableId(key);
    const named = index.get(normalizeName(r.name)) ?? [];
    let candidates = named.filter(
      (c) =>
        !r.manufacturer ||
        !c.manufacturer ||
        maker(c.manufacturer) === maker(r.manufacturer),
    );
    if (overrides[baseId])
      candidates = catalogs.filter((c) => c.code === overrides[baseId]);
    const codes = new Set(candidates.map((c) => c.code));
    const status =
      codes.size === 1
        ? "matched"
        : named.length || codes.size > 1
          ? "review"
          : "unclassified";
    stats[
      status === "matched"
        ? "matchedRows"
        : status === "review"
          ? "reviewRows"
          : "unclassifiedRows"
    ] += group.length;
    const normal = group.filter(
      (x) => x.date <= asOf && x.quantity > 0 && x.amount > 0,
    );
    const frequency = new Map<string, number>();
    for (const x of normal.filter((x) => x.date >= start))
      frequency.set(x.supplier, (frequency.get(x.supplier) ?? 0) + 1);
    const usages: Usage[] =
      status === "matched"
        ? [...new Set(candidates.map((c) => c.usage))]
        : ["unclassified"];
    for (const usage of usages) {
      const c = candidates.find((x) => x.usage === usage);
      const id = `${baseId}-${usage}`;
      const old =
        previous?.products.find((x) => x.id === id) ??
        previous?.products.find((x) => x.baseId === baseId);
      const signature = (x: Purchase) =>
        JSON.stringify([
          x.date,
          x.name,
          x.manufacturer,
          x.supplier,
          x.unitPrice,
          x.quantity,
          x.amount,
        ]);
      const currentSignatures = new Set(normal.map(signature));
      const historic =
        old?.latest.filter(
          (x) => x.date < start && !currentSignatures.has(signature(x)),
        ) ?? [];
      const latest = [...normal, ...historic]
        .sort(
          (a, b) => b.date.localeCompare(a.date) || a.sourceRow - b.sourceRow,
        )
        .slice(0, 3);
      // Keep repeats within the source export; there is no invoice ID.
      products.push({
        id,
        baseId,
        name: status === "matched" && c ? c.name : r.name,
        sourceName: r.name,
        manufacturer: r.manufacturer,
        usage,
        matchStatus: status,
        latest,
        frequency: [...frequency]
          .map(([supplier, count]) => ({ supplier, count }))
          .sort(
            (a, b) => b.count - a.count || a.supplier.localeCompare(b.supplier),
          ),
        ...(c && status === "matched" ? { code: c.code } : {}),
        ...(status === "review"
          ? { candidateCodes: [...new Set(named.map((x) => x.code))] }
          : {}),
      });
      if (c && status === "matched") seenCatalog.add(`${c.code}|${usage}`);
    }
  }
  const rebuiltBases = new Set(products.map((p) => p.baseId));
  for (const old of previous?.products ?? []) {
    if (!rebuiltBases.has(old.baseId) && !products.some((p) => p.id === old.id))
      products.push({
        ...old,
        latest: old.latest.filter((r) => r.date < start),
        frequency: [],
      });
  }
  for (const c of catalogs) {
    if (
      seenCatalog.has(`${c.code}|${c.usage}`) ||
      products.some((p) => p.code === c.code && p.usage === c.usage)
    )
      continue;
    const baseId = stableId(
      `${normalizeName(c.name)}|${maker(c.manufacturer)}`,
    );
    const id = `${baseId}-${c.usage}`;
    if (!products.some((p) => p.id === id))
      products.push({
        id,
        baseId,
        name: c.name,
        sourceName: c.name,
        manufacturer: c.manufacturer,
        usage: c.usage,
        code: c.code,
        matchStatus: "matched",
        latest: [],
        frequency: [],
      });
  }
  return {
    version: crypto.randomUUID(),
    ...(previous ? { previousVersion: previous.version } : {}),
    asOf,
    products,
    catalogs,
    stats,
    importedAt: new Date().toISOString(),
  };
}

export function getPrice(
  row: Purchase,
  setting?: UnitSetting,
  usage: Usage = "retail",
): {
  main: number;
  mainUnit: string;
  secondary?: number;
  secondaryUnit?: string;
} {
  if (
    !setting ||
    !Number.isFinite(setting.count) ||
    setting.count <= 0 ||
    row.quantity <= 0
  )
    return { main: row.unitPrice, mainUnit: "원본 단가" };
  const base = row.amount / row.quantity;
  return usage === "dispensing"
    ? { main: base, mainUnit: `${setting.baseUnit}당` }
    : {
        main: base * setting.count,
        mainUnit: `${setting.packUnit}당`,
        secondary: base,
        secondaryUnit: `${setting.baseUnit}당`,
      };
}
function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(
          next[j] + 1,
          prev[j + 1] + 1,
          prev[j] + (a[i] === b[j] ? 0 : 1),
        ),
      );
    prev = next;
  }
  return prev[b.length];
}
export function searchProducts(
  products: Product[],
  query: string,
): { results: Product[]; suggested: boolean } {
  const q = normalizeName(query);
  if (!q) return { results: [], suggested: false };
  const tokens = query.trim().split(/\s+/).map(normalizeName).filter(Boolean);
  const direct = products.filter((p) =>
    tokens.every((t) =>
      normalizeName(
        [
          p.name,
          p.sourceName,
          p.manufacturer,
          p.code ?? "",
          p.manualSupplier ?? "",
          ...p.frequency.map((x) => x.supplier),
          ...p.latest.map((x) => x.supplier),
        ].join(" "),
      ).includes(t),
    ),
  );
  if (direct.length)
    return {
      results: direct
        .sort(
          (a, b) =>
            Number(normalizeName(b.name).startsWith(q)) -
              Number(normalizeName(a.name).startsWith(q)) ||
            Number(!!b.latest.length) - Number(!!a.latest.length),
        )
        .slice(0, 80),
      suggested: false,
    };
  if (q.length < 2 || q.length > 40) return { results: [], suggested: false };
  const threshold = q.length < 5 ? 1 : 2;
  const near = products
    .map((p) => {
      const name = normalizeName(p.name);
      let score = 99;
      for (let i = 0; i <= Math.max(0, name.length - q.length); i++) {
        score = Math.min(
          score,
          distance(q, name.slice(i, i + q.length)),
          distance(q, name.slice(i, i + q.length + 1)),
          distance(q, name.slice(i, i + q.length - 1)),
        );
        if (score === 0) break;
      }
      return { p, score };
    })
    .filter((x) => x.score <= threshold)
    .sort((a, b) => a.score - b.score)
    .slice(0, 12);
  return { results: near.map((x) => x.p), suggested: near.length > 0 };
}
export function safeUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function pinBookmark(
  links: Bookmark[],
  id: string,
  replaceId?: string,
): Bookmark[] {
  const target = links.find((x) => x.id === id && !x.deletedAt);
  if (!target)
    throw new Error("즐겨찾기가 변경되었습니다. 다시 선택해 주세요.");
  const remove = (b: Bookmark) => {
    const { rank: _, ...rest } = b;
    return rest;
  };
  if (target.rank !== undefined)
    return links.map((b) => (b.id === id ? remove(b) : b));
  const alias = links.find(
    (b) =>
      !b.deletedAt &&
      b.rank !== undefined &&
      safeUrl(b.url) === safeUrl(target.url),
  );
  const replacement = replaceId
    ? links.find(
        (b) => b.id === replaceId && !b.deletedAt && b.rank !== undefined,
      )
    : alias;
  if (replaceId && !replacement)
    throw new Error("교체할 즐겨찾기가 변경되었습니다. 다시 선택해 주세요.");
  const occupied = new Set(
    links
      .filter((b) => !b.deletedAt && b.rank !== undefined)
      .map((b) => b.rank),
  );
  const rank =
    replacement?.rank ??
    Array.from({ length: 10 }, (_, i) => i).find((i) => !occupied.has(i));
  if (rank === undefined)
    throw new Error(
      "고정 10개가 모두 채워졌습니다. 교체할 항목을 선택해 주세요.",
    );
  return links.map((b) =>
    b.id === id ? { ...b, rank } : b.id === replacement?.id ? remove(b) : b,
  );
}
export function topBookmarks(
  links: Bookmark[],
  days: UsageDay[],
  asOf: string,
) {
  const active = links.filter((x) => !x.deletedAt);
  const fixed = active
    .filter((x) => x.rank !== undefined)
    .sort((a, b) => a.rank! - b.rank!)
    .slice(0, 10);
  const fixedUrls = new Set(fixed.map((x) => safeUrl(x.url)));
  const cutoff = new Date(`${asOf}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const counts = new Map<string, number>();
  for (const day of days)
    if (day.date >= cutoff.toISOString().slice(0, 10) && day.date <= asOf)
      for (const [id, n] of Object.entries(day.counts))
        counts.set(id, (counts.get(id) ?? 0) + n);
  const urlCounts = new Map<string, number>();
  for (const link of active) {
    const url = safeUrl(link.url);
    if (url)
      urlCounts.set(
        url,
        (urlCounts.get(url) ?? 0) + (counts.get(link.id) ?? 0),
      );
  }
  const seen = new Set<string>();
  const frequent = active
    .filter(
      (x) =>
        x.rank === undefined &&
        !fixedUrls.has(safeUrl(x.url)) &&
        (counts.get(x.id) ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (urlCounts.get(safeUrl(b.url) ?? "") ?? 0) -
          (urlCounts.get(safeUrl(a.url) ?? "") ?? 0) ||
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        a.title.localeCompare(b.title),
    )
    .filter((x) => {
      const url = safeUrl(x.url);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 5);
  return { fixed, frequent };
}
