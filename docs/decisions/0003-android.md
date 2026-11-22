# 0003 — Android app (Phase 2), first build

Date: 2026-11-22 · Status: accepted

## What it is

The same app as on Windows — same interface, engines and Rust core — built for Android with Tauri's Android target. One codebase: `apps/desktop` builds both.

| Area | Android v0.1 |
|---|---|
| Text, code, Markdown | Full editing (CodeMirror works with touch) |
| CSV and TSV | Full editing |
| PDF | View, search, page tools, save |
| Word, Excel, PowerPoint | Read-only previews (the Office pack is not in the APK; see below) |
| Export, version history, crash recovery, palette | As on Windows |
| Folders, folder search, "Show in folder" | Not available (hidden) |

## Files on Android

Android gives apps documents, not paths. A small plugin in the app (`gen/android/.../DocumentsPlugin.kt`) uses the system document picker (Storage Access Framework):

- **Open** uses `ACTION_OPEN_DOCUMENT` and keeps read and write permission across restarts, so Recent files keep working and Save writes back to the same file.
- **Save As and Export** use `ACTION_CREATE_DOCUMENT`.
- **Open with / Share** from file managers, mail and chat apps: the app registers for text, Markdown, CSV, JSON, XML, HTML, PDF and Office types; files arrive when the app comes to the front.
- **Names**: Android reports each document's display name; the app remembers it per document address, so tabs, Recent and file types show the real name.
- **Saving** cannot replace a document by renaming, so the file is rewritten in place — and the previous content is always kept as a version first, so a failed save loses nothing.
- Document addresses (`content://`) work only on Android; on desktop the core refuses them, and documents can never name one in a link.

## Why no Office editing on phones yet

The Office pack is 233 MB and its editors are built for a mouse and a wide screen. The plan (`plans/12-platforms-and-mobile.md`) starts phones with view and light edits. Next steps: try the pack in the Android WebView on a tablet, and a download-on-demand pack instead of bundling it.

## Build and install

- CI (`.github/workflows/android.yml`) builds an APK for arm64 phones and x86_64 emulators on GitHub's Linux runners, signs it, and uploads it with SHA-256 checksums as the `productivity-android` artifact.
- Signing: with repository secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS` set, every build is signed with that key and installs over the previous one. Without them each build gets its own key, so installing a newer build means uninstalling the old one first (app data is lost).
- Install: download the APK on the phone, allow installs from that source when Android asks, open it.

## Known gaps

- Not yet run on a real phone in this session: the APK is built in CI, but there is no Android emulator here. The first manual check is to open, edit and save a Markdown file from Downloads and from Google Drive.
- The back button closes the app instead of going back through dialogs and tabs.
- No Office editing; no folders; no file-change detection for documents changed by other apps while open.
