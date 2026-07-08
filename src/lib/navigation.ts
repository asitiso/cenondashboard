import type { HomeSectionKey } from "./homeSections";

export type HomeSectionTargetView = "changes" | "drugs" | "manual";

const homeSectionTargetView: Record<HomeSectionKey, HomeSectionTargetView> = {
  changes: "changes",
  drugs: "drugs",
  manual: "manual"
};

export function getViewForHomeSection(sectionKey: HomeSectionKey): HomeSectionTargetView {
  return homeSectionTargetView[sectionKey];
}
