import { describe, expect, it } from "vitest";
import { formatConfirmedFactForDisplay, formatManualDetailTextForDisplay } from "./display";

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

  it("uses the same readable formatting for manual summary text", () => {
    const original = "Summary sentence one. Summary sentence two.";

    expect(formatManualDetailTextForDisplay(original)).toBe("Summary sentence one.\nSummary sentence two.");
  });

  it("does not split numbered list markers after digits", () => {
    const original = "1. First step stays with its number. 2. Second step also stays.";

    expect(formatManualDetailTextForDisplay(original)).toBe("1. First step stays with its number.\n2. Second step also stays.");
  });
});
