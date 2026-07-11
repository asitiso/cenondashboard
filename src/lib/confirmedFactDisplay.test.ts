import { describe, expect, it } from "vitest";
import { formatConfirmedFactForDisplay } from "./display";

describe("formatConfirmedFactForDisplay", () => {
  it("keeps the text content while making sentence breaks easier to read", () => {
    const original = "First fact is confirmed. Second fact is also confirmed. Third fact remains unchanged.";

    const formatted = formatConfirmedFactForDisplay(original);

    expect(formatted).toBe("First fact is confirmed.\nSecond fact is also confirmed.\nThird fact remains unchanged.");
    expect(formatted.replace(/\n/g, " ")).toBe(original);
  });

  it("preserves existing line breaks", () => {
    const original = "Line one.\nLine two. Line three.";

    expect(formatConfirmedFactForDisplay(original)).toBe("Line one.\nLine two.\nLine three.");
  });
});
