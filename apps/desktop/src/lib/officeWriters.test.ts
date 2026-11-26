// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { markdownToDocx, textToDocx } from "./docxWriter";
import { tablesToXlsx, asNumber, colLetters } from "./xlsxWriter";
import { readDocxText, readXlsx } from "../engines/office/ooxml";

async function wellFormed(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  for (const name of Object.keys(zip.files).filter((n) => /\.(xml|rels)$/.test(n))) {
    const doc = new DOMParser().parseFromString(await zip.file(name)!.async("string"), "application/xml");
    expect(doc.getElementsByTagName("parsererror").length, `${name} is not well-formed XML`).toBe(0);
  }
  return zip;
}

const MD = `# Project kickoff

A note with **bold**, *italic*, \`code\`, ~~gone~~ and a [link](https://example.com) & 1 < 2.

## Agenda

1. Introductions
2. Scope
   - Phase 1
   - Phase 2
3. Risks

- [x] Book the room
- [ ] Send the slides

> Keep it simple.

| Owner | Task | Due |
|---|:-:|--:|
| Asha | Plan | Mon |
| Ravi | Design \\| review | Wed |

\`\`\`python
def total(items):
    return sum(items)
\`\`\`

---

![diagram](pic.png) Final words.
`;

describe("Word export", () => {
  it("writes a valid .docx whose text and structure read back", async () => {
    const bytes = await markdownToDocx(MD, "Project kickoff");
    const zip = await wellFormed(bytes);
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain('w:pStyle w:val="Heading1"');
    expect(doc).toContain('w:pStyle w:val="Heading2"');
    expect(doc).toContain("<w:tbl>");
    expect(doc).toContain('w:pStyle w:val="CodeBlock"');
    expect(doc).toContain("<w:b/>");
    expect(doc).toContain("<w:numPr>");
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain('Target="https://example.com"');

    const paras = await readDocxText(bytes);
    const text = paras.map((p) => p.text).join("\n");
    expect(paras.find((p) => p.text === "Project kickoff")?.style).toMatch(/Heading1/);
    expect(text).toContain("A note with bold, italic, code, gone and a link & 1 < 2.");
    expect(text).toContain("☑ Book the room");
    expect(text).toContain("☐ Send the slides");
    expect(text).toContain("Design | review");
    expect(text).toContain("    return sum(items)");
    expect(text).toContain("[diagram] Final words.");
  });

  it("numbers each ordered list from 1", async () => {
    const zip = await JSZip.loadAsync(await markdownToDocx("1. a\n2. b\n\ntext\n\n1. c\n2. d\n", "t"));
    const numbering = await zip.file("word/numbering.xml")!.async("string");
    expect((numbering.match(/<w:startOverride w:val="1"\/>/g) ?? []).length).toBe(2);
  });

  it("only web and mail links become clickable", async () => {
    const zip = await JSZip.loadAsync(await markdownToDocx("[a](notes.md) [b](file:///c:/x) [c](mailto:x@y.z)", "t"));
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain("mailto:x@y.z");
    expect(rels).not.toContain("notes.md");
    expect(rels).not.toContain("file:");
  });

  it("writes plain text line by line and survives control characters", async () => {
    const bytes = await textToDocx("line one\r\nline\u0001 two\n", "t");
    await wellFormed(bytes);
    expect((await readDocxText(bytes)).map((p) => p.text)).toEqual(["line one", "line two"]);
  });

  it("handles an empty document", async () => {
    await wellFormed(await markdownToDocx("", "empty"));
  });
});

describe("Excel export", () => {
  it("keeps numbers as numbers and IDs with leading zeros as text", async () => {
    const rows = [
      ["id", "name", "zip", "amount"],
      ["00012", "Smith, J", "01234", "10.5"],
      ["13", "Lee & <Co>", "98765", "-20"],
      ["", "", "", "1e5"],
    ];
    const bytes = await tablesToXlsx([{ name: "data/2026: Q1?", rows, header: true }]);
    const zip = await wellFormed(bytes);
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">00012</t></is></c>');
    expect(sheet).toContain('<c r="D2"><v>10.5</v></c>');
    expect(sheet).toContain('<c r="A3"><v>13</v></c>');
    expect(sheet).toContain('<c r="D3"><v>-20</v></c>');
    expect(sheet).toContain('t="inlineStr"><is><t xml:space="preserve">1e5</t>');
    expect(sheet).toContain('state="frozen"');
    const wb = await zip.file("xl/workbook.xml")!.async("string");
    expect(wb).toContain('name="data 2026  Q1"');

    const [read] = await readXlsx(bytes);
    expect(read.rows[0]).toEqual(["id", "name", "zip", "amount"]);
    expect(read.rows[1]).toEqual(["00012", "Smith, J", "01234", "10.5"]);
    expect(read.rows[2][1]).toBe("Lee & <Co>");
  });

  it("decides what is safely a number", () => {
    expect(asNumber("42")).toBe(42);
    expect(asNumber("-3.25")).toBe(-3.25);
    expect(asNumber("0.5")).toBe(0.5);
    for (const v of ["007", "+1", "1e5", " 4", "1,000", "12345678901234567", "", "0x10", "NaN"]) expect(asNumber(v)).toBeNull();
  });

  it("names columns like Excel", () => {
    expect([0, 25, 26, 701, 702, 16383].map(colLetters)).toEqual(["A", "Z", "AA", "ZZ", "AAA", "XFD"]);
  });
});
