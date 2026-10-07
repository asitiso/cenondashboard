import { describe, expect, it } from "vitest";
import { getFirstScreen, setFirstScreen } from "./firstScreen";

describe("first screen preference", () => {
  it("uses a PC-local value and defaults to home", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } } as Storage;
    expect(getFirstScreen(storage)).toBe("home");
    setFirstScreen("memo", storage);
    expect(getFirstScreen(storage)).toBe("memo");
  });
});
