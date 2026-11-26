// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { pathMatcher } from "./Palette";
import { samePath } from "../lib/paths";

describe("palette path matching", () => {
  it("agrees with samePath, so listing a folder's files can use a Set", () => {
    const known = ["C:\\Work\\Plan.md", "/home/ana/notes.md", "/home/ana/dir/", "D:/data/Table.csv"];
    const candidates = [
      "C:\\Work\\Plan.md", "c:/work/plan.md", "C:\\Work\\Plan.md\\", "C:\\Work\\Other.md",
      "/home/ana/notes.md", "/home/ana/Notes.md", "/home/ana/notes.md/", "\\home\\ana\\notes.md",
      "/home/ana/dir", "d:\\DATA\\table.csv", "D:/data/Table.csv/", "/d:/data/Table.csv",
    ];
    const listed = pathMatcher(known);
    for (const c of candidates) expect([c, listed(c)]).toEqual([c, known.some((k) => samePath(k, c))]);
  });

  it("is quick for a folder of 20,000 files", () => {
    const files = Array.from({ length: 20000 }, (_, i) => `C:\\Projects\\site\\src\\part${i % 50}\\file-${i}.ts`);
    const known = Array.from({ length: 45 }, (_, i) => `C:\\Projects\\site\\src\\part${i}\\file-${i}.ts`);
    const t0 = performance.now();
    const listed = pathMatcher(known);
    const left = files.filter((f) => !listed(f));
    expect(left.length).toBe(20000 - 45);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
