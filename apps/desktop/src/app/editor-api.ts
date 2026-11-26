/** The contract between the shell and every format engine (docs/plans/01-architecture.md).
 *  Bytes in, bytes out: engines never touch the disk. */
import type { ReactNode } from "react";
import type { Kind } from "../lib/formats";

export interface ToolbarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Shown as text next to the icon. */
  text?: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
  /** Items with the same group are kept together; a divider separates groups. */
  group?: string;
  /** Low-priority items move into the "More" menu on narrow windows. */
  overflow?: boolean;
}

export interface StatusItem {
  id: string;
  text: string;
  title?: string;
  onClick?: () => void;
  align?: "middle" | "right";
}

export interface OutlineItem {
  level: number;
  text: string;
  /** Engine-specific location, passed back to goTo. */
  loc: string;
}

export interface Command {
  id: string;
  title: string;
  group?: string;
  shortcut?: string;
  run: () => unknown;
}

export interface EngineHandle {
  /** Current content as bytes, for save, export and recovery. With forSave, the engine
   *  remembers this exact content as what markSaved() will treat as being on disk,
   *  and may ask the user about lossy choices. Other callers must not change engine state. */
  serialize(opts?: { forSave?: boolean; fresh?: boolean }): Promise<Uint8Array>;
  /** A save that was prepared stopped before writing (cancelled, or nothing to write). */
  // (markSaved receives { stillDirty } when the content changed after it was taken for the save.)
  cancelSave?(): void;
  focus(): void;
  /** Apply any edit still in progress (for example an open cell editor) before saving. */
  flush?(): void;
  commands?(): Command[];
  find?(): void;
  zoom?(delta: 1 | -1 | 0): void;
  /** Go to a location: a line number, page, row, or an outline loc. */
  goTo?(loc: string): void;
  /** Plain text of the document, for search and export. */
  getText?(): string;
  /** Cursor or scroll position to restore later. */
  viewState?(): unknown;
  /** False for read-only previews that cannot be saved back to their own format. */
  canSave?: boolean;
  /** Called after the bytes from the last serialize() were written successfully. */
  markSaved?(info?: { stillDirty?: boolean }): void;
  /** Formats this engine can produce itself (in addition to the shared converters). */
  exportFormats?(): { ext: string; label: string }[];
  /** Produce the document in another format (for engine-provided export formats). */
  convert?(ext: string): Promise<Uint8Array>;
  /** Choices made in the editor that exports should follow (for example a table's header row). */
  exportHints?(): import("../lib/convert").ExportHints;
}

export interface EngineHost {
  tabId: string;
  path: string | null;
  name: string;
  kind: Kind;
  bytes: Uint8Array;
  viewState?: unknown;
  setDirty(dirty: boolean): void;
  /** Tell the shell content changed (for auto-save and recovery scheduling). */
  changed(): void;
  setToolbar(items: ToolbarItem[]): void;
  setStatus(items: StatusItem[]): void;
  setOutline(items: OutlineItem[]): void;
  register(handle: EngineHandle): void;
  /** Open a link target found in the document (a relative path, URL, or path#location). */
  openLink(target: string): void;
  toast(message: string, kind?: "info" | "error"): void;
  /** Ask the shell to open the same file in another engine. */
  openAs(kind: Kind): void;
  /** Ask the shell to save (for example after a page operation). */
  save(): void;
}
