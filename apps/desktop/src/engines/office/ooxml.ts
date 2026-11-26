/** Minimal read-only readers for Office files: enough to preview content and export text.
 *  Full-fidelity Office editing is planned through the embedded office engine (W3). */
import JSZip from "jszip";
import { BUILTIN_FORMATS, formatNumber } from "../../lib/numfmt";

/** Limits that keep a small crafted file from exhausting memory. */
export const LIMITS = { unzippedBytes: 300 * 1024 * 1024, rows: 200_000, cols: 2_000, cells: 5_000_000 };

/** Open an Office package after checking its declared unzipped size (zip-bomb guard). */
export async function openZip(bytes: Uint8Array): Promise<JSZip> {
  const zip = await JSZip.loadAsync(bytes);
  let total = 0;
  zip.forEach((_p, f) => {
    total += (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (total > LIMITS.unzippedBytes) throw new Error(`This file would unpack to ${(total / 1048576).toFixed(0)} MB, more than the preview allows.`);
  return zip;
}

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

/** A part's text, unpacked with a hard limit on what it really inflates to: a crafted file can
 *  declare small sizes and still unpack to gigabytes. */
export async function readPart(zip: JSZip, path: string, maxBytes = 200 * 1024 * 1024): Promise<string | undefined> {
  const f = zip.file(path);
  if (!f) return undefined;
  const chunks: Uint8Array[] = [];
  let total = 0;
  await new Promise<void>((resolve, reject) => {
    // internalStream exists at run time but is missing from JSZip's type definitions.
    type Stream = { on(ev: string, cb: (x: never) => void): Stream; pause(): Stream; resume(): Stream };
    const stream = (f as unknown as { internalStream(type: "uint8array"): Stream }).internalStream("uint8array");
    stream
      .on("data", (chunk: Uint8Array) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.pause();
          reject(new Error("This file unpacks to more than the app can open."));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", (e: Error) => reject(e))
      .on("end", () => resolve())
      .resume();
  });
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) (all.set(c, at), (at += c.length));
  return new TextDecoder().decode(all);
}
const byTag = (el: Document | Element, ns: string, tag: string) => Array.from(el.getElementsByTagNameNS(ns, tag));

const NS = {
  main: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  rel: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  pkgRel: "http://schemas.openxmlformats.org/package/2006/relationships",
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
};

async function rels(zip: JSZip, path: string): Promise<Map<string, string>> {
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  const file = `${dir}_rels/${path.slice(dir.length)}.rels`;
  const xml = await zip.file(file)?.async("string");
  const out = new Map<string, string>();
  if (!xml) return out;
  for (const r of byTag(parse(xml), NS.pkgRel, "Relationship")) {
    let target = r.getAttribute("Target") ?? "";
    if (!target.startsWith("/")) {
      const parts = (dir + target).split("/");
      const stack: string[] = [];
      for (const p of parts) p === ".." ? stack.pop() : p !== "." && stack.push(p);
      target = stack.join("/");
    } else target = target.slice(1);
    out.set(r.getAttribute("Id") ?? "", target);
  }
  return out;
}

// ---------- spreadsheets ----------

export interface SheetData {
  name: string;
  /** True when the sheet was larger than the preview limits and was cut short. */
  truncated?: boolean;
  /** rows[r][c] = displayed value */
  rows: string[][];
  formulas: Map<string, string>;
  maxCol: number;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
    if (n > 20_000) return NaN;
  }
  return n - 1;
}

export function colName(i: number): string {
  let s = "";
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/** A stored number as Excel shows it. In General format the stored digits are kept as they are
 *  (only floating-point noise such as 0.30000000000000004 is cleaned), so no digits are lost. */
function showNumber(v: string, format: string | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (format && !/^general$/i.test(format.trim())) return formatNumber(n, format);
  return /\d{16,}/.test(v.replace(/[.-]/g, "")) && !/e/i.test(v) ? String(Number(n.toPrecision(15))) : v;
}

export async function readXlsx(bytes: Uint8Array): Promise<SheetData[]> {
  const zip = await openZip(bytes);
  const wbXml = await zip.file("xl/workbook.xml")?.async("string");
  if (!wbXml) throw new Error("This does not look like an Excel workbook.");
  const wbRels = await rels(zip, "xl/workbook.xml");
  const shared: string[] = [];
  const ssXml = await readPart(zip, "xl/sharedStrings.xml");
  if (ssXml) for (const si of byTag(parse(ssXml), NS.main, "si")) shared.push(byTag(si, NS.main, "t").map((t) => t.textContent ?? "").join(""));
  // Number formats by cell style, so dates, prices and percentages read as they are shown.
  const formats: (string | undefined)[] = [];
  const stylesXml = await zip.file("xl/styles.xml")?.async("string");
  if (stylesXml) {
    const st = parse(stylesXml);
    const custom = new Map<number, string>();
    for (const nf of byTag(st, NS.main, "numFmt")) custom.set(Number(nf.getAttribute("numFmtId")), nf.getAttribute("formatCode") ?? "");
    const cellXfs = byTag(st, NS.main, "cellXfs")[0];
    if (cellXfs) for (const xf of byTag(cellXfs, NS.main, "xf")) {
      const id = Number(xf.getAttribute("numFmtId") ?? 0);
      formats.push(custom.get(id) ?? BUILTIN_FORMATS[id]);
    }
  }
  const sheets: SheetData[] = [];
  // Each sheet part is read once, and only so many sheets (a crafted workbook can point thousands
  // of sheet entries at one large part).
  const readTargets = new Set<string>();
  for (const s of byTag(parse(wbXml), NS.main, "sheet").slice(0, 256)) {
    const rid = s.getAttributeNS(NS.rel, "id") ?? s.getAttribute("r:id") ?? "";
    const target = wbRels.get(rid);
    if (target && readTargets.has(target)) continue;
    if (target) readTargets.add(target);
    const xml = target ? await readPart(zip, target) : undefined;
    const rows: string[][] = [];
    const formulas = new Map<string, string>();
    let maxCol = 0;
    let truncated = false;
    let cellCount = 0;
    if (xml) {
      for (const row of byTag(parse(xml), NS.main, "row")) {
        const r = Number(row.getAttribute("r") ?? rows.length + 1) - 1;
        if (!Number.isFinite(r) || r < 0 || r >= LIMITS.rows) {
          truncated = true;
          continue;
        }
        const vals: string[] = rows[r] ?? [];
        let next = 0;
        for (const c of byTag(row, NS.main, "c")) {
          const ref = c.getAttribute("r");
          const ci = ref ? colIndex(ref) : next;
          next = ci + 1;
          if (!Number.isFinite(ci) || ci < 0 || ci >= LIMITS.cols || ++cellCount > LIMITS.cells) {
            truncated = true;
            continue;
          }
          const t = c.getAttribute("t");
          const v = byTag(c, NS.main, "v")[0]?.textContent ?? "";
          const f = byTag(c, NS.main, "f")[0]?.textContent;
          let val = v;
          if (t === "s") val = shared[Number(v)] ?? "";
          else if (t === "inlineStr") val = byTag(c, NS.main, "t").map((x) => x.textContent ?? "").join("");
          else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
          else if ((!t || t === "n") && v !== "") val = showNumber(v, formats[Number(c.getAttribute("s") ?? 0)]);
          vals[ci] = val;
          if (f) formulas.set(`${colName(ci)}${r + 1}`, f);
          if (ci + 1 > maxCol) maxCol = ci + 1;
        }
        rows[r] = vals;
      }
    }
    // Fill gaps (sparse rows) only up to the data actually present, and never past the cell limit
    // (two far-apart cells in a tiny file would otherwise describe millions of empty ones).
    if (rows.length * Math.max(1, maxCol) > LIMITS.cells) {
      rows.length = Math.max(1, Math.floor(LIMITS.cells / Math.max(1, maxCol)));
      truncated = true;
    }
    for (let i = 0; i < rows.length; i++) rows[i] = Array.from({ length: maxCol }, (_, c) => rows[i]?.[c] ?? "");
    sheets.push({ name: s.getAttribute("name") ?? `Sheet${sheets.length + 1}`, rows, formulas, maxCol, truncated });
  }
  return sheets;
}

// ---------- presentations ----------

export interface SlideText {
  index: number;
  paragraphs: string[];
  notes: string[];
}

function paragraphs(xml: string): string[] {
  return byTag(parse(xml), NS.a, "p")
    .map((p) => byTag(p, NS.a, "t").map((t) => t.textContent ?? "").join(""))
    .filter((s) => s.trim());
}

export async function readPptx(bytes: Uint8Array): Promise<SlideText[]> {
  const zip = await openZip(bytes);
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presXml) throw new Error("This does not look like a PowerPoint presentation.");
  const presRels = await rels(zip, "ppt/presentation.xml");
  const out: SlideText[] = [];
  let i = 0;
  // Each slide part is read once and only so many slides (a crafted deck can point thousands of
  // slide entries at one large slide).
  const readTargets = new Set<string>();
  for (const s of byTag(parse(presXml), NS.p, "sldId").slice(0, 2000)) {
    const target = presRels.get(s.getAttributeNS(NS.rel, "id") ?? s.getAttribute("r:id") ?? "");
    if (!target || readTargets.has(target)) continue;
    readTargets.add(target);
    const xml = await readPart(zip, target);
    if (!xml) continue;
    i++;
    const slideRels = await rels(zip, target);
    const notesPath = [...slideRels.values()].find((p) => p.includes("notesSlide"));
    const notesXml = notesPath ? await zip.file(notesPath)?.async("string") : undefined;
    out.push({ index: i, paragraphs: paragraphs(xml), notes: notesXml ? paragraphs(notesXml).filter((n) => !/^\d+$/.test(n)) : [] });
  }
  return out;
}

// ---------- documents ----------

export async function readDocxText(bytes: Uint8Array): Promise<{ style: string; text: string }[]> {
  const zip = await openZip(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("This does not look like a Word document.");
  return byTag(parse(xml), NS.w, "p").map((p) => {
    const style = byTag(p, NS.w, "pStyle")[0]?.getAttributeNS(NS.w, "val") ?? "";
    const text = byTag(p, NS.w, "t").map((t) => t.textContent ?? "").join("");
    return { style, text };
  });
}

