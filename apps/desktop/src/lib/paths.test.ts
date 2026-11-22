import { describe, it, expect } from "vitest";
import { basename, dirname, extname, join, relative, resolve, samePath, withExtension } from "./paths";

describe("paths", () => {
  it("handles Windows and POSIX paths", () => {
    expect(basename("C:\\Users\\me\\notes.md")).toBe("notes.md");
    expect(dirname("C:\\Users\\me\\notes.md")).toBe("C:\\Users\\me");
    expect(extname("/home/a/Report.DOCX")).toBe("docx");
    expect(extname(".gitignore")).toBe("");
    expect(join("C:\\a", "b.txt")).toBe("C:\\a\\b.txt");
    expect(join("/a/", "b.txt")).toBe("/a/b.txt");
    expect(withExtension("C:\\a\\b.md", "pdf")).toBe("C:\\a\\b.pdf");
  });
  it("computes relative links and resolves them back", () => {
    expect(relative("C:\\work\\notes", "C:\\work\\data\\budget.xlsx")).toBe("../data/budget.xlsx");
    expect(resolve("C:\\work\\notes", "../data/budget.xlsx")).toBe("C:\\work\\data\\budget.xlsx");
    expect(relative("/a/b", "/a/b/c.md")).toBe("c.md");
    expect(resolve("/a/b", "c.md")).toBe("/a/b/c.md");
  });
  it("compares Windows paths case-insensitively", () => {
    expect(samePath("C:\\A\\b.txt", "c:/a/B.TXT")).toBe(true);
    expect(samePath("/a/b", "/a/B")).toBe(false);
  });
});
