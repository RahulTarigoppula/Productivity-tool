# All-in-one productivity tool — plans and research

Last updated: 2026-11-22 · Stage: **v0.1 of the Windows app is built; the Android app has started** — see [apps/desktop](../apps/desktop/README.md)

One local, single-window, multi-tab app for personal use that opens, creates, edits, connects, converts and saves office documents, spreadsheets, presentations, PDFs, Markdown, and any text or code file — on Windows first, then Android, then Mac and iPhone/iPad.

## The plan in ten lines

1. **Do not rebuild Word, Excel or PowerPoint.** Embed a real office engine and put our effort into everything around it.
2. **The gap we fill.** No product found combines real Office and PDF editing, plain files with no account, and a notes-style layer of links and search across everything.
3. **Two tiers.** A small, fast base app for text, code, Markdown, CSV and PDF; the office engine (about 100 MB) is a separate pack that loads only when an office file is opened.
4. **One codebase, four platforms.** Tauri shell, Rust core, one responsive TypeScript interface. Windows → Android → macOS and iOS → sync across them.
5. **Engines.** ONLYOFFICE (offline, WebAssembly converter) for docx/xlsx/pptx; CodeMirror 6 for any text or code file, on desktop and touch; PDF.js for PDF.
6. **Interface.** Four things always visible on desktop (tabs, one toolbar, the document, a thin status bar); the same product reshapes itself for tablets and phones; one palette lists every action.
7. **Connected.** Links, backlinks, tags and universal search across every format, stored in the files themselves so nothing is locked in.
8. **Export anything to anything**, offline, with an honest quality label on every conversion.
9. **Across devices, built last.** Sync is the final release: a synced folder and per-device state, with no server to run; conflicts are merged for text and never silently overwritten for anything.
10. **Prove it first.** Short experiments and a clickable prototype before any build; fidelity, speed and size checked automatically on every change.

## The honest limits

- **Office editing on phones starts as view, comment and light edits.** No open-source touch editor for office formats exists today. Tablets and desktops get the full editor.
- **Apple devices are the riskiest platform** and come last: their webview is unproven for the office editors, and running your own app on an iPhone costs $99 a year or a weekly reinstall.
- **PDF → Word is never exact**, in any tool.
- **This is about a year of full-time work** for one person. The plan delivers something usable after each phase.
- **Nothing was tested hands-on**, and many primary sources were unreachable during research. Every plan lists the experiments that replace assumption with evidence.

## Reading order

| Doc | What it answers |
|---|---|
| [plans/00-vision-and-scope.md](plans/00-vision-and-scope.md) | What we are building, what we are not, and what "done" means |
| [plans/09-differentiators-and-interconnection.md](plans/09-differentiators-and-interconnection.md) | Where current apps fall short, what makes this better, how documents link to each other |
| [plans/01-architecture.md](plans/01-architecture.md) | Stack, process model, editor-provider contract, file pipeline, directory layout |
| [plans/12-platforms-and-mobile.md](plans/12-platforms-and-mobile.md) | One codebase for Windows, Android, macOS and iOS; what phones can and cannot do; adaptive layout |
| [plans/02-format-engines.md](plans/02-format-engines.md) | Per format: what it demands, engine chosen, alternatives, what we build ourselves |
| [plans/06-code-and-text-editor.md](plans/06-code-and-text-editor.md) | The VS Code-level editor: engine, feature tiers, language servers, what is left out |
| [plans/07-ux-ui-design.md](plans/07-ux-ui-design.md) | Design principles, window layout, toolbars, palette, shortcuts, save model, design process |
| [flows/](flows/) | **User flow maps:** 42 flows inventoried, the key ones drawn as diagrams |
| [plans/10-universal-export.md](plans/10-universal-export.md) | Formats, converters, the conversion matrix with quality labels, the export experience |
| [plans/11-sync-and-continuity.md](plans/11-sync-and-continuity.md) | Files and state across devices, conflicts, continuing where you left off |
| [plans/08-performance-and-footprint.md](plans/08-performance-and-footprint.md) | Measured sizes, two-tier packaging, speed and size budgets |
| [plans/03-roadmap.md](plans/03-roadmap.md) | Phase 0 spikes, then the Windows, Android, Apple and sync releases with exit checks |
| [plans/04-verification.md](plans/04-verification.md) | How open → edit → save → reload is proven lossless, on one device and across devices |
| [plans/05-risks-and-open-questions.md](plans/05-risks-and-open-questions.md) | Decisions needed from you, risks, licences, and what research could not confirm |
| [research/](research/) | The research report and the fifteen sets of source notes behind these plans |

## Where things stand

| Release 1 phase | Status |
|---|---|
| W1 Shell, text and code, CSV | Done in v0.1 (minimap and sticky scroll not yet) |
| W2 PDF | Done in v0.1 (annotation list panel, colours and comments not yet) |
| W3 Office editing | Done: Word, Excel and PowerPoint edit offline in the embedded Euro-Office editors ([decision 0002](decisions/0002-office-engine.md)) |
| W4 Connected | Partly: palette, folder search, links between files, export with quality labels, version history |
| W5 Light workbench | Not started |
| W6 Hardening | In progress: installer, CI, self-test, 38 end-to-end and 10 Office flows, three security reviews, error boundaries and local log, performance flow ([decision 0004](decisions/0004-design-stability-speed.md)) |

| Release 2 (Android) | Status |
|---|---|
| A1 Same app on Android | Started: text, code, Markdown, CSV, PDF; Office as previews; system document picker with persistent access; Open with; APK built and self-tested on an Android 15 emulator in CI (23/23) ([decision 0003](decisions/0003-android.md)) |

Decisions made while building are in [decisions/](decisions/).

## Where to start next session

1. The first questions in `plans/05-risks-and-open-questions.md` are answered; the remaining ones can wait for their phases.
2. Try ONLYOFFICE Desktop Editors for a few days and note what still feels wrong.
3. Install v0.1 on your PC and use it for a few days; note what feels wrong.
4. Install the Android APK from the latest "Android build" run and try opening, editing and saving files from Downloads and Google Drive.
