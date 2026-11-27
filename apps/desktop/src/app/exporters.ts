/** Converters registered with the conversion registry (docs/plans/10-universal-export.md).
 *  Heavy libraries are imported only when a conversion runs. */
import { ConversionRegistry, type Converter } from "../lib/convert";
import { loadCsv, toTable, looksLikeHeader } from "../lib/csv";
import { decodeText } from "../lib/textcodec";
import { stem } from "../lib/paths";

const enc = (s: string) => new TextEncoder().encode(s);
const textOf = (b: Uint8Array) => decodeText(b).text;
const one = (bytes: Uint8Array) => ({ files: [{ suffix: "", bytes }] });

export const HTML_STYLE = `body{font:16px/1.6 "Segoe UI",system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1c1c22}
pre,code{font-family:"Cascadia Code",Consolas,monospace;font-size:.9em}pre{background:#f4f4f6;padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap}
code{background:#f4f4f6;padding:1px 4px;border-radius:4px}pre code{background:none;padding:0}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}
blockquote{border-left:3px solid #ccd;margin:0;padding-left:14px;color:#555}img{max-width:100%}h1,h2,h3{line-height:1.25}
li:has(>.task-box:first-child),li:has(>p:first-child>.task-box:first-child){list-style:none;margin-left:-1.2em}`;

export function htmlDocument(title: string, body: string): string {
  const esc = title.replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  return `<!doctype html>\n<html><head><meta charset="utf-8"><title>${esc}</title><style>${HTML_STYLE}</style></head><body>\n${body}\n</body></html>\n`;
}

/** Elements and attributes removed from rendered documents: no forms (they could navigate the
 *  app window), no styles (they could restyle the app or leak what is on screen), no frames. */
export const SANITIZE = {
  FORBID_TAGS: ["style", "form", "video", "audio", "source", "picture", "track", "input", "button", "textarea", "select", "option", "iframe", "frame", "object", "embed", "link", "meta", "base", "svg", "math"],
  // No id or name (a document could shadow the app's own elements); classes are filtered in a hook.
  FORBID_ATTR: ["style", "srcset", "formaction", "action", "background", "ping", "poster", "id", "name"],
  ADD_ATTR: ["data-src"],
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (h: string) => void; reject: (e: Error) => void }>();

function renderInWorker(md: string, timeoutMs: number): Promise<string> {
  if (typeof Worker === "undefined") return import("marked").then(({ marked }) => marked.parse(md, { gfm: true, async: true }));
  if (!worker) {
    worker = new Worker(new URL("./markdown.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; html?: string; error?: string }>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (!p) return;
      if (e.data.error !== undefined) p.reject(new Error(e.data.error));
      else p.resolve(e.data.html ?? "");
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, md });
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      // The renderer is stuck on this document: replace it so later renders still work.
      worker?.terminate();
      worker = null;
      for (const [, p] of pending) p.reject(new Error("Preview stopped"));
      pending.clear();
      reject(new Error("This document is too complex to show or convert."));
    }, timeoutMs);
  });
}

let hooked = false;

/** Markdown → safe HTML. A preview stops at a size the window can show; an export always converts
 *  the whole document (with more time allowed for a long one). */
export async function markdownToHtml(md: string, opts: { forExport?: boolean } = {}): Promise<string> {
  const html = await renderInWorker(md, opts.forExport ? Math.max(20_000, md.length / 200) : 4000);
  // A tiny file can expand into an enormous page (for example a table with thousands of columns).
  if (!opts.forExport && html.length > 4_000_000) return "<p><em>This document is too large to preview. The editor still shows all of it.</em></p>";
  const DOMPurify = (await import("dompurify")).default;
  if (!hooked) {
    hooked = true;
    // Remote images are never loaded (a document must not be able to report that it was opened).
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      // Only code-language classes survive, so a document cannot borrow the app's own styles
      // (for example to draw a fake dialog over the window).
      const cls = node.getAttribute?.("class");
      if (cls !== null && cls !== undefined) {
        const keep = cls.split(/\s+/).filter((c) => /^(language|lang|hljs)-[\w-]+$/.test(c) || c === "task-box" || c === "done").join(" ");
        if (keep) node.setAttribute("class", keep);
        else node.removeAttribute("class");
      }
      // Nothing is fetched by the browser itself: the source moves to data-src and the app
      // loads only local files through its own checked path resolver.
      if (node.nodeName === "IMG") {
        const src = node.getAttribute("src") ?? "";
        if (!/^data:image\//i.test(src)) {
          node.removeAttribute("src");
          node.setAttribute("data-src", src.slice(0, 2000));
        }
      }
    });
  }
  return DOMPurify.sanitize(html, SANITIZE);
}

