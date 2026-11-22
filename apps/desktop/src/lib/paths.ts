/** Path helpers that work for both Windows (\) and POSIX (/) paths. */

export function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function dirname(p: string): string {
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
  for (const seg of rel.split(/[\\/]/)) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
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
  if (!r || isRemoteOrDevicePath(r) || /^[a-zA-Z]:/.test(r) || r.startsWith("/") || r.startsWith("\\") || /^[a-z][a-z0-9+.-]*:/i.test(r)) return null;
  return resolve(fromDir, r);
}

export function samePath(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-zA-Z]:/.test(a) ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b);
}
