import { describe, it, expect } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import { rotatePages, deletePages, reorderPages, extractPages, insertPdf, movedOrder } from "./pageTools";

async function makePdf(n: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage([100 + i, 200]);
  return d.save();
}
const widths = async (b: Uint8Array) => (await PDFDocument.load(b)).getPages().map((p) => p.getWidth());

describe("PDF page tools", () => {
  it("rotates selected pages", async () => {
    const out = await rotatePages(await makePdf(3), [1], 90);
    const d = await PDFDocument.load(out);
    expect(d.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0]);
    const back = await rotatePages(out, [1], -90);
    expect((await PDFDocument.load(back)).getPage(1).getRotation().angle).toBe(0);
  });
  it("deletes pages but never the last one", async () => {
    expect(await widths(await deletePages(await makePdf(3), [0, 2]))).toEqual([101]);
    await expect(deletePages(await makePdf(2), [0, 1])).rejects.toThrow();
  });
  it("reorders, extracts and inserts", async () => {
    const src = await makePdf(3);
    expect(await widths(await reorderPages(src, [2, 0, 1]))).toEqual([102, 100, 101]);
    expect(await widths(await extractPages(src, [1]))).toEqual([101]);
    expect(await widths(await insertPdf(src, await makePdf(1), 1))).toEqual([100, 100, 101, 102]);
  });
  it("computes a drag-to-move order", () => {
    expect(movedOrder(5, [0], 3)).toEqual([1, 2, 0, 3, 4]);
    expect(movedOrder(5, [3, 4], 0)).toEqual([3, 4, 0, 1, 2]);
    expect(movedOrder(4, [1], 4)).toEqual([0, 2, 3, 1]);
  });
});
