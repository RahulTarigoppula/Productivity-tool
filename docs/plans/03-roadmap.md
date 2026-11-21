# 03 — Roadmap

Status: draft for review · Last updated: 2026-11-21

The order is risk-first: prove the uncertain things with throwaway experiments, then build the shell on the easy formats, then bring in the heavy engine. Each phase ends with something usable and a written exit check. Durations are rough guesses for one person working with an AI coding assistant, not commitments.

## Phase 0 — Spikes, design prototype and decision gate (about 2–3 weeks)

Throwaway prototypes in a `spikes/` folder. Nothing here is kept as product code. Each spike ends with a short written result in `docs/decisions/`.

| # | Question | Experiment | Pass means |
|---|---|---|---|
| S1 | Does the ONLYOFFICE client-side stack work inside the chosen shell? | Load a pinned build (start from `ranuts/document`) in a sandboxed frame on a custom protocol. Open docx, xlsx and pptx from bytes, edit, get bytes back. | All three round-trip and reopen cleanly in Word/Excel/PowerPoint or LibreOffice. |
| S2 | Is it fast and light enough? | Measure cold load, open time for a 50-page docx, a 100k-row xlsx and a 60-slide pptx, and memory per tab with 1, 5 and 10 tabs. | Usable on the target machine; hibernation plan is sufficient. |
| S3 | Can the shell stay in control? | Intercept `Ctrl/Cmd+K` and the reserved chords above the frame; draw the palette over it; trigger at least bold, save and export-PDF from outside. | Shell chords always win; an action bridge exists or a small patch is scoped. |
| S4 | How much can the ONLYOFFICE chrome be restyled? | Try compact toolbar, hidden header, theme colours, CSS overrides. | A look that is acceptable for v1 without forking `web-apps`. |
| S5 | ONLYOFFICE or SuperDoc for documents? | Run the same five real documents through both. Compare fidelity, feel and restyling effort. | A written choice. |
| S6 | PDF.js or EmbedPDF? | Highlight, note, free text, ink and signature in both; open the results in Acrobat Reader, Preview and Edge. Test incremental save and page reorder. | A written choice plus a list of annotation types that survive everywhere. |
| S7 | Does the light CSV grid keep files byte-identical? | Round-trip awkward files: semicolon-delimited, leading zeros, long IDs, quoted newlines, Latin-1, CRLF. | Byte-identical on open-and-save with no edits. |
| S8 | Does the text editor keep files byte-identical? | Monaco prototype; open and save files with mixed line endings, BOMs, no final newline and non-UTF-8 encodings. | Open-and-save changes zero bytes, or the exception is detected and warned about. |
| S9 | Does the fidelity harness work? | Minimal version of `04-verification.md` on three files. | Harness reports a deliberately introduced corruption. |

Further spikes are defined next to the plans they test:

| # | Question | Defined in |
|---|---|---|
| S10 | Is one text engine (Monaco) enough, including for Markdown? | `06-code-and-text-editor.md` |
| S11 | Does Monaco's built-in language-server client work with a real server? | `06-code-and-text-editor.md` |
| S12 | Does Shiki highlighting in Monaco stay fast on large files? | `06-code-and-text-editor.md` |
| S13 | Electron or Tauri on your operating system? | `08-performance-and-footprint.md` |
| S14 | Do the office editors run correctly in your system webview? | `08-performance-and-footprint.md` |
| S15 | How small can the office pack get? | `08-performance-and-footprint.md` |
| S16 | What does a live office tab cost in memory and time? | `08-performance-and-footprint.md` |
| S17 | Are the speed budgets realistic? | `08-performance-and-footprint.md` |

**Run order.** S13 first, because the shell choice affects every other spike. Then S1 and S14 together, then the rest in any order.

**Design prototype, in parallel.** A clickable browser prototype of the shell with fake documents (tabs, palette, toolbar switching per format, sidebar, focus mode, home screen), following `07-ux-ui-design.md`. It settles layout questions before any engine is integrated.

**Decision gate.** If S1 or S3 fails with no workable fallback, stop and reconsider before building anything: the options are a local ONLYOFFICE Document Server sidecar, Collabora, or scoping the project down to a shell for text and PDF that hands office files to ONLYOFFICE Desktop.

## Phase 1 — Shell plus text and code (about 3–4 weeks)

The app becomes a real editor for any text or code file (the v1 tier in `06-code-and-text-editor.md`).

