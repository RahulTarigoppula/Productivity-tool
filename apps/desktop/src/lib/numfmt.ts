/** Spreadsheet number formats: showing a stored number the way Excel shows it, and recognising
 *  typed values (prices, percentages, dates) that can be stored as numbers without changing what
 *  the reader sees. Covers the formats everyday files use; anything unusual falls back to the
 *  plain number. Dates and times are written in ISO form (2026-01-15 14:30), which every program
 *  reads the same way whatever its language. */

/** Excel's built-in format codes by id. */
export const BUILTIN_FORMATS: Record<number, string> = {
  0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00",
  12: "# ?/?", 13: "# ??/??", 14: "yyyy-mm-dd", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "yyyy-mm-dd h:mm", 37: "#,##0 ;(#,##0)", 38: "#,##0 ;(#,##0)",
  39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;(#,##0.00)", 45: "mm:ss", 46: "[h]:mm:ss", 47: "mm:ss.0", 48: "##0.0E+0", 49: "@",
};

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);

/** Excel day number → date (Excel counts a 29 February 1900 that never was). */
function serialDate(serial: number): Date {
  const days = serial < 60 ? serial + 1 : serial;
  return new Date(EPOCH + Math.round(days * DAY_MS));
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Removes quoted text, escapes, colours, conditions and fill or padding marks from a format section. */
function bare(section: string): string {
  return section.replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "").replace(/[_*]./g, "");
}

