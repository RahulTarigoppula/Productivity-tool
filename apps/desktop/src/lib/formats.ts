/** Which engine handles a file, decided by extension and confirmed by sniffing the first bytes. */
import { extname } from "./paths";

export type Kind = "text" | "markdown" | "csv" | "pdf" | "docx" | "xlsx" | "pptx" | "image" | "media" | "archive" | "binary";

const MARKDOWN = new Set(["md", "markdown", "mdown", "mkd", "mdx"]);
const CSV = new Set(["csv", "tsv", "tab"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif", "svg"]);
/** Audio and video the built-in player can play. */
export const AUDIO = new Set(["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac"]);
export const VIDEO = new Set(["mp4", "m4v", "webm", "ogv", "mov"]);
const BINARY = new Set([
  "exe", "dll", "so", "dylib", "bin", "o", "obj", "class", "jar", "7z", "rar", "gz", "tgz", "bz2", "xz",
  "avi", "mkv", "wmv", "woff", "woff2", "ttf", "otf", "eot", "sqlite", "db",
  "psd", "iso", "msi", "pdb", "wasm",
]);

/** Older and OpenDocument formats the Office editors open (converting as they load). */
export const OTHER_OFFICE: Record<string, "docx" | "xlsx" | "pptx"> = {
  doc: "docx", dot: "docx", rtf: "docx", odt: "docx", ott: "docx",
  xls: "xlsx", xlt: "xlsx", ods: "xlsx", ots: "xlsx",
  ppt: "pptx", pot: "pptx", pps: "pptx", odp: "pptx", otp: "pptx",
};
/** Of those, the formats the editors can also write, so saving keeps the file as it is. */
const WRITES_BACK = new Set(["odt", "ods", "odp", "rtf"]);
/** Formats from before 2007 that are a "compound file" container rather than a ZIP. */
const OLE = new Set(["doc", "dot", "xls", "xlt", "ppt", "pot", "pps"]);

/** For a file the editors can read but not write back (an older .doc, .xls or .ppt, or a template),
 *  the modern format its changes are saved in; null when the file can be saved as it is. */
export function modernSaveFormat(path: string): "docx" | "xlsx" | "pptx" | null {
  const e = extname(path);
  return OTHER_OFFICE[e] && !WRITES_BACK.has(e) ? OTHER_OFFICE[e] : null;
}

/** Whether a file is one of the older or OpenDocument formats (only the full Office editor opens them). */
export function isOtherOffice(path: string): boolean {
  return extname(path) in OTHER_OFFICE;
}

export function kindFromName(path: string): Kind {
  const e = extname(path);
  if (MARKDOWN.has(e)) return "markdown";
  if (CSV.has(e)) return "csv";
  if (e === "pdf") return "pdf";
  if (e === "docx" || e === "docm" || e === "dotx") return "docx";
  if (e === "xlsx" || e === "xlsm" || e === "xltx") return "xlsx";
  if (e === "pptx" || e === "pptm" || e === "potx") return "pptx";
  if (OTHER_OFFICE[e]) return OTHER_OFFICE[e];
  if (IMAGE.has(e)) return "image";
  if (AUDIO.has(e) || VIDEO.has(e)) return "media";
  if (e === "zip") return "archive";
  if (BINARY.has(e)) return "binary";
  return "text";
}

export function looksBinary(bytes: Uint8Array): boolean {
  // UTF-16 text has many NULs but starts with a BOM.
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return false;
  const n = Math.min(bytes.length, 8000);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
  return false;
}

/** Refine the name-based kind using the actual content. */
export function detectKind(path: string, bytes: Uint8Array): Kind {
  const k = kindFromName(path);
  const head = String.fromCharCode(...bytes.slice(0, 5));
  // A real PDF has binary content; a note or text file that merely starts with "%PDF" stays text.
  if (head.startsWith("%PDF") && (k === "pdf" || k === "binary" || looksBinary(bytes))) return "pdf";
  if (k === "docx" || k === "xlsx" || k === "pptx") {
    const e = extname(path);
    const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    const ok = head.startsWith("PK") || (OLE.has(e) && ole) || (e === "rtf" && head.startsWith("{\\rt"));
    return ok ? k : looksBinary(bytes) ? "binary" : "text";
  }
  if (k === "pdf") return looksBinary(bytes) ? "binary" : "text";
  if (k === "archive") return head.startsWith("PK") ? k : "binary";
  if (k === "image") return extname(path) === "svg" ? "image" : k;
  if (k === "text" || k === "markdown" || k === "csv") return looksBinary(bytes) ? "binary" : k;
  return k;
}

export const KIND_LABEL: Record<Kind, string> = {
  text: "Text",
  markdown: "Markdown",
  csv: "CSV",
  pdf: "PDF",
  docx: "Word document",
  xlsx: "Spreadsheet",
  pptx: "Presentation",
  image: "Image",
  media: "Audio or video",
  archive: "ZIP archive",
  binary: "Binary",
};

export const OPEN_FILTERS = [
  { name: "All supported", extensions: ["*"] },
  { name: "Documents", extensions: ["md", "txt", "docx", "doc", "odt", "rtf", "pdf"] },
  { name: "Spreadsheets", extensions: ["csv", "tsv", "xlsx", "xls", "ods"] },
  { name: "Presentations", extensions: ["pptx", "ppt", "odp"] },
];
