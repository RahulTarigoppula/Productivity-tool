/** Central app state: a tiny observable store used through React's useSyncExternalStore. */
import { useSyncExternalStore } from "react";
import type { Kind } from "../lib/formats";
import type { OutlineItem, StatusItem, ToolbarItem, EngineHandle } from "./editor-api";

export type SaveState = "new" | "saved" | "saving" | "edited" | "failed" | "recovered" | "readonly";

export interface Tab {
  id: string;
  path: string | null;
  name: string;
  kind: Kind;
  dirty: boolean;
  saveState: SaveState;
  error?: string;
  /** Increments to remount the engine with fresh bytes (reload, restore). */
  version: number;
  /** Set when the file changed on disk while this tab had unsaved edits. */
  conflict?: "changed" | "deleted";
  /** Short note shown in a banner (recovered, lossy, read-only reason). */
  notice?: { text: string; tone: "info" | "warn" };
  viewState?: unknown;
  loading?: boolean;
  /** The file on disk is read-only: saves go through Save As. */
  readonly?: boolean;
  /** The content the engine started from is not on disk (recovered or restored),
   *  so the tab stays dirty even if edits are undone back to it. */
  baselineUnsaved?: boolean;
  /** The file is named as this kind of document (for example "PDF") but its content is not one:
   *  the tab shows a short explanation until the person asks to see the raw data. */
  damaged?: string;
  /** An older Office file (.doc, .xls, .ppt) the editor reads but cannot write: its changes are
   *  saved as a new file in this modern format, and the original stays as it is. */
  saveAsModern?: "docx" | "xlsx" | "pptx";
}

export interface RecentItem {
  path: string;
  opened: number;
  kind: Kind;
}

export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  autoSave: boolean;
  fontSize: number;
  wordWrapCode: boolean;
  lineNumbers: boolean;
  tabSize: number;
  markdownLivePreview: boolean;
  density: "comfortable" | "compact";
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  autoSave: true,
  fontSize: 14,
  wordWrapCode: false,
  lineNumbers: true,
  tabSize: 4,
  markdownLivePreview: true,
  density: "comfortable",
};

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

export type LeftView = "files" | "outline" | "search";
export type RightView = "preview" | "history" | "properties";

export interface State {
  tabs: Tab[];
  activeId: string | null;
  workspace: string | null;
  leftOpen: boolean;
  leftView: LeftView;
  rightOpen: boolean;
  rightView: RightView;
  recent: RecentItem[];
  pinned: string[];
  settings: Settings;
  palette: { open: boolean; query: string };
  dialog: null | { kind: "export" | "settings" | "signature" | "about" | "newFile" };
  focusMode: boolean;
  toasts: Toast[];
  closed: { path: string; kind: Kind; index?: number }[];
  /** Engine-provided UI per tab. */
  toolbar: Record<string, ToolbarItem[]>;
  status: Record<string, StatusItem[]>;
  outline: Record<string, OutlineItem[]>;
  ready: boolean;
}

let state: State = {
  tabs: [],
  activeId: null,
  workspace: null,
  leftOpen: false,
  leftView: "files",
  rightOpen: false,
  rightView: "preview",
  recent: [],
  pinned: [],
  settings: DEFAULT_SETTINGS,
  palette: { open: false, query: "" },
  dialog: null,
  focusMode: false,
  toasts: [],
  closed: [],
  toolbar: {},
  status: {},
  outline: {},
  ready: false,
};

const listeners = new Set<() => void>();

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function updateTab(id: string, patch: Partial<Tab> | ((t: Tab) => Partial<Tab>)) {
  setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
  }));
}

export function activeTab(): Tab | null {
  return state.tabs.find((t) => t.id === state.activeId) ?? null;
}

/** Engine handles and initial bytes live outside React state (they are large or imperative). */
export const handles = new Map<string, EngineHandle>();
export const tabBytes = new Map<string, Uint8Array>();
/** Last metadata the app itself wrote or read, to tell its own writes apart from external changes. */
export const knownMeta = new Map<string, { size: number; modified: number }>();

let nextToast = 1;
export function toast(text: string, tone: "info" | "error" = "info", action?: Toast["action"]) {
  // The same message twice in a row is shown once.
  if (state.toasts.some((t) => t.text === text)) return;
  const id = nextToast++;
  setState((s) => ({ toasts: [...s.toasts, { id, text, tone, action }].slice(-4) }));
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === "error" ? 8000 : 4500);
}

let idCounter = 0;
export function newId(): string {
  idCounter++;
  return `t${Date.now().toString(36)}${idCounter}`;
}