/** Literal text a format puts before or after the number: currency symbols, units, quoted words. */
function literals(section: string): { prefix: string; suffix: string } {
  const lit = (s: string) =>
    s
      .replace(/\[\$([^\]-]*)(-[^\]]*)?\]/g, "$1")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/_./g, "")
      .replace(/\*./g, "")
      .replace(/"([^"]*)"/g, "$1")
      .replace(/\\(.)/g, "$1");
  // Placeholders are found outside brackets, quotes and escapes (a locale tag such as [$€-407] has digits).
  const masked = section.replace(/\[[^\]]*\]|"[^"]*"|\\.|[_*]./g, (m) => " ".repeat(m.length));
  const first = masked.search(/[0#?]/);
  if (first < 0) return { prefix: "", suffix: "" };
  let last = first;
  for (let i = first; i < masked.length; i++) if (/[0#?.,%]/.test(masked[i])) last = i;
  return { prefix: lit(section.slice(0, first)).replace(/[.,]$/, ""), suffix: lit(section.slice(last + 1)) };
}

function isDateFormat(code: string): boolean {
  const b = bare(code);
  return /[dyhs]/i.test(b) || /m/i.test(b.replace(/AM\/PM|A\/P/gi, ""));
}

function formatDate(value: number, code: string): string {
  const b = bare(code).toLowerCase();
  const d = serialDate(value);
  const hasDate = /[dy]/.test(b) || (/m/.test(b) && !/[hs]/.test(b));
  const hasTime = /[hs]/.test(b);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const secs = /s/.test(b);
  if (/\[h\]/i.test(code)) {
    const total = Math.round(value * 86400);
    return `${Math.floor(total / 3600)}:${pad(Math.floor(total / 60) % 60)}${secs ? `:${pad(total % 60)}` : ""}`;
  }
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${secs ? `:${pad(d.getUTCSeconds())}` : ""}`;
  if (hasDate && hasTime) return `${date} ${time}`;
  return hasTime ? time : date;
}

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** A number shown with an Excel format code. */
export function formatNumber(value: number, code: string | undefined): string {
  if (!Number.isFinite(value)) return String(value);
  // Excel's codes are at most 255 characters; anything longer is not a real format.
  if (!code || code.length > 255 || /^general$/i.test(code.trim())) return general(value);
  const sections = code.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  let section = sections[0];
  let negative = value < 0;
  if (negative && sections[1] !== undefined && sections[1] !== "") {
    section = sections[1];
    negative = false;
    value = -value;
  } else if (value === 0 && sections[2] !== undefined && sections[2] !== "") section = sections[2];
  if (section.trim() === "@") return general(value);
  // Day numbers outside years 1900-9999 are not dates Excel can show.
  if (isDateFormat(section)) return value >= 0 && value < 2958466 ? formatDate(value, section) : general(value);
  const b = bare(section);
  if (!/[0#?]/.test(b)) return general(value);
  // Fractions ("# ?/?") and scaling by thousands ("0.0," or "#,##0,,") are not drawn here: the
  // plain number is shown rather than a wrong one.
  if (/\?\/|\/\s*[0-9?#]/.test(b) || /[0#?.],+(?![0#?])/.test(b.replace(/[%E+-]/gi, ""))) return general(value);
  const { prefix, suffix } = literals(section);
  let v = Math.abs(value);
  if (b.includes("%")) v *= 100;
  const numPart = b.replace(/[^0#?.,E+-]/gi, "");
  const sci = /E[+-]/i.exec(numPart);
  const decimals = (/\.([0#?]+)/.exec(numPart)?.[1] ?? "").length;
  let body: string;
  if (sci) {
    const [m, e] = v.toExponential(Math.min(decimals, 20)).split("e");
    body = `${m}E${Number(e) < 0 ? "-" : "+"}${pad(Math.abs(Number(e)))}`;
  } else {
    body = v.toFixed(Math.min(decimals, 20));
    const [int, frac] = body.split(".");
    // Optional decimal places (#) drop trailing zeros; required ones (0) keep them.
    const required = (/\.(0*)/.exec(numPart)?.[1] ?? "").length;
    const fracShown = frac ? frac.replace(new RegExp(`0{0,${Math.max(0, decimals - required)}}$`), "") : "";
    body = (/,(?=[0#?])/.test(numPart) ? group(int) : int) + (fracShown ? `.${fracShown}` : "");
  }
  const sign = negative && Number(body.replace(/[^0-9.]/g, "")) !== 0 ? "-" : "";
  return `${sign}${prefix}${body}${b.includes("%") ? "%" : ""}${suffix}`;
}

/** Excel's General format: up to about 11 significant digits, without floating-point noise. */
export function general(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e11) return String(value);
  const clean = Number(value.toPrecision(15));
  if (Math.abs(clean) >= 1e11 || (clean !== 0 && Math.abs(clean) < 1e-9)) return clean.toExponential(5).replace(/\.?0+e/, "E").replace(/E([+-])(\d)$/, "E$10$2").toUpperCase();
  return String(Number(clean.toPrecision(11)));
}

export interface NumberCell {
  value: number;
  /** Format code that shows the value exactly as it was typed; null for plain numbers. */
  format: string | null;
}

/** A typed value that can be stored as a number while still showing exactly as typed: plain
 *  numbers, decimals with trailing zeros ("1.10" shown with two places), percentages ("12.5%") and
 *  ISO dates ("2026-01-15"). Leading zeros (IDs, ZIP codes), "-0", 12+ digit numbers (barcodes,
 *  which Excel would show as 4.00638E+12) and over-precise decimals stay text. */
export function asNumberCell(v: string): NumberCell | null {
  let m = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(v);
  if (m) {
    const [, sign, int, frac = ""] = m;
    if (int.length > 11) return null;
    if ((int === "0" ? frac.replace(/^0+/, "") : int + frac).length > 15) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || (sign && n === 0)) return null;
    if (String(n) === v) return { value: n, format: null };
    if (frac && frac.length <= 10 && general(n) !== v && formatNumber(n, `0.${"0".repeat(frac.length)}`) === v) return { value: n, format: `0.${"0".repeat(frac.length)}` };
    return null;
  }
  m = /^(-?(?:0|[1-9]\d{0,8})(?:\.(\d{1,6}))?)%$/.exec(v);
  if (m) {
    const format = m[2] ? `0.${"0".repeat(m[2].length)}%` : "0%";
    const value = Number((Number(m[1]) / 100).toPrecision(15));
    return formatNumber(value, format) === v ? { value, format } : null;
  }
  // Amounts with a currency sign or thousands separators ($1,200.50, €300, 12,000): stored as
  // numbers so sums work in Excel, with a format that shows them exactly as typed.
  m = /^(-?)([$€£¥₹])?((?:[1-9]\d{0,2})(?:,\d{3})+|0|[1-9]\d*)(?:\.(\d{1,10}))?$/.exec(v);
  if (m && (m[2] || m[3].includes(","))) {
    const [, sign, cur = "", int, frac = ""] = m;
    const digits = int.replace(/,/g, "");
    if (digits.length > 11) return null;
    const value = Number(`${sign}${digits}${frac ? "." + frac : ""}`);
    const grouping = int.includes(",") || (cur !== "" && digits.length > 3) ? "#,##0" : "0";
    const format = `${cur ? `"${cur}"` : ""}${grouping}${frac ? "." + "0".repeat(frac.length) : ""}`;
    if (Number.isFinite(value) && !(sign && value === 0) && formatNumber(value, format) === v) return { value, format };
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    // From 1 March 1900 on, Excel's day numbers are plain day counts.
    if (y <= 9999 && t >= Date.UTC(1900, 2, 1) && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d) return { value: (t - EPOCH) / DAY_MS, format: "yyyy-mm-dd" };
  }
  return null;
}

/** A cell read as an amount, for sorting and sums: currency signs, thousands separators, spaces,
 *  a trailing % and accounting-style (500) negatives are allowed. With decimalComma (files that
 *  separate values with ";", as in much of Europe) "1.234,50" is 1234.5. Null when it is not a
 *  number. */
export function parseAmount(v: string, decimalComma = false): number | null {
  let t = v.trim();
  if (!t || t.length > 40) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/[$€£¥₹₩₽¢\s\u00a0\u202f]/g, "").replace(/%$/, "");
  if (t.startsWith("-")) {
    neg = !neg;
    t = t.slice(1);
  } else if (t.startsWith("+")) t = t.slice(1);
  t = decimalComma ? t.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".") : t.replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
