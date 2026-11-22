/** In-memory platform used when the interface runs in a normal browser:
 *  for development and for automated end-to-end tests. Exposed on window.__fs for tests. */
import type { Platform, FileMeta, DirEntry, SnapshotInfo, RecoveryInfo } from "./types";

/** In the browser build the Office pack is available only when a test serves it and sets this. */
const officeBase = () => (window as unknown as { __OFFICE_URL?: string }).__OFFICE_URL;

interface MemFile {
  bytes: Uint8Array;
  modified: number;
}

export function createBrowserPlatform(): Platform {
  const files = new Map<string, MemFile>();
  const state = new Map<string, string>();
  const snapshots = new Map<string, { info: SnapshotInfo; bytes: Uint8Array }[]>();
  const recovery = new Map<string, { info: RecoveryInfo; bytes: Uint8Array }>();
  const changeListeners = new Set<(p: string) => void>();
  const openListeners = new Set<(p: string[]) => void>();
  const pendingPicks: string[][] = [];
  const pendingSaves: (string | null)[] = [];
  let tick = 1;

  const meta = (p: string): FileMeta => {
    const f = files.get(p);
    return f ? { exists: true, size: f.bytes.length, modified: f.modified, readonly: false } : { exists: false, size: 0, modified: 0, readonly: false };
  };
  const put = (p: string, bytes: Uint8Array) => files.set(p, { bytes: new Uint8Array(bytes), modified: Date.now() + tick++ });

  const api = {
    files,
    write(path: string, content: string | Uint8Array) {
      put(path, typeof content === "string" ? new TextEncoder().encode(content) : content);
    },
    read(path: string) {
      return files.get(path)?.bytes ?? null;
    },
    readText(path: string) {
      const b = files.get(path)?.bytes;
      return b ? new TextDecoder().decode(b) : null;
    },
    externalChange(path: string, content: string | Uint8Array) {
      api.write(path, content);
      changeListeners.forEach((l) => l(path));
    },
    queuePick(paths: string[]) {
      pendingPicks.push(paths);
    },
    queueSave(path: string | null) {
      pendingSaves.push(path);
    },
    openFiles(paths: string[]) {
      openListeners.forEach((l) => l(paths));
    },
    state,
  };
  (window as unknown as { __fs: typeof api }).__fs = api;

  const platform: Platform = {
    kind: "browser",
    folders: true,
    log: async (level, message) => {
      (window as unknown as { __log?: string[] }).__log ??= [];
      (window as unknown as { __log: string[] }).__log.push(`${level} ${message}`);
    },
    async officePack() {
      return { available: !!officeBase() };
    },
    officeUrl: (path, session) => {
      // Tests serve the pack on http://localhost:PORT; each tab gets <session>.localhost.
      const base = session ? officeBase()!.replace("//localhost", `//${session}.localhost`) : officeBase();
      return `${base}/${path.replace(/^\//, "")}`;
    },
    async readFile(path) {
      const f = files.get(path);
      if (!f) throw new Error(`Could not open ${path}: not found`);
      return new Uint8Array(f.bytes);
    },
    async writeFile(path, bytes, opts) {
      if (opts?.snapshot && files.has(path)) {
        await platform.snapshotWrite(path, files.get(path)!.bytes, (snapshots.get(path)?.length ?? 0) ? "before save" : "original");
      }
      put(path, bytes);
      return meta(path);
    },
    async stat(path) {
      return meta(path);
    },
    async pickOpen() {
      return pendingPicks.shift() ?? [];
    },
    async pickSave(opts) {
      if (pendingSaves.length) return pendingSaves.shift() ?? null;
      return opts.defaultPath ?? null;
    },
    async listDir(path) {
      const prefix = path.endsWith("/") ? path : path + "/";
      const seen = new Map<string, DirEntry>();
      for (const [p, f] of files) {
        if (!p.startsWith(prefix)) continue;
        const rest = p.slice(prefix.length);
        const [head, ...tail] = rest.split("/");
        const full = prefix + head;
        if (!seen.has(full)) seen.set(full, { name: head, path: full, isDir: tail.length > 0, size: tail.length ? 0 : f.bytes.length });
      }
      return [...seen.values()].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    },
    async findFiles(root) {
      const prefix = root.endsWith("/") ? root : root + "/";
      return [...files.keys()].filter((p) => p.startsWith(prefix));
    },
    async searchFolder(root, query, o) {
      const prefix = root.endsWith("/") ? root : root + "/";
      const flags = o.caseSensitive ? "" : "i";
      let src = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (o.wholeWord) src = `\\b(?:${src})\\b`;
      const re = new RegExp(src, flags);
      const hits = [];
      for (const [p, f] of files) {
        if (!p.startsWith(prefix) || f.bytes.includes(0)) continue;
        const lines = new TextDecoder().decode(f.bytes).split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const m = re.exec(lines[i]);
          if (m) hits.push({ path: p, line: i + 1, col: m.index + 1, text: lines[i].slice(0, 240) });
        }
      }
      return hits;
    },
    async watch() {},
    async unwatch() {},
    onFileChanged(cb) {
      changeListeners.add(cb);
      return () => changeListeners.delete(cb);
    },
    onOpenFiles(cb) {
      openListeners.add(cb);
      return () => openListeners.delete(cb);
    },
    async launchFiles() {
      return [];
    },
    async stateGet(name) {
      return state.get(name) ?? null;
    },
    async stateSet(name, value) {
      state.set(name, value);
    },
    async snapshotList(path) {
      return (snapshots.get(path) ?? []).map((s) => s.info).sort((a, b) => b.created - a.created);
    },
    async snapshotRead(path, id) {
      const s = (snapshots.get(path) ?? []).find((x) => x.info.id === id);
      if (!s) throw new Error("Version not found");
      return s.bytes;
    },
    async snapshotWrite(path, bytes, reason) {
      const list = snapshots.get(path) ?? [];
      const info = { id: String(Date.now() + tick++), path, created: Date.now() + tick, size: bytes.length, reason };
      list.push({ info, bytes: new Uint8Array(bytes) });
      snapshots.set(path, list);
      return info;
    },
    async recoveryWrite(id, m, bytes) {
      recovery.set(id, { info: { id, meta: m, size: bytes.length, updated: Date.now() }, bytes: new Uint8Array(bytes) });
    },
    async recoveryList() {
      return [...recovery.values()].map((r) => r.info);
    },
    async recoveryRead(id) {
      const r = recovery.get(id);
      if (!r) throw new Error("Not found");
      return r.bytes;
    },
    async recoveryClear(id) {
      recovery.delete(id);
    },
    async reveal() {},
    async openExternal(target) {
      window.open(target, "_blank", "noopener");
    },
    async setTitle(title) {
      document.title = title;
    },
    async setFullscreen(on) {
      if (on) await document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    },
    onCloseRequested() {
      return () => {};
    },
  };
  return platform;
}
