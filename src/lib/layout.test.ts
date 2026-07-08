import { describe, expect, it } from "vitest";
import { COMPACT_LAYOUT_MAX_WIDTH, DEFAULT_SIDEBAR_COLLAPSED } from "./layout";

describe("layout defaults", () => {
  it("starts the desktop sidebar collapsed", () => {
    expect(DEFAULT_SIDEBAR_COLLAPSED).toBe(true);
  });

  it("keeps landscape tablets in the desktop layout", () => {
    expect(COMPACT_LAYOUT_MAX_WIDTH).toBe(980);
  });
});