const escHtml = (s: string) => s.replace(/[<&>"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export function tableToHtml(rows: string[][], header = true): string {
  const [head, ...rest] = rows;
  const tr = (r: string[], tag: string) => `<tr>${r.map((c) => `<${tag}>${escHtml(c)}</${tag}>`).join("")}</tr>`;
  return `<table>\n${header && head ? `<thead>${tr(head, "th")}</thead>` : ""}<tbody>\n${(header ? rest : rows).map((r) => tr(r, "td")).join("\n")}\n</tbody></table>`;
}

export function tableToMarkdown(rows: string[][]): string {
  if (!rows.length) return "";
  // A loop, not Math.max(...rows): spreading a million rows overflows the call stack.
  let width = 0;
  for (const r of rows) if (r.length > width) width = r.length;
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? "")).join(" | ")} |`;
  return [line(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n") + "\n";
}

function csvField(v: string, d: string): string {
  return v.includes(d) || v.includes('"') || /[\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export function tableToDelimited(rows: string[][], d: string, eol = "\r\n"): string {
  return rows.map((r) => r.map((c) => csvField(c, d)).join(d)).join(eol) + eol;
}

export function tableToJson(rows: string[][]): string {
  const [head, ...rest] = rows;
  if (!head) return "[]\n";
  const keys = head.map((h, i) => h.trim() || `column${i + 1}`);
  return JSON.stringify(rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""]))), null, 2) + "\n";
}

export function jsonToTable(text: string): string[][] {
  const data = JSON.parse(text);
  const arr: unknown[] = Array.isArray(data) ? data : [data];
  // Keys collected through a Set (a list lookup made 10,000 keys take seconds); a table wider than
  // a spreadsheet can show is refused rather than written.
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const o of arr) if (o && typeof o === "object" && !Array.isArray(o)) for (const k of Object.keys(o)) if (!seen.has(k)) (seen.add(k), keys.push(k));
  if (keys.length > 16_384) throw new Error(`This JSON has ${keys.length.toLocaleString()} different fields, more columns than a table can hold.`);
  if (!keys.length) return [["value"], ...arr.map((v) => [typeof v === "string" ? v : JSON.stringify(v)])];
  return [keys, ...arr.map((o) => keys.map((k) => {
    const v = (o as Record<string, unknown>)?.[k];
    return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  }))];
}

/** Lay out plain text on A4 pages with a monospaced font. */
export async function textToPdf(text: string, title: string): Promise<Uint8Array> {
  // Every character becomes drawing commands; beyond this the window would run out of memory.
  if (text.length > 20_000_000) throw new Error("This text is too long to turn into a PDF here. Export it as plain text or a Word document instead.");
  const { PDFDocument, StandardFonts } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Courier);
  const size = 10, lineH = 13, margin = 50, width = 595.28, height = 841.89;
  const maxChars = Math.floor((width - margin * 2) / font.widthOfTextAtSize("M", size));
  const lines: string[] = [];
  for (const raw of text.replace(/\t/g, "    ").split("\n")) {
    if (!raw) lines.push("");
    for (let i = 0; i < raw.length; i += maxChars) lines.push(raw.slice(i, i + maxChars));
  }
  const perPage = Math.floor((height - margin * 2) / lineH);
  for (let p = 0; p < Math.max(1, lines.length); p += perPage) {
    const page = doc.addPage([width, height]);
    lines.slice(p, p + perPage).forEach((l, i) => {
      // Standard fonts only cover Windows-1252; replace anything else.
      const safe = [...l].map((ch) => (ch.charCodeAt(0) < 256 || "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".includes(ch) ? ch : "?")).join("");
      page.drawText(safe, { x: margin, y: height - margin - (i + 1) * lineH, size, font });
    });
  }
  return doc.save();
}

async function pdfToImages(bytes: Uint8Array): Promise<{ suffix: string; bytes: Uint8Array }[]> {
  const { loadPdfjs } = await import("../engines/pdf/pdfjs");
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error(`Page ${i} is too large to turn into a picture.`);
    out.push({ suffix: `-page${String(i).padStart(String(doc.numPages).length, "0")}`, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  await doc.loadingTask.destroy();
  return out;
}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { loadPdfjs } = await import("../engines/pdf/pdfjs");
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let s = "";
    for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) s += (it.str ?? "") + (it.hasEOL ? "\n" : "");
    pages.push(s.trim());
  }
  await doc.loadingTask.destroy();
  return pages.join("\n\n\f\n\n") + "\n";
}

async function imageToPdf(bytes: Uint8Array, isPng: boolean): Promise<Uint8Array> {
  // A PNG is decoded pixel by pixel to go into a PDF; its size is read from the header first
  // (a small file can describe a picture of billions of pixels). JPEGs go in without decoding.
  if (isPng && bytes.length > 24) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const w = v.getUint32(16), h = v.getUint32(20);
    if (w * h > 60_000_000) throw new Error(`This picture is ${w.toLocaleString()} × ${h.toLocaleString()} pixels, too large to put into a PDF here.`);
  }
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.create();
  const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const page = doc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return doc.save();
}

const c = (from: string, to: string, quality: Converter["quality"], run: Converter["run"], loses?: Converter["loses"]): Converter => ({ id: `${from}->${to}`, from, to, quality, run, loses });

/** Markdown → Word in a worker, stopped if it runs too long (where workers exist; tests run it directly). */
async function markdownToDocxOffThread(md: string, title: string): Promise<Uint8Array> {
  if (typeof Worker === "undefined") return (await import("../lib/docxWriter")).markdownToDocx(md, title);
  const worker = new Worker(new URL("../lib/docx.worker.ts", import.meta.url), { type: "module" });
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("This note is too complex to convert to Word.")), Math.max(30_000, md.length / 50));
      worker.onmessage = (e: MessageEvent<{ bytes?: Uint8Array; error?: string }>) => {
        clearTimeout(timer);
        if (e.data.bytes) resolve(e.data.bytes);
        else reject(new Error(e.data.error ?? "Conversion failed."));
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error(e.message || "Conversion failed."));
      };
      worker.postMessage({ md, title });
    });
  } finally {
    worker.terminate();
  }
}

export function buildRegistry(): ConversionRegistry {
  const r = new ConversionRegistry();
  // Markdown and text
  // In the exported page, pictures point where the note points (it is saved beside the note, so
  // relative paths keep working); only the app's own preview withholds them.
  const withImages = (html: string) => html.replace(/<img([^>]*?) data-src="([^"]*)"/g, (_m, pre: string, src: string) => (/^\s*javascript:/i.test(src) ? `<img${pre}` : `<img${pre} src="${src}"`));
  r.register(c("md", "html", "good", async ({ bytes, name }) => one(enc(htmlDocument(stem(name), withImages(await markdownToHtml(textOf(bytes), { forExport: true })))))));
  r.register(c("md", "txt", "text", async ({ bytes }) => {
    const html = await markdownToHtml(textOf(bytes), { forExport: true });
    const div = document.createElement("div");
    div.innerHTML = html;
    return one(enc((div.innerText || div.textContent || "").replace(/\n{3,}/g, "\n\n").trim() + "\n"));
  }, "Formatting such as headings, bold and links becomes plain text."));
  r.register(c("txt", "pdf", "exact", async ({ bytes, name }) => one(await textToPdf(textOf(bytes), stem(name)))));
  // Word documents, written natively (headings, lists, tables, links and styles stay structured).
  r.register(c("md", "docx", "good", async ({ bytes, name }) => {
    return one(await markdownToDocxOffThread(textOf(bytes), stem(name)));
  }, (text) => (/!\[[^\]]*\]\(/.test(text) ? "Images are left out (their descriptions are kept)." : null)));
  r.register(c("txt", "docx", "exact", async ({ bytes, name }) => {
    const { textToDocx } = await import("../lib/docxWriter");
    return one(await textToDocx(textOf(bytes), stem(name), !/\.(txt|text|log)$/i.test(name)));
  }));
  // Markdown straight to PDF is a plain-text PDF; the formatted route is Print.
  r.register(c("md", "pdf", "text", async ({ bytes, name }) => {
    const html = await markdownToHtml(textOf(bytes), { forExport: true });
    const div = document.createElement("div");
    div.innerHTML = html;
    return one(await textToPdf((div.innerText || div.textContent || "").replace(/\n{3,}/g, "\n\n").trim() + "\n", stem(name)));
  }, "Plain text only: headings, bold and links are not formatted."));
  r.register(c("txt", "html", "exact", async ({ bytes, name }) => one(enc(htmlDocument(stem(name), `<pre>${escHtml(textOf(bytes))}</pre>`)))));
  // Tables
  const table = (b: Uint8Array, ext: string) => toTable(loadCsv(b, ext));
  for (const src of ["csv", "tsv"]) {
    r.register(c(src, "json", "exact", async ({ bytes }) => one(enc(tableToJson(table(bytes, src)))), undefined));
    r.register(c(src, "md", "good", async ({ bytes }) => one(enc(tableToMarkdown(table(bytes, src))))));
    r.register(c(src, "html", "good", async ({ bytes, name }) => one(enc(htmlDocument(stem(name), tableToHtml(table(bytes, src)))))));
  }
  for (const src of ["csv", "tsv"]) {
    // Tables as aligned plain text, and as a PDF of that text.
    const aligned = (b: Uint8Array) => {
      const rows = table(b, src);
      const widths: number[] = [];
      for (const r of rows) r.forEach((cell, i) => (widths[i] = Math.min(40, Math.max(widths[i] ?? 0, cell.length))));
      return rows.map((r) => r.map((cell, i) => cell.slice(0, 40).padEnd(widths[i])).join("  ").trimEnd()).join("\n") + "\n";
    };
    r.register(c(src, "txt", "good", async ({ bytes }) => one(enc(aligned(bytes))), "Columns are lined up with spaces; very long cells are shortened."));
    r.register(c(src, "pdf", "good", async ({ bytes, name }) => one(await textToPdf(aligned(bytes), stem(name))), "A plain table in a fixed-width font; very long cells are shortened."));
  }
  for (const src of ["csv", "tsv"]) {
    // Excel workbooks: numbers stay numbers, IDs with leading zeros stay text.
    r.register(c(src, "xlsx", "good", async ({ bytes, name, hints }) => {
      const { tablesToXlsx } = await import("../lib/xlsxWriter");
      const rows = table(bytes, src);
      return one(await tablesToXlsx([{ name: stem(name), rows, header: hints?.header ?? looksLikeHeader(rows) }]));
    }, "Values only: one sheet, no formulas or formatting."));
  }
  r.register(c("csv", "tsv", "exact", async ({ bytes }) => one(enc(tableToDelimited(table(bytes, "csv"), "\t")))));
  r.register(c("tsv", "csv", "exact", async ({ bytes }) => one(enc(tableToDelimited(table(bytes, "tsv"), ",")))));
  r.register(c("json", "csv", "good", async ({ bytes }) => one(enc(tableToDelimited(jsonToTable(textOf(bytes)), ","))), "Nested objects become JSON text inside a cell."));
  // PDF
  r.register(c("pdf", "png", "exact", async ({ bytes }) => ({ files: await pdfToImages(bytes) })));
  r.register(c("pdf", "txt", "text", async ({ bytes }) => one(enc(await pdfToText(bytes))), "Only the text is kept; layout, images and fonts are not."));
  // PDF → Markdown, and through it → Word: headings, paragraphs, lists, bold, italic and links rebuilt.
  r.register(c("pdf", "md", "good", async ({ bytes }) => {
    const [{ loadPdfjs }, { pdfToMarkdown }] = await Promise.all([import("../engines/pdf/pdfjs"), import("../lib/pdfToMarkdown")]);
    const pdfjs = await loadPdfjs();
    // Font names say which text is bold or italic; PDF.js keeps them only when asked.
    const doc = await pdfjs.getDocument({ data: bytes.slice(), fontExtraProperties: true }).promise;
    try {
      return one(enc(await pdfToMarkdown(doc as unknown as import("../lib/pdfToMarkdown").PdfDoc)));
    } finally {
      await doc.loadingTask.destroy();
    }
  }, "Text, headings, lists, bold and links are kept; page layout, pictures and table lines are not."));
  // Images
  r.register(c("png", "pdf", "exact", async ({ bytes }) => one(await imageToPdf(bytes, true))));
  r.register(c("jpg", "pdf", "exact", async ({ bytes }) => one(await imageToPdf(bytes, false))));
  r.register(c("jpeg", "pdf", "exact", async ({ bytes }) => one(await imageToPdf(bytes, false))));
  // Office (read-only readers)
  r.register(c("xlsx", "csv", "good", async ({ bytes }) => {
    const { readXlsx } = await import("../engines/office/ooxml");
    const sheets = await readXlsx(bytes);
    // One file per sheet; names that clean up alike ("a/b" and "a:b") get a number, never overwrite each other.
    const used = new Set<string>();
    const suffix = (name: string) => {
      const base = `-${name.replace(/[\\/:*?"<>|]/g, "_")}`;
      let out = base;
      for (let n = 2; used.has(out.toLowerCase()); n++) out = `${base} (${n})`;
      used.add(out.toLowerCase());
      return out;
    };
    return { files: sheets.map((s) => ({ suffix: sheets.length > 1 ? suffix(s.name) : "", bytes: enc(tableToDelimited(s.rows, ",")) })) };
  }, "Values only: formulas, formatting and charts are not kept. One file per sheet."));
  r.register(c("docx", "md", "good", async ({ bytes }) => {
    const { docxToMarkdown } = await import("../lib/docxToMarkdown");
    return one(enc(await docxToMarkdown(bytes)));
  }, "Images become placeholders with their description; page layout, fonts, colours and comments are not kept."));
  r.register(c("pptx", "md", "text", async ({ bytes }) => {
    const { readPptx } = await import("../engines/office/ooxml");
    const slides = await readPptx(bytes);
    return one(enc(slides.map((s) => `## Slide ${s.index}\n\n${s.paragraphs.map((p) => `- ${p}`).join("\n")}${s.notes.length ? `\n\n> Notes: ${s.notes.join(" ")}` : ""}`).join("\n\n") + "\n"));
  }, "Only slide text and notes are kept."));
  return r;
}

