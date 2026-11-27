/** PDF → Markdown (and through it → Word), offline. A PDF stores positioned pieces of text, not
 *  paragraphs, so the structure is rebuilt from the page: lines from positions, paragraphs from
 *  the gaps between lines, headings from larger type, lists from their bullets and numbers, bold
 *  and italic from the fonts, links from the page's link areas. Running headers, footers and page
 *  numbers are left out. Layout, images and table grids are not kept (tables read as lines). */

/** The parts of a PDF.js document this needs (kept small so tests can load PDF.js their own way). */
export interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<unknown>;
  getAnnotations(): Promise<{ subtype?: string; url?: string; rect?: number[] }[]>;
  getViewport(o: { scale: number }): { height: number };
  commonObjs: { has(id: string): boolean; get(id: string): unknown };
}

interface Piece {
  text: string;
  x: number;
  y: number;
  size: number;
  width: number;
  bold: boolean;
  italic: boolean;
  link?: string;
}

interface Line {
  y: number;
  x: number;
  size: number;
  pieces: Piece[];
  page: number;
  /** Distance from the top of the page, as a share of its height (for headers and footers). */
  top: number;
}

const BULLET = /^\s*([•●▪◦‣∙·○■□➢►–—-])\s+/;
const NUMBERED = /^\s*((\d{1,3}|[a-zA-Z]|[ivxIVX]{1,4})[.)])\s+/;

