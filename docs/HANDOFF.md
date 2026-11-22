# Handoff — Productivity v0.1 (Windows) and Android first build

Last updated: 2026-11-22 · Code: `apps/desktop` (one codebase for Windows and Android) · Branches: `main` (current) and `claude/productivity-tool-research-kowrt4` (same commit)

This page is the starting point for anyone picking the project up: how to get the apps, how people use them, how to build, test and release, how the code is laid out, and what is left.

---

## 1. Get the apps

### Windows (Release 1)

Built by GitHub Actions on every push to `main`: **Actions → Windows build → latest green run → Artifacts → `productivity-windows`**.

| File | Use it when |
|---|---|
| `Productivity_0.1.0_x64-setup.exe` (~60 MB) | **Recommended.** Installs for the current user (no admin prompt), Start menu entry, "Open with" for text, Markdown, CSV, PDF and Office files, uninstaller, and full Word/Excel/PowerPoint editing. |
| `Productivity_0.1.0_x64-portable.exe` (~8 MB) | No install, run from anywhere. Word/Excel/PowerPoint open as read-only previews. |
| `SHA256SUMS.txt` | Checksums to confirm a download is the file CI built. |

First run: the exe is not code-signed, so Windows SmartScreen says "Windows protected your PC". Choose **More info → Run anyway**. Settings, version history and recovery copies live in `%APPDATA%\com.rahul.productivity`; the app's own log is `logs\app.log` there (stays on the computer).

### Android (Release 2, first build)

**Actions → Android build → latest green run → Artifacts → `productivity-android`**: `Productivity_0.1.0_android.apk` (arm64 phones and x86_64 emulators). Copy it to the phone, open it, allow installs from that source. Without signing secrets (section 5) each build has its own signing key, so a newer build installs only after uninstalling the older one.

---

## 2. How people use it (usage flows)

The app is one window with tabs. Four things are always there: **tabs** at the top, **one toolbar** for the open file, the **document**, and a thin **status bar**. Everything else is one shortcut away: **Ctrl+K** finds any file or command.

### Start and create
1. Open the app → the **home screen**: a search box for recent files, **Create** cards (Note, Text or code, Table, and Document/Spreadsheet/Presentation in the installed app), **Open a file**, **Open a folder**, and **Recent**.
2. Choose **Note** → type. Formatting appears as you write (`# ` heading, `**bold**`, `- ` list, `- [ ] ` task, tables).
3. **Ctrl+S** the first time asks where to save. After that, text, notes, code and tables **save themselves** a moment after you stop typing (status bar: *Edited → Saving… → Saved*). PDFs and Office files save with **Ctrl+S**.

### Open
- **Ctrl+O**, drag files onto the window, double-click a file in Windows Explorer ("Open with"), or pick one from **Recent** / **Ctrl+K**.
- **Open a folder** (home screen or sidebar) to browse every file in it; **Ctrl+Shift+F** searches inside all of them.
- Android: **Open a file** uses Android's own picker (Downloads, Drive, other storage). Files shared from other apps ("Open with", "Share") open as tabs; shared text becomes a new note.

### Work with tabs
- Click a tab, **Ctrl+Tab** (last used), **Ctrl+PgUp/PgDn**, **Ctrl+1…9**. Drag tabs to reorder; middle-click closes.
- **Ctrl+W** closes; if there are unsaved changes it asks *Save / Don't save / Cancel*. **Ctrl+Shift+T** reopens the last closed tab in its old place.
- Right-click a tab for *Close*, *Close others*, *Close tabs to the right* (Cancel on a save question stops). *Show in folder* and *Copy file path* are in Ctrl+K.

### Notes (Markdown)
- Toolbar: headings, bold, italic, code, lists, task list, quote, link, table, divider, side-by-side preview.
- Tables show as real tables; click one to edit its text. Code blocks show a small language label.
- **Ctrl+click** a link to another file to open it (at a heading with `file.md#heading`). The sidebar's **Outline** lists headings.