- Scaffold on the chosen shell with the `platform` interface, Vite + React, pnpm workspace, lint, tests, CI.
- Design tokens, themes and the shell components from the prototype.
- Performance and size budgets wired into CI from the first commit.
- `editor-api` package and provider registry.
- Tab strip, new/open/save/save-as, recent files, drag-and-drop, OS file associations.
- File pipeline: atomic save, auto-save, snapshots, crash recovery, external-change detection.
- Command palette with commands, tabs and recent files.
- `engine-text`: Monaco for every text-based file; Shiki highlighting and VS Code themes; language detection; built-in language services; schema-aware config editing; formatting; diff; Markdown, JSON and image previews; outline, word count, focus mode.
- `engine-csv`: the light text-typed grid.
- Folder workspaces: file tree, fuzzy file finder, ripgrep search.
- Light and dark theme, status bar, settings.

**Exit check:** a week of note-taking and light coding in the app; open-and-save of any text file changes zero bytes; killing the process mid-edit loses nothing; every speed budget for text is met.

## Phase 2 — PDF (about 2–3 weeks)

- `engine-pdf` with the engine chosen in S6: continuous scroll, zoom, search, text selection, outline, thumbnails.
- Annotations: highlight, sticky note, free text, ink; annotation sidebar.
- Signature manager and placement.
- Page tools: reorder, rotate, delete, extract, split, merge across tabs.
- Form filling.
- Export md and txt to PDF.

**Exit check:** annotated and signed PDFs open correctly in Acrobat Reader, Preview and Edge; page operations pass `qpdf --check`.

## Phase 3 — Office formats (about 4–6 weeks)

- `scripts/build-pack` to download, pin, prune and checksum the office pack; `engine://` protocol; sandboxed frame; on-demand loading.
- `engine-office` adapter: load, serialize, dirty state, snapshot, suspend and resume.
- In order: **docx**, then **xlsx**, then **pptx**. Each one is finished and verified before the next starts.
- Templates for each format.
- Palette bridge for office commands.
- Tab hibernation, live-tab cap and optional idle pre-warming.
- Full-screen presenting and display selection.
- Bundled metric-compatible fonts.

**Exit check:** the round-trip suite in `04-verification.md` passes for each format on the sample corpus and on at least twenty personal files per format.

## Phase 4 — Unification (about 2–3 weeks)

- Cross-format export matrix (x2t, Pandoc WASM pack, print-to-PDF) surfaced as "Export as…" in the palette.
- Full-text search across open and recent files.
- Side-by-side split view.
- Version-history browser for snapshots.
- Consistent toolbar and status-bar behaviour across formats; theming pass on the embedded editors.

**Exit check:** every item in the brief's Phase 2 and Phase 3 lists is demonstrably present.

## Phase 5 — Light workbench (about 3–4 weeks)

The v2 tier in `06-code-and-text-editor.md`.

- Generic language-server client with servers discovered on the system PATH.
- Integrated terminal as a lazily loaded pack.
- Minimal git: gutter markers, changed files, diff, stage, commit.
- Replace across files; HTML preview, notebook and log viewers; Vim keybindings.

**Exit check:** a day of real coding in at least two languages without opening another editor.

## Phase 6 — Hardening and packaging (about 1–2 weeks)

- Full end-to-end suite: open → edit → save → reload for every format, automated with Playwright.
- Large-file and many-tab performance pass against every budget.
- The UX self-test script from `07-ux-ui-design.md`, keyboard-only and mouse-only.
- Slim and full installers.
- Installers for the target operating system; file associations; auto-update only if wanted.
- One week of exclusive daily use; fix what hurts.

**Exit check:** the "done" definition in `00-vision-and-scope.md`.

## Later, optional

- "Edit text" mode for PDFs through the ONLYOFFICE PDF editor.
- OCR for scanned PDFs; cryptographic signatures.
- Native shell toolbars replacing the ONLYOFFICE ribbon.
- Markdown slide decks.
- More formats: odt, ods, odp, rtf, legacy doc/xls/ppt import, code files.
- A lighter native spreadsheet engine (IronCalc) once it matures.
- Typora-style Markdown writing mode; language-server installer; tree-sitter; optional AI assistance.
- Workspace folders with a file tree.

## Sequencing logic in one paragraph

Text and code first because that engine is small, used most often, and exercises the whole shell. PDF second because it is medium-sized and independent of the office engine. Office third because it carries the most risk and benefits from a shell that is already solid; within office, documents first because they are the easiest to verify by eye. The light workbench comes after the formats, because it deepens one format where the earlier phases complete the set.
