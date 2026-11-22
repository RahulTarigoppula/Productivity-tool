import { describe, it, expect } from "vitest";
import { isContentUri, rememberName, basename, dirname, extname, join, relative, resolve, samePath, withExtension, isRemoteOrDevicePath, resolveDocumentRef } from "./paths";

describe("paths", () => {
  it("names Android documents by their display name, with no folder", () => {
    const uri = "content://com.android.providers.downloads.documents/document/msf%3A1000";
    expect(isContentUri(uri)).toBe(true);
    expect(basename(uri)).toBe("1000");
    rememberName(uri, "Budget.xlsx");
    expect(basename(uri)).toBe("Budget.xlsx");
    expect(extname(uri)).toBe("xlsx");
    expect(dirname(uri)).toBe("");
    expect(basename("content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fnotes.md")).toBe("notes.md");
    expect(resolveDocumentRef(dirname(uri), "image.png")).toBe(null);
  });
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
  it("never climbs above a drive or a network share", () => {
    expect(resolveDocumentRef("\\\\fileserver\\team\\docs", "../../../evil.example@SSL/a.png")).toBe("\\\\fileserver\\team\\evil.example@SSL\\a.png");
    expect(resolveDocumentRef("C:\\Users\\me", "../../../../Windows/win.ini")).toBe("C:\\Windows\\win.ini");
    expect(resolveDocumentRef("/home/me", "../../../etc/passwd")).toBe("/etc/passwd");
  });
  it("refuses document references that reach other machines", () => {
    expect(isRemoteOrDevicePath("\\\\attacker\\share\\a.png")).toBe(true);
    expect(isRemoteOrDevicePath("//attacker.com/s/a.png")).toBe(true);
    expect(isRemoteOrDevicePath("file://server/x")).toBe(true);
    expect(isRemoteOrDevicePath("C:\\x.png")).toBe(false);
    expect(resolveDocumentRef("C:\\notes", "img/a.png")).toBe("C:\\notes\\img\\a.png");
    expect(resolveDocumentRef("C:\\notes", "../assets/a.png")).toBe("C:\\assets\\a.png");
    for (const bad of ["\\\\evil\\s\\a.png", "//evil.com/a.png", "/etc/passwd", "C:/Windows/x.png", "file:///C:/x", "https://x/a.png", "smb://evil/a"]) {
      expect(resolveDocumentRef("C:\\notes", bad)).toBeNull();
    }
  });
  it("compares Windows paths case-insensitively", () => {
    expect(samePath("C:\\A\\b.txt", "c:/a/B.TXT")).toBe(true);
    expect(samePath("/a/b", "/a/B")).toBe(false);
  });
});
