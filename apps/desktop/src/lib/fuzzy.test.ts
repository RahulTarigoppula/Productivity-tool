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
});
