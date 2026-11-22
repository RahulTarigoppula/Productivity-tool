/** Full Word, Excel and PowerPoint editing through the embedded Office editors
 *  (Euro-Office / ONLYOFFICE, running offline from the Office pack on its own origin).
 *  The editor never touches the disk: the app sends it bytes and asks for bytes back. */
import { useEffect, useRef, useState } from "react";
import type { EngineHost, Command } from "../../app/editor-api";
import { platform } from "../../platform";
import { useStore, getState } from "../../app/store";
import { handleShortcut } from "../../app/keys";

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const SAVE_EXT: Record<string, string> = { docx: "DOCX", xlsx: "XLSX", pptx: "PPTX" };

/** Formats the editor itself can export to, per document type. */
export const OFFICE_EXPORTS: Record<string, { ext: string; label: string }[]> = {
  docx: [{ ext: "pdf", label: "PDF" }, { ext: "odt", label: "OpenDocument text" }, { ext: "rtf", label: "Rich text" }, { ext: "txt", label: "Plain text" }],
  xlsx: [{ ext: "pdf", label: "PDF" }, { ext: "csv", label: "CSV (first sheet)" }, { ext: "ods", label: "OpenDocument spreadsheet" }],
  pptx: [{ ext: "pdf", label: "PDF" }, { ext: "odp", label: "OpenDocument presentation" }],
};

/** Origin of the Office pages. Built by hand: for custom schemes such as office://localhost the
 *  URL parser reports the origin as "null", but the browser still uses scheme://host. */