let registry: ConversionRegistry | null = null;
export function getRegistry(): ConversionRegistry {
  return (registry ??= buildRegistry());
}

/** Source format id for a file: its extension, with any non-special text file treated as txt. */
export function sourceFormat(name: string, kind: string): string {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  if (kind === "markdown") return "md";
  if (kind === "csv") return ext === "tsv" || ext === "tab" ? "tsv" : "csv";
  if (kind === "text") return ext === "json" ? "json" : ext === "html" || ext === "htm" ? "html" : "txt";
  if (kind === "image") return ext === "jpeg" ? "jpg" : ext;
  return ext;
}

/** The formats most people want from each kind of file, in order ("print" is the formatted PDF).
 *  Export lists these first and puts the others under "More formats". */
export const PREFERRED_EXPORTS: Record<string, string[]> = {
  md: ["docx", "print", "html"],
  txt: ["pdf", "docx", "print"],
  csv: ["xlsx", "print", "pdf"],
  tsv: ["xlsx", "print", "pdf"],
  json: ["csv", "print"],
  html: ["pdf", "print"],
  docx: ["md", "html", "print"],
  xlsx: ["csv", "print"],
  pptx: ["md", "print"],
  pdf: ["docx", "txt", "png"],
};

export const FORMAT_LABEL: Record<string, string> = {
  html: "Web page", txt: "Plain text", pdf: "PDF", md: "Markdown", json: "JSON", csv: "CSV", tsv: "Tab-separated", png: "PNG images", docx: "Word document", xlsx: "Excel workbook",
};
