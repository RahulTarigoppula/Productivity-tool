import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { basename, extname, isContentUri, rememberName } from "../lib/paths";
import type { Platform, FileMeta, DirEntry, SearchHit, SnapshotInfo, RecoveryInfo, OfficePackInfo } from "./types";

const enc = (s: string) => encodeURIComponent(s);
const toBytes = (b: unknown) => new Uint8Array(b as ArrayBuffer);

function subscribe<T>(event: string, cb: (payload: T) => void): () => void {
  let un: (() => void) | null = null;
  let cancelled = false;
  listen<T>(event, (e) => cb(e.payload)).then((f) => {
    if (cancelled) f();
    else un = f;
  });
  return () => {
    cancelled = true;
    un?.();
  };
}

/** A document from Android's picker: its address plus what Android says about it. */
interface DocInfo {
  uri: string;
  name: string;
  size: number;
  modified: number;
  writable: boolean;
}

const MIME: Record<string, string> = {
  txt: "text/plain", md: "text/markdown", csv: "text/csv", tsv: "text/tab-separated-values", json: "application/json",
  html: "text/html", xml: "text/xml", pdf: "application/pdf", rtf: "application/rtf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};

/** Base64 helpers: Android's IPC carries binary data as JSON, where base64 is far lighter than a
 *  number array. */
function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const learn = (files: DocInfo[]) => files.map((f) => (rememberName(f.uri, f.name), f.uri));

export function createTauriPlatform(): Platform {
  const win = getCurrentWindow();
  const android = /Android/i.test(navigator.userAgent);
  // Android: one system picker at a time (a second would leave the first waiting forever).
  let picking = false;
  const onePicker = async <T,>(fallback: T, run: () => Promise<T>): Promise<T> => {
    if (picking) return fallback;
    picking = true;
    try {
      return await run();
    } finally {
      picking = false;
    }
  };
  // Android documents cannot be watched; open ones are re-checked whenever the app comes back
  // to the front, which is when another app could have changed them.
  const watchedDocs = new Set<string>();
  const whenFront = (cb: () => void) => {
    const run = () => document.visibilityState === "visible" && cb();
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  };
  // Binary request bodies: raw bytes on desktop, base64 JSON on Android.
  const bin = (bytes: Uint8Array) => (android ? { b64: toBase64(bytes) } : bytes);
  const self: Platform = {
    kind: "tauri",
    folders: !android,
    log: (level, message) => invoke("log_event", { level, message }),
    officePack: () => invoke<OfficePackInfo>("office_pack_info"),
    officeUrl: (path, session) => {
      // convertFileSrc encodes its whole argument, so keep the query string out of it.
      const q = path.indexOf("?");
      let url = q < 0 ? convertFileSrc(path, "office") : `${convertFileSrc(path.slice(0, q), "office")}${path.slice(q)}`;
      // office://localhost/… or http://office.localhost/… → a host of its own for this tab.
      if (session) url = url.replace(/^(office:\/\/|https?:\/\/office\.)localhost\//, `$1${session}.localhost/`);
      return url;
    },
    async readFile(path) {
      if (android) return fromBase64(await invoke<string>("read_file_b64", { path }));
      return toBytes(await invoke("read_file", { path }));
    },
    async writeFile(path, bytes, opts) {
      const meta = await invoke<FileMeta>("write_file", bin(bytes), {
        headers: { "x-path": enc(path), "x-snapshot": opts?.snapshot ? "1" : "0" },
      });
      // Android documents: report what the storage provider now says, so the next check for
      // outside changes compares like with like.
      if (android && isContentUri(path)) return self.stat(path).catch(() => meta);
      return meta;
    },
    async stat(path) {
      if (android && isContentUri(path)) {
        try {
          const i = await invoke<DocInfo>("android_info", { uri: path });
          rememberName(path, i.name);
          return { exists: true, size: Math.max(0, i.size), modified: i.modified, readonly: !i.writable };
        } catch {
          return invoke<FileMeta>("file_meta", { path });
        }
      }
      return invoke<FileMeta>("file_meta", { path });
    },
    async pickOpen(opts) {
      if (android) {
        // Android lists documents, not folders; types are not filtered because many storage
        // providers report text formats (Markdown, CSV) as generic files.
        if (opts.directory) return [];
        return onePicker([], async () => learn(await invoke<DocInfo[]>("android_pick", { multiple: opts.multiple ?? false, mimeTypes: [] })));
      }
      const r = await openDialog({ multiple: opts.multiple ?? false, directory: opts.directory ?? false, filters: opts.filters });
      if (!r) return [];
      return Array.isArray(r) ? r : [r];
    },
    async pickSave(opts) {
      if (android) {
        const name = basename(opts.defaultPath ?? "") || "Untitled.txt";
        return onePicker(null, async () => {
          const file = await invoke<DocInfo | null>("android_create", { fileName: name, mimeType: MIME[extname(name)] ?? "application/octet-stream" });
          return file ? learn([file])[0] : null;
        });
      }
      return (await saveDialog({ defaultPath: opts.defaultPath, filters: opts.filters })) ?? null;
    },
    listDir: (path) => invoke<DirEntry[]>("list_dir", { path }),
    findFiles: (root, max) => invoke<string[]>("find_files", { root, max }),
    searchFolder: (root, query, o) =>
      invoke<SearchHit[]>("search_folder", {
        root,
        query,
        caseSensitive: o.caseSensitive,
        regex: o.regex,
        wholeWord: o.wholeWord,
        maxHits: o.maxHits,
      }),
    async watch(path) {
      if (android && isContentUri(path)) watchedDocs.add(path);
      else await invoke("watch_file", { path });
    },
    async unwatch(path) {
      if (android && isContentUri(path)) watchedDocs.delete(path);
      else await invoke("unwatch_file", { path });
    },
    onFileChanged(cb) {
      const un = subscribe<string>("file-changed", cb);
      if (!android) return un;
      // The interface compares size and time itself and ignores files that did not change.
      const off = whenFront(() => watchedDocs.forEach((p) => cb(p)));
      return () => {
        un();
        off();
      };
    },
    onOpenFiles(cb) {
      if (!android) return subscribe<string[]>("open-files", cb);
      // Files shared from other apps ("Open with") arrive while the app is in the background,
      // or (split screen) while it stays visible but regains focus.
      return whenFront(() => void invoke<DocInfo[]>("android_take_opened").then((f) => f.length && cb(learn(f)), () => {}));
    },
    async launchFiles() {
      if (android) return learn(await invoke<DocInfo[]>("android_take_opened"));
      return invoke<string[]>("launch_files");
    },
    stateGet: (name) => invoke<string | null>("state_get", { name }),
    stateSet: (name, value) => invoke("state_set", { name, value }),
    snapshotList: (path) => invoke<SnapshotInfo[]>("snapshot_list", { path }),
    async snapshotRead(path, id) {
      return toBytes(await invoke("snapshot_read", { path, id }));
    },
    snapshotWrite: (path, bytes, reason) =>
      invoke<SnapshotInfo>("snapshot_write", bin(bytes), { headers: { "x-path": enc(path), "x-reason": enc(reason) } }),
    recoveryWrite: (id, meta, bytes) =>
      invoke("recovery_write", bin(bytes), { headers: { "x-id": enc(id), "x-meta": enc(meta) } }),
    recoveryList: () => invoke<RecoveryInfo[]>("recovery_list"),
    async recoveryRead(id) {
      return toBytes(await invoke("recovery_read", { id }));
    },
    recoveryClear: (id) => invoke("recovery_clear", { id }),
    reveal: (path) => invoke("reveal_in_folder", { path }),
    openExternal: (target) => invoke("open_external", { target }),
    setTitle: (title) => win.setTitle(title),
    setFullscreen: (on) => win.setFullscreen(on),
    setWindowTheme: (theme) => win.setTheme(theme).catch(() => {}),
    onCloseRequested(cb) {
      let un: (() => void) | null = null;
      win
        .onCloseRequested(async (e) => {
          e.preventDefault();
          try {
            await Promise.race([cb(), new Promise((r) => setTimeout(r, 3000))]);
          } finally {
            await win.destroy();
          }
        })
        .then((f) => (un = f));
      return () => un?.();
    },
  };
  return self;
}
