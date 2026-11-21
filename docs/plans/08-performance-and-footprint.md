# 08 — Performance and footprint

Status: draft for review · Last updated: 2026-11-21

Requirement: the app must feel instant, and the finished product must not carry huge dependencies.

## The tension, stated plainly

"Every feature of Word, Excel and PowerPoint" and "small and light" cannot both be true of the same piece of software. A full office engine is large no matter who builds it or what hosts it: the client-side ONLYOFFICE-family stack measured during research is **363 MB unpacked, about 100 MB compressed**, before fonts and dictionaries.

What *can* be true is this: **the app is small and fast, and the office engine is a separate pack that is only on disk if you want it and only in memory while an office file is open.** That two-tier design is the centre of this plan, and it matters more than any other choice here, including the choice of shell.

## What things actually weigh

Measured during research by downloading the packages (compressed sizes are gzip unless noted):

| Component | Unpacked | Compressed | Tier |
|---|---|---|---|
| **CodeMirror 6**, basic | 0.4 MB | 0.1 MB | Base |
| CodeMirror 6 with six languages | 0.6 MB | 0.2 MB | Base |
| Monaco, core only (for comparison) | 2.4 MB | 0.6 MB | Not used |
| Monaco, everything (for comparison) | 24.4 MB | 5.5 MB | Not used |
| TypeScript language service worker | 6.7 MB | — | Loaded only for TS/JS files on desktop |
| **PDF.js**, complete | 5.4 MB | 2.6 MB | Base |
| PDFium WASM (EmbedPDF) | 4.4 MB | 2.1 MB | Alternative to PDF.js |
| SQLite WASM | 0.8 MB | 0.4 MB | Base |
| **Office engine** (sdkjs + web-apps + x2t) | 363 MB | ~100 MB | **Pack** |
| — of which the x2t converter | 35.8 MB | 9.8 MB | Pack |
| Pandoc WASM | 55.9 MB | 12.2 MB (brotli) | **Pack** |
| A Node runtime (for Node-based language servers) | — | 30–35 MB | Not bundled |
| `node-pty` (terminal) | 61.4 MB | — | Pack or lazy |
| `better-sqlite3` | 26.5 MB | — | Avoid; use WASM or built-in SQLite |

Two things stand out:

- The base editors for text, code and PDF together are **a few megabytes compressed**.
- The office engine has obvious fat: in the document editor's interface alone, 15 MB is translation files and 13 MB is a mobile interface that a desktop app never uses. Pruning should bring the pack to roughly 60–75 MB compressed (an estimate to be confirmed in a spike).

## Two-tier packaging

**Base app** — installed by default, always fast:

- Shell, tabs, palette, file pipeline.
- Text and code editor (CodeMirror 6 plus lazily loaded languages).
- PDF viewer, annotation and page tools.
- CSV in a light grid (see below).
- Search.

**Packs** — separate, versioned, checksum-verified bundles:

| Pack | Contains | When it loads |
|---|---|---|
| Office | ONLYOFFICE editors and converter, pruned, plus metric-compatible fonts | First time a docx, xlsx or pptx is opened |
| Convert | Pandoc WASM | First Markdown ↔ docx export |
| Terminal | xterm.js and node-pty | First time the terminal is opened |
| Dictionaries | Spellcheck languages beyond the default | On request |
| OCR | Tesseract data | On request |

How packs stay compatible with "local-first, fully offline":

- A **full installer** includes the office pack for people who want everything offline from day one. A **slim installer** leaves packs out and fetches them once, on explicit request, then never needs the network again.
- Packs are pinned by checksum, so what loads is exactly what was tested.
- For a personal build, the simplest route is to build the full installer and treat the pack boundary as a loading boundary: nothing from a pack touches memory until needed.

**Consequence for CSV.** Opening a small CSV should not load a 100 MB engine. CSV moves to a light text-typed grid in the base app, which also suits its need for exact dialect preservation. "Open in spreadsheet editor" remains one click away for charts and formulas. This revises the earlier plan in `02-format-engines.md`.

