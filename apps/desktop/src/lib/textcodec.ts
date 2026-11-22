/** Decode bytes to text and encode it back, preserving the original encoding,
 *  byte-order mark and line endings, so that an unedited save is byte-identical. */

export type Encoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";
export type Eol = "\n" | "\r\n" | "\r";

export interface TextFormat {
  encoding: Encoding;
  bom: boolean;
  eol: Eol;
  /** True if the file mixed line-ending styles; saving normalises them to `eol`. */
  mixedEol: boolean;
}

export interface Decoded {
  /** Text with line endings normalised to \n (what the editor works with). */
  text: string;
  format: TextFormat;
  /** True if the decoded text can be re-encoded to exactly the original bytes. */
  lossless: boolean;
}

// windows-1252 bytes 0x80–0x9F map to these code points (undefined bytes map to themselves).
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
];

function decode1252(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    s += String.fromCharCode(b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : b);
  }
  return s;
}

function encode1252(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out[i] = c;
    else {
      const j = CP1252_HIGH.indexOf(c);
      out[i] = j >= 0 ? 0x80 + j : 0x3f; // "?" for characters the encoding cannot hold
    }
  }
  return out;
}

export function canEncode(text: string, encoding: Encoding): boolean {
  if (encoding !== "windows-1252") return true;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (!(c < 0x80 || (c >= 0xa0 && c <= 0xff) || CP1252_HIGH.includes(c))) return false;
  }
  return true;
}

function detectEol(text: string): { eol: Eol; mixed: boolean } {
  let crlf = 0, lf = 0, cr = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) {
        crlf++;
        i++;
      } else cr++;
    } else if (c === 10) lf++;
  }
  const kinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length;
  const eol: Eol = crlf >= lf && crlf >= cr && crlf > 0 ? "\r\n" : cr > lf ? "\r" : "\n";
  return { eol, mixed: kinds > 1 };
}

/** Decode without normalising line endings (for formats such as CSV that keep line breaks inside values). */
export function decodeTextRaw(bytes: Uint8Array): { raw: string; format: TextFormat } {
  const { raw, encoding, bom } = decodeBody(bytes);
  const { eol, mixed } = detectEol(raw);
  return { raw, format: { encoding, bom, eol, mixedEol: mixed } };
}

function decodeBody(bytes: Uint8Array): { raw: string; encoding: Encoding; bom: boolean } {
  let encoding: Encoding = "utf-8";
  let bom = false;
  let body = bytes;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bom = true;
    body = bytes.subarray(3);
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    bom = true;
    body = bytes.subarray(2);
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    bom = true;
    body = bytes.subarray(2);
  }
  let raw: string;
  if (encoding === "utf-8") {
    try {
      raw = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(body);
    } catch {
      encoding = "windows-1252";
      raw = decode1252(body);
    }
  } else {
    raw = new TextDecoder(encoding, { ignoreBOM: true }).decode(body);
  }
  return { raw, encoding, bom };
}

export function decodeText(bytes: Uint8Array): Decoded {
  const { raw, encoding, bom } = decodeBody(bytes);
  const { eol, mixed } = detectEol(raw);
  const text = raw.replace(/\r\n?/g, "\n");
  const format: TextFormat = { encoding, bom, eol, mixedEol: mixed };
  const lossless = !mixed && bytesEqual(encodeText(text, format), bytes);
  return { text, format, lossless };
}

export function encodeText(text: string, f: TextFormat): Uint8Array {
  const withEol = f.eol === "\n" ? text : text.replace(/\n/g, f.eol);
  let body: Uint8Array;
  if (f.encoding === "utf-8") body = new TextEncoder().encode(withEol);
  else if (f.encoding === "windows-1252") body = encode1252(withEol);
  else {
    body = new Uint8Array(withEol.length * 2);
    const le = f.encoding === "utf-16le";
    for (let i = 0; i < withEol.length; i++) {
      const c = withEol.charCodeAt(i);
      body[i * 2 + (le ? 0 : 1)] = c & 0xff;
      body[i * 2 + (le ? 1 : 0)] = c >> 8;
    }
  }
  if (!f.bom) return body;
  const bomBytes = f.encoding === "utf-8" ? [0xef, 0xbb, 0xbf] : f.encoding === "utf-16le" ? [0xff, 0xfe] : [0xfe, 0xff];
  const out = new Uint8Array(bomBytes.length + body.length);
  out.set(bomBytes, 0);
  out.set(body, bomBytes.length);
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function describeFormat(f: TextFormat): { encoding: string; eol: string } {
  const encoding = { "utf-8": "UTF-8", "utf-16le": "UTF-16 LE", "utf-16be": "UTF-16 BE", "windows-1252": "Windows 1252" }[f.encoding] + (f.bom && f.encoding === "utf-8" ? " with BOM" : "");
  const eol = f.eol === "\r\n" ? "CRLF" : f.eol === "\r" ? "CR" : "LF";
  return { encoding, eol: f.mixedEol ? `${eol} (was mixed)` : eol };
}
