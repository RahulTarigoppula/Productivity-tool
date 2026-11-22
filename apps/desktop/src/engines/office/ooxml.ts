/** Minimal read-only readers for Office files: enough to preview content and export text.
 *  Full-fidelity Office editing is planned through the embedded office engine (W3). */
import JSZip from "jszip";

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
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

export async function readXlsx(bytes: Uint8Array): Promise<SheetData[]> {
  const zip = await JSZip.loadAsync(bytes);
  const wbXml = await zip.file("xl/workbook.xml")?.async("string");
  if (!wbXml) throw new Error("This does not look like an Excel workbook.");
  const wbRels = await rels(zip, "xl/workbook.xml");
  const shared: string[] = [];
  const ssXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (ssXml) for (const si of byTag(parse(ssXml), NS.main, "si")) shared.push(byTag(si, NS.main, "t").map((t) => t.textContent ?? "").join(""));
  const sheets: SheetData[] = [];
  for (const s of byTag(parse(wbXml), NS.main, "sheet")) {
    const rid = s.getAttributeNS(NS.rel, "id") ?? s.getAttribute("r:id") ?? "";
    const target = wbRels.get(rid);
    const xml = target ? await zip.file(target)?.async("string") : undefined;
    const rows: string[][] = [];
    const formulas = new Map<string, string>();
    let maxCol = 0;
    if (xml) {
      for (const row of byTag(parse(xml), NS.main, "row")) {
        const r = Number(row.getAttribute("r") ?? rows.length + 1) - 1;
        const vals: string[] = rows[r] ?? [];
        let next = 0;
        for (const c of byTag(row, NS.main, "c")) {
          const ref = c.getAttribute("r");
          const ci = ref ? colIndex(ref) : next;
          next = ci + 1;
          const t = c.getAttribute("t");
          const v = byTag(c, NS.main, "v")[0]?.textContent ?? "";
          const f = byTag(c, NS.main, "f")[0]?.textContent;
          let val = v;
          if (t === "s") val = shared[Number(v)] ?? "";
          else if (t === "inlineStr") val = byTag(c, NS.main, "t").map((x) => x.textContent ?? "").join("");
          else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
          vals[ci] = val;
          if (f) formulas.set(`${colName(ci)}${r + 1}`, f);
          if (ci + 1 > maxCol) maxCol = ci + 1;
        }
        rows[r] = vals;
      }
    }
    for (let i = 0; i < rows.length; i++) rows[i] = Array.from({ length: maxCol }, (_, c) => rows[i]?.[c] ?? "");
    sheets.push({ name: s.getAttribute("name") ?? `Sheet${sheets.length + 1}`, rows, formulas, maxCol });
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
  const zip = await JSZip.loadAsync(bytes);
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presXml) throw new Error("This does not look like a PowerPoint presentation.");
  const presRels = await rels(zip, "ppt/presentation.xml");
  const out: SlideText[] = [];
  let i = 0;
  for (const s of byTag(parse(presXml), NS.p, "sldId")) {
    const target = presRels.get(s.getAttributeNS(NS.rel, "id") ?? s.getAttribute("r:id") ?? "");
    const xml = target ? await zip.file(target)?.async("string") : undefined;
    if (!xml || !target) continue;
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
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("This does not look like a Word document.");
  return byTag(parse(xml), NS.w, "p").map((p) => {
    const style = byTag(p, NS.w, "pStyle")[0]?.getAttributeNS(NS.w, "val") ?? "";
    const text = byTag(p, NS.w, "t").map((t) => t.textContent ?? "").join("");
    return { style, text };
  });
}

export function docxToMarkdown(paras: { style: string; text: string }[]): string {
  return paras
    .map(({ style, text }) => {
      const m = /^Heading(\d)$/i.exec(style) ?? /^(?:berschrift|Titre)(\d)$/i.exec(style);
      if (m) return `${"#".repeat(Math.min(6, Number(m[1])))} ${text}`;
      if (/^Title$/i.test(style)) return `# ${text}`;
      if (/List/i.test(style)) return `- ${text}`;
      return text;
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}
