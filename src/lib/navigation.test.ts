import { describe, expect, it } from "vitest";
import { getViewForHomeSection } from "./navigation";

describe("getViewForHomeSection", () => {
  it("maps each home work section to the matching main menu view", () => {
    expect(getViewForHomeSection("changes")).toBe("changes");
    expect(getViewForHomeSection("drugs")).toBe("drugs");
    expect(getViewForHomeSection("manual")).toBe("manual");
  });
});
