import { describe, it, expect } from "vitest";
import { PDFDocument, degrees } from "@cantoo/pdf-lib";
import { rotatePages, deletePages, reorderPages, extractPages, insertPdf, movedOrder, shiftedOrder, uprightPlacement, placeImage } from "./pageTools";

// A 4×2 pixel PNG (transparent), so a placed image is twice as wide as it is tall.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAC0lEQVR4nGNgIAQAACIAAV64IdsAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));

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
  it("moves pages one place up or down, keeping a block together and stopping at the ends", () => {
    expect(shiftedOrder(5, [2], -1)).toEqual([0, 2, 1, 3, 4]);
    expect(shiftedOrder(5, [2], 1)).toEqual([0, 1, 3, 2, 4]);
    expect(shiftedOrder(5, [1, 2], -1)).toEqual([1, 2, 0, 3, 4]);
    expect(shiftedOrder(5, [1, 3], 1)).toEqual([0, 2, 1, 4, 3]);
    expect(shiftedOrder(5, [0, 1], -1)).toEqual([0, 1, 2, 3, 4]);
    expect(shiftedOrder(5, [4], 1)).toEqual([0, 1, 2, 3, 4]);
    expect(shiftedOrder(3, [0, 2], -1)).toEqual([0, 2, 1]);
  });
  it("centres a placed image on the chosen point and keeps it upright on rotated pages", () => {
    for (const rotation of [0, 90, 180, 270, -90]) {
      const { x, y, angle } = uprightPlacement(300, 400, 160, 60, rotation);
      expect(angle).toBe(((rotation % 360) + 360) % 360);
      // The image's centre, drawn from (x, y) and turned by `angle`, is the chosen point.
      const a = (angle * Math.PI) / 180;
      expect(x + 80 * Math.cos(a) - 30 * Math.sin(a)).toBeCloseTo(300, 6);
      expect(y + 80 * Math.sin(a) + 30 * Math.cos(a)).toBeCloseTo(400, 6);
    }
  });
  it("places a signature image on the chosen page", async () => {
    const src = await PDFDocument.create();
    src.addPage([600, 800]);
    src.addPage([600, 800]).setRotation(degrees(90));
    const out = await placeImage(await src.save(), 1, PNG, 300, 400, 160);
    const d = await PDFDocument.load(out);
    const xobjects = (p: number) => d.getPage(p).node.Resources()?.get(d.context.obj("XObject"));
    expect(xobjects(0)).toBeUndefined();
    expect(xobjects(1)).toBeDefined();
    expect(d.getPage(1).getRotation().angle).toBe(90);
  });
});
