/** File actions: open, create, save, close, auto-save, recovery, session restore and external changes. */
import { platform } from "../platform";
import { basename, dirname, extname, join, samePath, withExtension, resolveDocumentRef } from "../lib/paths";
import { detectKind, kindFromName, KIND_LABEL, modernSaveFormat, type Kind } from "../lib/formats";
import {
  getState, setState, updateTab, handles, tabBytes, knownMeta, toast, newId,
  DEFAULT_SETTINGS, type Tab, type Settings, type RecentItem,
} from "./store";
import { ask } from "./dialogs";

const MAX_OPEN_BYTES = 300 * 1024 * 1024;
const TEXT_KINDS: Kind[] = ["text", "markdown", "csv"];
export const isTextual = (k: Kind) => TEXT_KINDS.includes(k);
export const isEditable = (k: Kind) => isTextual(k) || k === "pdf";

// ---------- helpers ----------

const pendingGoTo = new Map<string, string>();
const lastSnapshotAt = new Map<string, number>();
const autoSaveTimers = new Map<string, number>();
const recoveryTimers = new Map<string, number>();
let mru: string[] = [];

export function takePendingGoTo(tabId: string): string | undefined {
  const loc = pendingGoTo.get(tabId);
  pendingGoTo.delete(tabId);
  return loc;
}

const isTsv = (p: string) => /\.(tsv|tab)$/i.test(p);

/** Recovery writes and clears for one tab run in order (a late write must never follow a clear). */
const recoveryChains = new Map<string, Promise<unknown>>();
function recoveryOp(id: string, op: () => Promise<unknown>): Promise<unknown> {
  const next = (recoveryChains.get(id) ?? Promise.resolve()).then(op, op).catch(() => {});
  recoveryChains.set(id, next);
  return next;
}
const clearRecovery = (id: string) => recoveryOp(id, () => platform.recoveryClear(id));

/** Counts edits per tab; a save knows it is complete only if no edit came in after it serialized. */
const editGen = new Map<string, number>();
const bumpEdit = (id: string) => editGen.set(id, (editGen.get(id) ?? 0) + 1);

/** Saves of one tab run one after another (an autosave and Ctrl+S never overlap). */
const saveChains = new Map<string, Promise<boolean>>();

/** Keys for remembered file info: the same file written two ways (slashes, letter case on
 *  Windows drives) is one entry. */
export function metaKey(p: string): string {
  const s = p.replace(/\\/g, "/");
  return /^[a-zA-Z]:\//.test(s) || s.startsWith("//") ? s.toLowerCase() : s;
}

/** Engines report clean/dirty; a tab whose starting content is not on disk stays dirty. */
export function engineSetDirty(id: string, dirty: boolean) {
  const t = getState().tabs.find((x) => x.id === id);
  if (!t) return;
  if (dirty) bumpEdit(id);
  if (!dirty && t.baselineUnsaved) return;
  if (t.dirty === dirty) return;
  updateTab(id, { dirty, saveState: dirty ? "edited" : t.path ? (t.readonly ? "readonly" : "saved") : "new" });
  if (!dirty) {
    clearTimeout(autoSaveTimers.get(id));
    clearTimeout(recoveryTimers.get(id));
    void clearRecovery(id);
  }
  updateTitle();
}

function findTabByPath(path: string, kind?: Kind): Tab | undefined {
  return getState().tabs.find((t) => t.path && samePath(t.path, path) && (!kind || t.kind === kind));
}

export function activate(id: string | null) {
  if (id) mru = [id, ...mru.filter((x) => x !== id)];
  setState({ activeId: id });
  updateTitle();
  if (id) setTimeout(() => handles.get(id)?.focus(), 0);
  // Keys must never keep going to a document that is no longer shown (an Office editor frame
  // keeps focus when its tab is hidden): move focus out at once; the new document takes it as
  // soon as it is ready (see focusIfStranded).
  setTimeout(() => {
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body && a.closest("section.doc-pane[hidden]")) a.blur();
  }, 0);
}

/** Called when a document's editor becomes ready: if it is the visible tab and the keyboard is
 *  nowhere useful (or still in a hidden document), the new document gets it. */
export function focusIfStranded(id: string) {
  if (getState().activeId !== id) return;
  const a = document.activeElement as HTMLElement | null;
  const stranded = !a || a === document.body || !!a.closest("section.doc-pane[hidden]");
  if (stranded) handles.get(id)?.focus();
}

export function updateTitle() {
  const s = getState();
  const t = s.tabs.find((x) => x.id === s.activeId);
  void platform.setTitle(t ? `${t.dirty ? "● " : ""}${t.name} — Productivity` : "Productivity");
}

const VIEW_ONLY = new Set<Kind>(["binary", "image", "media", "archive"]);

