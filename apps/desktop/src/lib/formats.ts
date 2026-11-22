/** Which engine handles a file, decided by extension and confirmed by sniffing the first bytes. */
import { extname } from "./paths";

export type Kind = "text" | "markdown" | "csv" | "pdf" | "docx" | "xlsx" | "pptx" | "image" | "binary";

const MARKDOWN = new Set(["md", "markdown", "mdown", "mkd", "mdx"]);
const CSV = new Set(["csv", "tsv", "tab"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif", "svg"]);
const BINARY = new Set([
  "exe", "dll", "so", "dylib", "bin", "o", "obj", "class", "jar", "zip", "7z", "rar", "gz", "tgz", "bz2", "xz",
  "mp3", "mp4", "mov", "avi", "mkv", "wav", "flac", "ogg", "woff", "woff2", "ttf", "otf", "eot", "sqlite", "db",
  "doc", "xls", "ppt", "odt", "ods", "odp", "psd", "iso", "msi", "pdb", "wasm",
]);

export function kindFromName(path: string): Kind {
  const e = extname(path);
  if (MARKDOWN.has(e)) return "markdown";
  if (CSV.has(e)) return "csv";
  if (e === "pdf") return "pdf";
  if (e === "docx" || e === "docm" || e === "dotx") return "docx";
  if (e === "xlsx" || e === "xlsm" || e === "xltx") return "xlsx";
  if (e === "pptx" || e === "pptm" || e === "potx") return "pptx";
  if (IMAGE.has(e)) return "image";
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
  if (head.startsWith("%PDF")) return "pdf";
  if (k === "docx" || k === "xlsx" || k === "pptx") return head.startsWith("PK") ? k : looksBinary(bytes) ? "binary" : "text";
  if (k === "pdf") return looksBinary(bytes) ? "binary" : "text";
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
  binary: "Binary",
};

export const OPEN_FILTERS = [
  { name: "All supported", extensions: ["*"] },
  { name: "Documents", extensions: ["md", "txt", "docx", "pdf"] },
  { name: "Spreadsheets", extensions: ["csv", "tsv", "xlsx"] },
  { name: "Presentations", extensions: ["pptx"] },
];
