import { describe, expect, it } from "vitest";
import { DEFAULT_SIDEBAR_COLLAPSED } from "./layout";

describe("layout defaults", () => {
  it("starts the desktop sidebar collapsed", () => {
    expect(DEFAULT_SIDEBAR_COLLAPSED).toBe(true);
  });
});
