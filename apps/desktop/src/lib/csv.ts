/** CSV/TSV model that preserves the original file exactly.
 *  Every row keeps its original text; only rows that were edited are re-serialised. */
import { decodeTextRaw, encodeText, type TextFormat } from "./textcodec";

export interface CsvRow {
  cells: string[];
  /** Whether each field was quoted in the source (re-used when the row is re-serialised). */
  quoted: boolean[];
  /** Original text of the row including its line terminator; null once edited. */
  raw: string | null;
  /** Line terminator after this row: "\r\n", "\n", "\r" or "" for a final row with none. */
  term: string;
}

export interface CsvDoc {
  rows: CsvRow[];
  delimiter: string;
  eol: string;
  /** Whether the file ended with a line break (kept on save whatever row ends up last). */
  finalNewline: boolean;
  format: TextFormat;
}

const CANDIDATES = [",", ";", "\t", "|"];

export function detectDelimiter(text: string, hint?: string): string {
  if (hint === "tsv" || hint === "tab") return "\t";
  const lines: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < text.length && lines.length < 30; i++) {
    const c = text[i];
    if (c === '"') inQ = !inQ;
    if (!inQ && (c === "\n" || c === "\r")) {
      if (cur) lines.push(cur);
      cur = "";
      continue;
    }
    if (!inQ) cur += c;
  }
  if (cur && lines.length < 30) lines.push(cur);
  let best = ",", bestScore = -1;
  for (const d of CANDIDATES) {
    const counts = lines.map((l) => l.split(d).length - 1);
    if (!counts.length || counts[0] === 0) continue;
    const consistent = counts.filter((n) => n === counts[0]).length / counts.length;
    const score = consistent * 100 + Math.min(counts[0], 50);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** Splits CSV text into rows, keeping each row's original text. Fields are found by scanning ahead
 *  and slicing whole runs of text (a 1,000,000-row file parses in about a second). */
export function parseCsv(text: string, delimiter: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const n = text.length;
  const D = delimiter.charCodeAt(0);
  const QUOTE = 34, CR = 13, LF = 10;
  let i = 0, rowStart = 0;
  let cells: string[] = [], quoted: boolean[] = [];
  /** Index of the next delimiter or line break at or after k. */
  const fieldEnd = (k: number) => {
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === D || c === LF || c === CR) break;
      k++;
    }
    return k;
  };
  // Text that ends exactly after a line break has no further row.
  while (i < n || cells.length > 0 || rowStart < n) {
    let value: string, wasQuoted = false;
    if (i < n && text.charCodeAt(i) === QUOTE) {
      // A quoted field: "" inside stands for one quote; it may hold delimiters and line breaks.
      wasQuoted = true;
      let parts = "", j = i + 1;
      for (;;) {
        const q = text.indexOf('"', j);
        if (q < 0) {
          parts += text.slice(j);
          j = n;
          break;
        }
        if (text.charCodeAt(q + 1) === QUOTE) {
          parts += text.slice(j, q + 1);
          j = q + 2;
          continue;
        }
        parts += text.slice(j, q);
        j = q + 1;
        break;
      }
      // Anything between the closing quote and the next delimiter stays part of the value.
      const k = fieldEnd(j);
      value = parts + text.slice(j, k);
      i = k;
    } else {
      const k = fieldEnd(i);
      value = text.slice(i, k);
      i = k;
    }
    cells.push(value);
    quoted.push(wasQuoted);
    if (i >= n) {
      rows.push({ cells, quoted, raw: text.slice(rowStart), term: "" });
      break;
    }
    const c = text.charCodeAt(i);
    if (c === D) {
      i++;
      continue;
    }
    const term = c === CR && text.charCodeAt(i + 1) === LF ? "\r\n" : c === CR ? "\r" : "\n";
    i += term.length;
    rows.push({ cells, quoted, raw: text.slice(rowStart, i), term });
    rowStart = i;
    cells = [];
    quoted = [];
    if (i >= n) break;
  }
  return rows;
}

