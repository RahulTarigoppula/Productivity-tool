# 12 — Platforms: Windows, then Android, then Mac and iOS

Status: draft for review · Last updated: 2026-11-21

The release order is fixed: **Windows desktop → Android → macOS and iOS/iPadOS.** This document sets the one-codebase strategy that makes that possible, what each platform changes, and what phones honestly can and cannot do. Nothing here was tested on a device; the spikes at the end do that.

## One codebase, four platforms

| Layer | Shared? | What it is |
|---|---|---|
| Interface | **Shared** | One TypeScript/React interface that adapts to window size |
| Engines | **Shared** | The same web-based engines for text, PDF, CSV and office formats |
| Core | **Shared** | One Rust core: files, index and search, conversion jobs, sync state |
| Shell | **Tauri v2 on every platform** | Uses each system's own webview; supports Windows, macOS, Linux, Android and iOS from one project |
| Platform glue | Per platform | File access, share sheet, pen input, OCR, printing — small native plugins behind the `platform` interface |

Roughly 90% of the code is shared this way (an estimate). Every alternative considered — Flutter, React Native, Compose Multiplatform, .NET MAUI, or fully native apps — still has to host a webview for the engines and adds a second interface stack on top, for an estimated 60–70% sharing.

**This settles the shell question from `08-performance-and-footprint.md`.** Electron does not run on phones, so it is no longer a candidate for the main line. Tauri is the shell; on Windows, the first target, its webview is Chromium-based, which is the low-risk case.

**The escape hatch.** Tauri's mobile support is younger than its desktop support, and no verified list of production apps shipping on it was found. Because every operating-system call goes through the `platform` interface, the mobile shell can be swapped for Capacitor or a thin native host without touching the interface or the engines.

## Decisions that change because of phones

| Earlier decision | Now | Why |
|---|---|---|
| Electron or Tauri, by OS | **Tauri everywhere** | Only Tauri reaches Android and iOS |
| Monaco as the text engine | **CodeMirror 6 as the one text engine on every platform**; Monaco at most an optional desktop provider | Monaco's own documentation says it does not support mobile. CodeMirror 6 was designed for touch and on-screen keyboards, and is a sixth of the size. See `06-code-and-text-editor.md` |
| Files addressed by path | **Opaque document handles** | Android and iOS give apps a permission-bound handle, not a path. "Write a temp file and rename" only exists on desktop |
| Helper programs (ripgrep, language servers, LibreOffice, git) | **Desktop only.** Search moves into the Rust core | iOS forbids child processes; Android restricts them |
| Office pack stored in browser storage | **Served from app storage through a custom protocol** | Mobile browsers' storage quotas are small and evictable |
| Print-to-PDF from the webview | **Export through the engines, then the system share and print sheet** | No portable print-to-PDF across webviews |
| Several live office tabs | **One live heavy editor at a time on phones** | Memory |
| In-app updater | **Desktop only** | Mobile updates come through the store or a new install |
| Remove the office engine's mobile interface to save space | **Keep it for mobile builds** | It is the phone editing interface |

## The hard truth about office editing on phones

Three findings, the first two read directly from source code:

1. **ONLYOFFICE's open-source mobile interface cannot edit.** The editing code is absent from the public source, not merely switched off. It is a viewer.
2. **ONLYOFFICE's own mobile apps cannot be reused.** They are native and proprietary.
3. **iOS limits a web page to about 300 MB of memory for WebAssembly**, and the limit cannot be raised. The office converter running on a large file is the most likely thing to fail on an iPhone.

One hopeful sign: **Euro-Office**, the 2026 fork of ONLYOFFICE, is building an open mobile editor with the same architecture this project uses. Its maturity is unknown.

So the plan for office files on mobile is graduated, and says so in the interface:

| Device | Office files |
|---|---|
| **Tablet** (Android tablet, iPad), large screen | The full desktop editor in the webview, with touch adjustments. Expected to be usable; to be proven by spike |
| **Phone** | **View, comment, and light edits** (text, cell values) first. Full editing is a later goal that depends on the Euro-Office mobile editor maturing or on building touch controls ourselves |
| **Any mobile device, very large file** | Opens read-only with a clear reason, and offers "edit on your computer" |
| **Fallback if the converter cannot run in the webview** | A natively compiled converter library, called from the Rust core |

Everything else — text, code, Markdown, CSV, PDF reading, annotation and signing — is planned as **fully capable on phones**, because those engines are light and touch-friendly.

This is the honest shape of "the same app on every device": the same files, the same interface and the same connections everywhere, with office-format editing depth growing with screen size. Even Microsoft withdrew editing from its combined mobile app in 2025.

## Platform by platform

### 1. Windows (first)

