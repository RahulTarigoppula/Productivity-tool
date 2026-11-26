import { describe, it, expect } from "vitest";
import { parseCsv, type CsvRow } from "./csv";

/** The earlier character-by-character parser, kept as the reference the faster one must match. */
function reference(text: string, delimiter: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [], quoted: boolean[] = [];
  let field = "", fieldQuoted = false, inQ = false, rowStart = 0, atFieldStart = true;
  const n = text.length;
  const endField = () => { cells.push(field); quoted.push(fieldQuoted); field = ""; fieldQuoted = false; atFieldStart = true; };
  const endRow = (end: number, term: string) => { endField(); rows.push({ cells, quoted, raw: text.slice(rowStart, end + term.length), term }); cells = []; quoted = []; rowStart = end + term.length; };
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c;
      continue;
    }
    if (c === '"' && atFieldStart) { inQ = true; fieldQuoted = true; atFieldStart = false; }
    else if (c === delimiter) endField();
    else if (c === "\r" || c === "\n") { const term = c === "\r" && text[i + 1] === "\n" ? "\r\n" : c; endRow(i, term); i += term.length - 1; }
    else { field += c; atFieldStart = false; }
  }
  if (rowStart < n || cells.length || field) endRow(n, "");
  return rows;
}

describe("CSV parsing", () => {
  it("matches the reference parser on tricky inputs", () => {
    const cases = ["", "a", "a,b", "a,b\n", "a,b\r\n1,2", "a,b,\n,\n", '"a,b",c\n"x""y",z', '"multi\nline",2\r\n3,4\r', '"open', 'ab"c,d', '"a"b,c', "\n\n", "\r", "a;b|c\td", '"",""\n', ',,,\r\n'];
    for (const t of cases) for (const d of [",", ";", "\t"]) expect(parseCsv(t, d), JSON.stringify(t)).toEqual(reference(t, d));
  });

  it("matches the reference parser on random text", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const alphabet = ['"', '"', ",", ";", "\n", "\r", "\r\n", "a", "b", " ", "é", "x"];
    for (let round = 0; round < 2000; round++) {
      let t = "";
      const len = Math.floor(rand() * 40);
      for (let k = 0; k < len; k++) t += alphabet[Math.floor(rand() * alphabet.length)];
      expect(parseCsv(t, ","), JSON.stringify(t)).toEqual(reference(t, ","));
    }
  });

  it("parses a large table quickly", () => {
    const line = 'id,"Name, with comma",12.5,2026-01-15,plain text here\n';
    const text = line.repeat(200_000);
    const t0 = performance.now();
    const rows = parseCsv(text, ",");
    const ms = performance.now() - t0;
    expect(rows.length).toBe(200_000);
    expect(rows[5].cells[1]).toBe("Name, with comma");
    // Generous bound for slow CI machines; the old parser took several times longer.
    expect(ms).toBeLessThan(3000);
  });
});
