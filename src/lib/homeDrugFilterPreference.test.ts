import { describe, expect, it } from "vitest";
import {
  getSavedHomeDrugFilter,
  HOME_DRUG_FILTER_STORAGE_KEY,
  saveHomeDrugFilter
} from "./homeDrugFilterPreference";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}

describe("home drug filter preference", () => {
  it("starts with prescription when nothing has been saved", () => {
    expect(getSavedHomeDrugFilter(memoryStorage())).toBe("prescription");
  });

  it("restores the last saved home drug filter", () => {
    const storage = memoryStorage({ [HOME_DRUG_FILTER_STORAGE_KEY]: "otc" });

    expect(getSavedHomeDrugFilter(storage)).toBe("otc");
  });

  it("ignores invalid saved values", () => {
    const storage = memoryStorage({ [HOME_DRUG_FILTER_STORAGE_KEY]: "unknown" });

    expect(getSavedHomeDrugFilter(storage)).toBe("prescription");
  });

  it("saves the selected home drug filter", () => {
    const storage = memoryStorage();

    saveHomeDrugFilter("all", storage);

    expect(storage.getItem(HOME_DRUG_FILTER_STORAGE_KEY)).toBe("all");
  });
});
