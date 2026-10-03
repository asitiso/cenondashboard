import { expect, it } from "vitest";
import { encodeSnapshot, decodeSnapshot } from "./storage";
it("round trips Korean snapshot chunks without losing Unicode or exceeding document payload limits", () => {
  const value = { products: [{ name: "약국😀".repeat(120000) }], version: "v" };
  const chunks = encodeSnapshot(value);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((c) => new TextEncoder().encode(c).length < 800000)).toBe(
    true,
  );
  expect(decodeSnapshot(chunks)).toEqual(value);
});
it("rejects missing/corrupt chunks instead of replacing the active snapshot", () => {
  expect(() => decodeSnapshot(['{"products":'])).toThrow();
});
