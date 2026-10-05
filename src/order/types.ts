export type Usage = "dispensing" | "retail" | "unclassified";
export const CATEGORIES = [
  "종합도매",
  "제약사·브랜드 직거래",
  "담당자 주문",
  "동물의약품",
  "봉투·소모품",
  "업무·청구",
  "기타",
] as const;
export interface Purchase {
  date: string;
  name: string;
  manufacturer: string;
  supplier: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  sourceRow: number;
}
export interface CatalogItem {
  code: string;
  name: string;
  manufacturer: string;
  usage: Exclude<Usage, "unclassified">;
}
export interface Product {
  id: string;
  baseId: string;
  name: string;
  sourceName: string;
  manufacturer: string;
  code?: string;
  usage: Usage;
  matchStatus: "matched" | "unclassified" | "review";
  latest: Purchase[];
  supplierHistory?: Record<string, Purchase[]>;
  frequency: { supplier: string; count: number }[];
  candidateCodes?: string[];
  manualSupplier?: string;
}
export interface Snapshot {
  version: string;
  previousVersion?: string;
  asOf: string;
  products: Product[];
  catalogs: CatalogItem[];
  stats: {
    rows: number;
    names: number;
    matchedRows: number;
    unclassifiedRows: number;
    reviewRows: number;
    futureRows: number;
    returnRows: number;
    missingNames: number;
  };
  importedAt: string;
}
export interface UnitSetting {
  count: number;
  baseUnit: string;
  packUnit: string;
  quantityBasis: "base";
}
export interface BookmarkFolder {
  id: string;
  name: string;
  parentId: string | null;
  category: string;
  order: number;
}
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  folderId: string;
  category: string;
  memo: string;
  supplierNames?: string[];
  phone?: string;
  methods?: string[];
  rank?: number;
  order?: number;
  deletedAt?: string;
}
export interface UsageDay {
  date: string;
  counts: Record<string, number>;
}
export interface SupplierSetting {
  bookmarkId?: string;
  bookmarkIds?: string[];
  phone?: string;
  methods?: string[];
  method: "사이트" | "전화" | "카카오톡·문자" | "기타";
  memo: string;
}
export interface Preferences {
  additionalSuppliers?: Record<string, string[]>;
  barcodes?: Record<string, string[]>;
  searchNames?: Record<string, string>;
  productSuppliers?: Record<string, SupplierSetting>;
  units: Record<string, UnitSetting>;
  suppliers: Record<string, SupplierSetting>;
  overrides: Record<string, string>;
  folders: BookmarkFolder[];
  bookmarks: Bookmark[];
}
export interface ImportPayload {
  purchase: ArrayBuffer;
  dispensing?: ArrayBuffer;
  retail?: ArrayBuffer;
  asOf: string;
  previous?: Snapshot;
  overrides: Record<string, string>;
}
export const usageLabel: Record<Usage, string> = {
  dispensing: "조제용",
  retail: "판매용",
  unclassified: "미분류",
};
