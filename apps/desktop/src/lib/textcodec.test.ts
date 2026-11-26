import { describe, it, expect } from "vitest";
import { decodeText, encodeText, bytesEqual } from "./textcodec";

const roundTrip = (bytes: Uint8Array) => {
  const d = decodeText(bytes);
  return { d, out: encodeText(d.text, d.format) };
};
const u8 = (...n: number[]) => new Uint8Array(n);
const utf8 = (s: string) => new TextEncoder().encode(s);

describe("text codec round trips byte-for-byte", () => {
  const cases: [string, Uint8Array][] = [
    ["plain LF", utf8("a\nb\n")],
    ["CRLF", utf8("line one\r\nline two\r\n")],
    ["no final newline", utf8("no newline at end")],
    ["empty", new Uint8Array()],
    ["UTF-8 BOM", u8(0xef, 0xbb, 0xbf, ...utf8("héllo\r\n"))],
    ["unicode", utf8("日本語 — emoji 🎉\n")],
    ["CR only", utf8("a\rb\r")],
    ["UTF-16 LE", u8(0xff, 0xfe, 0x68, 0, 0x69, 0, 0x0d, 0, 0x0a, 0)],
    ["UTF-16 BE", u8(0xfe, 0xff, 0, 0x68, 0, 0x69, 0, 0x0a)],
    ["Windows 1252", u8(0x63, 0x61, 0x66, 0xe9, 0x20, 0x93, 0x71, 0x94, 0x0d, 0x0a)],
    ["trailing spaces and tabs", utf8("  a  \t\n\tb\t\n")],
  ];
  for (const [name, bytes] of cases) {
    it(name, () => {
      const { d, out } = roundTrip(bytes);
      expect(d.lossless).toBe(true);
      expect(bytesEqual(out, bytes)).toBe(true);
    });
  }

  it("detects encodings and line endings", () => {
    expect(decodeText(utf8("a\r\nb")).format.eol).toBe("\r\n");
    expect(decodeText(u8(0xe9)).format.encoding).toBe("windows-1252");
    expect(decodeText(u8(0xff, 0xfe, 0x41, 0)).format.encoding).toBe("utf-16le");
  });

  it("flags mixed line endings as not lossless", () => {
    const d = decodeText(utf8("a\r\nb\nc\r\n"));
    expect(d.format.mixedEol).toBe(true);
    expect(d.lossless).toBe(false);
    expect(d.text).toBe("a\nb\nc\n");
  });

  it("re-encodes edits in the original format", () => {
    const d = decodeText(u8(0xef, 0xbb, 0xbf, ...utf8("x\r\n")));
    const out = encodeText(d.text + "y\n", d.format);
    expect(bytesEqual(out, u8(0xef, 0xbb, 0xbf, ...utf8("x\r\ny\r\n")))).toBe(true);
  });

  it("keeps a UTF-8 mark on a file read as Windows-1252, byte for byte", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x63, 0x61, 0x66, 0xe9, 0x0a]);
    const d = decodeText(bytes);
    expect(d.format.encoding).toBe("windows-1252");
    expect(d.text).toBe("café\n");
    expect(Array.from(encodeText(d.text, d.format))).toEqual(Array.from(bytes));
    expect(Array.from(encodeText(d.text + "!", d.format).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });
});
