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
- **Saving** cannot replace a document by renaming, so the file is rewritten in place — and the previous content is always kept as a version first. If the current content cannot be read first, nothing is overwritten. The file is cut to the new length even with storage providers that ignore the request to truncate.
- **Changes by other apps**: Android documents cannot be watched, so open documents are re-checked each time the app comes back to the front; an unchanged tab reloads, an edited one shows the conflict banner.
- **Shared text** (not a file) becomes a new note in the app's own storage.
- Document addresses (`content://`) work only on Android; on desktop the core refuses them, and documents can never name one in a link.

## Why no Office editing on phones yet

The Office pack is 233 MB and its editors are built for a mouse and a wide screen. The plan (`plans/12-platforms-and-mobile.md`) starts phones with view and light edits. Next steps: try the pack in the Android WebView on a tablet, and a download-on-demand pack instead of bundling it.

## Build and install

- CI (`.github/workflows/android.yml`) builds an APK for arm64 phones and x86_64 emulators on GitHub's Linux runners, signs it, and uploads it with SHA-256 checksums as the `productivity-android` artifact.
- Signing: with repository secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS` set, every build is signed with that key and installs over the previous one. Without them each build gets its own key, so installing a newer build means uninstalling the old one first (app data is lost).
- Install: download the APK on the phone, allow installs from that source when Android asks, open it.

## Review (2026-11-22)

An independent review of the Android code against the Tauri, file-system plugin and WebView sources found, and this build fixes:

| Finding | Fix |
|---|---|
| Every save would fail: Android's IPC sends binary data as a JSON array of numbers | The core accepts both forms (unit test) |
| A second picker opened before the first returned left the first request waiting forever | One picker at a time, in the plugin and the interface |
| Slow storage (Drive) could stall all commands | File checks and saves for Android documents run off the command thread |
| Save went ahead when the previous content could not be kept | Save is refused instead |
| Providers that ignore truncation could leave an old tail | The file is cut to length after writing |
| Other apps' changes went unnoticed | Re-checked when the app returns to the front |
| Another app could hand the app its own private files ("confused deputy") | The app's own document addresses are refused; its file provider shares only an empty folder |
| Files shared for viewing looked editable | Write permission is checked per document |
| Huge shared files | Reads are capped at 300 MB |

## Known gaps

- Not yet run on a real phone in this session: the APK is built in CI, but there is no Android emulator here. The first manual check is to open, edit and save a Markdown file from Downloads and from Google Drive.
- No Office editing; no folders.
- Files shared once by another app ("Open with") cannot be reopened from Recent after a restart (Android grants them temporarily).
- Persisted document permissions are not released when files leave Recent (Android keeps up to 512).
- Cloud providers that report upload failures only when the file is closed can make a failed save look successful; the version kept before the save still has the previous content.