function needsQuotes(v: string, delimiter: string): boolean {
  return v.includes(delimiter) || v.includes('"') || v.includes("\n") || v.includes("\r");
}

export function serializeRow(row: CsvRow, delimiter: string): string {
  return row.cells
    .map((v, i) => (row.quoted[i] || needsQuotes(v, delimiter) ? `"${v.replace(/"/g, '""')}"` : v))
    .join(delimiter);
}

export function serializeCsv(doc: CsvDoc): string {
  const last = doc.rows.length - 1;
  return doc.rows
    .map((r, i) => {
      // Every row except the last needs a terminator (rows can move, for example after sorting);
      // the last row ends the way the file originally ended.
      const term = i < last ? r.term || doc.eol : doc.finalNewline ? r.term || doc.eol : "";
      // A row that had no line break of its own (the last one, or one whose open quote ran to the
      // end of the file) is written afresh once it is no longer last, so it cannot swallow the next row.
      const reuse = r.raw !== null && (r.term !== "" || i === last);
      const body = reuse ? r.raw!.slice(0, r.raw!.length - r.term.length) : serializeRow(r, doc.delimiter);
      return body + term;
    })
    .join("");
}

export function loadCsv(bytes: Uint8Array, extension = ""): CsvDoc {
  const { raw, format } = decodeTextRaw(bytes);
  const delimiter = detectDelimiter(raw, extension);
  const rows = parseCsv(raw, delimiter);
  const finalNewline = rows.length > 0 && rows[rows.length - 1].term !== "";
  return { rows, delimiter, eol: format.eol, finalNewline, format };
}

export function saveCsv(doc: CsvDoc): Uint8Array {
  // Line endings are already inside the row text, so encode without converting them.
  return encodeText(serializeCsv(doc), { ...doc.format, eol: "\n" });
}

export function columnCount(doc: CsvDoc): number {
  let m = 0;
  for (const r of doc.rows) if (r.cells.length > m) m = r.cells.length;
  return m;
}

export function setCell(row: CsvRow, col: number, value: string): CsvRow {
  const cells = row.cells.slice();
  const quoted = row.quoted.slice();
  while (cells.length <= col) {
    cells.push("");
    quoted.push(false);
  }
  cells[col] = value;
  return { cells, quoted, raw: null, term: row.term };
}

export function emptyRow(cols: number, term: string): CsvRow {
  return { cells: Array(cols).fill(""), quoted: Array(cols).fill(false), raw: null, term };
}

export function insertColumn(rows: CsvRow[], at: number): CsvRow[] {
  return rows.map((r) => {
    const cells = r.cells.slice();
    const quoted = r.quoted.slice();
    cells.splice(at, 0, "");
    quoted.splice(at, 0, false);
    return { cells, quoted, raw: null, term: r.term };
  });
}

export function deleteColumn(rows: CsvRow[], at: number): CsvRow[] {
  return rows.map((r) => {
    if (at >= r.cells.length) return r;
    const cells = r.cells.slice();
    const quoted = r.quoted.slice();
    cells.splice(at, 1);
    quoted.splice(at, 1);
    return { cells, quoted, raw: null, term: r.term };
  });
}

/** Compare two cell values the way people expect: numbers numerically, otherwise naturally. */
export function compareCells(a: string, b: string): number {
  const na = Number(a.replace(/,/g, "")), nb = Number(b.replace(/,/g, ""));
  const aNum = a.trim() !== "" && !isNaN(na), bNum = b.trim() !== "" && !isNaN(nb);
  if (aNum && bNum) return na - nb;
  if (aNum !== bNum) return aNum ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function toTable(doc: CsvDoc): string[][] {
  return doc.rows.map((r) => r.cells);
}

/** Whether the first row looks like column names: it has some text and no cell is a number.
 *  The grid and the Excel export use the same guess, so a table shows and exports alike. */
export function looksLikeHeader(rows: string[][]): boolean {
  const first = rows[0];
  return rows.length > 1 && !!first && first.some((c) => c.trim() !== "") && first.every((c) => c.trim() === "" || isNaN(Number(c)));
}
