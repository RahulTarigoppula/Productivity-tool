/** Page operations with pdf-lib: they produce a new PDF (a full rewrite, not an incremental save). */
import { PDFDocument, degrees } from "@cantoo/pdf-lib";

const load = (bytes: Uint8Array) => PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });

export async function rotatePages(bytes: Uint8Array, pages: number[], delta: 90 | -90): Promise<Uint8Array> {
  const doc = await load(bytes);
  for (const i of pages) {
    const p = doc.getPage(i);
    p.setRotation(degrees((((p.getRotation().angle + delta) % 360) + 360) % 360));
  }
  return doc.save();
}

export async function deletePages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const doc = await load(bytes);
  if (pages.length >= doc.getPageCount()) throw new Error("A PDF needs at least one page.");
  for (const i of [...pages].sort((a, b) => b - a)) doc.removePage(i);
  return doc.save();
}

/** New order: order[k] is the old index of the page that should end up at position k. */
export async function reorderPages(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, order);
  copied.forEach((p) => out.addPage(p));
  out.setTitle(src.getTitle() ?? "");
  return out.save();
}

export async function extractPages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  (await out.copyPages(src, pages)).forEach((p) => out.addPage(p));
  return out.save();
}

export async function insertPdf(bytes: Uint8Array, other: Uint8Array, at: number): Promise<Uint8Array> {
  const doc = await load(bytes);
  const add = await load(other);
  const copied = await doc.copyPages(add, add.getPageIndices());
  copied.forEach((p, i) => doc.insertPage(at + i, p));
  return doc.save();
}

/** Place a PNG image (a signature) on a page, centred on a point in PDF coordinates (origin
 *  bottom-left) and upright as the page is shown, even on a rotated page. */
export async function placeImage(bytes: Uint8Array, pageIndex: number, png: Uint8Array, cx: number, cy: number, width: number): Promise<Uint8Array> {
  const doc = await load(bytes);
  const img = await doc.embedPng(png);
  const page = doc.getPage(pageIndex);
  const height = (img.height / img.width) * width;
  const { x, y, angle } = uprightPlacement(cx, cy, width, height, page.getRotation().angle);
  page.drawImage(img, { x, y, width, height, rotate: degrees(angle) });
  return doc.save();
}

/** Where to draw a w×h image so that its centre is at (cx, cy) and it looks upright on a page shown
 *  turned `rotation` degrees clockwise: the image is turned as far the other way, around the corner
 *  it is drawn from. */
export function uprightPlacement(cx: number, cy: number, w: number, h: number, rotation: number): { x: number; y: number; angle: number } {
  const angle = ((rotation % 360) + 360) % 360;
  const a = (angle * Math.PI) / 180;
  // The image's centre seen from that corner once turned.
  const ox = (w / 2) * Math.cos(a) - (h / 2) * Math.sin(a);
  const oy = (w / 2) * Math.sin(a) + (h / 2) * Math.cos(a);
  return { x: cx - ox, y: cy - oy, angle };
}

export function movedOrder(count: number, selected: number[], target: number): number[] {
  const sel = new Set(selected);
  const rest = [...Array(count).keys()].filter((i) => !sel.has(i));
  const before = rest.filter((i) => i < target).length;
  const moving = [...selected].sort((a, b) => a - b);
  return [...rest.slice(0, before), ...moving, ...rest.slice(before)];
}

/** New order after moving each of the given pages one place up (-1) or down (+1). A page already at
 *  the end it moves towards, or blocked by another moving page there, stays where it is. */
export function shiftedOrder(count: number, pages: number[], delta: -1 | 1): number[] {
  const order = [...Array(count).keys()];
  const moving = new Set(pages);
  // Walk in the direction of travel so a block of pages moves together.
  for (let k = 0; k < count; k++) {
    const i = delta < 0 ? k : count - 1 - k;
    const j = i + delta;
    if (j >= 0 && j < count && moving.has(order[i]) && !moving.has(order[j])) [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