const MODERN_LABEL = { docx: "Word document", xlsx: "Excel workbook", pptx: "PowerPoint presentation" } as const;

/** A new note's first save is named after its first heading or line ("Biology – Cell structure.md")
 *  rather than "Untitled-1.md". Tables and other files keep their name. */
function firstSaveName(tab: Tab, handle: { getText?(): string }): string {
  if (tab.path || !/^Untitled-\d+\./.test(tab.name) || (tab.kind !== "markdown" && tab.kind !== "text")) return tab.name;
  const text = (handle.getText?.() ?? "").slice(0, 4000);
  const line = /^#{1,6}[ \t]+(.+)$/m.exec(text)?.[1] ?? text.split("\n").find((l) => l.trim()) ?? "";
  const name = line
    .replace(/[*_`~[\]()#>|]/g, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .replace(/[. ]+$/, "");
  // Names Windows reserves for devices cannot be used for files.
  if (!name || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) return tab.name;
  return `${name}${tab.name.slice(tab.name.lastIndexOf("."))}`;
}

function untitledName(kind: Kind): string {
  const ext = kind === "markdown" ? "md" : kind === "csv" ? "csv" : "txt";
  const used = new Set(getState().tabs.map((t) => t.name));
  for (let i = 1; ; i++) {
    const n = `Untitled-${i}.${ext}`;
    if (!used.has(n)) return n;
  }
}

function filtersFor(kind: Kind, name: string) {
  const ext = extname(name);
  const label: Record<string, string> = { md: "Markdown", csv: "CSV", tsv: "TSV", txt: "Text", pdf: "PDF" };
  return ext ? [{ name: label[ext] ?? ext.toUpperCase(), extensions: [ext] }, { name: "All files", extensions: ["*"] }] : kind === "text" ? [{ name: "All files", extensions: ["*"] }] : undefined;
}

// ---------- recent files and settings ----------

export async function addRecent(path: string, kind: Kind) {
  const recent: RecentItem[] = [{ path, kind, opened: Date.now() }, ...getState().recent.filter((r) => !samePath(r.path, path))].slice(0, 40);
  setState({ recent });
  await platform.stateSet("recent", JSON.stringify(recent)).catch(() => {});
}

export async function removeRecent(path: string) {
  const recent = getState().recent.filter((r) => !samePath(r.path, path));
  setState({ recent });
  await platform.stateSet("recent", JSON.stringify(recent)).catch(() => {});
}

export async function togglePin(path: string) {
  const pinned = getState().pinned.some((p) => samePath(p, path)) ? getState().pinned.filter((p) => !samePath(p, path)) : [path, ...getState().pinned];
  setState({ pinned });
  await platform.stateSet("pinned", JSON.stringify(pinned)).catch(() => {});
}

export async function updateSettings(patch: Partial<Settings>) {
  const settings = { ...getState().settings, ...patch };
  setState({ settings });
  await platform.stateSet("settings", JSON.stringify(settings)).catch(() => {});
}

// ---------- open and create ----------

export interface OpenOptions {
  kind?: Kind;
  activate?: boolean;
  goTo?: string;
  viewState?: unknown;
  /** Use these bytes instead of reading the file (recovered content). */
  bytes?: Uint8Array;
  dirty?: boolean;
  notice?: Tab["notice"];
}

/** Set while the previous session is being restored; a file the user opens meanwhile wins focus. */
let restoringSession = false;
let openedDuringRestore = false;

export async function openPath(path: string, opts: OpenOptions = {}): Promise<string | null> {
  if (restoringSession && opts.activate !== false) openedDuringRestore = true;
  const existing = findTabByPath(path, opts.kind);
  if (existing && !opts.bytes) {
    if (opts.activate !== false) activate(existing.id);
    if (opts.goTo) handles.get(existing.id)?.goTo?.(opts.goTo);
    return existing.id;
  }
  const id = newId();
  const tab: Tab = { id, path, name: basename(path), kind: opts.kind ?? kindFromName(path), dirty: false, saveState: "saved", version: 0, loading: true, viewState: opts.viewState };
  setState((s) => ({ tabs: [...s.tabs, tab] }));
  if (opts.activate !== false) activate(id);
  if (opts.goTo) pendingGoTo.set(id, opts.goTo);
  try {
    const meta = await platform.stat(path);
    if (!meta.exists && !opts.bytes) throw new Error("The file was not found. It may have been moved, renamed or deleted.");
    if (meta.size > MAX_OPEN_BYTES) throw new Error(`The file is ${(meta.size / 1048576).toFixed(0)} MB, larger than this version can open.`);
    const diskBytes = opts.bytes ? null : await platform.readFile(path);
    const bytes = opts.bytes ?? diskBytes!;
    if (meta.exists) knownMeta.set(metaKey(path), { size: meta.size, modified: meta.modified });
    const kind = opts.kind ?? detectKind(path, bytes);
    const named = kindFromName(path);
    const mismatch = !opts.kind && named !== kind && ["pdf", "docx", "xlsx", "pptx"].includes(named) && bytes.length > 0;
    // Not really the document its name says, and not readable as text either: explain, don't show bytes.
    const damaged = mismatch && kind === "binary" ? KIND_LABEL[named] : undefined;
    // An older .doc, .xls or .ppt opens in the editor, and its changes go to a new modern file.
    const modern = (kind === "docx" || kind === "xlsx" || kind === "pptx") && !opts.kind ? modernSaveFormat(path) : null;
    tabBytes.set(id, bytes);
    updateTab(id, {
      kind,
      loading: false,
      dirty: !!opts.dirty,
      readonly: meta.readonly,
      baselineUnsaved: !!opts.dirty,
      damaged,
      saveAsModern: modern ?? undefined,
      // Pictures, audio, video, archives and raw data are only shown, never saved back: read-only, not "Saved".
      saveState: opts.dirty ? "recovered" : meta.readonly || VIEW_ONLY.has(kind) ? "readonly" : "saved",
      notice:
        opts.notice ??
        (mismatch && !damaged
          ? { text: `${basename(path)} does not contain a valid ${KIND_LABEL[named]} file (it may be damaged or misnamed), so it is shown as text.`, tone: "warn" }
          : modern
            ? { text: `${basename(path)} is in an older format. Your changes are saved as a new ${MODERN_LABEL[modern]} (.${modern}); the original stays as it is.`, tone: "info" }
            : meta.readonly
            ? { text: "This file is read-only. Use Save As to keep your changes elsewhere.", tone: "info" }
            : undefined),
    });
    if (meta.exists) void platform.watch(path).catch(() => {});
    if (!opts.notice && !meta.readonly) void warnIfOpenInOffice(id, path);
    void addRecent(path, kind);
    updateTitle();
    return id;
  } catch (e) {
    updateTab(id, { loading: false, error: explainError(e instanceof Error ? e.message : String(e)) });
    return id;
  }
}

/** Microsoft Office's owner-file names for a document: "~$" plus the name, and (Word, for longer
 *  names) "~$" in place of the first one or two characters. */
export function officeLockNames(name: string): string[] {
  const names = [`~$${name}`];
  const dot = name.lastIndexOf(".");
  const stemLen = dot < 0 ? name.length : dot;
  if (stemLen > 7) names.push(`~$${name.slice(2)}`);
  if (stemLen > 6) names.push(`~$${name.slice(1)}`);
  return names;
}

/** Warn when the file seems to be open in Microsoft Office too (its lock file exists next to it):
 *  saving from both places would overwrite one set of changes. */
async function warnIfOpenInOffice(id: string, path: string) {
  if (!platform.folders || !/\.(docx|xlsx|pptx|doc|xls|ppt)$/i.test(path)) return;
  const dir = dirname(path);
  for (const n of officeLockNames(basename(path))) {
    const m = await platform.stat(join(dir, n)).catch(() => null);
    if (m?.exists) {
      updateTab(id, (t) => (t.notice ? {} : { notice: { text: "This file looks open in Microsoft Office too. Save in one place only, or one set of changes will replace the other.", tone: "warn" } }));
      return;
    }
  }
}

export function openBytes(name: string, bytes: Uint8Array, opts: { kind?: Kind; dirty?: boolean; notice?: Tab["notice"]; path?: string | null } = {}): string {
  const id = newId();
  const kind = opts.kind ?? detectKind(name, bytes);
  tabBytes.set(id, bytes);
  const tab: Tab = { id, path: opts.path ?? null, name, kind, dirty: !!opts.dirty, baselineUnsaved: !!opts.dirty, saveState: opts.dirty ? "recovered" : "new", version: 0, notice: opts.notice };
  setState((s) => ({ tabs: [...s.tabs, tab] }));
  activate(id);
  return id;
}

const TEMPLATES: Partial<Record<Kind, string>> = {
  markdown: "",
  text: "",
  csv: "Column A,Column B,Column C\n,,\n",
};

export function newFile(kind: Kind = "markdown", content?: string) {
  const name = untitledName(kind);
  return openBytes(name, new TextEncoder().encode(content ?? TEMPLATES[kind] ?? ""), { kind });
}

const OFFICE_TEMPLATES = {
  docx: () => import("../assets/templates/blank.docx?url"),
  xlsx: () => import("../assets/templates/blank.xlsx?url"),
  pptx: () => import("../assets/templates/blank.pptx?url"),
};

/** New blank Word, Excel or PowerPoint document (opens in the Office editor). */
export async function newOfficeFile(kind: "docx" | "xlsx" | "pptx") {
  const url = (await OFFICE_TEMPLATES[kind]()).default;
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const base = { docx: "Document", xlsx: "Workbook", pptx: "Presentation" }[kind];
  const used = new Set(getState().tabs.map((t) => t.name));
  let name = `${base}.${kind}`;
  for (let i = 2; used.has(name); i++) name = `${base} ${i}.${kind}`;
  return openBytes(name, bytes, { kind });
}

export async function pickAndOpen() {
  const paths = await platform.pickOpen({ multiple: true });
  for (const p of paths) await openPath(p);
}

export async function openFolder(path?: string) {
  const dir = path ?? (await platform.pickOpen({ directory: true }))[0];
  if (!dir) return;
  setState({ workspace: dir, leftOpen: true, leftView: "files" });
  persistSession();
}

export function closeFolder() {
  setState({ workspace: null });
  persistSession();
}

/** Open the same file again in a different engine (for example a CSV as plain text). */
export async function reopenAs(tabId: string, kind: Kind) {
  const tab = getState().tabs.find((t) => t.id === tabId);
  if (!tab) return;
  if (tab.path && !tab.dirty) {
    await openPath(tab.path, { kind });
    return;
  }
  const bytes = (await handles.get(tabId)?.serialize()) ?? tabBytes.get(tabId);
  if (bytes) openBytes(tab.name, bytes, { kind, path: null, notice: { text: `Opened as ${kind} from unsaved content.`, tone: "info" } });
}

export function openLink(fromTab: Tab, target: string) {
  if (/^(https?:|mailto:)/i.test(target)) {
    void platform.openExternal(target);
    return;
  }
  if (target.startsWith("#")) {
    handles.get(fromTab.id)?.goTo?.(decodeURIComponent(target.slice(1)));
    return;
  }
  const [rawPath, loc] = target.split("#");
  const base = fromTab.path ? dirname(fromTab.path) : getState().workspace;
  if (!base) {
    toast("Save this file first so relative links have a folder to start from.");
    return;
  }
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    /* keep as written */
  }
  // Links inside documents may only point to other files by relative path. Network shares,
  // absolute paths and other URL schemes are refused so a document cannot make the app
  // contact another machine or open arbitrary system files.
  const abs = resolveDocumentRef(base, decoded);
  if (!abs) {
    toast(`This link was not opened because it points outside the document's folder or to another computer: ${target.slice(0, 120)}`, "error");
    return;
  }
  void openPath(abs, { goTo: loc ? decodeURIComponent(loc) : undefined });
}

// ---------- save ----------

function wantSnapshot(path: string, explicit: boolean): boolean {
  const last = lastSnapshotAt.get(path) ?? 0;
  const gap = explicit ? 30_000 : 5 * 60_000;
  if (Date.now() - last < gap) return false;
  lastSnapshotAt.set(path, Date.now());
  return true;
}

export function saveTab(id: string, opts: { as?: boolean; explicit?: boolean } = {}): Promise<boolean> {
  const run = (saveChains.get(id) ?? Promise.resolve(true)).then(
    () => saveTabNow(id, opts),
    () => saveTabNow(id, opts),
  );
  saveChains.set(id, run);
  return run;
}

async function saveTabNow(id: string, opts: { as?: boolean; explicit?: boolean }): Promise<boolean> {
  const handle = handles.get(id);
  handle?.flush?.();
  const tab = getState().tabs.find((t) => t.id === id);
  if (!tab || !handle) return false;
  if (handle.canSave === false) {
    toast("This preview is read-only. Use Export to save it in another format.");
    return false;
  }
  if (tab.conflict === "changed" && !opts.as) {
    // Auto-save never asks: the banner above the document already offers the choice.
    if (!opts.explicit) return cancelSave(handle);
    const choice = await ask("This file changed outside the app", "Saving now replaces the other changes. They are kept in version history either way.", ["Save mine", "Cancel"]);
    if (choice !== "Save mine") return cancelSave(handle);
  }
  // Nothing to write: a clean tab already matches the file (keeps unedited files byte-identical).
  if (!opts.as && tab.path && !tab.dirty && !tab.conflict && tab.saveState !== "new") {
    cancelSave(handle);
    return true;
  }
  let path = tab.path;
  if (!path || opts.as || tab.readonly || tab.saveAsModern) {
    const modern = tab.saveAsModern;
    const def = modern && tab.path ? withExtension(tab.path, modern) : tab.path ?? join(getState().workspace ?? "", firstSaveName(tab, handle));
    path = await platform.pickSave({ defaultPath: def, filters: modern ? filtersFor(tab.kind, `x.${modern}`) : filtersFor(tab.kind, tab.name) });
    if (!path) return cancelSave(handle);
    const other = getState().tabs.find((t) => t.id !== id && t.path && samePath(t.path, path!));
    if (other) {
      toast(`${basename(path)} is open in another tab. Close it first, or choose another name.`, "error");
      return cancelSave(handle);
    }
  }
  clearTimeout(autoSaveTimers.get(id));
  updateTab(id, { saveState: "saving" });
  try {
    const genAtSerialize = editGen.get(id) ?? 0;
    let bytes = await handle.serialize({ forSave: true, targetExt: extname(path) });
    // Save As between .csv and .tsv changes the delimiter so the new file reads correctly.
    const fromTab = tab.kind === "csv" && tab.path ? isTsv(tab.path) : isTsv(tab.name);
    let remountBytes: Uint8Array | null = null;
    if (tab.kind === "csv" && isTsv(path) !== fromTab) {
      const { loadCsv, toTable } = await import("../lib/csv");
      const { tableToDelimited } = await import("./exporters");
      const doc = loadCsv(bytes, fromTab ? "tsv" : "csv");
      bytes = new TextEncoder().encode(tableToDelimited(toTable(doc), isTsv(path) ? "\t" : ",", doc.eol));
      remountBytes = bytes;
    }
    const meta = await platform.writeFile(path, bytes, { snapshot: wantSnapshot(path, !!opts.explicit) });
    knownMeta.set(metaKey(path), { size: meta.size, modified: meta.modified });
    const current = getState().tabs.find((t) => t.id === id);
    const pathChanged = !tab.path || !samePath(tab.path, path);
    if (pathChanged) {
      if (tab.path && !getState().tabs.some((t) => t.id !== id && t.path && samePath(t.path, tab.path!))) void platform.unwatch(tab.path);
      void platform.watch(path).catch(() => {});
    }
    const newKind = pathChanged ? kindFromName(path) : tab.kind;
    // Still dirty if the user kept typing after the content was taken for this save.
    const stillDirty = (editGen.get(id) ?? 0) !== genAtSerialize;
    updateTab(id, {
      path,
      name: basename(path),
      readonly: false,
      saveAsModern: undefined,
      baselineUnsaved: false,
      dirty: stillDirty,
      saveState: stillDirty ? "edited" : "saved",
      conflict: undefined,
      // Notes about the old file (an older format, a damaged one, recovered work) are done with now.
      notice: tab.saveAsModern || current?.notice?.tone === "warn" ? undefined : current?.notice?.text.startsWith("Recovered") ? undefined : current?.notice,
      error: undefined,
    });
    if (remountBytes || (pathChanged && newKind !== tab.kind && isTextual(newKind) && isTextual(tab.kind))) {
      tabBytes.set(id, bytes);
      updateTab(id, (t) => ({ kind: newKind, version: t.version + 1 }));
    }
    if (!stillDirty) void clearRecovery(id);
    // Engines adopt what was written as their baseline (and stay dirty themselves if the content
    // has changed since); stillDirty lets engines that cannot compare (Office) keep their state.
    handle.markSaved?.({ stillDirty });
    // Other tabs showing the same file (for example a CSV also open as text) must not keep stale content.
    for (const t of getState().tabs) {
      if (t.id === id || !t.path || !samePath(t.path, path)) continue;
      if (t.dirty) updateTab(t.id, { conflict: "changed" });
      else void reloadFromDisk(t.id, false);
    }
    void addRecent(path, newKind);
    updateTitle();
    // An earlier "Could not save" message for this file is out of date now.
    setState((s) => ({ toasts: s.toasts.filter((x) => !x.text.startsWith(`Could not save ${tab.name}:`)) }));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Save cancelled.") {
      // The person chose Cancel in a question during the save: nothing went wrong.
      updateTab(id, { saveState: "edited", dirty: true });
      return cancelSave(handle);
    }
    // A failed save leaves the tab unsaved, so closing it still asks.
    updateTab(id, { saveState: "failed", dirty: true, error: undefined });
    toast(`Could not save ${tab.name}: ${friendlyError(msg)}`, "error", { label: "Save a copy", run: () => void saveTab(id, { as: true }) });
    return false;
  }
}