export function officeOriginOf(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

/** Largest file the app accepts back from an editor (a guard against a hostile document). */
export const MAX_OFFICE_BYTES = 512 * 1024 * 1024;

/** The shortcuts the editor bridge forwards (mirrors RESERVED in src-tauri/src/office.rs).
 *  Anything else arriving as office:key is ignored. */
export function isForwardedKey(e: { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; shiftKey?: unknown; altKey?: unknown }): boolean {
  if (typeof e.key !== "string") return false;
  const m = !!e.ctrlKey || !!e.metaKey;
  const k = e.key.toLowerCase();
  if (e.key === "F11") return true;
  if (!m) return false;
  if (["Tab", "PageUp", "PageDown", "\\", ","].includes(e.key)) return true;
  if (/^[1-9]$/.test(e.key) && !e.shiftKey && !e.altKey) return true;
  if (!e.shiftKey && !e.altKey && ["k", "w", "n", "o", "e"].includes(k)) return true;
  if (e.shiftKey && ["t", "p", "s"].includes(k)) return true;
  return false;
}

/** A random host name for one tab's editor, so each document's editor has an origin of its own. */
function newSession(): string {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return "t" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: number;
}

export function OfficeEditor({ host, onFailed }: { host: EngineHost; onFailed: (reason: string) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatusState] = useState<"loading" | "ready" | "error">("loading");
  // The message handler is set up once; it reads the current status through this ref.
  const statusRef = useRef<"loading" | "ready" | "error">("loading");
  const setStatus = (s: "loading" | "ready" | "error") => {
    statusRef.current = s;
    setStatusState(s);
  };
  const pending = useRef(new Map<string, Pending>());
  const seq = useRef(0);
  /** The file handed over by Ctrl+S inside the editor, used by the save that Ctrl+S starts. */
  const userSaved = useRef<{ bytes: Uint8Array; at: number } | null>(null);
  const lastSavedAt = useRef(0);
  const lastSavedSize = useRef(-1);
  const recoveryCache = useRef<{ at: number; bytes: Uint8Array } | null>(null);
  const theme = useStore((s) => s.settings.theme);
  // Resolves once the editor has finished loading the document; saves wait for it.
  const loadedRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!loadedRef.current) {
    let resolve = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    loadedRef.current = { promise, resolve };
  }
  const markLoaded = () => {
    loadedRef.current!.resolve();
    setStatus("ready");
  };
  const kind = host.kind as "docx" | "xlsx" | "pptx";
  const opened = useRef(false);
  const keyTimes = useRef<number[]>([]);

  // One origin per tab: editors of different documents cannot reach each other.
  const [session] = useState(newSession);
  const src = platform.officeUrl(`editor?embed=1&embedOrigin=${encodeURIComponent(window.location.origin)}`, session);
  const officeOrigin = officeOriginOf(src);

  const post = (type: string, payload: Record<string, unknown> = {}, timeoutMs = 120000, transfer: Transferable[] = []) =>
    new Promise<unknown>((resolve, reject) => {
      const win = frameRef.current?.contentWindow;
      if (!win) return reject(new Error("The editor is not loaded."));
      const id = `p${++seq.current}`;
      const timer = window.setTimeout(() => {
        pending.current.delete(id);
        reject(new Error("The Office editor did not respond in time."));
      }, timeoutMs);
      pending.current.set(id, { resolve, reject, timer });
      win.postMessage({ id, type, payload }, officeOrigin, transfer);
    });

  const saveAs = async (ext: string): Promise<Uint8Array> => {
    await loadedRef.current!.promise;
    const r = (await post("document:save", { targetExt: ext.toUpperCase() })) as { file?: unknown };
    if (!(r?.file instanceof Blob)) throw new Error("The editor returned no file.");
    if (r.file.size > MAX_OFFICE_BYTES) throw new Error("The editor returned a file that is too large.");
    return new Uint8Array(await r.file.arrayBuffer());
  };

  const applyTheme = () => {
    const t = getState().settings.theme;
    const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    frameRef.current?.contentWindow?.postMessage({ type: "office:theme", theme: dark ? "dark" : "light" }, officeOrigin);
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== officeOrigin) return;
      // Only messages from this tab's own editor frame (or its inner frames).
      const frameWin = frameRef.current?.contentWindow;
      if (!frameWin) return;
      let fromOurs = e.source === frameWin;
      if (!fromOurs) {
        try {
          for (let i = 0; i < frameWin.frames.length && !fromOurs; i++) fromOurs = e.source === frameWin.frames[i];
        } catch {
          /* cross-origin frame enumeration may throw */
        }
      }
      if (!fromOurs) return;
      const { id, type, payload } = (e.data ?? {}) as { id?: string; type?: string; payload?: Record<string, unknown> };
      if (!type) return;
      if (type === "office:key") {
        // Only the visible tab's editor may trigger app shortcuts, only the forwarded ones,
        // and not faster than a person types.
        if (getState().activeId !== host.tabId || !isForwardedKey(e.data)) return;
        const now = Date.now();
        keyTimes.current = keyTimes.current.filter((t) => now - t < 1000);
        if (keyTimes.current.length >= 8) return;
        keyTimes.current.push(now);
        const d = e.data as Record<string, unknown>;
        handleShortcut({ key: String(d.key), ctrlKey: !!d.ctrlKey, metaKey: !!d.metaKey, shiftKey: !!d.shiftKey, altKey: !!d.altKey });
        return;
      }
      if (type === "office:loaded") {
        markLoaded();
        return;
      }
      if (type === "office:modified" || type === "document:modified") {
        // Edited after a Ctrl+S inside the editor: that file is no longer the current content.
        userSaved.current = null;
        host.setDirty(true);
        host.changed();
        return;
      }
      if (type === "document:ready") {
        if (opened.current) return; // the document is sent once
        opened.current = true;
        applyTheme();
        const buffer = host.bytes.slice().buffer;
        void post("document:open-buffer", { fileName: host.name, buffer, mimeType: MIME[kind], readonly: false }, 120000, [buffer])
          // The bridge reports when loading completes; this is a fallback if it cannot.
          .then(() => window.setTimeout(markLoaded, 20000))
          .catch((err) => {
            setStatus("error");
            onFailed(err instanceof Error ? err.message : String(err));
          });
        return;
      }
      if (type === "document:saved" && payload?.file instanceof Blob && payload.userInitiated) {
        // Ctrl+S inside the editor: it hands over the file; save it through the normal pipeline.
        // Ignore only a true duplicate of the same save (same size, a moment apart).
        const size = (payload.file as Blob).size;
        if (size > MAX_OFFICE_BYTES) return;
        if (Date.now() - lastSavedAt.current < 400 && size === lastSavedSize.current) return;
        lastSavedAt.current = Date.now();
        lastSavedSize.current = size;
        void (payload.file as Blob).arrayBuffer().then((b) => {
          userSaved.current = { bytes: new Uint8Array(b), at: Date.now() };
          host.save();
        });
        return;
      }
      if (id && pending.current.has(id)) {
        const p = pending.current.get(id)!;
        pending.current.delete(id);
        clearTimeout(p.timer);
        if (type === "document:error") p.reject(new Error(String(payload?.message ?? "The editor reported an error.")));
        else p.resolve(payload);
      } else if (type === "document:error" && statusRef.current !== "ready") {
        setStatus("error");
        onFailed(String(payload?.message ?? "The editor could not open this file."));
      }
    };
    window.addEventListener("message", onMessage);
    const pendingMap = pending.current;
    return () => {
      window.removeEventListener("message", onMessage);
      pendingMap.forEach((p) => clearTimeout(p.timer));
      pendingMap.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useEffect(() => applyTheme(), [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const commands: Command[] = OFFICE_EXPORTS[kind].map((f) => ({
      id: `office.export.${f.ext}`,
      title: `Export as ${f.label}`,
      group: "File",
      run: () => void import("../../shell/Dialogs").then(() => import("../../app/store").then((s) => s.setState({ dialog: { kind: "export" } }))),
    }));
    host.register({
      async serialize(opts) {
        if (opts?.forSave) {
          // Use the editor's own Ctrl+S file only for the save it started, moments ago.
          const u = userSaved.current;
          userSaved.current = null;
          if (u && Date.now() - u.at < 5000) return u.bytes;
          return saveAs(SAVE_EXT[kind]);
        }
        // Recovery copies: converting the document has a cost, so reuse a recent copy
        // (except when quitting, which takes a fresh one).
        const c = recoveryCache.current;
        if (!opts?.fresh && c && Date.now() - c.at < 20000) return c.bytes;
        const bytes = await saveAs(SAVE_EXT[kind]);
        recoveryCache.current = { at: Date.now(), bytes };
        return bytes;
      },
      markSaved(info) {
        // Edited again while saving: the editor must keep reporting changes.
        if (info?.stillDirty) return;
        frameRef.current?.contentWindow?.postMessage({ type: "office:set-unchanged" }, officeOrigin);
      },
      cancelSave() {
        userSaved.current = null;
      },
      convert: (ext: string) => saveAs(ext),
      exportFormats: () => OFFICE_EXPORTS[kind],
      focus: () => frameRef.current?.focus(),
      commands: () => commands,
    });
    host.setStatus([{ id: "kind", text: { docx: "Word document", xlsx: "Excel workbook", pptx: "PowerPoint presentation" }[kind] }]);
    host.setToolbar([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  return (
    <div className="office-editor">
      {status === "loading" && (
        <div className="center-note office-loading">
          <div className="spinner" />
          <div>Opening {host.name}…</div>
        </div>
      )}
      <iframe
        ref={frameRef}
        src={src}
        title={`${host.name} editor`}
        className="office-frame"
        allow="clipboard-read; clipboard-write"
        /* No top-level navigation and no pop-ups from a document's editor. */
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        referrerPolicy="no-referrer"
        style={{ visibility: status === "ready" ? "visible" : "hidden" }}
      />
    </div>
  );
}
