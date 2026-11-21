# 01 — Architecture

Status: draft for review · Last updated: 2026-11-21

Every choice below is a starting position backed by the research in `../research/`. Choices marked **(spike)** are confirmed or overturned by a Phase 0 experiment in `03-roadmap.md` before any real build work depends on them.

## Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Electron** (current stable; 45.x in Nov 2026) | Bundled Chromium gives every embedded editor one known browser on every OS. `printToPDF` is built in. |
| Language / build | TypeScript, Vite (`electron-vite`), pnpm workspace | One language end to end. |
| Shell UI | React, Radix/shadcn components, `cmdk` for the palette | Small, unopinionated, easy to keep minimal. |
| Tabs / split view | `dockview` (simple tab strip first, splits later) | Side-by-side tabs without writing a docking system. |
| docx / xlsx / pptx | **ONLYOFFICE editors (sdkjs + web-apps) with the x2t converter compiled to WebAssembly**, running fully client-side **(spike)** | The only open-source engine shown to edit all three at near-commercial fidelity with no server. |
| md / txt | **CodeMirror 6** | Keeps the file byte-identical; live preview is drawn on top, never written back. |
| csv | ONLYOFFICE sheet editor plus a dialect-preserving wrapper (Papa Parse) **(spike)** | One grid for all tabular files; the wrapper keeps delimiter, encoding and line endings. |
| pdf view / annotate / sign | **PDF.js** viewer and annotation editors **(spike vs EmbedPDF)** | Mature, Apache-2.0, monthly releases. |
| pdf page tools | `@cantoo/pdf-lib` in-process; `qpdf` sidecar for repair/linearize/encrypt | Maintained pdf-lib fork with incremental save. |
| Conversions | x2t (office ↔ pdf and between office formats), Electron `printToPDF` (md/txt → pdf), Pandoc WASM (md ↔ docx/html) | Each pair uses the tool that is best at it. |
| Search index | SQLite FTS5 (`better-sqlite3`) | Full-text search over open and recent files. |
| Tests | Vitest, Playwright for Electron, Python fidelity harness | See `04-verification.md`. |

### Why Electron and not Tauri

- Tauri uses the operating system's webview. Its own documentation warns that canvas and WebGL on Linux's WebKitGTK can fall onto a slow path, and no evidence was found of ONLYOFFICE running correctly inside WKWebView or WebKitGTK.
- Tauri has no programmatic print-to-PDF, which the export pipeline needs.
- Tauri's size advantage disappears once a full office engine is bundled.
- ONLYOFFICE Desktop, Obsidian and VS Code all bundle Chromium for the same reasons.

### Why ONLYOFFICE and not the alternatives

| Candidate | Verdict |
|---|---|
| ONLYOFFICE (sdkjs/web-apps + x2t-WASM) | **Chosen.** Client-side operation is demonstrated by `ranuts/document`, `cryptpad/onlyoffice-x2t-wasm` and two similar projects. AGPL-3.0, which places no obligations on private use. |
| Collabora / LibreOffice | Broadest format support, but built as an application, not an embeddable widget. Kept as an **optional headless converter and test oracle**, not as the editor. |
| Univer | Pleasant and hackable, but xlsx/docx/pptx import/export, charts, pivots and Slides are commercial. Not a full offline suite on open source alone. |
| SuperDoc (docx only) | Real in-place OOXML editing, AGPL. **Bake-off candidate** against ONLYOFFICE for documents if the ONLYOFFICE document editor proves too hard to restyle. |
| IronCalc (xlsx only) | Promising Rust/WASM engine, permissive licence, but pre-1.0 with no charts or pivots. Watch; revisit after its 1.0. |
| PPTist, custom canvas editors | Lossy by design (own JSON model). Rejected for pptx. |
| Euro-Office (ONLYOFFICE fork) | Needs Nextcloud today. Watch as a possible future upstream. |

## Process and isolation model

