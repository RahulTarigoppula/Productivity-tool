# 04 — Verification: proving nothing gets corrupted

Status: draft for review · Last updated: 2026-11-21

The brief makes an open → edit → save → reload check mandatory for every format. "It reopened and looked fine" is not strong enough for office files, where a lost chart or style can go unnoticed for weeks. This plan checks each saved file in four independent ways.

## The three test scenarios

Every file in the corpus goes through each of these:

1. **No-op round trip.** Open, save without editing, compare. This isolates what the engine changes on its own.
2. **Small edit.** Open, make one scripted change (type a word, change a cell, move a shape, add a highlight), save, compare. Everything except the edit must be unchanged.
3. **Double round trip.** Save, reopen, save again. The second and third files must be equivalent; drift here reveals instability.

## The four layers of checking

| Layer | Question | Tools |
|---|---|---|
| 1. Validity | Is the output a legal file? | Open XML SDK validator and officeotron for docx/xlsx/pptx; `qpdf --check` for pdf; UTF-8 and encoding checks for text |
| 2. Package diff | Which parts of the file changed? | Unzip both, list parts added, removed or changed; normalise and diff the XML. Any part that disappears is a failure unless explicitly allowed |
| 3. Semantic diff | Is the content the same? | python-docx (paragraphs, styles, comments, tracked changes), openpyxl (cell values, formulas, formats, defined names, validations, charts present), python-pptx (shapes, text, layouts, notes), PDF text and annotation extraction |
| 4. Visual diff | Does it look the same? | Render before and after to images with one pinned LibreOffice headless build, then compare with pixelmatch or SSIM against a threshold |

Rules:

- **Every text-based format (text, Markdown, code, config, `csv`) is held to byte equality** on the no-op round trip.
- **PDF incremental saves must leave the original bytes as an exact prefix** of the new file.
- **Office formats are held to layers 1–4**, with a short, reviewed allow-list of harmless differences (for example a changed "last modified by" property or a regenerated calculation chain).
- Both sides of a visual comparison are rendered by the same tool, so the test measures change, not the renderer's own inaccuracy.

## The corpus

**Generated samples** (small, committed to `tests/corpus/`), one or more per format, each built to exercise specific features:

| Format | Sample must contain |
|---|---|
| docx | Heading styles, numbered and bulleted lists, a table, an inline and a floating image, header and footer with page numbers, a footnote, a table of contents, a comment, a tracked change, two sections with different orientation |
| xlsx | Several sheets, formulas across sheets (`SUM`, `AVERAGE`, `IF`, `VLOOKUP`, `XLOOKUP`), number and date formats, merged cells, freeze panes, a filter, conditional formatting, data validation, a named range, a table, a chart, a pivot table |
| pptx | A custom master and layouts, text placeholders, shapes, a grouped shape, an image, a table, a chart, speaker notes, a transition, an animation |
| pdf | Text pages, a scanned page, an outline, a fillable form, existing annotations, mixed page sizes and rotations |
| code and config | One file per common language and config format; mixed line endings; a minified single-line file; a 20,000-line source file |
| md | Front matter, every CommonMark and GFM construct, math, a Mermaid block, unusual but legal formatting (mixed list markers, trailing spaces, hard tabs) |
| txt | UTF-8 with and without BOM, UTF-16, Latin-1, LF and CRLF, a file with no final newline, a 100 MB file |
| csv | Comma, semicolon and tab delimiters, quoted fields with newlines, leading zeros, 20-digit IDs, date-like strings, Latin-1, CRLF |

**Personal corpus** (not committed): at least twenty real files per format from actual use. Real documents surface what synthetic ones miss.

**Public corpora** for wider sweeps: the Apache POI test files and the LibreOffice bug-attachment collections.

## Cross-application checks

Automated checks cannot fully stand in for the real applications. Before each phase is called done, a short manual pass opens the saved samples in:

- Microsoft Word, Excel and PowerPoint (or their free web versions) and LibreOffice, confirming no repair prompt and no visible change.
- Acrobat Reader, macOS Preview and Edge for PDFs, confirming that annotations and signatures display and remain editable.

A "this file needs to be repaired" prompt in any Microsoft app is an automatic failure.

## End-to-end automation

- Automated tests drive the packaged app (through WebDriver on Tauri desktop; on-device test runners on Android and iOS), one test per flow ID in `../flows/`: launch, open a corpus file, perform the scripted edit through the real UI, save, close, reopen, assert.
- The Python harness then runs layers 1–4 on the output.
- Both run in CI on every change, with the engine build pinned so a failure always points at a code change.
- Engine upgrades (ONLYOFFICE, PDF.js) are their own pull requests and must pass the full suite before merging.

## Safety nets in the product itself

Testing lowers the risk; these contain what is left:

- First-save `.bak` copy and rolling snapshots (see `01-architecture.md`).
- After every office save, the app reopens the written bytes in a hidden instance and confirms they load before replacing the original.
- A warning before any save the provider reports as lossy.

## Across devices

- A file edited on one platform must pass the same four layers when reopened on another. The corpus is edited on Android and iOS and re-checked on Windows.
- Sync scenarios are scripted: concurrent edits to a text file (must merge), concurrent edits to an office file (must keep both), and a device coming back online after days.
- Every user flow in `../flows/` has an end-to-end test carrying its ID, at desktop and phone width.

## Harness layout

```
tests/
├── corpus/<format>/          # committed samples
├── e2e/                      # Playwright specs, one per format
└── fidelity/
    ├── validate.py           # layer 1
    ├── package_diff.py       # layer 2
    ├── semantic_diff.py      # layer 3
    ├── visual_diff.py        # layer 4
    ├── allowlist.yaml        # reviewed, harmless differences
    └── run.py                # runs the three scenarios across the corpus
```
