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

export function parseCsv(text: string, delimiter: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [], quoted: boolean[] = [];
  let field = "", fieldQuoted = false, inQ = false, rowStart = 0, atFieldStart = true;
  const n = text.length;
  const endField = () => {
    cells.push(field);
    quoted.push(fieldQuoted);
    field = "";
    fieldQuoted = false;
    atFieldStart = true;
  };
  const endRow = (end: number, term: string) => {
    endField();
    rows.push({ cells, quoted, raw: text.slice(rowStart, end + term.length), term });
    cells = [];
    quoted = [];
    rowStart = end + term.length;
  };
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
      continue;
    }
    if (c === '"' && atFieldStart) {
      inQ = true;
      fieldQuoted = true;
      atFieldStart = false;
    } else if (c === delimiter) {
      endField();
    } else if (c === "\r" || c === "\n") {
      const term = c === "\r" && text[i + 1] === "\n" ? "\r\n" : c;
      endRow(i, term);
      i += term.length - 1;
    } else {
      field += c;
      atFieldStart = false;
    }
  }
  if (rowStart < n || cells.length || field) endRow(n, "");
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
      const body = r.raw !== null ? r.raw.slice(0, r.raw.length - r.term.length) : serializeRow(r, doc.delimiter);
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