- **Shell:** Tauri v2 on WebView2, which is part of Windows 11.
- **Native feel:** Mica title bar with the tab strip in it, Snap Layouts support, system accent colour, dark mode, text scaling, jump lists, file associations, "Open with", touch and pen.
- **Files:** ordinary paths; full desktop pipeline.
- **Everything is available:** helper programs, language servers, terminal, all converters.
- **Distribution for personal use:** an installer you build yourself. An unsigned installer triggers a SmartScreen warning the first time; acceptable for your own machine.
- **Open item:** confirm the Mica title bar keeps the Snap Layouts flyout in a webview app.

### 2. Android (second)

- **Shell:** Tauri v2 on the Android System WebView, which is Chromium-based — the same engine family as Windows, so the heavy engines are most likely to behave here.
- **Native feel:** Material 3, edge-to-edge layout, predictive back gesture, dynamic colour, adaptive layouts for phones, foldables and tablets. Several of these are mandatory on current Android versions.
- **Files:** the system file picker gives a lasting permission to a file or folder; the app works with handles. "Open with" and "Share to" from other apps are supported by Tauri directly. Keeping permissions across restarts needs a small custom plugin.
- **Sync:** a local folder plus a companion sync tool (`11-sync-and-continuity.md`).
- **Not available:** language servers, terminal, helper programs.
- **Pen:** S Pen annotation in the webview first; native ink if latency is poor.
- **Distribution for personal use: free.** Installing over USB is exempt from Google's new developer verification, and a free limited-distribution account covers up to 20 devices.
- **If ever published:** from April 2027 Google Play requires adaptive layouts on large screens with no letterboxing.

### 3. macOS and iOS / iPadOS (third)

