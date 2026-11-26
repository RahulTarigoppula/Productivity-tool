// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildRegistry } from "./exporters";

const enc = (s: string) => new TextEncoder().encode(s);

async function sheetXml(csv: string, hints?: { header?: boolean }) {
  const reg = buildRegistry();
  const route = reg.routes("csv").find((r) => r.to === "xlsx")!;
  const out = await reg.run(route, { bytes: enc(csv), name: "stock.csv", hints });
  const zip = await JSZip.loadAsync(out.files[0].bytes);
  return zip.file("xl/worksheets/sheet1.xml")!.async("string");
}

describe("Excel export follows the table", () => {
  it("guesses a header row when the editor gives no choice", async () => {
    expect(await sheetXml("item,count\nPens,5\n")).toContain('state="frozen"');
  });

  it("keeps the first row as data when Header row is off", async () => {
    const xml = await sheetXml("item,count\nPens,5\n", { header: false });
    expect(xml).not.toContain('state="frozen"');
    expect(xml).not.toContain(' s="1"');
  });

  it("bolds the first row when Header row is on, even if it holds numbers", async () => {
    const xml = await sheetXml("2024,2025\n5,6\n", { header: true });
    expect(xml).toContain('state="frozen"');
    expect(xml).toContain('<c r="A1" t="inlineStr" s="1">');
  });
});
