import { describe, expect, it } from "vitest";
import { normalizeTopic } from "./normalize";
import { groupChangesByCategory, normalizeChangeCategory } from "./changeCategories";

describe("change category helpers", () => {
  it("normalizes stored Firebase category values", () => {
    expect(normalizeChangeCategory("업무규칙")).toBe("업무규칙");
    expect(normalizeChangeCategory("고객 응대")).toBe("고객응대");
    expect(normalizeChangeCategory("알 수 없음")).toBe("기타");
  });

  it("keeps topic category as a first-class field", () => {
    const item = normalizeTopic("topic-1", {
      title: "근무표 변경",
      category: "스케줄"
    });

    expect(item.changeCategory).toBe("스케줄");
  });

  it("groups changes in the pharmacy category order and keeps each group latest first", () => {
    const olderRule = normalizeTopic("older-rule", {
      title: "오래된 업무규칙",
      category: "업무규칙",
      updatedAt: "2026-07-01T09:00:00+09:00"
    });
    const newerRule = normalizeTopic("newer-rule", {
      title: "새 업무규칙",
      category: "업무규칙",
      updatedAt: "2026-07-08T09:00:00+09:00"
    });
    const drug = normalizeTopic("drug", {
      title: "약품 변경",
      category: "약품변경",
      updatedAt: "2026-07-05T09:00:00+09:00"
    });

    const groups = groupChangesByCategory([olderRule, newerRule, drug]);

    expect(groups.map((group) => group.category)).toEqual(["약품변경", "업무규칙"]);
    expect(groups[1].items.map((item) => item.title)).toEqual(["새 업무규칙", "오래된 업무규칙"]);
  });
});