```
┌──────────────────────────── Electron main process ────────────────────────────┐
│ window · file I/O · atomic save · snapshots · file watcher · recent files     │
│ conversion jobs · search index · protocol handlers · menus · OS integration   │
└───────────────▲──────────────────────────────────────────────▲────────────────┘
                │ typed IPC (contextBridge)                      │
┌───────────────┴───────────────────────────────┐   ┌───────────┴───────────────┐
│ Shell renderer  (app://shell)                 │   │ Sidecars (optional)       │
│ tabs · palette · command registry · sidebar   │   │ qpdf · soffice --headless │
│ status bar · settings · light editors:        │   └───────────────────────────┘
│   CodeMirror (md/txt), PDF.js (pdf)           │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Engine frame  (engine://onlyoffice)     │  │  one per office tab,
│  │ sandboxed, separate origin, own process │  │  postMessage only
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

- **Main process owns the disk.** Renderers never touch the file system; they ask over a small typed IPC surface.
- **Heavy third-party engines run in a separate origin** served by a custom protocol (`engine://`), so Chromium places them in their own process and a crash or hang in one tab cannot take the shell down. Starting position is a sandboxed iframe per tab, because the shell can draw the command palette over an iframe. **(spike)** If isolation or memory proves inadequate, fall back to one `WebContentsView` per tab with the palette in its own overlay view.
- **Light editors** (CodeMirror, PDF.js) run in the shell renderer directly.
- **Tab hibernation:** background office tabs that are clean and idle are unloaded and restored on focus, to bound memory.
- **Security defaults:** `contextIsolation` on, `nodeIntegration` off, renderer sandbox on, strict CSP, all engine assets vendored and served locally, and outbound network blocked for engine frames.

## The editor-provider contract

Every format plugs into the shell through one interface, modelled on VS Code's custom editors. The shell knows nothing about any format beyond this.

```ts
interface EditorProvider {
  id: string;                              // "onlyoffice", "codemirror", "pdfjs"
  selector: FileSelector[];                // extensions + MIME types it claims
  create(host: EditorHost, doc: DocumentHandle): Promise<EditorInstance>;
  templates?: Template[];                  // starter files for "New"
}

interface EditorInstance {
  mount(el: HTMLElement): void;
  load(bytes: Uint8Array, meta: FileMeta): Promise<void>;
  serialize(format?: string): Promise<Uint8Array>;   // save and Save As
  export?(target: ExportTarget): Promise<Uint8Array>;
  readonly dirty: Observable<boolean>;
  commands(): CommandContribution[];       // feeds the palette
  extractText?(): Promise<string>;         // feeds search
  focus(): void;
  suspend?(): Promise<Snapshot>;           // for tab hibernation
  resume?(s: Snapshot): Promise<void>;
  dispose(): void;
}
```

Rules that keep this honest:

- Bytes in, bytes out. A provider never reads or writes disk.
- A provider that cannot preserve something must say so through a `capabilities` report, and the shell warns before a lossy save.
- Swapping an engine (for example PDF.js for EmbedPDF) must not touch the shell.

## File pipeline

- **Open:** file dialog, drag-and-drop, OS "Open with", recent files, palette. The provider is picked by extension, then confirmed by sniffing the first bytes.
- **Save:** write to a temp file in the same folder, flush, rename over the original. Never truncate in place.
- **Auto-save:**
  - `md`, `txt`, `csv`: write to the real file shortly after typing stops.
  - `docx`, `xlsx`, `pptx`, `pdf`: write a **recovery snapshot** to the app's data folder about a second after edits stop, and write the real file on explicit save or on a configurable interval. Serializing a large office file on every keystroke is slow and makes every mistake permanent.
