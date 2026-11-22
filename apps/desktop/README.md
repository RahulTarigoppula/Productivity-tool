# Productivity — Windows desktop app (v0.1) and Android app (first build)

One calm, local app for every kind of file. This is Release 1 (Windows) from `docs/plans/03-roadmap.md`: phases **W1** (shell, text and code, CSV), **W2** (PDF) and **W3** (Word, Excel and PowerPoint editing), and parts of **W4** (search, links, export, version history).

## Install

Download from the repository's **Releases** page (or the **Actions → Windows build** artifacts):

| File | What it is |
|---|---|
| `Productivity_0.1.0_x64-setup.exe` (about 60 MB) | **Recommended.** Everything, including Word, Excel and PowerPoint editing. Installs for your user only (no admin prompt), adds a Start menu entry, registers "Open with" for Markdown, text, CSV, PDF, config and Office files, and has an uninstaller. Installs the WebView2 runtime if a machine lacks it (Windows 11 already has it). |
| `Productivity_0.1.0_x64-portable.exe` (about 8 MB) | No install. A single exe you can run from anywhere; needs the WebView2 runtime, which Windows 11 includes. Word, Excel and PowerPoint open as read-only previews (the Office editors come with the installer). Settings and version history are kept in `%APPDATA%\com.rahul.productivity`. |

The installer is not code-signed, so Windows SmartScreen shows "Windows protected your PC" the first time. Choose **More info → Run anyway**.

### Android (first build)

Download `Productivity_0.1.0_android.apk` from **Actions → Android build → productivity-android** on your phone, open it and allow installs from that source when asked. Text, code, Markdown, CSV and PDF are editable; Word, Excel and PowerPoint open as previews. Files come from Android's own document picker (Downloads, Drive and other storage apps) and stay accessible from Recent after a restart; "Open with" and "Share" from other apps work. Details and gaps: [decision 0003](../../docs/decisions/0003-android.md).

## What works

**Every file in tabs, one window.** Open from the file picker, drag and drop, "Open with", the command line, recent files or the palette. Double-clicking another file while the app is open adds a tab to the same window. Unchanged Office and PDF tabs left in the background release their memory and reload when you come back to them.

| Format | What you can do |
|---|---|
| **Markdown** | Live formatting as you type (headings, bold, italic, links, task checkboxes, quotes, code blocks, images), optional side-by-side preview, formatting toolbar and shortcuts, outline, word count, Ctrl+click links to open other files at a heading |
| **Text and code** | Any text file. Syntax highlighting for 100+ languages (by file name or `#!` line), multi-cursor, find and replace with regex, folding, bracket matching, auto-indent, indentation detection, word wrap toggle, language picker |
| **CSV / TSV** | Spreadsheet-style grid: edit cells, keyboard navigation, insert and delete rows and columns, sort, filter, copy and paste with Excel, undo and redo, sum/average/count of the selection, header row toggle, open as plain text |
| **PDF** | Continuous scrolling, zoom, text selection, find, page thumbnails, bookmarks in the outline; highlight, text boxes and drawing; drawn or typed signatures; rotate, delete, reorder (drag thumbnails), extract and insert pages; password-protected files |
| **Word, Excel, PowerPoint** | **Full editing** with the embedded Euro-Office editors (based on ONLYOFFICE), entirely offline: styles, tables, images, comments, track changes, formulas, charts, pivot tables, slides, notes and the rest of a full office suite. Saves go through the app's safe-save pipeline with versions and recovery; Ctrl+S inside the editor works. Export to PDF, OpenDocument, RTF, TXT or CSV. Without the Office pack (portable exe) they open as read-only previews |
| **Images, binary files** | Image viewer with zoom; binary files as a hex view |

**Never lose work**

- Saves are atomic: a temporary file is written and flushed, then swapped in, so a crash can never leave a half-written file.
- Text, Markdown, code and CSV **auto-save** shortly after you stop typing. PDFs save when you press Ctrl+S.
- **Files you don't edit are not changed.** Encoding (UTF-8, UTF-8 with BOM, UTF-16, Windows-1252), byte-order marks and line endings (CRLF/LF) are detected and kept, so opening and saving a file changes zero bytes. CSV rows you don't touch are written back exactly as they were, including their original quoting.
- **Version history**: before a save overwrites a file, the previous content is kept privately (the very first copy is always kept as the original). Open the history by clicking the save state in the status bar; restore or open any version as a copy.
- **Crash recovery**: unsaved changes are written to recovery storage as you work and restored on the next launch. Quitting never asks "save changes?".
- **Changes from other programs**: a clean tab reloads automatically; a tab with unsaved edits shows a banner to load theirs or keep yours.

**Find anything**