/** Operating-system error codes in plain words. */
/** Messages from libraries, in plain words (they are written for programmers). */
export function explainError(msg: string): string {
  const m = msg.toLowerCase();
  // Android: a file shared for one visit cannot be opened again after the app restarts.
  if (/permission denial|securityexception|no persistable permission|not have permission to access|requires that you obtain access/.test(m)) return "Android let the app open this file only once. Open it again from where it is (Files, Drive or the app that shared it).";
  if (/maximum call stack|too much recursion|excessive node nesting/.test(m)) return "This document is nested too deeply to read or convert.";
  if (/invalid string length|array buffer allocation|out of memory|allocation failed/.test(m)) return "This document is too large to convert here.";
  if (/uncompressed data size mismatch|invalid (length\/literal|distance|stored block|code lengths)|corrupted zip|end of central directory|crc32/.test(m)) return "This file is damaged: its packed contents cannot be read.";
  // Library messages sometimes ask to file a report with them; that is not for the person here.
  return msg.replace(/\s*please report this to \S+\.?/i, "").trim();
}

export function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (/eacces|eperm|access is denied|permission denied|os error 5\b|os error 13\b/.test(m)) return "you do not have permission to change this file, or it is open in another program. Try Save As to keep a copy.";
  if (/enospc|no space|os error 28\b|os error 112\b/.test(m)) return "the disk is full.";
  if (/enoent|not found|os error 2\b|os error 3\b/.test(m)) return "its folder no longer exists.";
  if (/ebusy|being used by another process|os error 32\b|os error 33\b/.test(m)) return "another program is using the file. Close it there and try again.";
  if (/erofs|read-only file system/.test(m)) return "the drive is read-only.";
  return explainError(msg);
}