- **Version history:** keep the last N snapshots per file, plus a one-time `.bak` copy the first time this app ever saves over a file. This is the main safety net against any engine bug.
- **Trust levels:** until a format has passed the fidelity suite in `04-verification.md` on the personal corpus, saving an office file defaults to "save a copy" beside the original. Overwriting in place is switched on per format once it has earned it.
- **Crash recovery:** on launch, offer to restore any snapshot newer than its file.
- **External changes:** watch open files; if a clean file changes on disk, reload it; if a dirty one does, ask.
- **Lock files:** respect and create the same lock files Office (`~$name`) and LibreOffice (`.~lock.name#`) use, and open read-only when another app holds one.
- **Text hygiene:** detect and preserve encoding, byte-order mark and line endings for `txt`, `md` and `csv`.

## Export matrix

| From → To | pdf | docx | md | html | xlsx | csv | pptx | images |
|---|---|---|---|---|---|---|---|---|
| docx | x2t | — | Pandoc | Pandoc | | | | |
| md | printToPDF | Pandoc | — | built-in | | | | |
| txt | printToPDF | Pandoc | rename | | | | | |
| xlsx | x2t | | | | — | x2t | | |
| csv | x2t | | | | x2t | — | | |
| pptx | x2t | | | | | | — | x2t |
| pdf | page tools | later | later (text) | | | | | PDF.js |

An optional LibreOffice headless sidecar can be added later as a second converter for pairs where x2t's output is poor. It is 500 MB+, so it is not bundled by default.

## Command palette and keyboard routing

- The shell owns a **single command registry**. Each provider contributes its commands (bold, insert table, freeze panes, rotate page, …) with an id, title, optional shortcut and a `when` condition.
- `Ctrl/Cmd+K` and a small set of reserved shell chords (new, open, save, close tab, switch tab, palette) are intercepted in the main process **before** the focused editor sees them, so no embedded engine can swallow them.
- Everything else passes through to the focused editor untouched, so Word-style and Excel-style shortcuts keep working.
- Palette modes: commands, open tabs, recent files, templates, and full-text search across open and recent documents.
- **(spike)** How many ONLYOFFICE actions can be triggered from outside the frame decides how deep the palette reaches into office formats. The fallback is a small private patch to `web-apps` that exposes its action list over `postMessage`.

## Look and feel

- One shell theme (light and dark), one typeface, one status bar (word count, selection sum, page number, zoom, save state).
- Embedded engines are themed to match as far as their own theming allows. ONLYOFFICE's toolbar is kept in its compact mode at first; replacing it with a native shell toolbar is a later, optional project.
- Focus mode hides everything except the document.

## Directory layout

```
productivity-tool/
├── apps/
│   └── desktop/
│       ├── src/main/            # Electron main: window, IPC, protocols, menus
│       │   ├── files/           # open, atomic save, snapshots, watcher, locks, recents
│       │   ├── convert/         # export jobs: x2t, pandoc, printToPDF, sidecars
│       │   └── search/          # SQLite FTS index
│       ├── src/preload/         # contextBridge API (typed)
│       └── src/renderer/        # shell UI
│           ├── workspace/       # tabs, splits, hibernation
│           ├── palette/         # cmdk UI + command registry
│           ├── statusbar/
│           └── settings/
├── packages/
│   ├── editor-api/              # EditorProvider contract, shared types
│   ├── engine-text/             # CodeMirror 6: md + txt
│   ├── engine-pdf/              # PDF.js viewer, annotations, page tools
│   ├── engine-office/           # adapter around the ONLYOFFICE frame (docx/xlsx/pptx/csv)
│   ├── file-kit/                # sniffing, encoding, csv dialect, lock files
│   └── ui/                      # shared components and theme tokens
├── vendor/
│   └── onlyoffice/              # pinned sdkjs + web-apps + x2t-wasm build (fetched by script, not committed)
├── templates/                   # blank and starter files per format
├── tests/
│   ├── corpus/                  # sample files per format (small, committed)
│   ├── e2e/                     # Playwright: open → edit → save → reload
│   └── fidelity/                # Python harness: validate, diff, render-compare
├── scripts/                     # fetch-vendor, build-engine, make-corpus
└── docs/
    ├── plans/
    └── research/
```

Vendored engine builds are downloaded by a pinned script instead of being committed, which keeps the repository small and keeps AGPL code out of the tree.
