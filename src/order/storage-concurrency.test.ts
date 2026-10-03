import { beforeEach, expect, it, vi } from "vitest";
import type { Snapshot } from "./types";
const fake = vi.hoisted(() => ({
  version: "current",
  reads: [] as string[],
  writes: [] as Array<{ ref: string; value: any }>,
}));
vi.mock("../lib/firebase", () => ({ getFirebaseServices: () => ({ db: {} }) }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  increment: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: (_db: unknown, ...parts: string[]) => parts.join("/"),
  setDoc: vi.fn(),
  runTransaction: async (_db: unknown, task: any) =>
    task({
      get: async (ref: string) => {
        fake.reads.push(ref);
        if (fake.writes.length) throw new Error("read after write");
        return {
          exists: () => true,
          data: () =>
            ref.endsWith("active")
              ? { version: fake.version }
              : { overrides: { kept: "old" } },
        };
      },
      set: (ref: string, value: any) => fake.writes.push({ ref, value }),
    }),
}));
import { publishSnapshot } from "./storage";
const snapshot = {
  version: "unique-new",
  asOf: "2026-10-03",
  importedAt: "now",
} as Snapshot;
beforeEach(() => {
  fake.version = "current";
  fake.reads = [];
  fake.writes = [];
});
it("rejects a stale classification before writing active metadata or overrides", async () => {
  await expect(
    publishSnapshot(snapshot, "stale", { baseId: "item", code: "123" }),
  ).rejects.toThrow("다른 직원");
  expect(fake.writes).toEqual([]);
});
it("commits classification and active metadata in the same transaction, retaining other overrides", async () => {
  // Cache is unavailable in this Node test; inspect the cloud transaction before its cache failure.
  await expect(
    publishSnapshot(snapshot, "current", { baseId: "item", code: "123" }),
  ).rejects.toThrow();
  expect(fake.reads).toEqual([
    "order_finder/active",
    "order_finder/preferences",
  ]);
  expect(fake.writes.map((x) => x.ref)).toEqual([
    "order_finder/preferences",
    "order_finder/active",
  ]);
  expect(fake.writes[0].value.overrides).toEqual({ kept: "old", item: "123" });
});
