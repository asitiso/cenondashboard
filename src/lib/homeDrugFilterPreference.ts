import type { HomeDrugFilter } from "./homeSections";

export const HOME_DRUG_FILTER_STORAGE_KEY = "central-onnuri.homeDrugFilter";
const DEFAULT_HOME_DRUG_FILTER: HomeDrugFilter = "prescription";
const validHomeDrugFilters = new Set<HomeDrugFilter>(["all", "prescription", "otc"]);

export function getSavedHomeDrugFilter(storage: Storage | undefined = globalThis.localStorage): HomeDrugFilter {
  try {
    const saved = storage?.getItem(HOME_DRUG_FILTER_STORAGE_KEY);
    return validHomeDrugFilters.has(saved as HomeDrugFilter) ? saved as HomeDrugFilter : DEFAULT_HOME_DRUG_FILTER;
  } catch {
    return DEFAULT_HOME_DRUG_FILTER;
  }
}

export function saveHomeDrugFilter(filter: HomeDrugFilter, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(HOME_DRUG_FILTER_STORAGE_KEY, filter);
  } catch {
    // A blocked storage write should not break the dashboard.
  }
}
