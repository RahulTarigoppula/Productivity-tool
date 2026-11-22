# 0002 — Office editing with the Euro-Office (ONLYOFFICE) editors, offline

Date: 2026-11-22 · Status: accepted

## Spike S1 result

Spike S1 from `plans/03-roadmap.md` asked whether the ONLYOFFICE client-side stack can run inside the app with no server, open Word, Excel and PowerPoint files from bytes, and give edited bytes back. **It can.**

| Check | Result |
|---|---|
| Source | `@kreijstal/eurooffice*` 9.3.5-rc.1.build.1 on npm (AGPL-3.0): Euro-Office's editors taken from its Document Server package, the Ranuts/document embedding shell, and the x2t converter built from source as WebAssembly. Fonts from Ranuts/document at a pinned commit (the npm font packages are not published) |
| Open from bytes, edit, save | Word, Excel and PowerPoint all round-trip. Typed text, cell values and slide text appear in the saved files; formulas, headings and speaker notes are kept |
| Separate origin | Works with the editors on their own origin, which isolates them from the app's file commands |
| Without a service worker | Works (the app serves every file itself) |
| Strict content security policy | Works with `default-src 'self'` plus `'unsafe-eval'` and `'wasm-unsafe-eval'` for the editors' scripts; no remote loads |
| Export | Word → PDF, ODT, RTF, TXT; Excel → PDF, CSV, ODS; PowerPoint → PDF, ODP. HTML and EPUB failed and are not offered |
| Change tracking | The editors' "modified" event fires only once per document, so the app uses the editor's own `isDocumentModified()` and `SetUnchangedDocument()` through a small bridge script |

## How it is built into the app

- **The Office pack** is built by `apps/desktop/scripts/build-office-pack.mjs` from pinned, integrity-checked sources and pruned: no website pages, other languages, phone interfaces, Visio or PDF editors, Internet Explorer fallbacks or source maps, and a "core" font set (Latin, Greek, Cyrillic, symbols; 41 MB instead of 185 MB). Fonts for other scripts are replaced by DejaVu Sans when a document asks for them. The pack is 233 MB on disk.
- **The installer includes it** (59 MB download with everything). The portable exe does not, and shows Office files as read-only previews; a pack folder named `office` next to the portable exe also works.
- **A custom `office` protocol** in the Rust core serves the pack, giving **every editor tab an origin of its own** (`office://<tab>.localhost`; `http://office.<tab>.localhost` on Windows and Android). It refuses paths that leave the pack, sets a strict content security policy on every response (only the app may embed the editors; no network), serves the fallback font for dropped fonts, and injects the bridge script into the editor pages.
- **The bridge** (in `src-tauri/src/office.rs`) forwards app shortcuts typed inside the editor (Ctrl+K, Ctrl+W, Ctrl+Tab and others) to the app, reports document changes and load completion, resets the editor's modified state after the app saves, follows the app's light or dark theme, hides the editors' feature-tip pop-ups, and turns off the service worker.
- **The app side** (`src/engines/office/OfficeEditor.tsx`) sends the file's bytes to the editor, asks for bytes back on save, and keeps the app's save pipeline (atomic writes, version snapshots, recovery) in charge. Ctrl+S inside the editor saves through the same pipeline. Recovery copies are throttled to one conversion every 20 seconds.

## Security

A separate security review of the integration (2026-11-22) found that all editor tabs shared one origin, so a script in one document's editor could reach another tab's editor and save over that file. Fixed, with the other findings:

| Finding | Fix |
|---|---|
| Editor tabs could reach each other (high) | One random origin per tab; checked by the self-test and end-to-end flow O-9 |
| Background editor could trigger app shortcuts | Accepted only from the visible tab, only the keys the bridge forwards, at most 8 a second |
| Editor frame treated as the app's own origin by Tauri; IPC object injected into frames on Windows | Per-tab hosts are not "local" to Tauri; every app command also refuses requests whose Origin is an editor page; the editors' policy blocks the IPC endpoint; the self-test reports a hung IPC call separately |
| Document macros could run code after one prompt | Macros and plugins disabled in the pack's editor configuration at build time (the build fails if the patch does not apply) |
| Editor could navigate the window or open pop-ups | Sandboxed iframe without top navigation or pop-ups; the window's navigation filter stays |
| Hostile file sizes | Files from the editor capped at 512 MB; the document is sent once |
| Dev origin and pack location from an environment variable in release builds | Debug builds only |

- Messages are accepted only from the app's own origin (the editors' `embedOrigin` setting, and checks on both sides).
- No document can make the editors load anything from the network: the pack's policy allows only its own files.
- Path traversal into or out of the pack was tested with encoded, doubled and Windows-style paths: all refused.
- Remaining: the pack's sources are pinned and integrity-checked at build time, but the pack is not re-verified when it is loaded; the npm packages come from a single maintainer's unofficial build.

## Verification

- Browser end-to-end tests (`tests/e2e/office.mjs`, 9 flows): open each format in the editor; edit, unsaved state, Ctrl+S inside the editor saving through the app, and a second edit-and-save; Ctrl+K inside the editor opening the app's palette; export to PDF; closing an unsaved Office tab asks first; a new Word document; isolation between tabs and refusal of forged shortcuts.
- The real app's self-test opens each Office file in the editor, saves it, and runs the isolation probe. CI runs it on Windows.

## Known limits

- First open of an Office file starts the editor engine (WebAssembly compile); later files open quickly.
- Documents using Chinese, Japanese, Korean, Indic, Thai or other non-core scripts show those characters in a fallback font. Building the pack with `--fonts=all` includes every font (the installer grows by about 100 MB).
- The editors' own File menu still offers "Download as"; the app's Export (Ctrl+E) is the supported route.
- Euro-Office 9.3.5 is a release candidate; the pack version is pinned and upgraded deliberately.
