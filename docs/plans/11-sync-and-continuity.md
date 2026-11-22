# 11 — Using it across devices: sync and continuity

Status: draft for review · Last updated: 2026-11-21

Goal: the same files and the same working state on a Windows PC, an Android phone, a Mac and an iPhone or iPad, for one person, with no server to run and no recurring cost.

This reverses an earlier non-goal. Cloud sync was out of scope; cross-device use is now a requirement. Real-time collaboration with other people remains out of scope.

Research caveat: every primary source for this area was unreachable, so all findings rest on search summaries and background knowledge. The spikes at the end exist to replace assumption with evidence.

## The approach in one paragraph

**The app does not sync files itself, at least at first. It works on files inside a folder that something else keeps in sync, and it is built to behave well there.** Your documents stay ordinary files in an ordinary folder. A small hidden folder beside them carries the app's own state between devices. A built-in connector to one cloud service is added later only if the folder approach proves inadequate on phones.

Why not build a sync service: it needs a server, an account system and encryption work, and it would put your files in a private store, which is the opposite of the "ordinary files you control" principle. Why not a real-time sync engine: those are mature in 2026 but solve multi-user editing of structured data, which is not the problem here.

## What works on each platform

| Platform | A synced folder the app can open | Practical choice |
|---|---|---|
| **Windows** | Yes. OneDrive, Dropbox and Google Drive all present normal folders | Any of them; OneDrive is already there |
| **macOS** | Yes. iCloud Drive, OneDrive, Dropbox, Google Drive | Any |
| **Android** | **Not reliably.** Cloud apps generally do not hand other apps a dependable writable folder tree | A real local folder kept in sync by a companion tool (the pattern Obsidian documents for Android) |
| **iOS / iPadOS** | **Only iCloud Drive is dependable** for opening a whole folder. Support from OneDrive, Google Drive and Dropbox is doubtful and unverified | iCloud Drive, or a built-in connector |

Two things follow:

- **iCloud is a poor bridge to Windows.** iCloud for Windows is widely reported to duplicate and corrupt files in app folders. A setup that spans Windows, Android and Apple devices should not rest on iCloud alone.
- **No single consumer cloud folder works well on all four platforms for third-party apps.** This is the central difficulty, and why a built-in connector is likely needed by the Apple stage.

## When this is built

**Decided on 2026-11-22: the cloud and sync work comes at the end**, as its own release after the app runs on Windows, Android and Apple devices (Release 4 in `03-roadmap.md`). The choice of cloud is made then, with all devices in hand.

| Stage | When | What is built |
|---|---|---|
| **0** | Now, in the design, and in the first Windows phase | Stable file identifiers; relative links; document handles; safe saves; caches and indexes kept out of the documents folder. These cost little now and are painful to retrofit |
| **—** | Windows, Android and Apple releases | **No sync features.** The app is complete on each device; files move between devices however you already move them |
| **1** | Release 4 | Good behaviour inside synced folders on desktop; the state folder; per-device sessions; "Continue from…"; QR hand-off; conflict handling |
| **2** | Release 4 | The route for phones: local folder plus companion tool on Android, iCloud Drive on iOS, or one built-in connector for both |
| **3** | Release 4, if needed | A built-in connector so the app syncs a chosen folder itself on every platform |

One consequence to accept: until Release 4, opening a file on the phone that you edited on the PC means getting it there yourself. If the app happens to be pointed at a folder your cloud already syncs on the desktop, that works without any special support, because the app saves safely from the start.

**Choosing the connector**, for a single-user app:

| Service | Friction for a personal app |
|---|---|
| Dropbox | Lowest. No review needed for small user counts |
| Microsoft OneDrive (Graph) | Low. Self-service registration; change tracking built in |
| Google Drive | Highest. Unverified apps show a warning and full-drive access is a restricted permission |
| WebDAV / Nextcloud | Simple protocol; you host it |

Dropbox or OneDrive first; Google last.

**Companion tools on Android:** a folder-sync app for your cloud provider, or Syncthing for direct device-to-device sync with no cloud. Syncthing's Android situation is unsettled: the official app was discontinued in 2024 and the main fork changed hands in late 2025 with some trust concerns, though it still has active releases. A cloud-provider sync app is the lower-risk default.

## Being a good citizen in a synced folder

What this requires. Safe saves and reload-on-change are built in the first Windows phase; the rest waits for Release 4:

- **Safe saves** that sync tools handle cleanly: write a temporary file and rename it over the original.
- **Placeholder awareness.** Cloud folders show files that are not downloaded yet. Opening one triggers a download; the app shows progress instead of an error, and never indexes or snapshots a file in a way that forces thousands of downloads.
- **Adopt the provider's conflict copies.** When the sync tool creates "report (conflicted copy).docx", the app notices, groups it with the original and offers the conflict flow, instead of leaving a stray file.
- **Reload on external change**, already in the file pipeline.
- **Keep heavy and private data out of the synced folder:** search index, caches, engine packs and local snapshots live in the device's app-data folder.
- **Tolerate lag.** A file can be older than the state that refers to it; references are by identifier and fail softly.

## App state: what travels and how

A hidden folder at the root of the synced workspace (called `.app/` here) carries state. The design rule that prevents conflict storms: **every file in it has exactly one writer.**

