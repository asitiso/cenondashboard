import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("overlay layout styles", () => {
  it("allows the home detail overlay panel to scroll when content is taller than the screen", () => {
    const overlayPanel = cssBlock(".overlay-panel");

    expect(overlayPanel).toContain("height: 100vh");
    expect(overlayPanel).toContain("overflow-y: auto");
  });
});
