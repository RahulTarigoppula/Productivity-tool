/** Writes Excel (.xlsx) workbooks from tables, offline, with no extra dependencies.
 *  Plain numbers become numbers (so sums and sorting work in Excel); anything that would change
 *  if treated as a number stays text: leading zeros (IDs, ZIP codes), digit strings of 12 or more
 *  (barcodes, card and order numbers, which Excel would show as 4.00638E+12), trailing zeros
 *  ("1.10"), "-0", "+1", "1e5" and the like. The header row is bold and stays in view; columns are sized to fit. */
import JSZip from "jszip";

export const XLSX_MAX_ROWS = 1_048_576;
export const XLSX_MAX_COLS = 16_384;
export const XLSX_MAX_CELL = 32_767;

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "");

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function colLetters(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A value Excel can store as a number without changing what the person sees: the number must
 *  print back exactly as written (so "1.10", "2.50", "-0" stay text), have at most 15 significant
 *  digits (Excel's precision) and at most 11 before the point (Excel shows longer ones as 1.2E+12). */
export function asNumber(v: string): number | null {
  const m = /^-?(0|[1-9]\d*)(?:\.(\d+))?$/.exec(v);
  if (!m) return null;
  const [, int, frac = ""] = m;
  if (int.length > 11) return null;
  if ((int === "0" ? frac.replace(/^0+/, "") : int + frac).length > 15) return null;
  const n = Number(v);
  return Number.isFinite(n) && String(n) === v ? n : null;
}

export interface SheetInput {
  name: string;
  rows: string[][];
  header?: boolean;
}

/** Excel's sheet-name rules: 1-31 characters, none of \\ / ? * [ ] :, no apostrophe at either
 *  end, not "History", unique ignoring case. Cut by characters, never inside an emoji. */
function sheetName(name: string, taken: Set<string>): string {
  // Excel counts UTF-16 units (an emoji is two), so stop before a character that would not fit.
  const clip = (t: string, max: number) => {
    let out = "";
    for (const ch of t) {
      if (out.length + ch.length > max) break;
      out += ch;
    }
    return out.replace(/^['\s]+|['\s]+$/g, "");
  };
  let base = clip(name.replace(/[\\/?*[\]:\u0000-\u001f]/g, " ").trim(), 31) || "Sheet";
  if (base.toLowerCase() === "history") base = "History (sheet)";
  let n = 2;
  let out = base;
  while (taken.has(out.toLowerCase())) {
    const suffix = ` (${n++})`;
    out = clip(base, 31 - suffix.length) + suffix;
  }
  taken.add(out.toLowerCase());
  return out;
}

function sheetXml(s: SheetInput): string {
  const cols = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (s.rows.length > XLSX_MAX_ROWS || cols > XLSX_MAX_COLS) throw new Error(`Excel holds at most ${XLSX_MAX_ROWS.toLocaleString()} rows and ${XLSX_MAX_COLS.toLocaleString()} columns.`);
  const widths = Array.from({ length: cols }, () => 8);
  for (const r of s.rows.slice(0, 500)) r.forEach((v, i) => (widths[i] = Math.min(60, Math.max(widths[i], v.length + 2))));
  const rowsXml = s.rows
    .map((r, ri) => {
      const header = s.header && ri === 0;
      const cells = r
        .map((v, ci) => {
          if (v === "") return "";
          if (v.length > XLSX_MAX_CELL) throw new Error(`Row ${ri + 1}, column ${colLetters(ci)} holds more than ${XLSX_MAX_CELL.toLocaleString()} characters, more than one Excel cell can store.`);
          const ref = `${colLetters(ci)}${ri + 1}`;
          const n = header ? null : asNumber(v);
          const style = header ? ' s="1"' : "";
          return n !== null ? `<c r="${ref}"${style}><v>${n}</v></c>` : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const freeze = s.header && s.rows.length > 1 ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const colsXml = cols ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${freeze}<sheetFormatPr defaultRowHeight="15"/>${colsXml}<sheetData>${rowsXml}</sheetData></worksheet>`;
}

export async function tablesToXlsx(sheets: SheetInput[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const taken = new Set<string>();
  const names = sheets.map((s) => sheetName(s.name, taken));
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
