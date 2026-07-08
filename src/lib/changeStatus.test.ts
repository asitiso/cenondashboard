import { describe, expect, it } from "vitest";
import { normalizeTopic } from "./normalize";
import { isCompletedChange, shouldShowChangeInList } from "./changeStatus";

describe("change status display policy", () => {
  it("treats only completed change items as completed", () => {
    expect(isCompletedChange(normalizeTopic("active", { title: "유효", status: "active" }))).toBe(false);
    expect(isCompletedChange(normalizeTopic("done", { title: "완료", status: "done" }))).toBe(true);
  });

  it("hides completed changes unless the user includes them", () => {
    const active = normalizeTopic("active", { title: "유효", status: "active" });
    const done = normalizeTopic("done", { title: "완료", status: "done" });

    expect(shouldShowChangeInList(active, false)).toBe(true);
    expect(shouldShowChangeInList(done, false)).toBe(false);
    expect(shouldShowChangeInList(done, true)).toBe(true);
  });
});