/** A save that stopped before writing: engines drop anything they prepared for it. */
function cancelSave(handle: { cancelSave?: () => void } | undefined): false {
  handle?.cancelSave?.();
  return false;
}

/** Called by engines whenever content changes. */
export function contentChanged(id: string) {
  const tab = getState().tabs.find((t) => t.id === id);
  if (!tab) return;
  bumpEdit(id);
  if (!tab.dirty || tab.saveState === "saved" || tab.saveState === "saving") updateTab(id, { dirty: true, saveState: "edited" });
  updateTitle();
  const { autoSave } = getState().settings;
  // Saving a very large file takes a moment of work each time, so it waits for a longer pause in typing.
  const big = (tabBytes.get(id)?.length ?? 0) > 20 * 1024 * 1024;
  if (autoSave && tab.path && isTextual(tab.kind) && !tab.conflict && !tab.readonly) {
    clearTimeout(autoSaveTimers.get(id));
    autoSaveTimers.set(id, window.setTimeout(() => void saveTab(id), big ? 4000 : 900));
  }
  scheduleRecovery(id, big ? 8000 : 1500);
}

function scheduleRecovery(id: string, delay: number) {
  clearTimeout(recoveryTimers.get(id));
  recoveryTimers.set(id, window.setTimeout(() => void writeRecovery(id), delay));
}

