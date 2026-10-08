import { expect, it } from "vitest";
import { removeSupplierSettings } from "./SupplierManager";
import { emptyPreferences } from "./storage";
import type { Preferences } from "./types";

it("unlinks only the selected supplier, preserving shared sites and unrelated product exceptions", () => {
  const conf = { bookmarkId: "shared", method: "사이트" as const, memo: "" };
  const prefs: Preferences = {
    suppliers: { 백제: conf, 복산: conf },
    additionalSuppliers: { p1: ["백제", "복산"] },
    productSuppliers: { "p1|백제": conf, "p2|복산": conf, "p3|다른|백제": conf },
    bookmarks: [{ id: "shared", title: "도매몰", url: "https://example.com", folderId: "f", category: "종합도매", memo: "", supplierNames: ["백제", "복산"] }],
    folders: [], units: {}, overrides: {},
  };
  const next = removeSupplierSettings(prefs, "백제");
  expect(next.suppliers).toEqual({ 복산: conf });
  expect(next.additionalSuppliers).toEqual({ p1: ["복산"] });
  expect(next.productSuppliers).toEqual({ "p2|복산": conf, "p3|다른|백제": conf });
  expect(next.bookmarks).toEqual(prefs.bookmarks);
  expect(prefs.suppliers.백제).toEqual(conf);
  expect(prefs.bookmarks[0].supplierNames).toEqual(["백제", "복산"]);
});

it("fully removes a temporary supplier without changing imported purchase history", () => {
  const prefs: Preferences = {
    ...emptyPreferences,
    suppliers: { 임시: { method: "사이트", memo: "" } },
    manualSupplierNames: { manual: "임시" },
    additionalSuppliers: { manual: ["임시"] },
    productSuppliers: { "manual|임시": { method: "사이트", memo: "" } },
  };
  const next = removeSupplierSettings(prefs, "임시", true, ["manual"]);
  expect(next.hiddenSuppliers).toContain("임시");
  expect(next.manualSupplierNames?.manual).toBe("");
  expect(next.suppliers.임시).toBeUndefined();
  expect(next.additionalSuppliers?.manual).toEqual([]);
  expect(next.productSuppliers?.["manual|임시"]).toBeUndefined();
});