- `Ctrl+K` opens the command palette: open tabs, recent files, files in the open folder, and every command. Prefixes: `>` commands, `#` search inside the folder's files, `:` go to line/page/row, `@` headings, `?` keyboard shortcuts.
- Open a folder to get a file tree with every file type, and full-text search across the folder (respects `.gitignore`).

**Export** (`Ctrl+E`) with an honest quality label on every format:

| From | To |
|---|---|
| Markdown | Web page, plain text, PDF (through the print dialog) |
| Text | PDF, web page |
| CSV / TSV | JSON, Markdown table, web page, TSV/CSV |
| JSON | CSV |
| PDF | PNG images (one per page), plain text |
| PNG / JPG | PDF |
| Excel | CSV (one file per sheet, values only) |
| Word | Markdown (headings and paragraphs) |
| PowerPoint | Markdown (slide text and notes) |

Conversions run through a registry that finds multi-step routes and labels the result by its weakest step (`src/lib/convert.ts`).

**Look and feel**: light, dark or follow Windows; comfortable or compact density; focus mode (`F11`); a layout that adapts down to phone width.

## Keyboard

| Action | Shortcut |
|---|---|
| Command palette / quick open | `Ctrl+K`, `Ctrl+P` |
| Commands only | `Ctrl+Shift+P` |
| New Markdown note | `Ctrl+N` |
| Open, Save, Save as | `Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S` |
| Export | `Ctrl+E` |
| Close tab, reopen closed tab | `Ctrl+W`, `Ctrl+Shift+T` |
| Last used tab, next/previous tab, tab 1–9 | `Ctrl+Tab`, `Ctrl+PgDn`/`PgUp`, `Ctrl+1…9` |
| Find in file, search in folder | `Ctrl+F`, `Ctrl+Shift+F` |
| Toggle sidebar, focus mode, settings | `Ctrl+\`, `F11`, `Ctrl+,` |
| Zoom | `Ctrl+=`, `Ctrl+-`, `Ctrl+0`, `Ctrl+wheel` |
| Markdown bold, italic, link, headings | `Ctrl+B`, `Ctrl+I`, `Ctrl+Shift+K`, `Ctrl+Alt+1…3` |

Everything else follows each format's usual keys (VS Code-style editing keys in text and code; spreadsheet keys in the CSV grid).

## Security and privacy

Documents are untrusted: you may open a file someone sent you. v0.1 was audited for what a malicious file could do, and these protections are in place (each has an automated test):

- **No network access from documents.** Images and links inside a document are followed only by relative path. Network shares (`\\server\share`), `//host` and `file:` references are refused, so opening a file can never make Windows send your credentials to another computer. Remote images are never loaded, so a document cannot report that you opened it. Nothing in the app phones home.
- **No code from documents.** A strict content security policy forbids scripts other than the app's own. Rendered Markdown and Word previews are sanitised: no scripts, forms, styles, frames or event handlers. Embedded HTML inside Word files is not rendered. PDF.js runs without scripting or `eval`.
- **The window cannot be taken over.** The app window only ever shows the app itself; links and forms in documents cannot navigate it. Web links open in your browser.
- **"Open in default app" never runs programs.** Executables, scripts, shortcuts and installers (`.exe`, `.bat`, `.ps1`, `.lnk`, `.url`, `.hta`, `.msi` and similar) are refused, as are files on network shares.
- **Office documents are isolated.** The Word, Excel and PowerPoint editors run on origins separate from the app and from each other (one per tab), cannot call the app's commands, cannot navigate the window or open pop-ups, and run no macros or plugins. Shortcuts typed inside an editor reach the app only from the visible tab.
- **Hostile files cannot hang or exhaust the app.** Markdown is rendered in a background worker with a time limit; pathologically nested Markdown is shown as plain text; Office previews cap unpacked size, rows, columns and cells.
- **Build pipeline.** GitHub Actions runs read-only by default, every third-party action is pinned to an exact commit, and each build publishes SHA-256 checksums of the downloads.

Dependency scans: `pnpm audit --prod` reports no known vulnerabilities. `cargo audit` reports no vulnerabilities, only six "unmaintained" or "unsound" warnings, all in crates that are Linux-only (GTK) or used only at build time and are not part of the Windows app.

Not yet done: code signing (so Windows shows "unknown publisher"), and limiting which files the app's core may write to (today any script running inside the app could reach any file; the protections above exist so that no document can run script there).

## Known gaps in v0.1

These are planned; none is hidden from the user in the app.