async function writeRecovery(id: string, fresh = false) {
  const tab = getState().tabs.find((t) => t.id === id);
  const handle = handles.get(id);
  if (!tab || !handle || !tab.dirty || handle.canSave === false) return;
  // A save is writing this document right now; take the copy afterwards only if it is still unsaved.
  if (tab.saveState === "saving" && !fresh) return scheduleRecovery(id, 1500);
  try {
    const bytes = await handle.serialize({ fresh });
    // The tab may have been saved, cleaned or closed while serializing.
    const now = getState().tabs.find((t) => t.id === id);
    if (!now || !now.dirty || now.saveState === "saving") return;
    await recoveryOp(id, () => platform.recoveryWrite(id, JSON.stringify({ path: now.path, name: now.name, kind: now.kind }), bytes));
  } catch {
    /* recovery is best effort */
  }
}

export async function flushAll() {
  const tabs = getState().tabs.filter((t) => t.dirty);
  // On quit, recovery copies are taken now (not from a recent cache).
  await Promise.all(tabs.map((t) => writeRecovery(t.id, true)));
  await persistSessionNow();
}

// ---------- close ----------

/** Closes a tab, asking about unsaved changes unless the person already chose to discard them. */
export async function closeTab(id: string, opts: { discard?: boolean } = {}): Promise<boolean> {
  handles.get(id)?.flush?.();
  const tab = getState().tabs.find((t) => t.id === id);
  if (!tab) return true;
  if (tab.dirty && !opts.discard) {
    const autoSaves = getState().settings.autoSave && tab.path && isTextual(tab.kind) && !tab.conflict;
    const saved = autoSaves ? await saveTab(id) : false;
    if (!saved) {
      const choice = await ask(`Save changes to ${tab.name}?`, "Your changes will be lost if you don't save them.", ["Save", "Don't save", "Cancel"]);
      if (choice === "Cancel" || choice === null) return false;
      if (choice === "Save" && !(await saveTab(id, { explicit: true }))) return false;
    }
  }
  clearTimeout(autoSaveTimers.get(id));
  clearTimeout(recoveryTimers.get(id));
  void clearRecovery(id);
  editGen.delete(id);
  handles.delete(id);
  tabBytes.delete(id);
  mru = mru.filter((x) => x !== id);
  setState((s) => {
    const idx = s.tabs.findIndex((t) => t.id === id);
    const tabs = s.tabs.filter((t) => t.id !== id);
    const { [id]: _a, ...toolbar } = s.toolbar;
    const { [id]: _b, ...status } = s.status;
    const { [id]: _c, ...outline } = s.outline;
    const nextActive = s.activeId === id ? mru.find((m) => tabs.some((t) => t.id === m)) ?? tabs[Math.min(idx, tabs.length - 1)]?.id ?? null : s.activeId;
    return {
      tabs,
      toolbar,
      status,
      outline,
      activeId: nextActive,
      closed: tab.path ? [{ path: tab.path, kind: tab.kind, index: idx }, ...s.closed].slice(0, 20) : s.closed,
    };
  });
  if (tab.path && !getState().tabs.some((t) => t.path && samePath(t.path, tab.path!))) void platform.unwatch(tab.path);
  activate(getState().activeId);
  persistSession();
  return true;
}

