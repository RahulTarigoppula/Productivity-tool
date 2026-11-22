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

/** Place a PNG image (a drawn signature) on a page at PDF coordinates (origin bottom-left). */
export async function placeImage(bytes: Uint8Array, pageIndex: number, png: Uint8Array, x: number, y: number, width: number): Promise<Uint8Array> {
  const doc = await load(bytes);
  const img = await doc.embedPng(png);
  const page = doc.getPage(pageIndex);
  const height = (img.height / img.width) * width;
  page.drawImage(img, { x, y: y - height, width, height });
  return doc.save();
}

export function movedOrder(count: number, selected: number[], target: number): number[] {
  const sel = new Set(selected);
  const rest = [...Array(count).keys()].filter((i) => !sel.has(i));
  const before = rest.filter((i) => i < target).length;
  const moving = [...selected].sort((a, b) => a - b);
  return [...rest.slice(0, before), ...moving, ...rest.slice(before)];
}
