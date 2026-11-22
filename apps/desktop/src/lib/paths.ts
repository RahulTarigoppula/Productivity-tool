/** Path helpers that work for Windows (\) and POSIX (/) paths, and for Android document
 *  addresses (content://…), which carry no usable file name or folder. */

const NAMES_KEY = "productivity.documentNames";
const names = new Map<string, string>();
try {
  const saved = JSON.parse(localStorage.getItem(NAMES_KEY) ?? "{}") as Record<string, string>;
  for (const [k, v] of Object.entries(saved)) if (typeof v === "string") names.set(k, v);
} catch {
  /* no storage: names are learned again when files are picked */
}

export function isContentUri(p: string): boolean {
  return /^content:\/\//i.test(p);
}

/** Remember the display name Android reported for a document address. */
export function rememberName(uri: string, name: string): void {
  if (!isContentUri(uri) || !name || names.get(uri) === name) return;
  names.set(uri, name.replace(/[\\/]/g, "_"));
  try {
    // Keep the most recent few hundred.
    const entries = [...names.entries()].slice(-300);
    localStorage.setItem(NAMES_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* ignore */
  }
}

function contentName(uri: string): string {
  const known = names.get(uri);
  if (known) return known;
  let last = uri.split("/").pop() ?? uri;
  try {
    last = decodeURIComponent(last);
  } catch {
    /* keep as is */
  }
  return last.split(/[/:]/).pop() || last;
}

export function basename(p: string): string {
  if (isContentUri(p)) return contentName(p);
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function dirname(p: string): string {
  if (isContentUri(p)) return "";
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i <= 0 ? (i === 0 ? p.slice(0, 1) : "") : p.slice(0, i);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.slice(i + 1).toLowerCase();
}

export function stem(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? b : b.slice(0, i);
}

export function sep(p: string): string {
  return p.includes("\\") && !p.includes("/") ? "\\" : "/";
}

export function join(dir: string, name: string): string {
  if (!dir) return name;
  const s = sep(dir);
  return dir.endsWith(s) ? dir + name : dir + s + name;
}

export function withExtension(p: string, ext: string): string {
  return join(dirname(p), `${stem(p)}.${ext}`);
}

/** Path of `target` relative to the folder `fromDir`, using forward slashes (for links). */
export function relative(fromDir: string, target: string): string {
  const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "");
  const a = norm(fromDir).split("/");
  const b = norm(target).split("/");
  const ci = /^[a-zA-Z]:$/.test(a[0] ?? "");
  const eq = (x: string, y: string) => (ci ? x.toLowerCase() === y.toLowerCase() : x === y);
  let i = 0;
  while (i < a.length && i < b.length && eq(a[i], b[i])) i++;
  if (i === 0) return target.replace(/\\/g, "/");
  return [...Array(a.length - i).fill(".."), ...b.slice(i)].join("/") || ".";
}

/** Resolve a relative link against a folder. */
export function resolve(fromDir: string, rel: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith("/") || rel.startsWith("\\\\")) return rel;
  const s = sep(fromDir);
  const parts = fromDir.replace(/[\\/]+$/, "").split(/[\\/]/);
  // ".." never climbs above the root: a drive (C:), a network share (\\server\share) or "/".
  const rootLen = /^[\\/]{2}/.test(fromDir) ? 4 : /^[a-zA-Z]:/.test(fromDir) || fromDir.startsWith("/") || fromDir.startsWith("\\") ? 1 : 0;
  for (const seg of rel.split(/[\\/]/)) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length > Math.max(rootLen, 1)) parts.pop();
    } else parts.push(seg);
  }
  return parts.join(s);
}

/** True for paths that would reach another machine (network shares, file: URLs, \\?\ forms).
 *  Documents must never make the app touch these on their own: on Windows that sends the
 *  user's credentials to the remote server. */
export function isRemoteOrDevicePath(p: string): boolean {
  const s = p.trim();
  return /^(\\\\|\/\/|\\\/|\/\\)/.test(s) || /^file:/i.test(s) || /^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^[a-zA-Z]:[\\/]/.test(s);
}

/** Resolve a link or image reference found inside a document. Only relative references
 *  are followed; absolute, network and URL-like references are refused (null). */
export function resolveDocumentRef(fromDir: string, ref: string): string | null {
  const r = ref.trim();
  // Documents opened through Android's picker have no folder to resolve against.
  if (!fromDir || isContentUri(fromDir)) return null;
  if (!r || isRemoteOrDevicePath(r) || /^[a-zA-Z]:/.test(r) || r.startsWith("/") || r.startsWith("\\") || /^[a-z][a-z0-9+.-]*:/i.test(r)) return null;
  const out = resolve(fromDir, r);
  // The result must stay on the same drive or share as the document (never another server).
  const server = (p: string) => (/^[\\/]{2}([^\\/]+)[\\/]([^\\/]+)/.exec(p)?.slice(1).join("/") ?? "").toLowerCase();
  if (server(out) !== server(fromDir)) return null;
  if (/^[a-zA-Z]:/.test(fromDir) && out.slice(0, 2).toLowerCase() !== fromDir.slice(0, 2).toLowerCase()) return null;
  return out;
}

export function samePath(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-zA-Z]:/.test(a) ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b);
}
