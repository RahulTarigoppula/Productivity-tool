# 01 — Architecture

Status: draft for review · Last updated: 2026-11-21

Every choice below is a starting position backed by the research in `../research/`. Choices marked **(spike)** are confirmed or overturned by a Phase 0 experiment in `03-roadmap.md` before any real build work depends on them.

## Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri v2 on every platform** (Windows, Android, macOS, iOS) | The only shell that reaches desktop and phones from one project, and it uses the system webview, so the base app is a few megabytes. See `12-platforms-and-mobile.md`. |
| Core | One Rust core: files, search index, conversion jobs, sync state | Runs on every platform, including phones where helper programs are not allowed. |
| Platform layer | A small `platform` interface (document handles, dialogs, windows, share, printing, pen, OCR) with one implementation per platform | Keeps the shell replaceable and hides the differences between desktop paths and mobile file permissions. |
| Language / build | TypeScript and React for the interface, Rust for the core, Vite, pnpm workspace | One interface for every platform, responsive from phone to desktop. |
| Shell UI | React, shadcn/ui components, `cmdk` for the palette | Small, unopinionated, easy to keep minimal. See `07-ux-ui-design.md`. |
| Tabs / split view | `dockview` (simple tab strip first, splits later) | Side-by-side tabs without writing a docking system. |
| docx / xlsx / pptx | **ONLYOFFICE editors (sdkjs + web-apps) with the x2t converter compiled to WebAssembly**, running fully client-side, shipped as an on-demand **pack** **(spike)** | The only open-source engine shown to edit all three at near-commercial fidelity with no server. About 100 MB compressed, so it loads only when an office file is opened. |
| Any text or code file | **CodeMirror 6**, with Shiki grammars and a language-server client | VS Code-level editing that also works on touch; keeps files byte-identical. See `06-code-and-text-editor.md`. |
| csv | A light text-typed grid in the base app, with Papa Parse for dialect detection; "open in spreadsheet editor" on request | Opening a small CSV should not load the office engine, and CSV needs exact dialect preservation. |
| pdf view / annotate / sign | **PDF.js** viewer and annotation editors **(spike vs EmbedPDF)** | Mature, Apache-2.0, monthly releases. |
| pdf page tools | `@cantoo/pdf-lib` in-process; `qpdf` sidecar for repair/linearize/encrypt | Maintained pdf-lib fork with incremental save. |
| Conversions | A registry of converters with route-finding: x2t, Pandoc, the PDF engine, data converters, platform OCR | Any format to any sensible format. See `10-universal-export.md`. |
| Search and links | A local index in the Rust core (SQLite FTS5): full text with locations, links, backlinks, tags | Works on every platform; rebuildable from the files. See `09-differentiators-and-interconnection.md`. |
| Sync | None built in at first: the app works inside a synced folder and carries its state in a hidden folder there | See `11-sync-and-continuity.md`. |
| Tests | Vitest, Playwright, Python fidelity harness, performance and size budgets in CI | See `04-verification.md` and `08-performance-and-footprint.md`. |

### Why Tauri

- It is the only mainstream shell that targets Windows, macOS, Android and iOS from one project. Electron does not run on phones.
- It uses the system webview, so an empty app is about 3–5 MB against Electron's 270–370 MB.
- On Windows and Android, the first two targets, the system webview is Chromium-based, which is what the editors are built for.
- Its weak points are known and planned around: mobile support is younger than desktop, there is no built-in print-to-PDF, and Apple's webview is unproven for the office editors. The `platform` interface keeps a different shell possible on any one platform (Electron on macOS, Capacitor or a native host on mobile).

Where the rest of this document says "main process", read it as the Rust core.

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
┌──────────────────────────── shell backend process ────────────────────────────┐
│ window · file I/O · atomic save · snapshots · file watcher · recent files     │
│ conversion jobs · search index · protocol handlers · menus · OS integration   │
└───────────────▲──────────────────────────────────────────────▲────────────────┘
                │ typed IPC                                      │