export async function reopenClosed() {
  const [first, ...rest] = getState().closed;
  if (!first) return;
  setState({ closed: rest });
  const id = await openPath(first.path, { kind: first.kind });
  // Back where it was in the tab strip.
  if (id && first.index !== undefined) moveTab(id, Math.min(first.index, getState().tabs.length - 1));
}

export function switchTab(delta: number) {
  const s = getState();
  if (!s.tabs.length) return;
  const idx = s.tabs.findIndex((t) => t.id === s.activeId);
  activate(s.tabs[(idx + delta + s.tabs.length) % s.tabs.length].id);
}

export function switchToRecentTab() {
  const other = mru.find((m) => m !== getState().activeId && getState().tabs.some((t) => t.id === m));
  if (other) activate(other);
  else switchTab(1);
}

export function moveTab(id: string, toIndex: number) {
  setState((s) => {
    const tabs = s.tabs.slice();
    const from = tabs.findIndex((t) => t.id === id);
    if (from < 0) return {};
    const [t] = tabs.splice(from, 1);
    tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, t);
    return { tabs };
  });
  persistSession();
}

// ---------- external changes ----------

const changeTimers = new Map<string, number>();

export function handleExternalChange(path: string) {
  clearTimeout(changeTimers.get(path));
  changeTimers.set(path, window.setTimeout(() => void checkExternal(path), 350));
}

