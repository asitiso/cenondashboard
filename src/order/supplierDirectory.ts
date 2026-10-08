import { normalizeName } from "./core";
import { isManualProduct } from "./productSettings";
import { allOrderSites } from "./orderSites";
import { supplierRows } from "./workspace";
import type { Bookmark, Preferences, Snapshot } from "./types";

const supplierFromKey = (key: string) => key.slice(key.indexOf("|") + 1);
const productFromKey = (key: string) => key.slice(0, key.indexOf("|"));

export function getSupplierDirectory(snapshot: Snapshot | undefined, prefs: Preferences) {
  const managed = new Set<string>();
  const linked = new Set<string>();
  const purchased = new Set<string>();
  const activeIds = new Set<string>();
  const hidden = new Set(prefs.hiddenSuppliers ?? []);
  for (const product of snapshot?.products ?? []) {
    const deleted = isManualProduct(product) && prefs.manualProductEdits?.[product.baseId]?.deleted;
    if (!deleted) activeIds.add(product.baseId);
    const purchaseNames = [
      ...supplierRows(product).map(row => row.supplier),
      ...product.frequency.map(row => row.supplier),
    ];
    for (const name of purchaseNames) {
      managed.add(name);
      purchased.add(name);
      if (!deleted) linked.add(name);
    }
    const manual = Object.prototype.hasOwnProperty.call(prefs.manualSupplierNames ?? {}, product.baseId)
      ? prefs.manualSupplierNames![product.baseId] : product.manualSupplier;
    if (product.manualSupplier) managed.add(product.manualSupplier);
    if (manual) {
      managed.add(manual);
      if (!deleted) linked.add(manual);
    }
  }
  for (const name of Object.keys(prefs.suppliers)) managed.add(name);
  for (const name of Object.values(prefs.manualSupplierNames ?? {})) if (name) managed.add(name);
  for (const [id, names] of Object.entries(prefs.additionalSuppliers ?? {})) {
    for (const name of names) {
      managed.add(name);
      if (activeIds.has(id)) linked.add(name);
    }
  }
  for (const key of Object.keys(prefs.productSuppliers ?? {})) {
    const name = supplierFromKey(key);
    managed.add(name);
    if (activeIds.has(productFromKey(key))) linked.add(name);
  }
  for (const name of hidden) {
    if (purchased.has(name)) continue;
    managed.delete(name);
    linked.delete(name);
  }
  return {
    managed: [...managed].sort((a, b) => a.localeCompare(b, "ko", { numeric: true })),
    linked, purchased, activeIds,
  };
}

export function manualProductIdsForSupplier(snapshot: Snapshot | undefined, prefs: Preferences, name: string): string[] {
  return [...new Set((snapshot?.products ?? [])
    .filter(product => isManualProduct(product) &&
      (Object.prototype.hasOwnProperty.call(prefs.manualSupplierNames ?? {}, product.baseId)
        ? prefs.manualSupplierNames![product.baseId] : product.manualSupplier) === name)
    .map(product => product.baseId))];
}

export function getSearchableSites(prefs: Preferences, linkedSuppliers: Set<string>, activeProductIds: Set<string>): Bookmark[] {
  const favorites = prefs.bookmarks.filter(site => !site.deletedAt);
  const favoriteIds = new Set(favorites.map(site => site.id));
  const referenced = new Set<string>();
  for (const [name, setting] of Object.entries(prefs.suppliers)) {
    if (!linkedSuppliers.has(name)) continue;
    if (setting.bookmarkId) referenced.add(setting.bookmarkId);
    for (const id of setting.bookmarkIds ?? []) referenced.add(id);
  }
  for (const [key, setting] of Object.entries(prefs.productSuppliers ?? {})) {
    if (!activeProductIds.has(productFromKey(key)) || !linkedSuppliers.has(supplierFromKey(key))) continue;
    if (setting.bookmarkId) referenced.add(setting.bookmarkId);
    for (const id of setting.bookmarkIds ?? []) referenced.add(id);
  }
  const connected = allOrderSites(prefs).filter(site => !favoriteIds.has(site.id) && referenced.has(site.id));
  const result: Bookmark[] = [];
  const urls = new Set<string>();
  const untitled = new Set<string>();
  for (const site of [...favorites, ...connected.filter(site => !!site.url), ...connected.filter(site => !site.url)]) {
    const url = site.url.trim().replace(/\/$/, "").toLowerCase();
    const title = normalizeName(site.title);
    if (url ? urls.has(url) : untitled.has(title)) continue;
    if (url) urls.add(url);
    else untitled.add(title);
    result.push(site);
  }
  return result;
}
