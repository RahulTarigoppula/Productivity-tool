import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { Platform, FileMeta, DirEntry, SearchHit, SnapshotInfo, RecoveryInfo } from "./types";

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

export function createTauriPlatform(): Platform {
  const win = getCurrentWindow();
  return {
    kind: "tauri",
    async readFile(path) {
      return toBytes(await invoke("read_file", { path }));
    },
    writeFile(path, bytes, opts) {
      return invoke<FileMeta>("write_file", bytes, {
        headers: { "x-path": enc(path), "x-snapshot": opts?.snapshot ? "1" : "0" },
      });
    },
    stat: (path) => invoke<FileMeta>("file_meta", { path }),
    async pickOpen(opts) {
      const r = await openDialog({ multiple: opts.multiple ?? false, directory: opts.directory ?? false, filters: opts.filters });
      if (!r) return [];
      return Array.isArray(r) ? r : [r];
    },
    async pickSave(opts) {
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
    watch: (path) => invoke("watch_file", { path }),
    unwatch: (path) => invoke("unwatch_file", { path }),
    onFileChanged: (cb) => subscribe<string>("file-changed", cb),
    onOpenFiles: (cb) => subscribe<string[]>("open-files", cb),
    launchFiles: () => invoke<string[]>("launch_files"),
    stateGet: (name) => invoke<string | null>("state_get", { name }),
    stateSet: (name, value) => invoke("state_set", { name, value }),
    snapshotList: (path) => invoke<SnapshotInfo[]>("snapshot_list", { path }),
    async snapshotRead(path, id) {
      return toBytes(await invoke("snapshot_read", { path, id }));
    },
    snapshotWrite: (path, bytes, reason) =>
      invoke<SnapshotInfo>("snapshot_write", bytes, { headers: { "x-path": enc(path), "x-reason": enc(reason) } }),
    recoveryWrite: (id, meta, bytes) =>
      invoke("recovery_write", bytes, { headers: { "x-id": enc(id), "x-meta": enc(meta) } }),
    recoveryList: () => invoke<RecoveryInfo[]>("recovery_list"),
    async recoveryRead(id) {
      return toBytes(await invoke("recovery_read", { id }));
    },
    recoveryClear: (id) => invoke("recovery_clear", { id }),
    reveal: (path) => invoke("reveal_in_folder", { path }),
    openExternal: (target) => invoke("open_external", { target }),
    setTitle: (title) => win.setTitle(title),
    setFullscreen: (on) => win.setFullscreen(on),
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
}
