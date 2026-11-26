// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readXlsx, readPart, LIMITS } from "./ooxml";

async function xlsx(sheetXml: string): Promise<Uint8Array> {
  const z = new JSZip();
  z.file("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`);
  z.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetXml}</sheetData></worksheet>`);
  return z.generateAsync({ type: "uint8array" });
}

describe("Office preview limits", () => {
  it("does not allocate a huge grid for a crafted far-away cell", async () => {
    const t0 = Date.now();
    const [s] = await readXlsx(await xlsx(`<row r="1"><c r="A1" t="inlineStr"><is><t>ok</t></is></c></row><row r="1048576"><c r="XFD1048576"><v>1</v></c></row>`));
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(s.truncated).toBe(true);
    expect(s.rows[0][0]).toBe("ok");
    expect(s.maxCol).toBeLessThanOrEqual(LIMITS.cols);
  });
  it("rejects absurd column letters", async () => {
    const [s] = await readXlsx(await xlsx(`<row r="1"><c r="ZZZZZZZZ1"><v>1</v></c></row>`));
    expect(s.truncated).toBe(true);
  });
  it("reads a normal sheet", async () => {
    const [s] = await readXlsx(await xlsx(`<row r="1"><c r="A1"><v>1</v></c><c r="B1"><f>A1*2</f><v>2</v></c></row>`));
    expect(s.rows).toEqual([["1", "2"]]);
    expect(s.formulas.get("B1")).toBe("A1*2");
  });
});

describe("crafted Office files stay within limits", () => {
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const wbRels = (n: number) => `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet1.xml"/>`).join("")}</Relationships>`;

  it("two far-apart cells do not make millions of empty ones", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook ${ns}><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", wbRels(1));
    zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet ${ns}><sheetData><row r="1"><c r="BXX1"><v>1</v></c></row><row r="199999"><c r="A199999"><v>2</v></c></row></sheetData></worksheet>`);
    const t0 = Date.now();
    const [s] = await readXlsx(await zip.generateAsync({ type: "uint8array" }));
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(s.truncated).toBe(true);
    expect(s.rows.length * s.maxCol).toBeLessThanOrEqual(LIMITS.cells);
  });

  it("many sheet entries pointing at one part read it once", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook ${ns}><sheets>${Array.from({ length: 2000 }, (_, i) => `<sheet name="S${i}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", wbRels(2000));
    zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet ${ns}><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>`);
    const sheets = await readXlsx(await zip.generateAsync({ type: "uint8array" }));
    expect(sheets.length).toBe(1);
  });

  it("a part that unpacks past the budget is refused", async () => {
    const zip = new JSZip();
    zip.file("big.xml", "x".repeat(3 * 1024 * 1024));
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
    await expect(readPart(loaded, "big.xml", 1024 * 1024)).rejects.toThrow(/unpacks to more/);
    expect((await readPart(loaded, "big.xml"))?.length).toBe(3 * 1024 * 1024);
  });
});
