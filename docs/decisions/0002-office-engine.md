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
- **A custom `office` protocol** in the Rust core serves the pack on its own origin (`http://office.localhost` on Windows). It refuses paths that leave the pack, sets a strict content security policy on every response (only the app may embed the editors; no network), serves the fallback font for dropped fonts, and injects the bridge script into the editor pages.
- **The bridge** (in `src-tauri/src/office.rs`) forwards app shortcuts typed inside the editor (Ctrl+K, Ctrl+W, Ctrl+Tab and others) to the app, reports document changes and load completion, resets the editor's modified state after the app saves, follows the app's light or dark theme, hides the editors' feature-tip pop-ups, and turns off the service worker.
- **The app side** (`src/engines/office/OfficeEditor.tsx`) sends the file's bytes to the editor, asks for bytes back on save, and keeps the app's save pipeline (atomic writes, version snapshots, recovery) in charge. Ctrl+S inside the editor saves through the same pipeline. Recovery copies are throttled to one conversion every 20 seconds.

## Security

- The editors run on a different origin from the app. The self-test checks from inside the editor frame that it cannot call any app command; on Linux the app's IPC object does not even exist there.
- Messages are accepted only from the app's own origin (the editors' `embedOrigin` setting, and checks on both sides).
- No document can make the editors load anything from the network: the pack's policy allows only its own files.

## Verification

- Browser end-to-end tests (`tests/e2e/office.mjs`, 7 flows): open each format in the editor; edit, unsaved state, Ctrl+S inside the editor saving through the app, and a second edit-and-save; Ctrl+K inside the editor opening the app's palette; export to PDF; closing an unsaved Office tab asks first.
- The real app's self-test opens each Office file in the editor, saves it, and runs the isolation probe. CI runs it on Windows.

## Known limits

- First open of an Office file starts the editor engine (WebAssembly compile); later files open quickly.
- Documents using Chinese, Japanese, Korean, Indic, Thai or other non-core scripts show those characters in a fallback font. Building the pack with `--fonts=all` includes every font (the installer grows by about 100 MB).
- The editors' own File menu still offers "Download as"; the app's Export (Ctrl+E) is the supported route.
- Euro-Office 9.3.5 is a release candidate; the pack version is pinned and upgraded deliberately.