### Tables (CSV)
- Double-click or **F2**/**Enter** to edit a cell; arrows move; **Ctrl+C/V** copies to and from spreadsheets.
- Toolbar or **right-click**: insert/delete rows and columns, sort A–Z/Z–A (blanks last), filter (**Ctrl+F**), **Header row** on/off. **Ctrl+Z/Y** undo/redo.
- Select cells to see sum, average and count in the status bar.

### PDFs
- Scroll, zoom, **Ctrl+F** find, page thumbnails (drag to reorder).
- **Highlight**, **Text** (text boxes), **Draw**, **Sign** (draw or type a signature, then click where it goes).
- **Rotate**, delete, extract or insert pages; *Undo page change* in the toolbar's More menu.
- **Ctrl+S** saves. Password-protected PDFs ask for the password.

### Word, Excel, PowerPoint
- Installed app: full editing inside the tab (ribbon, styles, formulas, charts, slides, comments, track changes). **Ctrl+S** inside the editor saves through the app (versions and recovery included).
- Portable exe and Android: read-only preview with zoom and Export. The banner says how to edit.
- **New** Document/Spreadsheet/Presentation from the home screen or Ctrl+K (installed app only).

### Export and print
- **Ctrl+E** lists every format the file can become, with a **Text only** label where formatting is lost (for example Markdown → plain text). The original file is never changed.
- **Print or save as a formatted PDF** opens the print window (choose *Save as PDF*).

### Safety nets
- **Version history**: click *Saved* in the status bar to see earlier versions of a file and restore one.
- **Crash recovery**: unsaved changes are copied in the background; after a crash or power cut they come back on the next start with *Save them / Discard them*.
- **Changed by another program**: if a file changes on disk while you have unsaved edits, a banner offers **Keep my version**, **Use the other version** or **Compare** (opens the other version read-only).
- A file whose content does not match its name (a damaged PDF, for example) opens as text with a note saying so.

### Find anything (command palette, Ctrl+K)
- Type a file name, or start with `>` for commands, `#` to search inside the open folder's files, `:` to go to a line/page/row, `@` for headings, `?` for shortcuts.

### Look and comfort
- **Settings** (Ctrl+, or the ⋯ menu): theme (System/Light/Dark), auto-save, format notes as I type, text size, line numbers and wrapping for code.
- **Focus mode** (F11): just the document; F11 or Esc to leave.
- The status bar's **Details** shows a file's language, text format, line endings and indentation.

### Keyboard summary

| Action | Keys |
|---|---|
| Find files and commands | Ctrl+K (Ctrl+P), commands only Ctrl+Shift+P |
| New note, open, save, save as | Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S |
| Export | Ctrl+E |
| Close, reopen closed tab | Ctrl+W, Ctrl+Shift+T |
| Switch tabs | Ctrl+Tab, Ctrl+PgUp/PgDn, Ctrl+1…9 |
| Find, search in folder | Ctrl+F, Ctrl+Shift+F |
| Sidebar, focus mode, settings | Ctrl+\, F11, Ctrl+, |
| Zoom | Ctrl+= / Ctrl+- / Ctrl+0 |
| Notes: bold, italic, link, headings | Ctrl+B, Ctrl+I, Ctrl+Shift+K, Ctrl+Alt+1…3 |

---

## 3. Build and run (developers)

Requirements: Node 22, pnpm 10, Rust stable. Windows builds need the MSVC toolchain (CI uses `windows-latest`); Android builds need JDK 17, the Android SDK and NDK (CI uses `ubuntu-latest`).

```bash
cd apps/desktop
pnpm install
pnpm dev                       # browser build with an in-memory file system, http://localhost:1420
pnpm tauri dev                 # the real desktop app (Rust core + window)
pnpm office-pack               # build the Office pack (pinned, integrity-checked; ~233 MB in packs/office)
pnpm tauri build --config src-tauri/tauri.office.conf.json   # installer + exe with Office editing
pnpm tauri build               # without the Office pack (previews only)
pnpm tauri android build --apk # Android (see .github/workflows/android.yml for the exact steps)
```

Note: a plain `cargo build --release` does not embed the interface (it points at the dev server). Use `pnpm tauri build`, or `cargo build --release --features tauri/custom-protocol`.

---

## 4. Test

| What | Command (in `apps/desktop`) | Count today |
|---|---|---|
| Unit tests | `pnpm test` | 63 |
| Rust tests | `cd src-tauri && cargo test --release` | 22 |
| End-to-end flows (browser build) | `pnpm build && pnpm preview --port 1420 &` then `APP_URL=http://localhost:1420/ pnpm e2e` | 46 |
| Office editing flows | `pnpm office-pack`, `node tests/office-server.mjs &`, then `pnpm e2e:office` | 10 |
| Real-app self-test (Windows/Linux) | `PRODUCTIVITY_SELF_TEST=<folder with tests/corpus files> productivity.exe` → writes `selftest-report.json` there | 23 checks |
| Real-app self-test (Android emulator) | `tests/android-smoke.sh <apk> <out-dir>` (needs USB debugging on) | 23 checks |

CI (`.github/workflows/`): **windows.yml** runs unit and Rust tests, builds the Office pack, the installer and portable exe, runs the self-test in real WebView2, and runs all end-to-end and Office flows on Linux. **android.yml** builds and signs the APK and runs the emulator smoke test and self-test on Android 15. Both passed on the latest code (commit `cd3ab8d`).

Flows named `D-*`, `U-*`, `R-*`, `P-1` are regression guards for bugs found in review (data loss, journeys, performance); keep them green.

### Manual check on real hardware (not yet done)
1. Windows 11 PC: install the setup exe; open, edit and save a note, a CSV, a PDF (highlight + sign), a Word file; close with unsaved changes; kill the app mid-edit and restart (recovery); open a file from a network share.
2. Android phone: install the APK; open a Markdown file from Downloads and from Google Drive, edit, save, restart the app and reopen from Recent; share text from another app; open a PDF.
3. Note anything slow, confusing or broken in `docs/plans/05-risks-and-open-questions.md` or an issue.

---

## 5. Release

1. Set the version in `apps/desktop/src-tauri/tauri.conf.json` (and `package.json`), commit.
2. Tag and push: `git tag v0.1.0 && git push origin v0.1.0`. The Windows workflow builds and tests, then a separate tag-only job attaches the installer, portable exe and `SHA256SUMS.txt` to a GitHub Release.
3. Android updates that install over the previous version need a stable signing key. Create one once and add three repository secrets: `ANDROID_KEYSTORE_B64` (base64 of the .jks), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`. Keep the keystore safe; losing it means users must reinstall.
4. Optional: code-sign the Windows exe to remove the SmartScreen warning.

Before shipping the installer with Office editing: review the Euro-Office/ONLYOFFICE AGPL-3.0 terms, including any additional terms on names and logos; their notices ship inside the Office pack and the About box credits them.

---

## 6. How the code is organised

```
apps/desktop/
  src/                      interface (React + TypeScript)
    shell/                  window: tabs, toolbar, status bar, home, sidebar, palette, dialogs, error boundaries
    app/                    state (store.ts), actions (open/save/close/recovery/session), commands, keys, export
    engines/                one per format: text (CodeMirror 6 + live Markdown), csv, pdf (PDF.js + pdf-lib), office
    platform/               tauri.ts (real app, incl. Android) and browser.ts (in-memory, for tests)
    lib/                    paths, text codecs, CSV, conversion registry
  src-tauri/
    src/lib.rs              commands (read/write/list/search/state/snapshots/recovery/watch), window, IPC guard
    src/files.rs store.rs   atomic writes, folder listing and search; versions, recovery, local log
    src/office.rs           serves the Office pack on per-tab origins, bridge script, strict CSP
    src/uri.rs android.rs   Android documents (content://) and the document picker plugin bridge
    gen/android/            Android project (DocumentsPlugin.kt: picker, Open with, shared text)
  scripts/                  build-office-pack.mjs (pinned sources), copy-assets.mjs
  tests/                    corpus, e2e flows, office flows, Android smoke script
```

Key rules the code follows:
- **Bytes in, bytes out**: every engine gets the file's bytes and returns bytes on save; the shell owns saving (atomic write, version snapshot, recovery). Unedited files are never rewritten.
- **Documents are untrusted**: strict CSP (no inline scripts), links and images only by relative path inside the same drive/share, no network, Office editors on separate origins per tab with no access to app commands, macros off.
- **Never lose work**: saves queue per tab; an edit counter decides "still unsaved"; recovery copies run in order; failed saves stay unsaved.

Design and decisions: `docs/plans/` (vision, architecture, UX, roadmap), `docs/flows/` (user flow maps), `docs/decisions/0001–0004` (what was built and why, security audits, review rounds).

---

## 7. Known gaps and next steps

| Area | Gap | Where planned |
|---|---|---|
| All | Not yet used on real hardware | Section 4 checklist |
| Windows | Exe not code-signed; native Mica title bar; Markdown ↔ Word conversion; language servers/terminal (light workbench) | W5–W6, convert pack |
| Android | Office files are previews only; no folders; very old system WebViews may not draw PDF pages; files shared once cannot be reopened after a restart | `docs/decisions/0003-android.md` |
| Office | Non-Latin scripts use a fallback font in the core pack (`--fonts=all` adds them); release-candidate editors pinned | `docs/decisions/0002-office-engine.md` |
| Next phase | Phase 3: macOS and iOS; Release 4: sync across devices | `docs/plans/03-roadmap.md`, `12-platforms-and-mobile.md`, `11-sync-and-continuity.md` |
