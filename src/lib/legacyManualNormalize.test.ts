import { describe, expect, it } from "vitest";
import { normalizeManualImprove } from "./normalize";

describe("legacy manual_improve normalization", () => {
  it("keeps older content and proposedContent visible in the dashboard", () => {
    const item = normalizeManualImprove("legacy", {
      title: "예전 매뉴얼 개선",
      content: "현재 부족한 내용",
      proposedContent: "개선 제안 내용",
      status: "검토중"
    });

    expect(item.description).toContain("현재 부족한 내용");
    expect(item.description).toContain("개선 제안 내용");
  });
});