async function checkExternal(path: string) {
  const tabs = getState().tabs.filter((t) => t.path && samePath(t.path, path));
  if (!tabs.length) return;
  const meta = await platform.stat(path);
  const known = knownMeta.get(metaKey(path));
  if (meta.exists && known && known.size === meta.size && known.modified === meta.modified) return;
  for (const tab of tabs) {
    if (!meta.exists) {
      updateTab(tab.id, { conflict: "deleted", notice: undefined });
      continue;
    }
    if (tab.dirty) {
      updateTab(tab.id, { conflict: "changed" });
    } else {
      await reloadFromDisk(tab.id, false);
      toast(`${tab.name} was updated by another program and reloaded.`);
    }
  }
}

export async function reloadFromDisk(id: string, keepMineAsVersion = true) {
  const tab = getState().tabs.find((t) => t.id === id);
  if (!tab?.path) return;
  const handle = handles.get(id);
  try {
    if (keepMineAsVersion && handle && tab.dirty && handle.canSave !== false) {
      await platform.snapshotWrite(tab.path, await handle.serialize(), "kept before reload");
    }
    const bytes = await platform.readFile(tab.path);
    const meta = await platform.stat(tab.path);
    knownMeta.set(metaKey(tab.path), { size: meta.size, modified: meta.modified });
    tabBytes.set(id, bytes);
    updateTab(id, (t) => ({ version: t.version + 1, dirty: false, saveState: "saved", conflict: undefined, viewState: handle?.viewState?.() }));
    void clearRecovery(id);
    updateTitle();
  } catch (e) {
    toast(`Could not reload: ${e instanceof Error ? e.message : e}`, "error");
  }
}

export function keepMine(id: string) {
  updateTab(id, { conflict: undefined, dirty: true, saveState: "edited" });
}

/** Replace a tab's content with other bytes (restore a version) as an unsaved edit. */
export function replaceContent(id: string, bytes: Uint8Array, note: string) {
  tabBytes.set(id, bytes);
  updateTab(id, (t) => ({ version: t.version + 1, dirty: true, baselineUnsaved: true, saveState: "edited", notice: { text: note, tone: "info" } }));
  contentChanged(id);
}

// ---------- session ----------