| State | Travels? | Where and how |
|---|---|---|
| Documents | Yes | The ordinary files |
| Settings, keybindings, templates, snippets | Yes | Small text files in `.app/`; merged key by key |
| Open tabs and session | Yes, per device | One file per device, written only by that device. Other devices read it to offer "continue from PC" |
| Recent files, reading and cursor positions | Yes, per device | Same per-device file; merged for display by latest time |
| PDF annotations | Yes | In the PDF itself as standard annotations. A sidecar keyed by annotation id is the fallback if concurrent edits prove common |
| Tags, links | Yes | Inside the documents (see `09-differentiators-and-interconnection.md`) |
| Search index, backlink index | No | Rebuilt on each device |
| Version snapshots | No | Local to each device; too large and too conflict-prone to sync |
| Engine packs, fonts, caches | No | Per device |
| Signatures | Opt-in | Encrypted, because it is sensitive |

The cautionary example is Obsidian, where a shared workspace file written by every device produced thousands of duplicate conflict files for some users.

## Conflicts: the same file edited on two devices

No silent overwrites, ever.

| File type | Policy |
|---|---|
| Text, Markdown, code | **Three-way merge** against the last synced version, which the app keeps. Non-overlapping edits merge automatically; overlapping ones open a compare view |
| CSV, settings (JSON) | Merge by row or by key where possible; otherwise as text |
| docx, xlsx, pptx | **Cannot be merged.** Keep both, name the second with device and time, show a banner, and open the format's compare view where one exists. Word's co-authoring depends on Microsoft's servers and is out of reach |
| PDF | Keep both; annotations from both sides can be combined because each has an identity |

Prevention is better than resolution:

- A lightweight **"open on another device" hint** from the per-device session files: if the PC's session shows the file open with unsaved changes, the phone says so before you edit.
- Sync on open and on save, so the window for a conflict is small.

## Continuity: picking up where you left off

Platform hand-off features do not span your four devices:

| Feature | Reality |
|---|---|
| Apple Handoff | Apple devices only |
| Windows cross-device resume | Android to PC only, and needs Microsoft's approval per app |
| Android cross-device SDK | Still a developer preview |

So the portable design is the app's own:

- **"Continue from…"** on the home screen: recent files from your other devices with a device badge, opening at the same position. Driven by the per-device session files.
- **Deep links.** The link format from `09-differentiators-and-interconnection.md` opens a specific file at a specific place on any device.
- **QR hand-off.** The desktop shows a code for the current file and position; the phone scans it and opens the same place. Works with no platform support at all.
- **Inbox.** The phone's share sheet and a quick-note shortcut drop text, links, photos and scans into an inbox folder that is waiting on the desktop.
- **Handoff on Apple devices** is added on top, since it is free there.

## Mobile realities to design for

- **No continuous background sync.** Android limits background work to roughly fifteen-minute intervals and manufacturers kill it further; iOS gives minutes at unpredictable times. The app syncs when opened and when saving, and says when it last synced.
- **Storage.** Phones cannot hold everything. Files download on demand, with "keep on this device" for chosen folders.
- **Cellular data.** Large downloads wait for Wi-Fi by default.
- **Being killed.** The app may be terminated at any time; every edit is saved locally first.

## Privacy

- With a consumer cloud folder, the provider can read your files. That is the same as using that cloud today.
- With a built-in connector, optional end-to-end encryption of a chosen folder, with the key shared between devices by QR code. It costs the ability to view those files in the provider's own web interface.
- Sensitive app state (signatures) is always encrypted before it enters the synced folder.

## Risks

| Risk | Response |
|---|---|
| No cloud folder works well for third-party apps on all four platforms | Decide with all devices in hand; built-in connector if needed; spikes at the start of Release 4 |
| Conflict copies pile up and confuse | Adopt and group them; three-way merge for text; hints to prevent them |
| Shared state files cause conflict storms | One writer per file |
| Cloud placeholders trigger mass downloads | Index and snapshot only downloaded files |
| Background sync is unreliable on phones | Sync on open and save; show last-synced time |
| The Android companion-tool landscape shifts | Do not depend on one tool; the app only needs a folder |
| Sync was researched without primary sources | The spikes below, run on your actual devices and cloud |

## Decision deferred

**Which cloud to build around** is decided at the start of Release 4, not now. Nothing in the earlier releases depends on the answer.

## Additional spikes

| # | Question | Experiment |
|---|---|---|
| S25 | Does the save strategy behave in each cloud folder on Windows? | Save, rename and edit quickly inside OneDrive, Dropbox and Google Drive folders; look for duplicates and lock errors |
| S26 | What do real conflict copies look like per provider? | Edit the same file offline on two devices; record the naming so the app can recognise it |
| S27 | Can the Android app get a lasting, writable folder from any cloud app? | Try each provider through the system folder picker; then the companion-tool route |
| S28 | Which iOS file providers allow opening a whole folder? | iCloud Drive, OneDrive, Dropbox, Google Drive on a real iPhone |
| S29 | Does three-way merge on text behave? | Scripted concurrent edits to Markdown and code |
| S30 | Does the per-device state layout stay conflict-free? | Three devices writing sessions for a week |
