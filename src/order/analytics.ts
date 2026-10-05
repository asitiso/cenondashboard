import { normalizeName, yearStart } from "./core";
import { allReceipts, displayPrice } from "./workspace";
import { isManualProduct } from "./productSettings";
import type { Product, Preferences, Snapshot } from "./types";

export type VendorPrice = {
  supplier: string;
  amount: number;
  unit: string;
  date: string;
  manual?: boolean;
};
export type AnalysisItem = {
  product: Product;
  vendors: VendorPrice[];
  suppliers: string[];
  latestDate: string;
  frequency: number;
  vendorDifference?: number;
  increase?: {
    current: VendorPrice;
    previous: VendorPrice;
    difference: number;
    percent: number;
  };
};
const roundedPrice = (amount: number) => Math.round(amount * 100) / 100;
export function groupVendorPrices(values: VendorPrice[]): VendorPrice[] {
  const groups = new Map<string, VendorPrice>();
  for (const value of values) {
    const key = JSON.stringify([
      roundedPrice(value.amount),
      value.unit,
      value.date,
      !!value.manual,
    ]);
    const existing = groups.get(key);
    if (existing) existing.supplier += ` · ${value.supplier}`;
    else groups.set(key, { ...value });
  }
  return [...groups.values()];
}
export function buildPurchaseAnalysis(
  snapshot: Snapshot | undefined,
  prefs: Preferences,
) {
  const grouped = new Map<string, Product[]>();
  for (const p of snapshot?.products ?? []) {
    if (isManualProduct(p) && prefs.manualProductEdits?.[p.baseId]?.deleted)
      continue;
    grouped.set(p.baseId, [...(grouped.get(p.baseId) ?? []), p]);
  }
  const start = snapshot ? yearStart(snapshot.asOf) : "";
  const items: AnalysisItem[] = [];
  for (const variants of grouped.values()) {
    const original =
      variants.find((p) => p.usage === "dispensing") ?? variants[0];
    const product =
      isManualProduct(original) &&
      prefs.manualProductEdits?.[original.baseId]?.name
        ? { ...original, name: prefs.manualProductEdits[original.baseId].name! }
        : original;
    const seen = new Set<string>();
    const rows = variants
      .flatMap(allReceipts)
      .filter((r) => {
        const key = JSON.stringify([
          r.date,
          r.supplier,
          r.sourceRow,
          r.unitPrice,
          r.quantity,
          r.amount,
        ]);
        if (seen.has(key)) return false;
        seen.add(key);
        return (
          /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
          r.date <= snapshot!.asOf &&
          ((r.quantity > 0 && r.amount > 0) ||
            (r.sourceRow === 0 && r.quantity === 0 && r.amount === 0)) &&
          r.unitPrice > 0 &&
          [r.quantity, r.amount, r.unitPrice].every(Number.isFinite)
        );
      })
      .sort(
        (a, b) => b.date.localeCompare(a.date) || a.sourceRow - b.sourceRow,
      );
    const setting = prefs.units[product.baseId];
    const prices: VendorPrice[] = rows
      .map((r) => ({
        ...displayPrice(r, setting, product.usage),
        supplier: r.supplier,
        date: r.date,
      }))
      .filter((r) => Number.isFinite(r.amount) && r.amount > 0);
    const vendors = prices.filter(
      (r, index) =>
        r.date >= start &&
        prices.findIndex((x) => x.supplier === r.supplier) === index,
    );
    const prefix = product.baseId + "|";
    for (const [key, reference] of Object.entries(
      prefs.referencePrices ?? {},
    )) {
      if (
        key.startsWith(prefix) &&
        Number.isFinite(reference.amount) &&
        reference.amount >= 0
      ) {
        vendors.push({
          supplier: key.slice(prefix.length),
          amount: reference.amount,
          unit: reference.unit.trim() || "단위",
          date: "",
          manual: true,
        });
      }
    }
    const frequency = new Map<string, number>();
    // The two usage views share source receipts and yearly counts; never add them twice.
    for (const variant of variants)
      for (const f of variant.frequency) {
        if (Number.isFinite(f.count) && f.count > 0)
          frequency.set(
            f.supplier,
            Math.max(f.count, frequency.get(f.supplier) ?? 0),
          );
      }
    const item: AnalysisItem = {
      product,
      vendors,
      suppliers: [
        ...new Set([
          ...rows.map((r) => r.supplier),
          ...vendors.map((r) => r.supplier),
          ...frequency.keys(),
        ]),
      ],
      latestDate: rows[0]?.date ?? "",
      frequency: [...frequency.values()].reduce((sum, n) => sum + n, 0),
    };
    const current = prices[0],
      previous = prices.find((r) => r.date < current?.date);
    if (new Set(vendors.map((v) => v.supplier)).size >= 2) {
      const amounts = vendors.map((v) => roundedPrice(v.amount));
      item.vendorDifference = roundedPrice(
        Math.max(...amounts) - Math.min(...amounts),
      );
    }
    if (current?.date >= start && previous) {
      const difference = current.amount - previous.amount;
      item.increase = {
        current,
        previous,
        difference,
        percent: (difference / previous.amount) * 100,
      };
    }
    items.push(item);
  }
  return {
    changes: items
      .filter((x) => x.increase)
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate)),
    rises: items
      .filter((x) => x.increase && x.increase.difference > 0)
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate)),
    gaps: items
      .filter((x) => (x.vendorDifference ?? 0) > 0)
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate)),
    frequent: items
      .filter((x) => x.frequency > 0)
      .sort(
        (a, b) =>
          b.frequency - a.frequency || b.latestDate.localeCompare(a.latestDate),
      ),
    suppliers: [...new Set(items.flatMap((x) => x.suppliers))].sort((a, b) =>
      a.localeCompare(b, "ko"),
    ),
    start,
  };
}
export function matchesAnalysis(
  item: AnalysisItem,
  query: string,
  supplier: string,
) {
  return (
    (!supplier || item.suppliers.includes(supplier)) &&
    normalizeName(
      item.product.name +
        " " +
        item.product.sourceName +
        " " +
        item.product.manufacturer +
        " " +
        item.product.code +
        " " +
        item.suppliers.join(" "),
    ).includes(normalizeName(query))
  );
}