let sessionTimer = 0;
export function persistSession() {
  clearTimeout(sessionTimer);
  sessionTimer = window.setTimeout(() => void persistSessionNow(), 400);
}

async function persistSessionNow() {
  const s = getState();
  if (!s.ready) return;
  const session = {
    tabs: s.tabs.filter((t) => t.path).map((t) => ({ path: t.path, kind: t.kind, viewState: handles.get(t.id)?.viewState?.() })),
    active: s.tabs.find((t) => t.id === s.activeId)?.path ?? null,
    workspace: s.workspace,
    leftOpen: s.leftOpen,
    leftView: s.leftView,
    rightOpen: s.rightOpen,
    rightView: s.rightView,
  };
  await platform.stateSet("session", JSON.stringify(session)).catch(() => {});
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await platform.stateGet(name);
    return raw ? { ...(fallback as object), ...JSON.parse(raw) } as T : fallback;
  } catch {
    return fallback;
  }
}

export async function startup() {
  const settings = await readJson<Settings>("settings", DEFAULT_SETTINGS);
  const list = async <T,>(name: string): Promise<T[]> => {
    try {
      const raw = await platform.stateGet(name);
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    } catch {
      return []; // a damaged state file must never stop the app from starting
    }
  };
  setState({ settings, recent: await list("recent"), pinned: await list("pinned") });

  const session = await readJson<{ tabs: { path: string; kind: Kind; viewState?: unknown }[]; active: string | null; workspace: string | null; leftOpen?: boolean; leftView?: State["leftView"]; rightOpen?: boolean; rightView?: State["rightView"] }>("session", { tabs: [], active: null, workspace: null });
  setState({
    workspace: session.workspace ?? null,
    leftOpen: !!session.leftOpen,
    leftView: session.leftView ?? "files",
    rightOpen: !!session.rightOpen,
    rightView: session.rightView ?? "preview",
  });
  restoringSession = true;
  for (const t of session.tabs ?? []) {
    const meta = await platform.stat(t.path).catch(() => null);
    if (meta?.exists) await openPath(t.path, { kind: t.kind, activate: false, viewState: t.viewState });
  }

  // Recover unsaved work from the last run (crash or quit with unsaved changes).
  const recovered = await platform.recoveryList().catch(() => []);
  for (const r of recovered) {
    try {
      const meta = JSON.parse(r.meta) as { path: string | null; name: string; kind: Kind };
      const bytes = await platform.recoveryRead(r.id);
      const notice = { text: "Recovered unsaved changes from your last session.", tone: "info" as const };
      const existing = meta.path ? findTabByPath(meta.path, meta.kind) : undefined;
      let newTabId: string | null;
      if (existing) {
        tabBytes.set(existing.id, bytes);
        updateTab(existing.id, (t) => ({ version: t.version + 1, dirty: true, baselineUnsaved: true, saveState: "recovered", notice }));
        newTabId = existing.id;
      } else if (meta.path && (await platform.stat(meta.path)).exists) {
        newTabId = await openPath(meta.path, { kind: meta.kind, bytes, dirty: true, notice, activate: false });
      } else {
        newTabId = openBytes(meta.path ? basename(meta.path) : meta.name, bytes, { kind: meta.kind, dirty: true, notice, path: null });
      }
      if (newTabId !== r.id) await platform.recoveryClear(r.id);
      if (newTabId) await platform.recoveryWrite(newTabId, r.meta, bytes);
    } catch {
      await platform.recoveryClear(r.id);
    }
  }

  const activePath = session.active;
  const active = (activePath && findTabByPath(activePath)) || getState().tabs[getState().tabs.length - 1];
  restoringSession = false;
  setState({ ready: true });
  // Do not take focus away from a file opened while the session was coming back.
  if (!openedDuringRestore || !getState().activeId) activate(active?.id ?? null);

  for (const p of await platform.launchFiles().catch(() => [])) await openPath(p);
}

type State = ReturnType<typeof getState>;

// ---------- export helpers ----------

export function suggestExportPath(tab: Tab, ext: string, suffix = ""): string {
  const base = tab.path ?? join(getState().workspace ?? "", tab.name);
  // Never suggest the file being exported (a misnamed report.pdf exported to PDF).
  if (!suffix && tab.path && samePath(withExtension(base, ext), tab.path)) suffix = " (exported)";
  const p = withExtension(base, ext);
  return suffix ? p.replace(new RegExp(`\\.${ext}$`), `${suffix}.${ext}`) : p;
}

/** Whether an export may write to a path: never over the file it comes from. */
export function exportTargetOk(tab: Tab, target: string): boolean {
  if (tab.path && samePath(tab.path, target)) {
    toast(`${basename(target)} is the file you are exporting from. Choose another name.`, "error");
    return false;
  }
  return true;
}
