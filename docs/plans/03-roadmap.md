# 03 — Roadmap

Status: draft for review · Last updated: 2026-11-21

The order is risk-first: prove the uncertain things with throwaway experiments, then build the shell on the easy formats, then bring in the heavy engine. Each phase ends with something usable and a written exit check. Durations are rough guesses for one person working with an AI coding assistant, not commitments.

## Phase 0 — Spikes and decision gate (about 1–2 weeks)

Throwaway prototypes in a `spikes/` folder. Nothing here is kept as product code. Each spike ends with a short written result in `docs/decisions/`.

| # | Question | Experiment | Pass means |
|---|---|---|---|
| S1 | Does the ONLYOFFICE client-side stack work inside Electron? | Load a pinned build (start from `ranuts/document`) in a sandboxed frame on a custom protocol. Open docx, xlsx and pptx from bytes, edit, get bytes back. | All three round-trip and reopen cleanly in Word/Excel/PowerPoint or LibreOffice. |
| S2 | Is it fast and light enough? | Measure cold load, open time for a 50-page docx, a 100k-row xlsx and a 60-slide pptx, and memory per tab with 1, 5 and 10 tabs. | Usable on the target machine; hibernation plan is sufficient. |
| S3 | Can the shell stay in control? | Intercept `Ctrl/Cmd+K` and the reserved chords above the frame; draw the palette over it; trigger at least bold, save and export-PDF from outside. | Shell chords always win; an action bridge exists or a small patch is scoped. |
| S4 | How much can the ONLYOFFICE chrome be restyled? | Try compact toolbar, hidden header, theme colours, CSS overrides. | A look that is acceptable for v1 without forking `web-apps`. |
| S5 | ONLYOFFICE or SuperDoc for documents? | Run the same five real documents through both. Compare fidelity, feel and restyling effort. | A written choice. |
| S6 | PDF.js or EmbedPDF? | Highlight, note, free text, ink and signature in both; open the results in Acrobat Reader, Preview and Edge. Test incremental save and page reorder. | A written choice plus a list of annotation types that survive everywhere. |
| S7 | Can CSV be made non-destructive through the sheet editor? | Round-trip awkward files: semicolon-delimited, leading zeros, long IDs, quoted newlines, Latin-1, CRLF. | Byte-identical on open-and-save with no edits, or the fallback grid is chosen. |
| S8 | Does live preview keep Markdown byte-identical? | CodeMirror 6 prototype with heading, emphasis, link and image decorations. | Open-and-save changes zero bytes. |
| S9 | Does the fidelity harness work? | Minimal version of `04-verification.md` on three files. | Harness reports a deliberately introduced corruption. |

**Decision gate.** If S1 or S3 fails with no workable fallback, stop and reconsider before building anything: the options are a local ONLYOFFICE Document Server sidecar, Collabora, or scoping the project down to a shell for text and PDF that hands office files to ONLYOFFICE Desktop.

## Phase 1 — Shell plus text (about 2–3 weeks)

The app becomes a real Markdown and plain-text editor.

- Electron + Vite + React scaffold, pnpm workspace, lint, tests, CI.
- `editor-api` package and provider registry.
- Tab strip, new/open/save/save-as, recent files, drag-and-drop, OS file associations.
- File pipeline: atomic save, auto-save, snapshots, crash recovery, external-change detection.
- Command palette with commands, tabs and recent files.
- `engine-text`: CodeMirror 6 for txt and md, source mode and live preview, toolbar, outline, word count, focus mode.
- Light and dark theme, status bar, settings.

**Exit check:** a week of note-taking in the app; open-and-save of any md or txt file changes zero bytes; killing the process mid-edit loses nothing.

## Phase 2 — PDF (about 2–3 weeks)

- `engine-pdf` with the engine chosen in S6: continuous scroll, zoom, search, text selection, outline, thumbnails.
- Annotations: highlight, sticky note, free text, ink; annotation sidebar.
- Signature manager and placement.
- Page tools: reorder, rotate, delete, extract, split, merge across tabs.
- Form filling.
- Export md and txt to PDF.

**Exit check:** annotated and signed PDFs open correctly in Acrobat Reader, Preview and Edge; page operations pass `qpdf --check`.

## Phase 3 — Office formats (about 4–6 weeks)

- `scripts/fetch-vendor` to download and pin the ONLYOFFICE build; `engine://` protocol; sandboxed frame.
- `engine-office` adapter: load, serialize, dirty state, snapshot, suspend and resume.
- In order: **docx**, then **xlsx**, then **pptx**, then **csv** with the dialect wrapper. Each one is finished and verified before the next starts.
- Templates for each format.
- Palette bridge for office commands.
- Tab hibernation.
- Full-screen presenting and display selection.
- Bundled metric-compatible fonts.

**Exit check:** the round-trip suite in `04-verification.md` passes for each format on the sample corpus and on at least twenty personal files per format.

## Phase 4 — Unification (about 2–3 weeks)

- Cross-format export matrix (x2t, Pandoc WASM, printToPDF) surfaced as "Export as…" in the palette.
- Full-text search across open and recent files.
- Side-by-side split view.
- Version-history browser for snapshots.
- Consistent toolbar and status-bar behaviour across formats; theming pass on the embedded editors.

**Exit check:** every item in the brief's Phase 2 and Phase 3 lists is demonstrably present.

## Phase 5 — Hardening and packaging (about 1–2 weeks)

- Full end-to-end suite: open → edit → save → reload for every format, automated with Playwright.
- Large-file and many-tab performance pass.
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
- Workspace folders with a file tree.

## Sequencing logic in one paragraph

Text first because it is the smallest engine and exercises the whole shell. PDF second because it is medium-sized and independent of the office engine. Office third because it carries the most risk and benefits from a shell that is already solid. Within office, documents first because they are the easiest to verify by eye, and CSV last because its hazards are specific and separate.
