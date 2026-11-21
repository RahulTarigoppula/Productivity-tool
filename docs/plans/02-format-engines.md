# 02 — Format engines and feature coverage

Status: draft for review · Last updated: 2026-11-21

One section per format family: what the format demands, the engine chosen, what the user gets, what we build ourselves, and what could go wrong. Library versions are as read in November 2026; details and sources are in `../research/`.

## Shared principle: never rebuild a file from a private model

Office files are ZIP packages of many XML parts. An editor that reads a file into its own simplified model and writes a brand-new file loses everything it did not model. The research found this to be the single biggest source of corruption across docx, xlsx and pptx. Every engine in this plan either:

- is a full engine that models the whole format (ONLYOFFICE), or
- edits the original bytes in place and passes through what it does not understand (CodeMirror for text, incremental saves for PDF).

---

## Documents — `.docx`

**What the format demands.** A docx is paragraphs and runs plus styles with inheritance, numbering definitions, sections with their own page setup, headers and footers, footnotes, fields (table of contents, page numbers), comments, tracked changes, content controls and embedded drawings. Lossy editors most often drop tracked changes, comments, section layout, fields and drawings.

**Engine: ONLYOFFICE Document Editor** (client-side, x2t-WASM).

**What comes with the engine.** Styles, headings, lists, tables, images with wrapping, headers/footers, page layout, sections and columns, footnotes, table of contents, comments, tracked changes, equations, spellcheck, find and replace, word count, export to PDF.

**What we build.**
- The adapter (bytes in, bytes out, dirty state, save and auto-save hooks).
- Palette commands that reach into the editor.
- Status-bar word count and focus mode.
- Blank, letter, report and notes templates.

**Alternative kept alive: SuperDoc.** It edits OOXML in place, is AGPL like ONLYOFFICE, needs no server and is far easier to restyle. Its risks are vendor control and very rapid release churn. A bake-off on real documents in Phase 0 decides whether documents stay on ONLYOFFICE or move to SuperDoc.

**Ruled out.** Tiptap and CKEditor (docx conversion is paid), Univer Docs (no open-source docx import/export), mammoth and docx-preview (view or lossy import only), `docx`/html-to-docx (write-only).

---

## Text, Markdown and code — any text-based file

Planned in full in `06-code-and-text-editor.md`. In summary:

- **Engine: CodeMirror 6** for every text-based file, on every platform including phones. The text on disk is the source of truth and is never reformatted.
- **Highlighting** for about 260 languages through the same grammars VS Code uses, with VS Code themes.
- **Built-in intelligence** for TypeScript, JavaScript, JSON, CSS, HTML, YAML, TOML and Markdown; other languages through any language server already installed on the machine.
- **Markdown** renders in place as you type, in the style of Typora and Obsidian, with an optional side-by-side preview, math and diagrams.
- **Left out on purpose:** debugger, test runner, extension marketplace, remote development.

---

## Spreadsheets — `.xlsx`

**What the format demands.** Beyond cells and formulas: shared strings, a style table, number formats, defined names, tables, conditional formatting, data validation, charts and drawings, pivot caches and tables, freeze panes, and newer features such as dynamic arrays that need extra metadata parts. Rewrite-style libraries (SheetJS community, ExcelJS) drop charts, pivots, shapes and macros.

**Engine: ONLYOFFICE Spreadsheet Editor.**

**What comes with the engine.** Multi-sheet workbooks, several hundred functions including `SUM`, `AVERAGE`, `IF`, `VLOOKUP`, `XLOOKUP` and `INDEX`/`MATCH`, sorting and filtering, cell and number formatting, merged cells, freeze panes, conditional formatting, data validation, named ranges, tables, charts, pivot tables, comments, find and replace, print setup.

**What we build.** The adapter, palette commands, status-bar selection summary (sum, average, count), templates (blank, budget, tracker).

**Weight.** The office engine is about 100 MB compressed, so it ships as an on-demand pack and loads only when an office file is opened (`08-performance-and-footprint.md`).

**Alternatives and why not now.**
- **Univer:** best open grid to hack on, but xlsx import/export, charts and pivots are commercial.
- **IronCalc:** permissive Rust/WASM engine with its own xlsx reader and writer, but pre-1.0, no charts, no pivots. The most likely long-term replacement if a lighter native grid is ever wanted.
- **HyperFormula + a grid + SheetJS/ExcelJS:** the most work for the least fidelity.

## Spreadsheets — `.csv`

**What the format demands.** CSV has no standard dialect. Opening one in a spreadsheet and saving it back commonly changes the delimiter, quoting, encoding and line endings, and mangles values: leading zeros vanish, long numbers become scientific notation, and text that looks like a date becomes one.

**Engine: a light, text-typed grid in the base app.** Opening a small CSV should not load the 100 MB office engine, and a simple grid that treats every cell as text is the surest way to leave the file exactly as it was.

**What we build.**
- Detect delimiter, quoting, encoding, byte-order mark and line ending on open (Papa Parse) and reapply them on save.
- Every cell is text; nothing is reinterpreted. Sorting, filtering, column resize, find and replace, add and remove rows and columns.
- A raw-text view of the same file in the text editor, one click away.
- "Open in spreadsheet editor" for formulas and charts, with a clear note that saving from there goes to xlsx unless exported back.

**Risk.** Very large CSV files need a virtualised grid and streamed parsing; covered by the performance budgets.

---

## Presentations — `.pptx`