| Gap | Planned in |
|---|---|
| Office documents in Chinese, Japanese, Korean, Indic or other non-Latin scripts use a fallback font (the pack ships a core font set) | Optional full-font pack |
| The first Office file of a session takes longer to open (the editor engine starts) | W6 |
| Markdown ↔ Word conversion, PDF → Word | Convert pack (Pandoc) |
| Language servers, terminal, git panel, minimap | W5 — light workbench |
| PDF: annotation list panel, highlight colours, sticky-note comments, certificate signatures | W2 follow-up / later |
| Printing PDFs goes through page images | Later |
| Office lock files: the app warns when Microsoft Office has the file open, but does not create its own lock file | W6 |
| Saved signatures are stored as plain images in the app's data folder (planned: encrypted) | W6 |
| Native Mica title bar and Snap Layouts flyout (uses the standard Windows title bar) | W6 |
| Code signing (SmartScreen warning on first run) | Optional |
| Not yet exercised by hand on a Windows machine; performance budgets not yet measured there | First run on your PC |

## Build and test

Requirements: Node 22, pnpm 10, Rust (stable). On Windows: the WebView2 runtime and Visual Studio Build Tools (C++).

```bash
cd apps/desktop
pnpm install
pnpm tauri dev          # run the app with live reload
pnpm tauri build        # Windows: installer in src-tauri/target/release/bundle/nsis/
```

Cross-compiling the Windows build from Linux (used during development; CI builds natively on Windows):

```bash
sudo apt install nsis mingw-w64
rustup target add x86_64-pc-windows-gnu
pnpm tauri build --target x86_64-pc-windows-gnu
```

Tests:

| Command | What it checks |
|---|---|
| `pnpm test` | Unit tests: text codec byte round trips, CSV preservation, paths and document-reference safety, fuzzy matching, conversion routing, PDF page tools, Office preview limits (54 tests) |
| `cd src-tauri && cargo test` | Rust: atomic writes (including symlinks and permissions), folder listing and search, version snapshots and pruning, recovery and state storage, refusal to open programs or network files (12 tests) |
| `pnpm build && pnpm preview --port 4173 & pnpm e2e` | 35 end-to-end flows in Chromium: user flows named after `docs/flows/`, regression checks from code review, and security checks (hostile Markdown, nesting bombs). Fails on any outbound network request |
| `pnpm office-pack`, then `node tests/office-server.mjs & pnpm preview --port 1420 & pnpm e2e:office` | Builds the Office pack, then runs 7 Office editing flows: open each format in the editor, edit and save (including Ctrl+S inside the editor and a second save), shortcuts forwarded from the editor, export to PDF, close with unsaved changes |
| `PRODUCTIVITY_SELF_TEST=<folder> <app exe>` | Self-test of the real app: exercises the file system bridge (binary, Unicode paths, byte-identical saves, versions, recovery, search), opens every sample file in the folder through the interface with timings, writes `selftest-report.json`, then exits. CI runs it on Windows against the built exe |

GitHub Actions (`.github/workflows/windows.yml`) runs the unit and Rust tests, builds the installer and portable exe on Windows, runs the end-to-end flows on Linux, and publishes a release when a `v*` tag is pushed. `.github/workflows/android.yml` builds and signs the Android APK and runs it on an emulator (launch, Open with, and the app's self-test).

To publish a release: set the version in `src-tauri/tauri.conf.json`, commit, then `git tag v0.1.0 && git push origin v0.1.0`. The Windows workflow attaches the installer, the portable exe and `SHA256SUMS.txt` to the release. For Android updates that install over the previous version, add the signing secrets described in [decision 0003](../../docs/decisions/0003-android.md).

## How it is built

```
apps/desktop/
├── src-tauri/src/        Rust core: files.rs (atomic save, list, search), store.rs (versions, recovery, state), lib.rs (commands, watcher, single instance)
├── src/platform/         The platform interface, with the Tauri implementation and an in-memory one for tests
├── src/app/              State, file actions, command registry, keyboard, export converters, editor contract
├── src/shell/            Tabs, toolbar, status bar, home, palette, sidebars, dialogs
├── src/engines/          text (CodeMirror 6), csv, pdf (PDF.js + pdf-lib), office (previews), media
├── src/lib/              Pure logic with tests: text codec, CSV model, paths, formats, fuzzy, conversion registry
└── tests/                Corpus generators, sample files, end-to-end flows
```

Every format plugs into the shell through one contract (`src/app/editor-api.ts`): bytes in, bytes out; engines never touch the disk. The interface never calls Tauri directly, only `src/platform`, which is what will let the same interface run on Android and Apple devices later.

Departures from the plan are recorded in `docs/decisions/0001-v0.1-implementation.md`; the Office engine and how it is isolated are in `docs/decisions/0002-office-engine.md`.

### The Office pack

`pnpm office-pack` builds `packs/office` from pinned, integrity-checked sources (Euro-Office editors and x2t from npm, fonts and the spelling dictionary from pinned git commits) and prunes it to about 233 MB. `pnpm tauri build --config src-tauri/tauri.office.conf.json` puts it in the installer. The app serves it on its own origin through the `office` protocol (`src-tauri/src/office.rs`) with a strict security policy; the editors cannot reach the app's file commands.
