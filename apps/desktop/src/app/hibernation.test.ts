import { describe, it, expect } from "vitest";
import { canSleep, shouldSleep, setAwake, touch, MAX_AWAKE_HEAVY } from "./hibernation";
import type { Tab } from "./store";

const tab = (id: string, extra: Partial<Tab> = {}): Tab =>
  ({ id, path: `/w/${id}.docx`, name: `${id}.docx`, kind: "docx", dirty: false, saveState: "saved", version: 0, ...extra }) as Tab;

describe("tab hibernation", () => {
  it("never puts to sleep a tab that could lose anything", () => {
    expect(canSleep(tab("a"), true)).toBe(false);
    expect(canSleep(tab("a", { dirty: true }), false)).toBe(false);
    expect(canSleep(tab("a", { path: null }), false)).toBe(false);
    expect(canSleep(tab("a", { conflict: "changed" }), false)).toBe(false);
    expect(canSleep(tab("a", { baselineUnsaved: true }), false)).toBe(false);
    expect(canSleep(tab("a", { kind: "markdown" }), false)).toBe(false);
    expect(canSleep(tab("a"), false)).toBe(true);
  });
  it("lets the least recently used heavy tabs sleep beyond the limit", () => {
    const ids = Array.from({ length: MAX_AWAKE_HEAVY + 1 }, (_, i) => `t${i}`);
    const now = Date.now();
    ids.forEach((id, i) => {
      setAwake(id, true);
      touch(id, now - 1000 + i);
    });
    // t0 was used first, so it is the one over the limit.
    expect(shouldSleep(tab("t0"), false, now)).toBe(true);
    expect(shouldSleep(tab(ids[ids.length - 1]), false, now)).toBe(false);
  });
});
