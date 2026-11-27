import { describe, it, expect } from "vitest";
import { fuzzyMatch, rank } from "./fuzzy";

describe("fuzzy matching", () => {
  it("matches subsequences and rejects non-matches", () => {
    expect(fuzzyMatch("tgl", "Toggle sidebar")).not.toBeNull();
    expect(fuzzyMatch("xyz", "Toggle sidebar")).toBeNull();
  });
  it("prefers prefix and word-start matches", () => {
    const r = rank(["Export as PDF", "Open recent", "Reopen closed tab"], "open", (s) => s);
    expect(r[0].item).toBe("Open recent");
  });
  it("prefers word initials over scattered letters", () => {
    const r = rank(["Show settings", "Toggle sidebar"], "ts", (s) => s);
    expect(r[0].item).toBe("Toggle sidebar");
  });
  it("applies boosts", () => {
    const r = rank(["notes.md", "notes-old.md"], "notes", (s) => s, (s) => (s === "notes-old.md" ? 2000 : 0));
    expect(r[0].item).toBe("notes-old.md");
  });

  it("names whose lower case is longer (İstanbul) and emoji match without shifting or crashing", () => {
    for (const q of ["bud", "nd", "id", "smd", "imd", "stan"]) expect(() => fuzzyMatch(q, "İstanbul notları.md")).not.toThrow();
    const m = fuzzyMatch("stan", "İstanbul.md")!;
    expect(m.positions.map((p) => "İstanbul.md"[p]).join("")).toBe("stan");
    const e = fuzzyMatch("plan", "🎉 plan.md")!;
    expect(e.positions.map((p) => "🎉 plan.md"[p]).join("")).toBe("plan");
  });
});