**What the format demands.** The hardest of the three. Slides inherit from layouts, which inherit from masters and themes; shapes use hundreds of preset geometries; text autofit and line breaking must match PowerPoint; and animations, transitions, SmartArt, charts and embedded media each live in their own parts. Editors with a private model (PPTist reports about 85% import fidelity) flatten placeholders and drop masters, animation timing and SmartArt data.

**Engine: ONLYOFFICE Presentation Editor.**

**What comes with the engine.** Slide thumbnail navigator, text boxes, shapes, images, tables, charts, themes, layouts and masters, alignment guides, grouping and ordering, speaker notes, transitions, animations, slide-show mode and presenter view, export to PDF.

**What we build.** The adapter, palette commands, true full-screen presenting through the shell (including choosing the display), templates.

**Honest limits.** SmartArt editing, PowerPoint-identical text layout with missing fonts, and the newest transitions will not match PowerPoint exactly in any open-source engine. Bundling a set of metric-compatible fonts reduces layout drift.

**Later option.** Markdown-based decks (Marp or Slidev style) as an additional, lighter slide format in the text engine. This is separate from pptx editing.

---

## PDF — `.pdf`

**What the format demands.** PDF is a fixed-layout format, not an editable document. Annotations, form fields and signatures are objects layered on top of pages and can be appended with an *incremental save* that leaves the original bytes untouched. Reflowing existing text is a different and much harder problem.

**Engines.**

| Job | Choice | Notes |
|---|---|---|
| View, zoom, scroll, search, text selection, outline, thumbnails | **PDF.js** (6.x) | Apache-2.0, monthly releases. |
| Highlights, free text, ink, image stamps, drawn/typed signatures, comments | PDF.js annotation editors | Covers the required set. PDF.js's own FAQ says it creates only a subset of annotation types. |
| Merge, split, reorder, rotate, delete, extract pages | **`@cantoo/pdf-lib`** | Maintained fork; the original pdf-lib is abandoned. Supports incremental update and encryption. |
| Repair, linearize, encrypt/decrypt | `qpdf` sidecar | Optional, small. |
| Fill and flatten forms | PDF.js to fill, pdf-lib to flatten | XFA forms are out of scope. |
| OCR for scanned PDFs (later) | Tesseract.js | Offline. |
| Cryptographic signatures (later) | `@libpdf/core` | Self-signed certificates show as untrusted in Acrobat; drawn signatures are enough for most personal use. |

**Alternative under test: EmbedPDF** (PDFium compiled to WASM, Apache-2.0). On paper it is the most complete single engine: wider annotation types, forms, redaction, undoable page editing and signing in one library. Its 3.0 arrived on 6 November 2026 with four minor releases in the ten days after, so API churn is the risk. Phase 0 runs both against the same files; the provider contract lets either win.

**What we build.**
- Thumbnail sidebar with drag-to-reorder, multi-select, rotate, delete, and drag-in from another PDF tab to merge.
- Annotation sidebar listing every comment and highlight.
- Signature manager: draw, type or import once, place anywhere.
- An engine-neutral annotation model, so switching engines does not lose work.
- Save policy: incremental save by default (original bytes preserved); full rewrite only for page operations and redaction.

**Not in v1.** Editing existing PDF text. ONLYOFFICE's PDF editor can do it and can be exposed later as an "Edit text" mode for a PDF tab.

**Risk.** Annotations written by one tool do not always display or stay editable in Acrobat, Preview and Edge. No interoperability tests were found, so we run our own (`04-verification.md`).

---

## Cross-cutting pieces

| Need | Choice |
|---|---|
| Office → PDF, office ↔ office | x2t (the ONLYOFFICE converter) |
| Text / Markdown → PDF | The webview's print-to-PDF with a print stylesheet |
| md ↔ docx / html | Pandoc WASM as an optional pack (official since Pandoc 3.9; about 12 MB compressed, 56 MB unpacked; GPL) |
| Fuzzy matching in the palette | uFuzzy or fzf-for-js |
| Full-text search | SQLite FTS5; text comes from each provider's `extractText()` |
| Fonts | Bundle metric-compatible open fonts (Carlito, Caladea, Liberation) so documents lay out the same without Microsoft fonts |

## Feature coverage against the original brief

| Requirement | Covered by | Built by us or engine |
|---|---|---|
| Multi-tab single window, side by side | Shell + dockview | Us |
| Open, New from templates, Auto-save, Save As | File pipeline | Us |
| Export docs, sheets, slides to PDF | x2t, print-to-PDF | Engine + glue |
| Command palette | Shell command registry | Us |
| Rich-text toolbar, headings, lists, tables, images, word count | ONLYOFFICE (docx), CodeMirror (md) | Engine / us |
| Distraction-free Markdown and text modes | CodeMirror + focus mode | Us |
| Any text or code file, VS Code-level editing | CodeMirror 6, Shiki, language servers | Engine + us |
| Links, backlinks and search across formats | Local index; links stored in the files | Us (`09`) |
| Export anything to anything | Converter registry | Engines + us (`10`) |
| Use across devices | Synced folder, per-device state | Us (`11`, `12`) |
| Multi-sheet, formulas, sort, filter, formatting, freeze panes, charts | ONLYOFFICE | Engine |
| Slide navigator, canvas editor, notes, full-screen presenting | ONLYOFFICE | Engine + shell full-screen |
| PDF zoom, scroll, text selection, annotations, signatures | PDF.js | Engine + UI |
| PDF merge, split, reorder, rotate, delete | pdf-lib fork | Us |