┌───────────────┴───────────────────────────────┐   ┌───────────┴───────────────┐
│ Shell renderer  (app://shell)                 │   │ Sidecars (optional)       │
│ tabs · palette · command registry · sidebar   │   │ qpdf · soffice --headless │
│ status bar · settings · light editors:        │   └───────────────────────────┘
│   CodeMirror (text/code), PDF.js, grid       │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Engine frame  (engine://onlyoffice)     │  │  one per office tab,
│  │ sandboxed, separate origin, own process │  │  postMessage only
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

- **Main process owns the disk.** Renderers never touch the file system; they ask over a small typed IPC surface.
- **Heavy third-party engines run in a separate origin** served by a custom protocol (`engine://`), so Chromium places them in their own process and a crash or hang in one tab cannot take the shell down. Starting position is a sandboxed iframe per tab, because the shell can draw the command palette over an iframe. **(spike)** If isolation or memory proves inadequate, fall back to one `WebContentsView` per tab with the palette in its own overlay view.
- **Light editors** (CodeMirror, PDF.js, the CSV grid) run in the shell renderer directly. Text tabs share one editor core, so each extra text tab costs very little.
- **On phones**, only one heavy editor is live at a time.
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

- **Document handles, not paths.** The interface and engines never see a file path. They hold an opaque handle; the platform layer turns it into a path on desktop or a permission-bound reference on Android and iOS.
- **Open:** file dialog, drag-and-drop, OS "Open with", share-to-app on phones, recent files, palette. The provider is picked by extension, then confirmed by sniffing the first bytes.
- **Save:** on desktop, write to a temp file in the same folder, flush, rename over the original. On mobile, write through the handle and verify. Never leave a half-written file.
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
| md | print-to-PDF | Pandoc | — | built-in | | | | |
| txt | print-to-PDF | Pandoc | rename | | | | | |
| xlsx | x2t | | | | — | x2t | | |
| csv | office pack | | | | office pack | — | | |
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
- The full design is in `07-ux-ui-design.md`.

## Directory layout

```
productivity-tool/
├── apps/
│   └── desktop/
│       ├── src/main/            # shell backend: window, IPC, protocols, menus
│       │   ├── files/           # open, atomic save, snapshots, watcher, locks, recents
│       │   ├── convert/         # export jobs: x2t, pandoc, print-to-PDF, sidecars
│       │   └── search/          # SQLite FTS index
│       ├── src/preload/         # contextBridge API (typed)
│       └── src/renderer/        # shell UI
│           ├── workspace/       # tabs, splits, hibernation
│           ├── palette/         # cmdk UI + command registry
│           ├── statusbar/
│           └── settings/
├── packages/
│   ├── editor-api/              # EditorProvider contract, shared types
│   ├── platform/                # platform interface + per-platform implementations
│   ├── core/                    # Rust core: document handles, index, links, conversion registry, sync state
│   ├── engine-text/             # CodeMirror 6: any text or code file; previews; language services
│   ├── engine-csv/              # light text-typed grid with dialect preservation
│   ├── engine-pdf/              # PDF.js viewer, annotations, page tools
│   ├── engine-office/           # adapter around the ONLYOFFICE frame (docx/xlsx/pptx)
│   ├── file-kit/                # sniffing, encoding, csv dialect, lock files
│   └── ui/                      # shared components and theme tokens
├── packs/                       # on-demand bundles: office, convert, terminal (built by script, not committed)
│   └── office/                  # pinned, pruned sdkjs + web-apps + x2t-wasm build
├── templates/                   # blank and starter files per format
├── tests/
│   ├── corpus/                  # sample files per format (small, committed)
│   ├── e2e/                     # Playwright: open → edit → save → reload
│   ├── perf/                    # startup, latency, memory and size budgets
│   └── flows/                   # one end-to-end test per user flow ID (see docs/flows)
│   └── fidelity/                # Python harness: validate, diff, render-compare
├── scripts/                     # fetch-vendor, build-engine, make-corpus
└── docs/
    ├── plans/
    └── research/
```

Engine packs are built by a pinned script instead of being committed, which keeps the repository small and keeps AGPL code out of the tree.
