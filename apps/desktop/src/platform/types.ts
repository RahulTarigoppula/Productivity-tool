/** Everything the interface needs from the operating system goes through this interface.
 *  Paths are treated as opaque document handles by the rest of the app. */

export interface FileMeta {
  exists: boolean;
  size: number;
  /** Milliseconds since the Unix epoch. */
  modified: number;
  readonly: boolean;
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface SearchHit {
  path: string;
  line: number;
  col: number;
  text: string;
}

export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
  maxHits?: number;
}

export interface SnapshotInfo {
  id: string;
  path: string;
  created: number;
  size: number;
  reason: string;
}

export interface RecoveryInfo {
  id: string;
  meta: string;
  size: number;
  updated: number;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OfficePackInfo {
  available: boolean;
  version?: string | null;
  bytes?: number | null;
}

export interface Platform {
  kind: "tauri" | "browser";
  /** Whether the Office editing pack is installed. */
  officePack(): Promise<OfficePackInfo>;
  /** URL of a file inside the Office pack (served on its own origin). */
  officeUrl(path: string): string;
  readFile(path: string): Promise<Uint8Array>;
  /** Safe write. With snapshot=true the previous content is kept as a version first. */
  writeFile(path: string, bytes: Uint8Array, opts?: { snapshot?: boolean }): Promise<FileMeta>;
  stat(path: string): Promise<FileMeta>;
  pickOpen(opts: { multiple?: boolean; directory?: boolean; filters?: FileFilter[] }): Promise<string[]>;
  pickSave(opts: { defaultPath?: string; filters?: FileFilter[] }): Promise<string | null>;
  listDir(path: string): Promise<DirEntry[]>;
  findFiles(root: string, max?: number): Promise<string[]>;
  searchFolder(root: string, query: string, opts: SearchOptions): Promise<SearchHit[]>;
  watch(path: string): Promise<void>;
  unwatch(path: string): Promise<void>;
  onFileChanged(cb: (path: string) => void): () => void;
  onOpenFiles(cb: (paths: string[]) => void): () => void;
  launchFiles(): Promise<string[]>;
  stateGet(name: string): Promise<string | null>;
  stateSet(name: string, value: string): Promise<void>;
  snapshotList(path: string): Promise<SnapshotInfo[]>;
  snapshotRead(path: string, id: string): Promise<Uint8Array>;
  snapshotWrite(path: string, bytes: Uint8Array, reason: string): Promise<SnapshotInfo>;
  recoveryWrite(id: string, meta: string, bytes: Uint8Array): Promise<void>;
  recoveryList(): Promise<RecoveryInfo[]>;
  recoveryRead(id: string): Promise<Uint8Array>;
  recoveryClear(id: string): Promise<void>;
  reveal(path: string): Promise<void>;
  openExternal(target: string): Promise<void>;
  setTitle(title: string): Promise<void>;
  setFullscreen(on: boolean): Promise<void>;
  /** Called before the window closes; the app finishes saving recovery data, then the window closes. */
  onCloseRequested(cb: () => Promise<void>): () => void;
}