## Shell: Tauri, and what the numbers say

The only reproducible current benchmark found (an empty app, automated single runs, updated October–November 2026):

| | Disk on Windows / macOS / Linux | Startup on Windows / macOS | Memory on Windows / macOS / Linux |
|---|---|---|---|
| Electron | 373 / 268 / 286 MB | ~195 / ~431 ms | ~279 / ~370 / ~596 MB |
| Tauri | 3 / 5 / 4 MB | ~650 / ~1,933 ms | ~312 / ~96 / ~94 MB |

Reading it honestly:

- **Size:** Tauri is about a hundred times smaller, because it uses the webview the operating system already has.
- **Startup:** Electron was faster in this test.
- **Memory:** Tauri is far lighter on macOS and Linux and about the same on Windows.
- These are empty apps and single runs. They rank the frameworks; they do not predict this app.

What the system webview means per platform:

| Platform | System webview | Risk for the heavy editors |
|---|---|---|
| Windows | WebView2, which is Chromium and ships with Windows 11 | Low. Same engine family the editors are built for |
| macOS | WKWebView (Safari's engine) | Unknown. No evidence was found of the ONLYOFFICE editors running inside it |
| Linux | WebKitGTK | High. Tauri's own documentation warns of slow canvas paths and blank windows, mainly on NVIDIA |

Other facts that bear on it:

- Tauri has no built-in print-to-PDF (the upstream change has been a draft since 2024). On Windows it can be reached through WebView2's native API with custom code. Office-to-PDF does not depend on it, because that goes through the office converter.
- Tauri's backend is Rust; Electron's is Node. Language servers and git are external programs either way, and exist on desktop only.

**Decision: Tauri v2 on every platform.** The requirement to run on Android and iOS settles it, because Electron does not run on phones (`12-platforms-and-mobile.md`). The numbers above still matter for two reasons:

- They show what is gained: a base app of a few megabytes instead of hundreds.
- They show the one cost to watch: Tauri's slower start in this benchmark. Launch time is a budget below and is measured in spike S13.

The interface code never calls the shell directly. All platform access goes through one small `platform` interface, so a different shell can be used on any single platform if it is ever needed — for example Electron on macOS if the office editors do not behave in Apple's webview.


## Budgets

Proposed targets, to be confirmed or adjusted by measurement in Phase 0. They are measured on your actual machine, not a developer workstation.

**Speed**

| Moment | Target |
|---|---|
| Launch to usable window (with last session's tabs shown) | under 500 ms warm, under 1 s cold |
| Open a text, code or Markdown file | under 100 ms |
| Open a 50-page PDF, first page visible | under 300 ms |
| Open an office file with the engine already loaded | under 1.5 s |
| Open the first office file of a session (engine cold) | under 4 s, with the shell responsive throughout |
| Switch between live tabs | under 50 ms |
| Restore a hibernated office tab | under 1.5 s |
| Keystroke to character on screen, 95th percentile | under 16 ms (one frame) |
| Palette opens | under 50 ms |
| Scrolling | 60 frames per second, no dropped frames in text and PDF |

**Memory**

| State | Target |
|---|---|
| App open with ten text tabs | under 300 MB on desktop |
| On a phone, one document open | under 250 MB, so the system does not kill the app in the background |
| Each additional text tab | a few MB |
| Each live office tab | to be measured; cap live office tabs at 2–3 and hibernate the rest |

**Size**

| Artifact | Target |
|---|---|
| Base installer | under 15 MB on desktop; under 25 MB on mobile |
| Office pack | under 80 MB download |
| Runtime npm dependencies of the base app | fewer than 40 direct, each one justified |

## How it gets fast

**Startup**
- The shell is one small bundle; nothing format-specific loads until a tab needs it.
- Show the window with the last session's tab strip immediately; fill in the active tab first, the others on focus.
- Compile-cache JavaScript and WebAssembly so second launches skip compilation.
- No work on the main thread at launch that can wait: indexing, update checks and file watching start after first paint.

**Loading engines**
- Every engine, language, preview and panel is its own lazy chunk.
- WebAssembly is loaded with streaming compilation, which is what allows the browser engine to cache the compiled code.
- When the app is idle and an office pack is installed, pre-warm one hidden office frame so the first office file opens quickly. This is a setting, off on low-memory machines.

**Tabs**
- Text tabs share one editor instance and swap models, so they cost almost nothing.
- Background frames are throttled; office tabs that are clean and idle are hibernated to a snapshot and restored on focus.
- Under memory pressure, hibernate the least recently used tab first.

**Typing and scrolling**
- Editors render only what is visible.
- Highlighting, language services, word count, search indexing and Markdown preview run in workers, never on the keystroke path.
- File reads, writes, snapshots and conversions happen outside the interface process.

**Large files**
- Large-file mode in the text editor above a size threshold.
- PDFs render pages on demand at the needed resolution and discard off-screen ones.

## Keeping dependencies small

The npm ecosystem had repeated supply-chain attacks through 2025 and 2026, so fewer dependencies is a security position as well as a size one.

- **A dependency budget.** Every runtime dependency is listed with its reason. Adding one is a deliberate decision.
- **Prefer the platform.** Built-in browser and runtime features before a library; a small utility written in-house before a package with a deep dependency tree.
- **No bundled second runtimes.** No JVM, no Python, no extra Node. Language servers use whatever the user already has installed.
- **Avoid native modules where a WebAssembly or built-in alternative exists** (SQLite in particular), since native modules complicate every build and upgrade.
- **Exact pinning** with a lockfile; install scripts disabled by default; updates batched and reviewed, never automatic.
- **Engines are vendored at pinned versions with checksums**, not pulled fresh.
- **Only ship what is used:** one interface language, the desktop interface only, subsetted fonts, tree-shaken components.

## Measuring, continuously

A budget that is not measured is a wish.

- **Startup:** timed launches in CI and on your machine.
- **Interaction:** scripted traces through Playwright for open, switch, type and scroll on each format.
- **Typing latency:** a scripted typing test with frame timing.
- **Memory:** recorded after a fixed scenario (ten text tabs, two office tabs, one large PDF).
- **Size:** installer and pack sizes checked on every build; a build that exceeds a budget fails.
- Results are tracked over time so a regression points at the change that caused it.

## Additional Phase 0 spikes

| # | Question | Experiment |
|---|---|---|
| S13 | Is Tauri on Windows fast enough? | A minimal shell with CodeMirror and PDF.js loaded: launch time, memory, installer size, against the budgets. Electron measured alongside as a reference |
| S14 | Do the office editors run correctly in WebView2 under Tauri? | Load the office engine; edit and save all three formats |
| S15 | How small can the office pack get? | Remove unused locales, the mobile interface and unneeded editors; measure size and confirm nothing breaks |
| S16 | What does a live office tab cost? | Memory and time-to-interactive per office tab; hibernate and restore timing |
| S17 | Are the speed budgets realistic? | Measure every row of the speed table on the prototype |

## Risks

| Risk | Response |
|---|---|
| The office engine misbehaves in Apple's webview | Device spikes M6–M8 before the Apple phase; Electron on macOS as a fallback; a native converter library on iOS |
| Phones kill the app for memory | One live heavy editor at a time; file-size ceilings; state saved continuously |
| Pruning the office pack breaks features | Prune conservatively; the fidelity suite runs against the pruned pack |
| First office open still feels slow | Idle pre-warming; honest one-line progress; measure against the 4 s budget |
| Many office tabs exhaust memory | Hibernation and a live-tab cap |
| Budgets slip gradually | CI checks that fail the build |
| Benchmarks from research do not match reality | They were single runs on empty apps; S13 and S17 replace them with our own numbers |

Several vendor and benchmark sites were unreachable during research. Engine sizes above were measured directly from published packages; the office figures come from an unofficial build of the same architecture and should be re-measured on the pinned upstream build. Details are in `../research/notes/performance-and-footprint.md`.
