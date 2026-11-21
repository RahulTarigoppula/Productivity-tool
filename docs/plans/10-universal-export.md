# 10 — Export anything to anything

Status: draft for review · Last updated: 2026-11-21

Goal: any file the app can open can be exported to any other format that makes sense, offline, with an honest statement of how good the result will be.

## The honest version of "anything to anything"

Conversions fall into three kinds, and the app says which one you are getting:

| Label | Meaning | Examples |
|---|---|---|
| **Exact** | Nothing visible is lost | docx → PDF, PDF → images, csv ↔ xlsx (values) |
| **Good** | Content and structure survive; some layout or styling changes | docx ↔ odt, md → docx, docx → md, pptx → PDF |
| **Text and structure only** | You get the words, headings and tables, not the look | PDF → docx, PDF → md, pptx → md |

Some directions are never exact for anyone. PDF is a picture of a page, not a document, so **PDF → Word is the conversion people most expect to be perfect and it is not**, even in Acrobat. No independent benchmark for it was found. The app will offer it, label it honestly, and show a preview first.

Apple's iWork formats (`.pages`, `.numbers`, `.key`) can be **imported** but nothing open-source can write them.

## Formats

| Tier | Documents | Spreadsheets / data | Slides | PDF / images | Other |
|---|---|---|---|---|---|
| **v1** | docx, md, txt, html, odt, rtf | xlsx, csv, tsv, ods, json | pptx, odp | pdf, png, jpg, svg | — |
| **v2** | epub, doc (import), tex, typst, asciidoc, rst | xls (import), yaml, toml, xml, parquet | ppt (import), Markdown decks | PDF/A, webp, heic, tiff, searchable PDF by OCR | ipynb (import) |
| **Later** | pages (import), mobi | numbers (import), sqlite | key (import), slides → video | — | mermaid, eml, archives |

## The converters

Each converter is a separate piece. Heavy ones are on-demand packs, as in `08-performance-and-footprint.md`.