- **Shell:** Tauri v2 on WKWebView, Safari's engine. **This is the highest-risk platform**: no evidence was found of the ONLYOFFICE editors running inside it, on Mac or on iPhone.
- **Native feel:** system toolbars and sidebars, a populated menu bar on Mac and iPad, "Open in New Window" on iPad (Apple's convention is one window per document), pointer and hardware-keyboard support, Apple Pencil. Apple's translucent "Liquid Glass" style is left to the system's own bars; the app does not imitate it.
- **Files:** security-scoped bookmarks for lasting access; the Files app and iCloud Drive; open-in-place. Needs a small custom plugin.
- **Not available on iOS:** child processes of any kind, long background work.
- **PDF on iOS:** the webview caps canvas size, which breaks high-zoom rendering in PDF.js. Use tiled rendering, or Apple's native PDF view if needed.
- **Distribution for personal use has a cost or a chore:**

| Route | Cost | Catch |
|---|---|---|
| Free signing | Free | Up to 3 apps on 3 devices, **expires every 7 days** and must be reinstalled |
| Apple Developer Program | $99 per year | Builds last a year; TestFlight builds last 90 days |
| macOS, own machine | Free | Local signing is enough |

- If the Mac build proves troublesome in WKWebView, **Electron remains a fallback for macOS only**, since the interface code is shell-independent.

## One interface that adapts

The interface is the same product at every size. It changes shape by **window width**, not by device type, so a narrow desktop window, a snapped third of a screen and a phone all get the same compact layout.

| Element | Compact (under 600) — phone | Medium (600–839) — small tablet, narrow window | Expanded (840–1199) — tablet landscape | Large (1200+) — desktop |
|---|---|---|---|---|
| Tabs | A tab-count button opens a **tab switcher sheet**; swipe the top bar to move between tabs | Compact scrolling strip | Full strip | Full strip in the title bar |
| Toolbar | Split: **top bar** (back, title and save state, undo, more) and **bottom bar** (five most-used tools). Becomes the **keyboard accessory bar** when typing | One top toolbar with overflow | Full | Full |
| Left sidebar | Drawer or bottom sheet | Overlay drawer | Docked, collapsible | Docked |
| Right panel | Bottom sheet, half or full height | Side sheet overlay | Docked | Docked |
| Command palette | **Full-screen search** | Centred sheet | Centred popover | Centred popover |
| Status bar | Removed; save state moves into the title, the rest into an info sheet | Thin, two or three items | Full | Full |
| Split view | Not offered; "peek" a linked file in a sheet | 50/50 in landscape | Two panes | Two or three panes |
| Home | The root screen; back returns here | Same, two columns | A tab | A tab |
| Focus mode | The default: bars hide on scroll | Toggle | Toggle | Toggle |

Rules that hold at every size:

- The document always gets the most space.
- A document is never unloaded because the window changed size.
- On phones, at most one bottom bar.
- Back closes one layer at a time: sheet → find bar → document → home.

## Touch, by format

Shared rules: the system's own text selection handles and copy/paste menu are never replaced; long-press opens the context menu; pinch zooms everywhere; every destructive action can be undone; the bar above the keyboard always starts with undo and redo.

| Format | Phone model | Chance to beat the incumbents |
|---|---|---|
| **Documents** | Two views with a one-tap switch: *Page* (faithful) and *Reflow* (phone width) | Word's mobile view silently drops shapes and ink. Show "N objects hidden in reflow" and jump to them |
| **Spreadsheets** | Grid with large handles, formula bar above the keyboard, keyboard that changes by cell type | Excel's card view needs a formal table. Offer a record view for any range with a header row |
| **Slides** | Filmstrip → tap a slide for text edits. Presenting from the phone, and the phone as a remote for the desktop | Layout work is left to larger screens, stated plainly |
| **PDF** | Continuous reading; thumbnail grid for page tools; pen draws and finger scrolls; signature saved once, placed by tap | Annotation, signing and page tools in one free app with no account |
| **Markdown / text** | Live preview, accessory bar with headings, lists, checkboxes, links; reorderable | — |
| **Code** | Extra key row (Tab, Esc, brackets, quotes, arrows); read-mostly | — |

## What is and is not on each platform

| Capability | Windows | Android | macOS | iOS / iPadOS |
|---|---|---|---|---|
| Text, code, Markdown, CSV editing | Full | Full | Full | Full |
| PDF view, annotate, sign, page tools | Full | Full | Full | Full |
| Office editing | Full | Tablet: full (to prove). Phone: view + light edit | Full (to prove in WKWebView) | iPad: full (to prove). iPhone: view + light edit |
| Links, backlinks, universal search | Full | Full | Full | Full |
| Export | All converters | Light ones on device; heavy via native build or desktop | All | Light ones on device; heavy via native build or desktop |
| Language servers, terminal, git | Yes | No | Yes | No |
| Sync | Synced folder | Local folder + companion tool | Synced folder | iCloud Drive, or built-in connector |
| Pen | Windows Ink | S Pen | — | Apple Pencil |
| OCR | Windows OCR | ML Kit | Vision | Vision |

## Building for the later platforms from day one

Things done during the Windows phase so that Android and Apple are ports and not rewrites:

- All file access through document handles.
- All operating-system calls through the `platform` interface.
- The interface built responsive from the first screen, and tested at phone width in a narrow desktop window.
- Touch target sizes and pointer-independent interactions throughout.
- One text engine that already works on touch.
- No feature that depends on a helper program without a stated mobile answer.
- Search and indexing inside the Rust core.

## Risks

| Risk | Response |
|---|---|
| Office engine fails or is too heavy in mobile webviews | Spike M1 before the Android phase; native converter library; view-first design on phones |
| No open mobile editing interface for office formats | Tablets use the desktop interface; phones get light edit; watch Euro-Office |
| iOS memory limit | File-size ceilings; native converter; honest read-only fallback |
| Tauri mobile is immature or blocks | The `platform` interface allows a Capacitor or native shell |
| WKWebView incompatibility on Apple devices | Spike before the Apple phase; Electron fallback on macOS |
| Office tabs on phones look like a different app | Their mobile interface is themed from source; accepted as a known seam at first |
| Scope: four platforms, six formats, four window sizes | Strict phase order; each platform ships before the next begins |
| Platform rules change yearly | Budget time each year for platform updates |
| iOS personal distribution cost | Decide between the yearly fee and weekly reinstall when that phase arrives |

## Device spikes

Run on real hardware before the phase they gate.

| # | Before | Question | Experiment |
|---|---|---|---|
| M1 | Android | How large an office file can be opened and saved in the Android webview? | Step through docx, xlsx and pptx files of increasing size on a mid-range phone; record memory and failures |
| M2 | Android | Is touch editing of office files in the desktop interface usable on a tablet? | A day of real edits on an Android tablet |
| M3 | Android | Does save-back work through the system file picker for each storage provider? | Open, edit and save files from local storage, a cloud app and a USB drive |
| M4 | Android | Do the base editors feel native-fast on a mid-range phone? | Typing latency, scroll and PDF zoom measured against the budgets |
| M5 | Android | Is pen annotation latency acceptable in the webview? | S Pen on a PDF; compare with a native ink view |
| M6 | Apple | Do the office editors run in WKWebView at all? | Load, edit and save on a Mac and an iPad |
| M7 | Apple | The same size ladder as M1 on an iPhone | Find the ceiling under the 300 MB limit |
| M8 | Apple | Does a natively compiled converter remove that ceiling? | Build the converter as a library and call it from the Rust core |
| M9 | Android | Is the Euro-Office mobile editor usable? | Build it and try real edits on a phone |
| M10 | Any | Does one layout adapt cleanly across fold, rotate and resize without losing state? | Foldable and tablet in split-screen |