/** Characters Markdown would read as formatting (same rules as the Word converter). */
function escapeText(t: string): string {
  return t
    .replace(/[\\`*[\]~]/g, "\\$&")
    .replace(/_/g, (m, off: number, s: string) => (/[\p{L}\p{N}]/u.test(s[off - 1] ?? "") && /[\p{L}\p{N}]/u.test(s[off + 1] ?? "") ? m : "\\_"))
    .replace(/<(?=[A-Za-z/!?])/g, "\\<")
    .replace(/&(?=#?[A-Za-z0-9]+;)/g, "\\&");
}

function escapeLineStart(line: string): string {
  return line
    .replace(/^(#{1,6})(?=\s|$)/, "\\$1")
    .replace(/^([-+])(?=\s|$)/, "\\$1")
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, "$1\\$2")
    .replace(/^>/, "\\>");
}

/** What PDF.js knows about a font (its name and style flags), if anything. */
function fontOf(page: PdfPage, id: string | undefined): { bold?: boolean; italic?: boolean; name?: string } | null {
  try {
    return id && page.commonObjs.has(id) ? (page.commonObjs.get(id) as { bold?: boolean; italic?: boolean; name?: string }) : null;
  } catch {
    return null;
  }
}

async function readPage(page: PdfPage, n: number): Promise<Line[]> {
  // The operator list loads the fonts, which say whether they are bold or italic.
  await page.getOperatorList();
  const [tc, annots] = await Promise.all([page.getTextContent(), page.getAnnotations().catch(() => [])]);
  const height = page.getViewport({ scale: 1 }).height || 1;
  const links = annots.filter((a) => a.subtype === "Link" && a.url && /^(https?:|mailto:)/i.test(a.url) && a.rect?.length === 4);
  const fontInfo = new Map<string, { bold: boolean; italic: boolean }>();
  const pieces: Piece[] = [];
  for (const raw of tc.items as { str?: string; transform?: number[]; width?: number; fontName?: string }[]) {
    if (!raw.str || !raw.transform) continue;
    const [a, b, , d, x, y] = raw.transform;
    const size = Math.hypot(a, b) || Math.abs(d) || 1;
    let info = fontInfo.get(raw.fontName ?? "");
    if (!info) {
      const f = fontOf(page, raw.fontName);
      info = { bold: !!f?.bold || /bold|black|heavy|semibold/i.test(f?.name ?? ""), italic: !!f?.italic || /italic|oblique/i.test(f?.name ?? "") };
      fontInfo.set(raw.fontName ?? "", info);
    }
    const link = links.find((l) => x >= l.rect![0] - 1 && x <= l.rect![2] + 1 && y >= l.rect![1] - 2 && y <= l.rect![3] + 2)?.url;
    pieces.push({ text: raw.str, x, y, size, width: raw.width ?? raw.str.length * size * 0.5, bold: info.bold, italic: info.italic, link });
  }
  // Lines: pieces at the same height, read left to right.
  pieces.sort((p, q) => q.y - p.y || p.x - q.x);
  const lines: Line[] = [];
  for (const p of pieces) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - p.y) < Math.max(last.size, p.size) * 0.5) {
      last.pieces.push(p);
      last.size = Math.max(last.size, p.size);
    } else lines.push({ y: p.y, x: p.x, size: p.size, pieces: [p], page: n, top: 1 - p.y / height });
  }
  for (const l of lines) {
    l.pieces.sort((p, q) => p.x - q.x);
    l.x = l.pieces[0].x;
  }
  return lines.filter((l) => lineText(l).trim());
}

/** A line's plain text, with spaces where the pieces leave a gap. */
function lineText(l: Line): string {
  let s = "";
  let end = -Infinity;
  for (const p of l.pieces) {
    if (s && !/\s$/.test(s) && !/^\s/.test(p.text) && p.x - end > p.size * 0.15) s += " ";
    s += p.text;
    end = p.x + p.width;
  }
  return s;
}

/** A line as Markdown runs: bold, italic and links kept, neighbouring runs of the same kind merged. */
function lineRuns(l: Line): { text: string; bold: boolean; italic: boolean; link?: string }[] {
  const runs: { text: string; bold: boolean; italic: boolean; link?: string }[] = [];
  let end = -Infinity;
  for (const p of l.pieces) {
    let text = p.text;
    const prev = runs[runs.length - 1];
    if (prev && !/\s$/.test(prev.text) && !/^\s/.test(text) && p.x - end > p.size * 0.15) text = " " + text;
    end = p.x + p.width;
    if (prev && prev.bold === p.bold && prev.italic === p.italic && prev.link === p.link) prev.text += text;
    else runs.push({ text, bold: p.bold, italic: p.italic, link: p.link });
  }
  return runs;
}

function runsToMarkdown(runs: { text: string; bold: boolean; italic: boolean; link?: string }[], allBold: boolean): string {
  let out = "";
  for (const r of runs) {
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(r.text)!;
    if (!core) {
      out += r.text;
      continue;
    }
    let t = escapeText(core);
    // Markers only on whole words, so they read back the same.
    const mark = (m: string) => (/^[\p{L}\p{N}]/u.test(core) || /[\p{L}\p{N}]$/u.test(core) ? `${m}${t}${m}` : t);
    if (r.italic) t = mark("*");
    if (r.bold && !allBold) t = mark("**");
    if (r.link) t = `[${t}](${/[\s()]/.test(r.link) ? `<${r.link}>` : r.link})`;
    out += lead + t + trail;
  }
  return out;
}

/** A list item's text without its number ("1.", "a)"), taken off the pieces before they become
 *  Markdown, so a number set in bold leaves no stray "**" behind. */
function withoutMarker(para: Line[], marker: string): string {
  const [first, ...rest] = para;
  const pieces = first.pieces.map((p) => ({ ...p }));
  let left = marker;
  for (const p of pieces) {
    if (!left) break;
    const t = p.text.trimStart();
    const n = Math.min(t.length, left.length);
    if (t.slice(0, n) !== left.slice(0, n)) break;
    p.text = t.slice(n);
    left = left.slice(n);
  }
  const lines = [{ ...first, pieces: pieces.filter((p) => p.text.length) }, ...rest].filter((l) => l.pieces.length);
  return lines
    .map((l) => runsToMarkdown(lineRuns(l), false))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function pdfToMarkdown(doc: PdfDoc): Promise<string> {
  const pages: Line[][] = [];
  for (let n = 1; n <= doc.numPages; n++) pages.push(await readPage(await doc.getPage(n), n));
  const all = pages.flat();
  if (!all.length) throw new Error("This PDF has no text to convert. It may be a scanned picture of pages.");

  // Running headers, footers and page numbers: near the top or bottom, repeated on most pages.
  const norm = (l: Line) => lineText(l).trim().replace(/\d+/g, "#").toLowerCase();
  const margin = (l: Line) => l.top < 0.09 || l.top > 0.91;
  const counts = new Map<string, Set<number>>();
  for (const l of all) if (margin(l)) counts.set(norm(l), (counts.get(norm(l)) ?? new Set()).add(l.page));
  const repeated = (l: Line) => margin(l) && ((counts.get(norm(l))?.size ?? 0) >= Math.max(2, pages.length * 0.5) || /^(page\s*)?#(\s*(of|\/)\s*#)?$/.test(norm(l)));
  const pageNumber = (l: Line) => margin(l) && /^(page\s*)?#(\s*(of|\/)\s*#)?$/.test(norm(l));
  let lines = pages.length > 1 ? all.filter((l) => !repeated(l)) : all.filter((l) => !pageNumber(l));
  // Slides and forms can put most of their text near the top of every page in the same pattern
  // ("Slide 1: ...", "Slide 2: ..."): that is content, not a running header.
  if (lines.length < all.length * 0.5) lines = all.filter((l) => !pageNumber(l));
  if (!lines.length) throw new Error("This PDF has no text to convert. It may be a scanned picture of pages.");

  // The body size is the one most text is set in; larger sizes become heading levels.
  const weight = new Map<number, number>();
  for (const l of lines) {
    const s = Math.round(l.size * 2) / 2;
    weight.set(s, (weight.get(s) ?? 0) + lineText(l).length);
  }
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11;
  const bigger = [...weight.keys()].filter((s) => s >= body * 1.15).sort((a, b) => b - a);
  const level = (size: number) => {
    const i = bigger.indexOf(Math.round(size * 2) / 2);
    return i < 0 ? 0 : Math.min(3, i + 1);
  };

  // Paragraphs: lines that follow closely, at the same size, belong together.
  const blocks: string[] = [];
  let para: Line[] = [];
  const flush = () => {
    if (!para.length) return;
    const first = para[0];
    const text = para.map(lineText).join(" ").replace(/\s+/g, " ").trim();
    const allBold = para.every((l) => l.pieces.every((p) => p.bold || !p.text.trim()));
    const h = level(first.size) || (allBold && text.length < 80 && para.length === 1 && !/[.:;,]$/.test(text) ? Math.max(1, Math.min(3, bigger.length + 1)) : 0);
    // Words broken over a line end with a hyphen are joined again.
    const md = para
      .map((l, i) => {
        const s = runsToMarkdown(lineRuns(l), h > 0);
        return i < para.length - 1 && /[\p{L}]-$/u.test(s) && /^[\p{Ll}]/u.test(lineText(para[i + 1]).trim()) ? s.slice(0, -1) + "\u0000" : s;
      })
      .join(" ")
      .replace(/\u0000 /g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (h && text.length < 160) blocks.push(`${"#".repeat(h)} ${md.replace(/^\*\*(.*)\*\*$/, "$1")}`);
    else if (BULLET.test(text)) blocks.push(`- ${escapeLineStart(md.replace(/^\s*(\\?[•●▪◦‣∙·○■□➢►–—-])\s+/, ""))}`);
    else if (NUMBERED.test(text)) {
      const m = NUMBERED.exec(text)!;
      blocks.push(/^\d/.test(m[2]) ? `${m[2]}. ${withoutMarker(para, m[1])}` : md);
    } else blocks.push(escapeLineStart(md));
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const prev = para[para.length - 1];
    const startsItem = BULLET.test(lineText(l)) || NUMBERED.test(lineText(l));
    const together =
      prev &&
      prev.page === l.page &&
      Math.abs(prev.size - l.size) < 0.5 &&
      prev.y - l.y < l.size * 1.75 &&
      !startsItem &&
      !level(l.size) &&
      // A short line ending a sentence closes its paragraph.
      !(/[.!?:]$/.test(lineText(prev).trim()) && lineText(prev).length < 45);
    if (!together) flush();
    para.push(l);
  }
  flush();
  // Consecutive list items sit together; everything else is separated by a blank line.
  let md = "";
  for (let i = 0; i < blocks.length; i++) {
    const item = (b: string) => /^(- |\d+\. )/.test(b);
    if (i) md += item(blocks[i]) && item(blocks[i - 1]) ? "\n" : "\n\n";
    md += blocks[i];
  }
  return md + "\n";
}