| Converter | Covers | Size | Where it ships |
|---|---|---|---|
| **x2t** (ONLYOFFICE's converter, WebAssembly) | Office formats to each other and to PDF; legacy doc/xls/ppt in | ~36 MB unpacked, ~10 MB compressed | Office pack |
| **Pandoc** (WebAssembly) | Markdown, html, docx, odt, epub, rst, asciidoc, tex, typst and dozens more; since 3.14 it also reads pptx and xlsx | ~56 MB unpacked, ~16 MB compressed | Convert pack |
| **Webview print-to-PDF** | Any text, Markdown or html → PDF | Built in | Base app |
| **PDF engine** (PDF.js, pdf-lib) | PDF → images, text; images → PDF; merge, split | Built in | Base app |
| **Typst** (WebAssembly) | High-quality PDF from Markdown, with page control | ~8 MB compressed plus fonts | Convert pack (v2) |
| **Image library** (wasm-vips) | Image formats to each other, resize, compress | ~10 MB | Convert pack (v2) |
| **Data converters** | csv ↔ json ↔ yaml ↔ toml ↔ xml | Tiny | Base app |
| **OCR** | Scanned PDF or image → text and searchable PDF | Uses the operating system's own engine on each platform | Base app where the OS provides it |
| **Document AI** (Docling, MinerU and similar) | Better PDF → Markdown with tables | Hundreds of MB to several GB of models | Desktop-only optional pack, later |
| **LibreOffice headless** | Second opinion for office → PDF and odd formats | 500 MB+ | Desktop-only optional pack, later |

Notes:

- **OCR uses the platform**, not a bundled engine: Windows' built-in OCR, Android's ML Kit, Apple's Vision. This keeps size at zero and quality high.
- The **document AI** converters are the best route for PDF → Markdown, but none is feasible on a phone, their licences vary and some restrict use. They stay optional and desktop-only.
- Pandoc's pptx and xlsx readers were days old at the time of research and need testing before being relied on.

## The conversion matrix (v1)

Rows are the source, columns the target. Each cell is the tool and the expected label. Labels are judgement, not measurements, and are replaced by measured results as the test corpus grows.

| From ↓ / To → | pdf | docx | md | html | txt | xlsx | csv | pptx | images |
|---|---|---|---|---|---|---|---|---|---|
| **docx** | x2t · Exact | — | Pandoc · Good | Pandoc · Good | Pandoc · Text | | | Pandoc · Text | via pdf |
| **odt / rtf** | x2t · Good | x2t · Good | Pandoc · Good | Pandoc · Good | Pandoc · Text | | | | via pdf |
| **md** | print · Good | Pandoc · Good | — | built-in · Exact | built-in · Exact | | tables only | Pandoc · Good | via pdf |
| **html** | print · Good | Pandoc · Good | Pandoc · Good | — | Pandoc · Text | | tables only | | via pdf |
| **txt** | print · Exact | Pandoc · Exact | rename | built-in | — | | | | via pdf |
| **xlsx / ods** | x2t · Good | | Pandoc · tables | x2t · Good | | x2t · Good | x2t · values only | | via pdf |
| **csv / tsv** | via xlsx | | built-in · table | built-in · table | — | x2t · Exact (values) | built-in · Exact | | |
| **json / yaml / toml** | print | | code block | | — | flat data only | flat data only | | |
| **pptx / odp** | x2t · Good | Pandoc · Text | Pandoc · Text | | Pandoc · Text | | | x2t · Good | x2t · Exact per slide |
| **pdf** | page tools | Text and structure | Text and structure | | built-in · Text | tables only (later) | tables only (later) | one page per slide, as images | built-in · Exact |
| **images** | built-in · Exact | as inserted image | as linked image | | OCR · Text | | | one image per slide | image library |

Spreadsheet → PDF deserves a warning in the interface: page breaks and scaling decide whether the result is usable, so the export dialog shows a page preview.

## The conversion engine

Converters are not wired together by hand. They are entries in a registry, and the app finds a route.

**Each converter declares:**

- The formats it reads and writes.
- A quality label per pair, and what is lost.
- Its options (page size, range, image quality, and so on).
- Which platforms it runs on, and which pack it needs.
- Rough cost in time and memory.

**The engine then:**

- Finds the best route between two formats, including through an intermediate (pptx → PDF → images), preferring higher quality, then fewer steps.
- Reports the route's overall label as the worst label along it.
- Runs conversions in a background worker with progress and cancel.
- Sandboxes every converter: no network, no file access beyond the bytes it is given. Converters are a classic way for a malicious file to attack an app.
- Checks the output before handing it over (the file opens; a PDF passes a structure check).
- Offers to fetch a missing pack, or says clearly that a conversion is only available on desktop.

Adding a format later means adding one converter entry; every sensible route appears automatically.

## How it looks to the user

One verb, **Export**, in the same place for every format (toolbar, palette, menu, and the share sheet on phones).

1. **Choose a target.** Formats are listed with their label (Exact, Good, Text and structure only). The last choice for this kind of file is preselected.
2. **Options**, hidden behind "More" unless needed: pages or range, page size, image quality.
3. **Preview** for conversions that change layout or lose content, with a plain-language line about what is lost.
4. **Destination:** beside the original by default, or share directly on a phone.

Related actions use the same engine:

- **Open as…** converts in memory and opens the result in a new tab without writing a file.
- **Batch export** from the home screen or a folder, with a result line per file.
- **Drag out** of the app to produce a converted copy.
- **Save As** to a different format is the same Export, with a warning if the new format cannot hold everything.

The original file is never modified by an export.

## On phones

- iOS gives a web page only about 300 MB of memory for WebAssembly, and that limit cannot be raised. Nobody was found running x2t or Pandoc as WebAssembly inside a mobile webview.
- So on phones the plan is: small conversions (text, Markdown, data, images, PDF pages) run on the device; heavy ones run through native builds of the converters where possible; anything that cannot run is offered as "convert on your computer", queued through sync, and never fails silently.
- Which conversions are truly available on Android and iOS is decided by spikes, not promised here.

## Risks

| Risk | Response |
|---|---|
| People expect PDF → Word to be perfect | Honest label, preview, and saying so before the conversion runs |
| Converter size | Packs; base app converts text, data, images and PDF pages without any pack |
| Malicious input files | Sandboxed converters, no network, output validation |
| Licences (x2t is AGPL, Pandoc is GPL, some AI converters restrict use) | Fine for personal use; recorded in `05-risks-and-open-questions.md` |
| Missing fonts change layout in exports | Bundled metric-compatible fonts; warn on substitution |
| Mobile memory limits | Native converter builds or desktop hand-off; spikes first |
| New Pandoc readers are immature | Test against the corpus before enabling a route |

## Additional spikes

| # | Question | Experiment |
|---|---|---|
| S21 | Does route-finding work end to end? | Registry with x2t, Pandoc and print-to-PDF; convert a docx to md, pdf and html; a pptx to images through pdf |
| S22 | How good are the top ten conversions on real files? | Run them over the personal corpus; record a measured label per pair |
| S23 | What converts on a phone? | x2t and Pandoc in the Android webview and in iOS's, with memory measured; then a native build of each |
| S24 | Is platform OCR good enough? | Scanned pages through Windows OCR, ML Kit and Vision; produce a searchable PDF |
