import { describe, expect, it } from "vitest";
import { freezeMemoActivity } from "./memoActivity";

describe("order navigation freeze", () => {
  it("changes only the flag synchronously and defers cleanup and save", () => {
    const foreground = { current: true };
    const generation = { current: 3 };
    const queued: Array<() => void> = [];
    const events: string[] = [];
    freezeMemoActivity(foreground, generation, work => { queued.push(work); events.push("scheduled"); }, () => events.push("cleanup and save"));
    expect(foreground.current).toBe(false);
    expect(generation.current).toBe(4);
    expect(events).toEqual(["scheduled"]);
    queued[0]();
    expect(events).toEqual(["scheduled", "cleanup and save"]);
  });

  it("does not clean up a newly resumed memo screen", () => {
    const foreground = { current: true };
    const generation = { current: 0 };
    let queued = () => {};
    let cleaned = false;
    freezeMemoActivity(foreground, generation, work => { queued = work; }, () => { cleaned = true; });
    foreground.current = true;
    queued();
    expect(cleaned).toBe(false);
  });
});
