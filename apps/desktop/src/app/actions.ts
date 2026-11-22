/** File actions: open, create, save, close, auto-save, recovery, session restore and external changes. */
import { platform } from "../platform";
import { basename, dirname, extname, join, samePath, withExtension, resolveDocumentRef } from "../lib/paths";
import { detectKind, kindFromName, type Kind } from "../lib/formats";
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

/** Engines report clean/dirty; a tab whose starting content is not on disk stays dirty. */
export function engineSetDirty(id: string, dirty: boolean) {
  const t = getState().tabs.find((x) => x.id === id);
  if (!t) return;
  if (!dirty && t.baselineUnsaved) return;
  if (t.dirty === dirty) return;
  updateTab(id, { dirty, saveState: dirty ? "edited" : t.path ? (t.readonly ? "readonly" : "saved") : "new" });
  if (!dirty) {
    clearTimeout(autoSaveTimers.get(id));
    clearTimeout(recoveryTimers.get(id));
    void platform.recoveryClear(id);
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
}

export function updateTitle() {
  const s = getState();
  const t = s.tabs.find((x) => x.id === s.activeId);
  void platform.setTitle(t ? `${t.dirty ? "● " : ""}${t.name} — Productivity` : "Productivity");
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

export async function openPath(path: string, opts: OpenOptions = {}): Promise<string | null> {
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
    if (meta.exists) knownMeta.set(path, { size: meta.size, modified: meta.modified });
    const kind = opts.kind ?? detectKind(path, bytes);
    tabBytes.set(id, bytes);
    updateTab(id, {
      kind,
      loading: false,
      dirty: !!opts.dirty,
      readonly: meta.readonly,
      baselineUnsaved: !!opts.dirty,
      saveState: opts.dirty ? "recovered" : meta.readonly ? "readonly" : "saved",
      notice: opts.notice ?? (meta.readonly ? { text: "This file is read-only. Use Save As to keep your changes elsewhere.", tone: "info" } : undefined),
    });
    if (meta.exists) void platform.watch(path).catch(() => {});
    void addRecent(path, kind);
    updateTitle();
    return id;
  } catch (e) {
    updateTab(id, { loading: false, error: e instanceof Error ? e.message : String(e) });
    return id;
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

export async function saveTab(id: string, opts: { as?: boolean; explicit?: boolean } = {}): Promise<boolean> {
  const handle = handles.get(id);
  handle?.flush?.();
  const tab = getState().tabs.find((t) => t.id === id);
  if (!tab || !handle) return false;
  if (handle.canSave === false) {
    toast("This preview is read-only. Use Export to save it in another format.");
    return false;
  }
  if (tab.conflict === "changed" && !opts.as) {
    const choice = await ask("This file changed outside the app", "Saving now replaces the other changes. They are kept in version history either way.", ["Save mine", "Cancel"]);
    if (choice !== "Save mine") return false;
  }
  // Nothing to write: a clean tab already matches the file (keeps unedited files byte-identical).
  if (!opts.as && tab.path && !tab.dirty && !tab.conflict && tab.saveState !== "new") return true;
  let path = tab.path;
  if (!path || opts.as || tab.readonly) {
    const def = tab.path ?? join(getState().workspace ?? "", tab.name);
    path = await platform.pickSave({ defaultPath: def, filters: filtersFor(tab.kind, tab.name) });
    if (!path) return false;
    const other = getState().tabs.find((t) => t.id !== id && t.path && samePath(t.path, path!));
    if (other) {
      toast(`${basename(path)} is open in another tab. Close it first, or choose another name.`, "error");
      return false;
    }
  }
  clearTimeout(autoSaveTimers.get(id));
  updateTab(id, { saveState: "saving" });
  try {
    let bytes = await handle.serialize({ forSave: true });
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
    knownMeta.set(path, { size: meta.size, modified: meta.modified });
    const current = getState().tabs.find((t) => t.id === id);
    const pathChanged = !tab.path || !samePath(tab.path, path);
    if (pathChanged) {
      if (tab.path && !getState().tabs.some((t) => t.id !== id && t.path && samePath(t.path, tab.path!))) void platform.unwatch(tab.path);
      void platform.watch(path).catch(() => {});
    }
    const newKind = pathChanged ? kindFromName(path) : tab.kind;
    // Still dirty if the user kept typing while the save ran.
    const stillDirty = current?.saveState === "edited" ? true : false;
    updateTab(id, {
      path,
      name: basename(path),
      readonly: false,
      baselineUnsaved: false,
      dirty: stillDirty,
      saveState: stillDirty ? "edited" : "saved",
      conflict: undefined,
      notice: current?.notice?.tone === "warn" ? undefined : current?.notice?.text.startsWith("Recovered") ? undefined : current?.notice,
      error: undefined,
    });
    if (remountBytes || (pathChanged && newKind !== tab.kind && isTextual(newKind) && isTextual(tab.kind))) {
      tabBytes.set(id, bytes);
      updateTab(id, (t) => ({ kind: newKind, version: t.version + 1 }));
    }
    if (!stillDirty) void platform.recoveryClear(id);
    handle.markSaved?.();
    // Other tabs showing the same file (for example a CSV also open as text) must not keep stale content.
    for (const t of getState().tabs) {
      if (t.id === id || !t.path || !samePath(t.path, path)) continue;
      if (t.dirty) updateTab(t.id, { conflict: "changed" });
      else void reloadFromDisk(t.id, false);
    }
    void addRecent(path, newKind);
    updateTitle();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateTab(id, { saveState: "failed", error: undefined });
    toast(`Could not save ${tab.name}: ${msg}`, "error", { label: "Save a copy", run: () => void saveTab(id, { as: true }) });
    return false;
  }
}

/** Called by engines whenever content changes. */
export function contentChanged(id: string) {
  const tab = getState().tabs.find((t) => t.id === id);
  if (!tab) return;
  if (!tab.dirty || tab.saveState === "saved" || tab.saveState === "saving") updateTab(id, { dirty: true, saveState: "edited" });
  updateTitle();
  const { autoSave } = getState().settings;
  if (autoSave && tab.path && isTextual(tab.kind) && !tab.conflict && !tab.readonly) {
    clearTimeout(autoSaveTimers.get(id));
    autoSaveTimers.set(id, window.setTimeout(() => void saveTab(id), 900));
  }
  clearTimeout(recoveryTimers.get(id));
  recoveryTimers.set(id, window.setTimeout(() => void writeRecovery(id), 1500));
}

async function writeRecovery(id: string) {
  const tab = getState().tabs.find((t) => t.id === id);
  const handle = handles.get(id);
  if (!tab || !handle || !tab.dirty || handle.canSave === false) return;
  try {
    const bytes = await handle.serialize();
    // The tab may have been saved, cleaned or closed while serializing.
    const now = getState().tabs.find((t) => t.id === id);
    if (!now || !now.dirty || now.saveState === "saving") return;
    await platform.recoveryWrite(id, JSON.stringify({ path: now.path, name: now.name, kind: now.kind }), bytes);
  } catch {
    /* recovery is best effort */
  }
}

export async function flushAll() {
  const tabs = getState().tabs.filter((t) => t.dirty);
  await Promise.all(tabs.map((t) => writeRecovery(t.id)));
  await persistSessionNow();
}

// ---------- close ----------

export async function closeTab(id: string): Promise<boolean> {
  handles.get(id)?.flush?.();
  const tab = getState().tabs.find((t) => t.id === id);
  if (!tab) return true;
  if (tab.dirty) {
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
  void platform.recoveryClear(id);
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
      closed: tab.path ? [{ path: tab.path, kind: tab.kind }, ...s.closed].slice(0, 20) : s.closed,
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
  await openPath(first.path, { kind: first.kind });
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
  const known = knownMeta.get(path);
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
    knownMeta.set(tab.path, { size: meta.size, modified: meta.modified });
    tabBytes.set(id, bytes);
    updateTab(id, (t) => ({ version: t.version + 1, dirty: false, saveState: "saved", conflict: undefined, viewState: handle?.viewState?.() }));
    void platform.recoveryClear(id);
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
  const recentRaw = await platform.stateGet("recent").catch(() => null);
  const pinnedRaw = await platform.stateGet("pinned").catch(() => null);
  setState({ settings, recent: recentRaw ? JSON.parse(recentRaw) : [], pinned: pinnedRaw ? JSON.parse(pinnedRaw) : [] });

  const session = await readJson<{ tabs: { path: string; kind: Kind; viewState?: unknown }[]; active: string | null; workspace: string | null; leftOpen?: boolean; leftView?: State["leftView"]; rightOpen?: boolean; rightView?: State["rightView"] }>("session", { tabs: [], active: null, workspace: null });
  setState({
    workspace: session.workspace ?? null,
    leftOpen: !!session.leftOpen,
    leftView: session.leftView ?? "files",
    rightOpen: !!session.rightOpen,
    rightView: session.rightView ?? "preview",
  });
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
  setState({ ready: true });
  activate(active?.id ?? null);

  for (const p of await platform.launchFiles().catch(() => [])) await openPath(p);
}

type State = ReturnType<typeof getState>;

// ---------- export helpers ----------

export function suggestExportPath(tab: Tab, ext: string, suffix = ""): string {
  const base = tab.path ?? join(getState().workspace ?? "", tab.name);
  const p = withExtension(base, ext);
  return suffix ? p.replace(new RegExp(`\\.${ext}$`), `${suffix}.${ext}`) : p;
}
