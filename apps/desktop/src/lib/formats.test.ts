import { describe, it, expect } from "vitest";
import { detectKind, kindFromName, modernSaveFormat, isOtherOffice } from "./formats";

// Real compound files and ZIP archives are full of zero bytes after their headers.
const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(64).fill(0)]);
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const text = (s: string) => new TextEncoder().encode(s);

describe("file kinds", () => {
  it("opens older and OpenDocument Office files in the Office editors", () => {
    expect(["report.doc", "letter.rtf", "notes.odt"].map(kindFromName)).toEqual(["docx", "docx", "docx"]);
    expect(["sales.xls", "sales.ods"].map(kindFromName)).toEqual(["xlsx", "xlsx"]);
    expect(["deck.ppt", "deck.odp"].map(kindFromName)).toEqual(["pptx", "pptx"]);
    expect(detectKind("report.doc", bytes(...OLE))).toBe("docx");
    expect(detectKind("sales.xls", bytes(...OLE))).toBe("xlsx");
    expect(detectKind("notes.odt", bytes(...ZIP))).toBe("docx");
    expect(detectKind("letter.rtf", text("{\\rtf1\\ansi hello}"))).toBe("docx");
  });

  it("does not mistake other content for an Office file", () => {
    expect(detectKind("report.doc", text("just some words"))).toBe("text");
    expect(detectKind("letter.rtf", text("plain text, not rtf"))).toBe("text");
    expect(detectKind("notes.odt", bytes(...OLE))).toBe("binary");
    expect(detectKind("report.docx", bytes(...OLE))).toBe("binary");
  });

  it("knows which files are saved as a modern file and which keep their format", () => {
    expect(modernSaveFormat("a/report.doc")).toBe("docx");
    expect(modernSaveFormat("sales.xls")).toBe("xlsx");
    expect(modernSaveFormat("deck.ppt")).toBe("pptx");
    for (const f of ["notes.odt", "sales.ods", "deck.odp", "letter.rtf", "report.docx", "plan.md"]) expect(modernSaveFormat(f), f).toBeNull();
    expect(isOtherOffice("deck.odp")).toBe(true);
    expect(isOtherOffice("deck.pptx")).toBe(false);
  });

  it("a note that starts with %PDF stays a note unless it really is a PDF", () => {
    expect(detectKind("plan.md", text("%PDF-1.4 is the version line of a PDF"))).toBe("markdown");
    expect(detectKind("plan.md", bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("pdf");
  });
});
