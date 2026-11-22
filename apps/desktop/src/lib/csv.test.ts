import { describe, it, expect } from "vitest";
import { loadCsv, saveCsv, setCell, emptyRow, insertColumn, deleteColumn, detectDelimiter, compareCells } from "./csv";
import { bytesEqual } from "./textcodec";

const utf8 = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("CSV round trips exactly", () => {
  const cases: [string, string | Uint8Array, string?][] = [
    ["simple", "a,b,c\n1,2,3\n"],
    ["CRLF", "a,b\r\n1,2\r\n"],
    ["no final newline", "a,b\n1,2"],
    ["quoted with newline inside", 'name,note\n"Smith, J","line1\r\nline2"\n'],
    ["escaped quotes", 'a\n"he said ""hi"""\n'],
    ["unnecessary quotes kept", '"a","b"\n"1","2"\n'],
    ["leading zeros and long ids", "id,zip\n00012,01234\n12345678901234567890,0\n"],
    ["semicolon", "a;b;c\n1,5;2;3\n"],
    ["tab", "a\tb\n1\t2\n", "tsv"],
    ["ragged rows", "a,b,c\n1\n1,2,3,4\n"],
    ["empty lines", "a,b\n\n1,2\n\n"],
    ["BOM", new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("a,b\r\n1,2\r\n")])],
    ["windows-1252", new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x2c, 0x31, 0x0d, 0x0a])],
  ];
  for (const [name, content, ext] of cases) {
    it(name, () => {
      const bytes = typeof content === "string" ? utf8(content) : content;
      const doc = loadCsv(bytes, ext);
      expect(bytesEqual(saveCsv(doc), bytes)).toBe(true);
    });
  }
});

describe("CSV parsing", () => {
  it("parses quoted fields and values", () => {
    const doc = loadCsv(utf8('name,note\n"Smith, J","a ""b"""\n'));
    expect(doc.rows[1].cells).toEqual(["Smith, J", 'a "b"']);
    expect(doc.rows[1].quoted).toEqual([true, true]);
  });
  it("detects delimiters", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter("a,b\n1,2")).toBe(",");
    expect(detectDelimiter('"x;y",b\n"1;2",3')).toBe(",");
  });
});

describe("CSV editing keeps untouched rows identical", () => {
  it("edits one cell and leaves others byte-identical", () => {
    const src = 'a,b\n"1","x"\r\n3,4\n';
    const doc = loadCsv(utf8(src));
    doc.rows[2] = setCell(doc.rows[2], 1, "four, with comma");
    expect(dec(saveCsv(doc))).toBe('a,b\n"1","x"\r\n3,"four, with comma"\n');
  });
  it("adds a row after a file without a final newline", () => {
    const doc = loadCsv(utf8("a,b\n1,2"));
    doc.rows.push(emptyRow(2, ""));
    doc.rows[2] = setCell(doc.rows[2], 0, "3");
    expect(dec(saveCsv(doc))).toBe("a,b\n1,2\n3,");
  });
  it("keeps a final newline when rows are added", () => {
    const doc = loadCsv(utf8("a,b\r\n1,2\r\n"));
    doc.rows.push(setCell(emptyRow(2, "\r\n"), 0, "3"));
    expect(dec(saveCsv(doc))).toBe("a,b\r\n1,2\r\n3,\r\n");
  });
  it("reorders rows without changing their text", () => {
    const doc = loadCsv(utf8("h\nb\na"));
    doc.rows = [doc.rows[0], doc.rows[2], doc.rows[1]];
    expect(dec(saveCsv(doc))).toBe("h\na\nb");
  });
  it("inserts and deletes columns", () => {
    const doc = loadCsv(utf8("a,b\n1,2\n"));
    doc.rows = insertColumn(doc.rows, 1);
    expect(dec(saveCsv(doc))).toBe("a,,b\n1,,2\n");
    doc.rows = deleteColumn(doc.rows, 1);
    expect(dec(saveCsv(doc))).toBe("a,b\n1,2\n");
  });
  it("compares numbers numerically", () => {
    expect(["10", "9", "b", "a"].sort(compareCells)).toEqual(["9", "10", "a", "b"]);
  });
});
