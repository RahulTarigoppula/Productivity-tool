// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument, StandardFonts, PDFString } from "@cantoo/pdf-lib";
import { pdfToMarkdown, type PdfDoc } from "./pdfToMarkdown";

type Pdfjs = typeof import("pdfjs-dist");
let pdfjs: Pdfjs;
beforeAll(async () => {
  pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as Pdfjs;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).href;
});
const load = async (bytes: Uint8Array) =>
  (await pdfjs.getDocument({ data: bytes, isEvalSupported: false, fontExtraProperties: true } as Parameters<Pdfjs["getDocument"]>[0]).promise) as unknown as PdfDoc;

async function report(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const reg = await d.embedFont(StandardFonts.Helvetica);
  const bold = await d.embedFont(StandardFonts.HelveticaBold);
  const ital = await d.embedFont(StandardFonts.HelveticaOblique);
  for (let n = 1; n <= 2; n++) {
    const p = d.addPage([595, 842]);
    p.drawText("ACME quarterly report", { x: 50, y: 810, size: 9, font: reg });
    p.drawText(`Page ${n} of 2`, { x: 270, y: 30, size: 9, font: reg });
    if (n === 1) {
      p.drawText("Quarterly Report", { x: 50, y: 750, size: 24, font: bold });
      p.drawText("Sales grew in every region this quarter, and the new store", { x: 50, y: 710, size: 11, font: reg });
      p.drawText("opened on time. Costs were steady through the whole sum-", { x: 50, y: 696, size: 11, font: reg });
      p.drawText("mer season.", { x: 50, y: 682, size: 11, font: reg });
      p.drawText("Highlights", { x: 50, y: 640, size: 16, font: bold });
      p.drawText("• Online sales doubled", { x: 60, y: 615, size: 11, font: reg });
      p.drawText("• Two new hires", { x: 60, y: 600, size: 11, font: reg });
      p.drawText("Read the", { x: 50, y: 570, size: 11, font: reg });
      p.drawText("full details", { x: 98, y: 570, size: 11, font: bold });
      p.drawText("online.", { x: 162, y: 570, size: 11, font: ital });
      const link = d.context.obj({ Type: "Annot", Subtype: "Link", Rect: [97, 566, 160, 580], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of("https://example.com/q3") } });
      p.node.addAnnot(d.context.register(link));
    } else {
      p.drawText("Next steps", { x: 50, y: 750, size: 16, font: bold });
      p.drawText("1. Hire a manager", { x: 60, y: 720, size: 11, font: reg });
      p.drawText("2. Open in March", { x: 60, y: 705, size: 11, font: reg });
      p.drawText("Price is 5 * 3 = 15 and file_name_here.", { x: 50, y: 670, size: 11, font: reg });
    }
  }
  return d.save();
}

describe("PDF to Markdown", () => {
  it("rebuilds headings, paragraphs, lists, emphasis and links, without headers or page numbers", async () => {
    const md = await pdfToMarkdown(await load(await report()));
    expect(md).toContain("# Quarterly Report\n");
    expect(md).toContain("## Highlights\n");
    expect(md).toContain("## Next steps\n");
    expect(md).toContain("Sales grew in every region this quarter, and the new store opened on time. Costs were steady through the whole summer season.");
    expect(md).toContain("- Online sales doubled\n- Two new hires");
    expect(md).toContain("1. Hire a manager\n2. Open in March");
    expect(md).toContain("[**full details**](https://example.com/q3)");
    expect(md).toContain("*online.*");
    expect(md).toContain("Price is 5 \\* 3 = 15 and file_name_here.");
    expect(md).not.toMatch(/ACME quarterly report|Page \d of 2/);
  });

  it("says so when a PDF has no text (a scan)", async () => {
    const d = await PDFDocument.create();
    d.addPage([595, 842]);
    await expect(pdfToMarkdown(await load(await d.save()))).rejects.toThrow(/no text/);
  });
});
