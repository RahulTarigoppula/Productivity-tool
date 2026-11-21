# PDF stack for a personal, local-first all-in-one office app (view, annotate, sign, page tools, export to PDF)

State of the world as of 2026-11-21. Version numbers and dates below were read from package registries (npm, PyPI, crates.io) and GitHub pages on that date unless marked otherwise.

Sourcing conventions used in these notes:
- "[verified]" = read from the linked page or registry this session.
- "[background]" = from the researcher's prior knowledge (training data up to mid-2026); a canonical URL is given but was NOT fetched this session. Treat as likely-correct but unverified.
- Blocked hosts this session (could not be fetched; network allowlist): www.electronjs.org, www.embedpdf.com, libpdf.documenso.com, deepwiki.com, mupdfjs.readthedocs.io, api.github.com (403). Claims that depend on them are flagged.

---

## 1. PDF format essentials relevant to editing

### Takeaway
A PDF is a graph of numbered objects plus a cross-reference table; edits can be appended as an "incremental update" without touching original bytes, which is the safe way to annotate/sign. Annotations and form fields live outside page content (easy to add/edit); page text lives in drawing-operator content streams with no paragraphs or reflow (hard to edit). Almost all of this section is [background] because the spec pages were not fetched this session.

### Cited Findings
- [background] File structure: header, body of indirect objects, cross-reference table/stream, trailer. An incremental update appends new/changed objects plus a new xref section and trailer that points to the previous one (`/Prev`); original bytes are untouched, so earlier revisions (and earlier signatures' byte ranges) remain valid. — [ISO 32000-1:2008 (Adobe-hosted copy), section 7.5.6 "Incremental Updates"](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)
- [background] Annotations are dictionaries in each page's `/Annots` array with `/Subtype` (Text = sticky note, FreeText, Highlight, Underline, StrikeOut, Squiggly, Ink, Stamp, Square, Circle, Line, Polygon, PolyLine, Link, Widget, Redact, FileAttachment, Popup, etc.), a `/Rect`, and optionally an appearance stream `/AP /N` (a Form XObject that draws the annotation). Markup annotations carry `/Contents`, `/T` (author), `/M` (modified date), `/C` colour, `/QuadPoints` (text markup), `/InkList` (ink), `/IRT` (reply threading). — [ISO 32000-1 section 12.5](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)
- [background] Why appearance streams matter: readers differ on whether they regenerate appearances. Writing both the semantic keys (QuadPoints, InkList, DA for FreeText, Name for Stamp) AND a `/AP /N` stream is the portable approach; PDF 2.0 makes appearance streams required for most annotation types. — [PDF Association, ISO 32000-2 resources](https://pdfa.org/resource/iso-32000-2/)
- [background] AcroForm: document-level `/AcroForm` dictionary with field tree (`/FT` Tx/Btn/Ch/Sig), each field shown by Widget annotations; `/NeedAppearances` asks the reader to regenerate appearances; "flattening" paints the widget appearance into the page content and removes the field. XFA (XML Forms Architecture) is a separate XML-based form technology embedded in PDF, deprecated in PDF 2.0. — [ISO 32000-1 section 12.7](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf); [PDF Association ISO 32000-2 page](https://pdfa.org/resource/iso-32000-2/)
- [background] Drawn/typed/image "signature" = purely visual: an image or vector path placed as a Stamp/Ink annotation or painted into page content. No cryptographic meaning. A digital signature = a `/Sig` field whose value dictionary has `/ByteRange` (the bytes covered — everything except the hex `/Contents` hole) and `/Contents` holding a CMS/PKCS#7 blob; `/SubFilter` `adbe.pkcs7.detached` (legacy) or `ETSI.CAdES.detached` (PAdES). Any later change must be an incremental update or the signature breaks. — [ISO 32000-1 section 12.8](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf); [ETSI EN 319 142-1 PAdES](https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/01.01.01_60/en_31914201v010101p.pdf)
- [verified] @signpdf's README confirms the practical mechanics: a placeholder of sufficient length must exist in the PDF before signing, and PAdES-style output requires SubFilter `ETSI.CAdES.detached`. — [vbuch/node-signpdf](https://github.com/vbuch/node-signpdf)
- [background] Content streams: a page's visible content is a sequence of operators (`BT ... Tf ... Tm ... Tj/TJ ... ET` for text, path and image operators). Text is positioned glyph runs, not paragraphs; fonts are usually embedded as subsets (only the used glyphs) and may lack a ToUnicode map. — [ISO 32000-1 sections 7.8, 9](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)
- [verified] pdf-lib documents this limitation directly: it can read/edit text in form fields but not plain page text outside them. — [Hopding/pdf-lib README](https://github.com/Hopding/pdf-lib)
- [verified] Stirling-PDF's text editor needed "server-provided fonts" and font subsetting on save (v3.4.0, 19 Nov 2026) and only gained table/OCR-scan editing in v3.1.0 (5 Oct 2026) — an illustration of how much machinery real text editing needs. — [Stirling-PDF releases](https://github.com/Stirling-Tools/Stirling-PDF/releases)

### Inferences
- True text editing is hard because (a) no paragraph/line/reflow model exists in the file, so an editor must reconstruct it heuristically; (b) subset fonts lack glyphs for newly typed characters, forcing font substitution or re-embedding; (c) kerning arrays (`TJ`), custom encodings and missing ToUnicode maps make round-tripping lossy; (d) one logical paragraph may be split across many text objects or XObjects.
- For a personal app the safe default is: never rewrite original bytes for annotate/sign/form-fill (incremental save), and only do full rewrites for page operations (merge/split/reorder/compress), ideally writing to a new file or keeping a backup.
- Incremental saves grow the file and retain "deleted" content in earlier revisions (privacy issue: redaction must be a full rewrite / sanitise, never incremental).

### Gaps
- ISO 32000 text was not fetched this session; section numbers are from memory and should be spot-checked by the writer if quoted.
- ISO 32000-2 (PDF 2.0) has been available at no cost via the PDF Association since 2023 [background]; exact current access terms not re-verified.

---

## 2. Essential vs. full professional feature set of a PDF tool

### Takeaway
The essential personal set is: fast continuous-scroll viewing with thumbnails/outline/search/text selection, markup annotations (highlight, underline, strikeout, note, free text, ink, shapes, stamp/image), visual signature placement, AcroForm fill, and page organisation (merge/split/reorder/rotate/delete/insert). The "professional" tier adds true content editing, redaction, OCR, form authoring, cryptographic signing/validation, compare, PDF/A, compression, Bates/watermark and conversions — all of which now exist in at least one open-source tool.

### Cited Findings
- [verified] EmbedPDF v3 (Apache-2.0) feature list is a good definition of "essential + some pro" in one open-source viewer: annotations (highlight, underline, strikeout, draw, notes, shapes, stamps, comments), forms (fill, build), sign and verify, redaction, measurement, page editing (rotate, move, insert, duplicate, delete, all undoable), search, text selection, thumbnails, outline, attachments, printing, multi-document tabs, RTL. — [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)
- [verified] Stirling-PDF describes "50+ PDF tools: edit, merge, split, sign, redact, convert, OCR, compress", automation pipelines, REST API; 2026 releases add in-viewer text editing, a redesigned Page Editor, password-protected PDF handling without removing the password, arrow/polyline annotations, QR stamp, read-aloud, CSV export of comments, PDF/UA accessibility checker. — [Stirling-PDF README](https://github.com/Stirling-Tools/Stirling-PDF); [releases](https://github.com/Stirling-Tools/Stirling-PDF/releases)
- [verified] ONLYOFFICE's PDF editor (Docs/Desktop 9.3, Feb 2026) covers: edit existing text, add paragraphs, insert images/tables/shapes/hyperlinks; highlight/underline/strikethrough/notes/stamps/shapes; create and fill forms; view/verify digital signatures; OCR; merge/split/rotate/crop/delete/reorder pages. — [ONLYOFFICE Docs 9.3 release post](https://onlyoffice.com/blog/2026/02/onlyoffice-docs-9-3); [ONLYOFFICE "PDF workflows without Adobe" (Aug 2026)](https://www.onlyoffice.com/blog/2026/08/pdf-workflows-without-adobe-in-onlyoffice)
- [verified] pdfcpu's CLI gives the page/"batch" tier: validate, optimize, split, trim, merge, extract images/fonts/metadata, encrypt/decrypt, resize/rotate pages, stamps/watermarks, attachments/portfolios, signature validation, booklet/grid/n-up/poster, form fill. — [pdfcpu/pdfcpu](https://github.com/pdfcpu/pdfcpu)
- [verified] MuPDF.js capability list: annotations (highlight, underline, sticky note, free text, shapes, stamps), redaction (mark + permanently apply), insert/delete/reorder/rotate/crop pages, merge via page grafting, read/write form values, text extraction (plain/structured JSON), search with quads, metadata, outline editing, password handling, render to PNG/JPEG. — [ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js)

### Inferences
Suggested tiering for the app (synthesis, not a quoted source):
- Tier 0 (must-have viewer): open large files quickly; continuous scroll + single/dual page; zoom/fit; thumbnail sidebar; outline/bookmarks; full-text search with highlights; text select/copy; links; print; password prompt; remember last position; dark/sepia page tint.
- Tier 1 (annotate + sign + fill): highlight/underline/strikeout; sticky note; free text (typewriter); ink/pen; shapes/arrows; stamp/image; visual signature (draw, type, image) with a saved-signature library; annotation sidebar (list, filter, jump, edit, delete); AcroForm fill; flatten; save incrementally in standard form so Acrobat/Preview/Edge see them.
- Tier 2 (page tools): merge, split/extract, drag-reorder, rotate, delete, insert blank/from file/from image, crop, duplicate; compress/optimise; encrypt/decrypt/remove restrictions; edit metadata and outline; image(s) to PDF.
- Tier 3 (professional): OCR to searchable PDF; true redaction; true text/image editing; form authoring; digital signing (PAdES) + validation; compare; watermark/headers/footers/Bates/page numbers; PDF/A or PDF/UA conversion/validation; PDF to DOCX/XLSX/images; measurement.

### Gaps
- No independent (non-vendor) feature-priority survey of personal PDF users was found; the tiering is a synthesis.
- Adobe Acrobat, PDF Expert and macOS Preview feature pages were not fetched this session (see section 10).

---

## 3. Rendering / viewing engines

### Takeaway
Three viable open engines for a JS/TS desktop app: PDF.js (Apache-2.0, pure JS, v6.5.438 on 2026-11-01, now with highlight/free text/ink/stamp/signature/comment editors and signature verification), PDFium-WASM via EmbedPDF (Apache-2.0/MIT, v3.3.0 on 2026-11-16, the most feature-complete permissive option but very fast-moving), and MuPDF.js (AGPL-3.0-or-later or commercial, v1.28.6 on 2026-11-09, the most capable engine incl. redaction). Native WebView PDF viewers are not controllable enough for an annotating app.

### Cited Findings

#### PDF.js
- [verified] Current version: pdfjs-dist 6.5.438, published 2026-11-01, Apache-2.0. — [npm registry: pdfjs-dist](https://registry.npmjs.org/pdfjs-dist/latest)
- [verified] 2026 release cadence is roughly monthly: v6.0.227 (30 May; major release with API changes, ImageDecoder by default on Chrome), v6.1.200 (27 Jun), v6.2.108 (28 Jul; "digital signature and certificate verification", Sound annotation playback, editing sessions committed before saving), v6.3.289 (29 Aug; better ink responsiveness, viewer chrome synced with Firefox design system), v6.4.299 (3 Oct; typed signatures in GeckoView), v6.5.438 (1 Nov; offloading canvas drawing to a worker, caching operator lists in the renderer worker, stamp/signature editor fixes). Release page shows day/month only; year 2026 is confirmed by the npm publish date of 6.5.438. — [mozilla/pdf.js releases](https://github.com/mozilla/pdf.js/releases)
- [verified] Built-in editor types: free text, ink, stamp (image), highlight — "since PDF.js 3.x the built-in AnnotationEditorLayer provides native support"; pdfjs-dist 4.x+ needed for the full set incl. highlight. Enum values in 5.4 docs: FREETEXT=3, HIGHLIGHT=9, STAMP=13, INK=15; mode is switched via the `switchannotationeditormode` EventBus event or `updateMode`; `annotationStorage` is passed into the editor layer render call. — [Nutrient: PDF.js annotation editor layer guide (vendor blog)](https://www.nutrient.io/blog/pdfjs-annotation-editor-layer/); [tessl mirror of pdfjs-dist 5.4.0 editor API docs](https://tessl.io/registry/tessl/npm-pdfjs-dist/5.4.0/files/docs/editor-api.md)
- [verified via search snippet only] The editor system also has a signature editor (SignatureManager) and a comment system (Comment data class + CommentManager UI) that attaches textual notes to annotations. — [DeepWiki: mozilla/pdf.js annotation editor system](https://deepwiki.com/mozilla/pdf.js/3.5-annotation-editor-system) (host blocked; snippet only)
- [verified] Release notes corroborate signature and comment features being live in 2026: "deferring signature undo until a signature is added", "typed signatures", "fixed comment tooltip and highlight test races", "saving stamps after alt text is removed". — [mozilla/pdf.js releases](https://github.com/mozilla/pdf.js/releases)
- [verified] PDF.js FAQ positions the project as "designed for reading", supporting creation of only "a subset of the possible annotation types"; the default viewer is a configurable demo viewer (`defaultUrl` / `?file=`); the library is a general-purpose parser/renderer installed via `npm install pdfjs-dist`. — [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)
- [verified] Performance guidance from the FAQ: page count does not affect performance, page size/complexity does; range requests fetch only what visible pages need; legacy build supports Chrome 125+, Safari 18+ (mostly), Node 22+ (mostly). — [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)
- [verified] Known open issue: FreeText annotation contents are not searchable in saved PDFs (Bugzilla 1781068, still open). — [Mozilla Bugzilla 1781068](https://bugzilla.mozilla.org/show_bug.cgi?id=1781068)
- [verified, vendor-biased] Apryse (competitor) reports PDF.js memory inefficiency on e.g. large embedded JPEGs, and that 15.8% of its surveyed switchers cited failure to open files or crashes. — [Apryse PDF.js reliability benchmark](https://apryse.com/blog/pdf-js/pdf-js-reliability-benchmark)
- [background] Embedding choices: (1) ship the prebuilt `web/viewer.html` in an iframe/webview — get all UI incl. editors, but Mozilla says it is not a supported embeddable component and its UI is hard to restyle; (2) use `pdfjs-dist/web/pdf_viewer.mjs` components (`PDFViewer`, `PDFLinkService`, `PDFFindController`, `EventBus`) and build your own chrome; (3) use only the core `getDocument()/page.render()` API and build everything. Saving edits: `pdfDocument.saveDocument()` serialises `annotationStorage` (form values + new editor annotations) into an incremental update; `getData()` returns the original bytes. — [PDF.js API docs](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html); [viewer components example](https://github.com/mozilla/pdf.js/tree/master/examples/components)

#### PDFium via WASM — EmbedPDF
- [verified] embedpdf/embed-pdf-viewer: Apache-2.0 for the viewer, engine and every `@embedpdf/*` package (handwriting fonts in `@embedpdf/default-signature-fonts` are SIL OFL); 4.7k stars, 229 open issues, 65 open PRs. "A PDF engine built on PDFium that runs as WebAssembly", powered by "EmbedPDF Runtime, a fork of PDFium". Framework packages: plain HTML, React, Vue, Svelte, Angular. — [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)
- [verified] Versions: `@embedpdf/core` 3.3.0 published 2026-11-16 (Apache-2.0); `@embedpdf/pdfium` 2.15.1 published 2026-09-16 (registry lists MIT). — [npm: @embedpdf/core](https://registry.npmjs.org/@embedpdf/core/latest); [npm: @embedpdf/pdfium](https://registry.npmjs.org/@embedpdf/pdfium/latest)
- [verified] v3 is brand new: v3.0.0 on 6 Nov 2026 (after "next.20–23" prereleases 2–6 Nov), v3.1.0 8 Nov, v3.2.0 11 Nov, v3.3.0 16 Nov. v3.0.0 added redaction ("mark text and areas, then remove them from the file for good"), fill and build forms, rich-text comments on markup annotations; v3.2.0 added copy of annotations and form fields; v3.3.0 added `addValidationInfo()` (stores certificate + revocation data for long-term validation offline), `validateSignatures()`, and document timestamps without a field; v3.1.0 stopped reading every page's viewports at open (large-document performance). — [embed-pdf-viewer releases](https://github.com/embedpdf/embed-pdf-viewer/releases)
- [verified] A separate CloudPDF server (`cloudpdf/server`) is Fair Source (FCL-1.0-ALv2), not Apache — each release converts to Apache-2.0 after two years; not needed for local use. — [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)
- [verified via search snippets] PDFium WASM binary is about 2.7 MB gzipped and loads separately; the viewer runs PDFium in a Web Worker by default. — [third-party docs (MeldUI document viewer, bundle and perf)](https://meldui-eht.pages.dev/docs/document-viewer/bundle-and-perf); [EmbedPDF PDFium docs](https://www.embedpdf.com/docs/pdfium/introduction) (host blocked; not read)
- [verified] Stirling-PDF (97k stars) depends on EmbedPDF for its viewer (dependency group update in v3.0.2) — a significant production adopter. — [Stirling-PDF releases](https://github.com/Stirling-Tools/Stirling-PDF/releases)
- [verified] No head-to-head EmbedPDF vs PDF.js benchmark was found; Syncfusion's comparison rates PDFium as efficient on large/complex PDFs but is about desktop/server use. — [Syncfusion: PDF rendering engines compared](https://www.syncfusion.com/blogs/post/pdf-rendering-engines-comparison)

#### Other PDFium bindings
- [verified] `@hyzyla/pdfium` 3.0.0, published 2026-10-10, MIT (PDFium WASM wrapper for Node/browser, rendering-focused). — [npm: @hyzyla/pdfium](https://registry.npmjs.org/@hyzyla/pdfium/latest)
- [verified] A PDFium binding's docs note that in Node the native backend is faster than WASM, about 1.25x on a 1x page render. — [jacquesg/pdfium performance notes](https://jacquesg.github.io/pdfium/concepts/performance)
- [verified] `pdfium-render` (Rust, for a Tauri backend): MIT OR Apache-2.0; crates.io max stable 0.9.5 (updated 2026-11-01) while the GitHub README lists 0.9.6 (minor discrepancy); 4.16M downloads. Features: render pages/regions to bitmaps, text and image extraction, form field introspection and fill, signature introspection, attachments, concatenate documents, watermarks, introspect page objects/annotations/links, create documents/pages and text/path/bitmap objects. Binding: dynamic (default) or static; can compile to WASM. "Pdfium makes no guarantees about thread safety" — all calls are mutex-serialised (no parallel speedup). Some PDFium WASM builds have a non-growable heap that fails on large documents. — [crates.io: pdfium-render](https://crates.io/crates/pdfium-render); [ajrcarey/pdfium-render](https://github.com/ajrcarey/pdfium-render)

#### MuPDF.js
- [verified] npm package `mupdf` 1.28.6, published 2026-11-09, AGPL-3.0-or-later; dual-licensed (AGPL or Artifex commercial), covering both the JS wrapper and the WASM binary. ESM only; runs in Node, Bun, Deno, browsers; WASM memory not garbage-collected (must call `.destroy()`); in browsers intended to run in a Web Worker. — [npm: mupdf](https://registry.npmjs.org/mupdf/latest); [ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js)
- [verified] Redaction API: create Redaction annotations then `PDFPage.applyRedactions()` with options for image handling (pixel-level by default), line art (remove if covered) and text (remove); save via `saveToBuffer("incremental")` or full rewrite. — [mupdf.js redactions how-to (search snippet; host blocked)](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/redactions/index.html); [MuPDF 1.27 PDFPage reference (Debian sources)](https://sources.debian.org/src/mupdf/1.27.0%2Bds1-2/docs/reference/javascript/types/PDFPage.rst)
- [verified] The mupdf.js README does NOT list text editing or digital signing among capabilities. — [ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js)

#### Native WebView PDF viewers
- [background] Electron can display PDFs with Chromium's built-in PDFium viewer (the `<webview>`/BrowserWindow `plugins` web preference), and WKWebView (macOS, Tauri) uses PDFKit; WebView2 (Windows, Tauri) uses the Edge PDF viewer; WebKitGTK (Linux, Tauri) has no built-in PDF viewer (commonly shimmed with PDF.js). None exposes an API for programmatic annotation, page reorder, or reading back edits. — [Electron webPreferences `plugins`](https://www.electronjs.org/docs/latest/api/structures/web-preferences) (host blocked; not verified)

### Inferences
- PDF.js is the lowest-risk renderer (Firefox ships it; monthly releases; Apache-2.0) and its editor set is now enough for Tier 1 except shapes, underline/strikeout authoring, sticky-note-as-first-class, and full editing of arbitrary pre-existing annotations (exact coverage in v6.x not verified — see Gaps).
- EmbedPDF is the only permissively licensed option that covers viewer + annotations + forms + redaction + page editing + signing/validation in one headless plugin architecture; the risk is API churn (v3.0 was released 15 days before these notes, four minor versions in 10 days) and a young maintainer base.
- MuPDF.js is technically strongest and most stable but AGPL: fine for a private personal build; distributing the app would require the whole app to be AGPL-compatible or a commercial licence.
- In Tauri, WebView engine differences (WebKit on macOS/Linux) matter for PDF.js canvas performance; Electron's bundled Chromium gives consistent behaviour and the "modern" PDF.js build.

### Gaps
- Exact list of annotation types PDF.js v6.5 can create and whether it can edit/delete every existing annotation type could not be confirmed from primary docs (DeepWiki blocked; release notes truncated). [background] As of v5.x (2025) existing FreeText, Ink, Highlight and Stamp annotations were editable, and a comment sidebar was being added; treat as unverified for v6.5.
- No trustworthy public benchmark of PDF.js vs PDFium-WASM vs MuPDF-WASM on 500+ page or scan-heavy files was found.
- EmbedPDF docs (embedpdf.com) were unreachable: save API (incremental vs full), memory limits and Electron/Tauri specifics are unverified.
- MuPDF.js docs unreachable: text-editing API claims (the brief suggests MuPDF "text editing") are NOT confirmed; the README lists none.

---

## 4. Manipulation / writing libraries

### Takeaway
Original pdf-lib is effectively abandoned (last npm release 1.17.1 on 2021-11-06); use a maintained fork (`@cantoo/pdf-lib` 2.11.1, Sep 2026 — adds encryption, incremental update, SVG) or the newer `@libpdf/core` (MIT, beta) in JS. For heavyweight operations (compress, linearise, repair, decrypt) shell out to qpdf 12.4.2 or pdfcpu; in a Rust/Tauri backend lopdf 0.47 and pdfium-render are active.

### Cited Findings
- [verified] pdf-lib (Hopding): latest 1.17.1 published 2021-11-06; registry last modified 2022-05-12; MIT; 8.7k stars; 279 open issues. Features: create/modify, form create/fill/flatten, add/insert/remove/copy pages, draw text/images/vector/SVG paths, embed fonts, metadata, attachments. Limits: no encrypted documents (`EncryptedPDFError`), no page-text extraction/editing, standard fonts are WinAnsi only. — [npm registry: pdf-lib](https://registry.npmjs.org/pdf-lib); [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib)
- [verified] `@cantoo/pdf-lib` 2.11.1, published 2026-09-15, MIT. Adds: `PDFDocument.encrypt()` (AES-256 default, AES-128, RC4) and decryption; incremental updates (`forIncrementalUpdate` on load + `commit()`), "which suits signing workflows"; full SVG (`drawSvg`, `embedSvg`); PDF/A conversion, Factur-X, XFA helpers, attachment extraction, optional content layers, page content extraction, truncated-PDF recovery. Maintained "as long as we need it"; no guarantee for issues off their roadmap. 361 stars. — [npm: @cantoo/pdf-lib](https://registry.npmjs.org/@cantoo/pdf-lib/latest); [cantoo-scribe/pdf-lib](https://github.com/cantoo-scribe/pdf-lib)
- [verified] Other forks: `@pdfme/pdf-lib` 6.2.8 (published 2026-10-21, MIT); `@adnsistemas/pdf-lib` (merges Cantoo + improved incremental update, v2.9.1); `@maxwbh/pdf-lib` (encryption, incremental save, hyperlinks). `pdf-lib-plus` does not exist on npm (404). — [npm: @pdfme/pdf-lib](https://registry.npmjs.org/@pdfme/pdf-lib/latest); [pkgstats: @adnsistemas/pdf-lib](https://www.pkgstats.com/pkg:@adnsistemas/pdf-lib); [Maxwbh/pdf-lib](https://github.com/Maxwbh/pdf-lib); [npm: pdf-lib-plus (404)](https://registry.npmjs.org/pdf-lib-plus/latest)
- [verified] LibPDF (`@libpdf/core` 0.5.3, published 2026-10-16, MIT; fontbox part Apache-2.0 derived from PDFBox; about 1.9k stars; by Documenso): lenient parsing, create/modify, encryption RC4/AES-128/AES-256 (R2–R6), PAdES signatures B-B/B-T/B-LT/B-LTA, form fill/flatten, merge/split, attachments, text extraction with positions, font subsetting, incremental saves preserving signatures. Limits: self-described "Beta Software" (APIs may change), no signature verification, no .ttc, JBIG2/JPEG2000 passthrough, no certificate encryption, JavaScript actions ignored; annotations not listed as a feature. Self-reported benchmark: up to 31x faster than @cantoo/pdf-lib for load-and-save. — [LibPDF-js/core](https://github.com/LibPDF-js/core); [npm: @libpdf/core](https://registry.npmjs.org/@libpdf/core/latest)
- [verified] pdfcpu (Go): Apache-2.0; about 50 CLI commands (see section 2); PDF 2.0 validation "basic and continuously improving"; files that Acrobat Reader and Preview cannot open are unlikely to process reliably. — [pdfcpu/pdfcpu](https://github.com/pdfcpu/pdfcpu)
- [verified] qpdf 12.4.2 (released 27 Sep 2026): official binaries for macOS (Intel + Apple silicon), Windows arm64, Linux aarch64; linearisation memory reduced up to 30x for some files. — [qpdf releases](https://github.com/qpdf/qpdf/releases)
- [background] qpdf is Apache-2.0, a structural/content-preserving transformer: merge/split/rotate pages, encrypt/decrypt, linearise, object-stream compression, repair, and QDF mode for inspection; it does not render, recompress images or edit content. — [qpdf documentation](https://qpdf.readthedocs.io/en/stable/)
- [verified] Rust crates: `lopdf` 0.47.0 (updated 2026-11-04, MIT, 31.8M downloads, "PDF document manipulation"); `pdf` (pdf-rs) 0.10.0 (updated 2026-03-02, MIT, "PDF reader"); `hayro` 0.9.0 (pure-Rust PDF rasteriser, updated 2026-11-02, Apache-2.0 OR MIT); `krilla` 0.8.2 (PDF creation, MIT OR Apache-2.0); `pdf_oxide` 0.3.78 (text extraction; speed claims are self-reported). — [crates.io: lopdf](https://crates.io/crates/lopdf); [pdf](https://crates.io/crates/pdf); [hayro](https://crates.io/crates/hayro); [krilla](https://crates.io/crates/krilla); [pdf_oxide](https://crates.io/crates/pdf_oxide)
- [verified] Python: PyMuPDF 2.1 (2026-11-02; AGPL-3.0 or Artifex commercial); pypdf 7.1.1 (2026-11-18; BSD-3-Clause). — [PyPI: PyMuPDF](https://pypi.org/project/PyMuPDF/); [PyPI: pypdf](https://pypi.org/project/pypdf/)
- [verified] Stirling-PDF stack: Java / Spring Boot backend (Spring Boot 4.1.2 as of v3.3.0), Gradle; React frontend; desktop client is a Tauri 2.x app that bundles a jlink-minimised Java runtime plus the Spring Boot backend JAR and manages its lifecycle; EmbedPDF for the viewer; JPDFium; bundled CLI tools in Docker builds: Calibre, Ghostscript, ImageMagick, QPDF; veraPDF; LibreOffice is "planned for removal in favor of Stirling Office Convert" (beta since v3.1.0, 5 Oct 2026). Latest v3.4.0 on 19 Nov 2026. — [Stirling-PDF releases](https://github.com/Stirling-Tools/Stirling-PDF/releases); [Stirling-PDF README](https://github.com/Stirling-Tools/Stirling-PDF); [DeepWiki configuration notes (search snippet)](https://deepwiki.com/Stirling-Tools/Stirling-PDF/2.3-configuration-system)
- [verified] Stirling-PDF licensing is open-core: MIT outside of carve-out directories; separately licensed directories include `app/proprietary/`, `app/saas/`, `engine/`, `frontend/src/editor/proprietary/`, `frontend/src/editor/desktop/`, `frontend/src/editor/saas/`, `frontend/src/editor/cloud/`, `frontend/src/processor/`. Note that the desktop editor directory is among the non-MIT parts. — [Stirling-PDF LICENSE](https://raw.githubusercontent.com/Stirling-Tools/Stirling-PDF/main/LICENSE)
- [verified] Stirling 2.0 (Dec 2025) introduced text editing and the open-core model; free for individuals and groups of up to five. — [heise: Stirling PDF 2.0](https://heise.de/-11095732); [Open Source For You, Dec 2025](https://www.opensourceforu.com/2025/12/stirling-pdf-2-0-brings-text-editing-and-enterprise-tools-to-open-source/)

### Inferences
- Operation-to-tool mapping for a JS/TS app: merge/split/reorder/rotate/delete/insert/metadata/form fill+flatten → @cantoo/pdf-lib or @libpdf/core in-process (or the viewer engine itself if EmbedPDF/MuPDF); encrypt/decrypt → @cantoo/pdf-lib, @libpdf/core, or qpdf; compress → qpdf (structural) plus Ghostscript or MuPDF for image downsampling (Ghostscript is AGPL [background]); linearise/repair → qpdf.
- Stirling-PDF is a product to learn from (and possibly to run alongside), not a library to embed: it is a JVM server with a bundled runtime, and its desktop editor code is outside the MIT grant.
- Bundling one small native CLI (qpdf, a few MB, Apache-2.0) as an Electron/Tauri sidecar is the cheapest way to get robust repair/decrypt/linearise.

### Gaps
- Whether Stirling still uses Apache PDFBox as its core Java PDF library in v3.x is not confirmed by the pages read (historically yes [background]); Tesseract/OCRmyPDF use in v3.x also not confirmed.
- pdfcpu latest version/date not captured (releases page not read); WASM build status unknown.
- No verified qpdf-WASM package status (several community builds exist [background]; none checked).
- Licence text of the Stirling carve-out directories was not read (unknown whether source-available or fully proprietary).

---

## 5. Annotations: writing standards-compliant, interoperable annotations

### Takeaway
Three workable approaches: (a) let the viewer engine write them (PDF.js `saveDocument`, EmbedPDF/PDFium, MuPDF) — these emit real `/Annots` entries with appearance streams; (b) keep annotations in an app-side store/sidecar and "export" into the PDF on demand (Zotero model); (c) hand-write annotation dictionaries with a low-level library (pdf-lib forks) — most work, most control. Third-party "PDF.js annotation overlay" libraries mostly store JSON overlays and do not write standard PDF annotations.

### Cited Findings
- [verified] PDF.js creates free text, ink, stamp, highlight (and signature, comments) through `AnnotationEditorLayer`, with state held in `annotationStorage`. — [Nutrient guide](https://www.nutrient.io/blog/pdfjs-annotation-editor-layer/); [tessl pdfjs-dist editor API docs](https://tessl.io/registry/tessl/npm-pdfjs-dist/5.4.0/files/docs/editor-api.md)
- [verified] PDF.js FAQ: only "a subset of the possible annotation types" can be added. — [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)
- [verified] PDF.js v6.2.108 notes: "Editing sessions are committed before saving"; v6.5.438 fixes saving stamps after alt-text removal — i.e. saving editor output into the PDF is an actively maintained path. — [mozilla/pdf.js releases](https://github.com/mozilla/pdf.js/releases)
- [verified] Interop caveat: saved FreeText contents not searchable (also fails in Chrome and Edge viewers). — [Bugzilla 1781068](https://bugzilla.mozilla.org/show_bug.cgi?id=1781068)
- [verified] Interop caveat from Zotero users: Zotero imports only ink annotations it created itself; ink/highlight annotations made in Acrobat or Preview appear in other tools' comment panes as "Pencil"/"Stamp" — cross-reader annotation typing is inconsistent. — [Zotero forums thread 126434](https://forums.zotero.org/discussion/126434)
- [verified] EmbedPDF (PDFium) annotation set: highlight, underline, strikeout, draw (ink), notes, shapes, stamps, comments, with rich-text comments on markup annotations and undoable operations. — [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer); [releases](https://github.com/embedpdf/embed-pdf-viewer/releases)
- [verified] MuPDF.js: create and edit highlights, underlines, sticky notes, free text, shapes, stamps; incremental save via `saveToBuffer("incremental")`. — [ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js); [mupdf.js how-to (snippet)](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/redactions/index.html)
- [verified] Incremental writing in JS without an engine: `@cantoo/pdf-lib` (`forIncrementalUpdate` + `commit()`), `@libpdf/core` (`save({ incremental: true })`). — [cantoo-scribe/pdf-lib](https://github.com/cantoo-scribe/pdf-lib); [LibPDF-js/core](https://github.com/LibPDF-js/core)
- [verified] Annotation helper libraries: `react-pdf-highlighter` latest is 8.0.0-rc.0 from 2024-09-14 (MIT) — stale; `pdf-annotate.js` (Instructure) is at 1.0.0 — legacy; `pdfjs-annotation-extension` is not published under that name on npm (404); `annotpdf` / highkite/pdfAnnotate is a small library that writes annotations into PDFs. — [npm: react-pdf-highlighter](https://registry.npmjs.org/react-pdf-highlighter/latest); [npm: pdf-annotate.js](https://registry.npmjs.org/pdf-annotate.js/latest); [npm: pdfjs-annotation-extension (404)](https://registry.npmjs.org/pdfjs-annotation-extension/latest); [highkite/pdfAnnotate](https://github.com/highkite/pdfAnnotate)
- [verified] zotero/pdf-reader repo contains `pdfjs` and `epubjs` directories (PDF/EPUB/HTML reader built on those engines); 1,877 commits. — [zotero/pdf-reader](https://github.com/zotero/pdf-reader)
- [background] Zotero stores annotations in its own database (not in the PDF) and writes standard PDF annotations only on "Export PDF with annotations" / "Store annotations in file"; it can import existing PDF annotations as read-only external annotations. — [Zotero docs: PDF reader](https://www.zotero.org/support/pdf_reader)

### Inferences
- Interop checklist for whichever engine is chosen (synthesis): always write `/AP /N`; for Highlight write `/QuadPoints` + `/C` + `/CA` and a multiply-blend appearance; for FreeText write `/DA` and (optionally) `/RC`; for Ink write `/InkList` + `/BS`; for Stamp include `/Name`; set `/T`, `/M`, `/NM` (unique id), `/F 4` (print flag); pair Text notes with Popup where useful. Test round-trip in Acrobat Reader, Preview, Edge/Chrome and Firefox.
- Preview has a history of rewriting files and occasionally mangling other tools' annotations/forms [background, widely reported]; keeping the original file intact + incremental save + optional sidecar JSON is the defensive design.
- A dual model is attractive for a local-first app: app database is the source of truth (fast sidebar, search, sync), and "write into PDF" happens on save/export using the engine's native annotation writer.
- If PDF.js is the viewer, its own save path gives standards-shaped FreeText/Ink/Highlight/Stamp for free; anything else (shapes, underline, strikeout, sticky notes, replies) would need custom writing via @cantoo/pdf-lib or switching the engine to EmbedPDF/MuPDF.

### Gaps
- No primary-source verification this session of exactly what PDF.js writes (appearance streams, incremental-only) — [background] it appends an incremental update with appearance streams for new annotations.
- No systematic cross-reader compatibility matrix (Acrobat/Preview/Edge editing annotations written by PDF.js, PDFium, MuPDF) was found; must be tested empirically.
- `pdfjs-annotation-extension` (Laomai-codefee, GitHub) could not be inspected (GitHub API blocked; not on npm under that name).

---

## 6. Signatures: visual vs. cryptographic

### Takeaway
For personal use, "signing" realistically means placing a drawn/typed/image signature (visual), optionally flattened; every candidate engine supports that. Cryptographic PAdES signing is now feasible fully offline in JS (@libpdf/core up to B-LTA; @signpdf basic; EmbedPDF v3.3 has validation and LTV helpers) or via pyHanko, but a self-signed certificate shows as "identity not trusted" in Acrobat, so it only proves integrity to people who trust your cert.

### Cited Findings
- [verified] PDF.js has a built-in signature editor (draw/typed/image), with release-note evidence in 2026 ("typed signatures", "signature undo"), and since v6.2.108 "digital signature and certificate verification" (viewing/validation side). — [mozilla/pdf.js releases](https://github.com/mozilla/pdf.js/releases)
- [verified] EmbedPDF: "sign and verify"; v3.3.0 adds `validateSignatures()` (reports revoked certificates), `addValidationInfo()` (embed cert + revocation data for long-term offline validation), field-less document timestamps; ships handwriting fonts for typed signatures (`@embedpdf/default-signature-fonts`, OFL). — [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer); [releases](https://github.com/embedpdf/embed-pdf-viewer/releases)
- [verified] `@signpdf/signpdf` 4.0.0 (published 2026-10-19, MIT): family of packages — `@signpdf/signer-p12` (P12 via node-forge, detached), placeholder helpers for PDFKit, pdf-lib and "plain" (fragile; no streams; PDF up to 1.3). Self-described as covering "only basic scenarios of signing a PDF"; no mention of timestamps, LTV or multiple signatures. The old `node-signpdf` package is deprecated. — [vbuch/node-signpdf](https://github.com/vbuch/node-signpdf); [npm: @signpdf/signpdf](https://registry.npmjs.org/@signpdf/signpdf/latest)
- [verified] `node-forge` 1.4.3 (published 2026-11-04; BSD-3-Clause OR GPL-2.0) — still maintained; provides PKCS#12/PKCS#7 and can generate self-signed certs. — [npm: node-forge](https://registry.npmjs.org/node-forge/latest)
- [verified] `@libpdf/core`: PAdES B-B, B-T, B-LT, B-LTA signing with incremental saves; verification not implemented. — [LibPDF-js/core](https://github.com/LibPDF-js/core)
- [verified] pyHanko 0.38.2 (2026-11-19, MIT): visible and invisible signatures, several PAdES baseline profiles, seed values, PKCS#11 devices; CLI e.g. `pyhanko sign addsig --field Sig1 pemder --key key.pem --cert cert.pem in.pdf out.pdf`. — [PyPI: pyHanko](https://pypi.org/project/pyHanko/); [pyHanko CLI signing guide](https://github.com/MatthiasValvekens/pyHanko/blob/0.15.0/docs/cli-guide/signing.rst)
- [verified] Self-signed certificates are flagged untrusted by PDF readers (Adobe shows "signer's identity not trusted") regardless of signing library. — [LibPDF signatures guide (search snippet; host blocked)](https://libpdf.documenso.com/docs/guides/signatures)
- [verified] pdfcpu can validate signature integrity, report signature evidence, and remove signatures. — [pdfcpu/pdfcpu](https://github.com/pdfcpu/pdfcpu)
- [verified] Stirling-PDF: "Stirling Sign moves out of alpha" in v3.1.0 (5 Oct 2026); admin controls over changes to signed PDFs in v3.4.0. — [Stirling-PDF releases](https://github.com/Stirling-Tools/Stirling-PDF/releases)

### Inferences
- MVP: signature library (draw on canvas with pressure smoothing → vector path or transparent PNG; typed with handwriting font; imported image with background removal), place/resize on page, save as Stamp/Ink annotation (still movable) with a "flatten" option to burn into page content.
- Warn the user when a document already carries a digital signature: only incremental saves keep it valid, and even then Acrobat reports "changed after signing".
- Optional later tier: "Certify with my certificate" using @libpdf/core or EmbedPDF's engine with a locally generated self-signed P12; timestamping (B-T and above) needs a network TSA, so it is not strictly offline.
- Legally, in many jurisdictions a visual e-signature suffices for ordinary personal documents; qualified signatures (eIDAS QES) need a qualified trust service provider and cannot be done offline with a self-signed cert [background; not legal advice].

### Gaps
- Whether PDF.js v6.2 verification covers full chain/revocation or only integrity was not determined.
- No independent review of @libpdf/core's PAdES conformance (e.g. against the ETSI/DSS validator) found.
- A vendor page claiming "the Node ecosystem has no comparable full PAdES/LTV signer" (ATick) is contradicted by LibPDF's and EmbedPDF's own claims; none independently verified. — [ATick comparison (biased)](https://atick.readthedocs.io/compare/)

---

## 7. Forms: AcroForm and XFA

### Takeaway
AcroForm fill and flatten is well covered by every candidate (PDF.js viewer fill + save, pdf-lib forks, LibPDF, PDFium, MuPDF, pdfcpu). Form authoring exists in EmbedPDF v3 and ONLYOFFICE. XFA is legacy: deprecated in PDF 2.0, partially rendered by PDF.js, otherwise mostly unsupported in open source.

### Cited Findings
- [verified] pdf-lib: create, fill and flatten forms. — [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib)
- [verified] @libpdf/core: form filling and flattening; JavaScript actions ignored, so calculated fields do not run. — [LibPDF-js/core](https://github.com/LibPDF-js/core)
- [verified] EmbedPDF v3: fill and build forms; copying form fields with widgets and settings (v3.2.0). — [embed-pdf-viewer releases](https://github.com/embedpdf/embed-pdf-viewer/releases)
- [verified] PDF.js v6.1.200: checkbox and radio button appearances are rendered from the PDF; v6.4 release covers "form handling". — [mozilla/pdf.js releases](https://github.com/mozilla/pdf.js/releases)
- [verified] MuPDF.js reads and writes form field values; pdfium-render introspects and fills form fields; pdfcpu has `form fill` / `form multifill`. — [mupdf.js](https://github.com/ArtifexSoftware/mupdf.js); [pdfium-render](https://github.com/ajrcarey/pdfium-render); [pdfcpu](https://github.com/pdfcpu/pdfcpu)
- [verified] @cantoo/pdf-lib includes "XFA helpers". — [cantoo-scribe/pdf-lib](https://github.com/cantoo-scribe/pdf-lib)
- [verified] ONLYOFFICE can create and fill fillable PDF forms. — [ONLYOFFICE PDF workflows post](https://www.onlyoffice.com/blog/2026/08/pdf-workflows-without-adobe-in-onlyoffice)
- [background] PDF.js renders XFA forms (enabled in Firefox since v93, 2021; `enableXfa` option in the API) but XFA filling/saving fidelity is limited; PDFium has optional XFA support only in builds compiled with it (Chrome's is). XFA was deprecated in ISO 32000-2. — [PDF.js API: getDocument `enableXfa`](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html); [PDF Association ISO 32000-2](https://pdfa.org/resource/iso-32000-2/)

### Inferences
- Use the viewer engine for interactive fill (it already draws widgets), and save incrementally; offer "flatten on export".
- Field JavaScript (calculations, validation, formatting) is a common interop gap; PDF.js sandboxes a subset of Acrobat JS in its viewer [background], LibPDF ignores it.
- For XFA-only government forms, the pragmatic answer is "open in Acrobat Reader"; show a clear message rather than attempt support.

### Gaps
- Current PDF.js XFA status in v6.x not verified (FAQ did not cover it).

---

## 8. Text/content editing and OCR

### Takeaway
Open-source true text editing exists but is fidelity-limited everywhere: ONLYOFFICE (most complete open-source "edit existing text" PDF editor, AGPL), Stirling-PDF v3 (in-viewer text editor, non-MIT desktop/editor code), LibreOffice Draw (imports PDF as drawing objects; line-by-line text boxes). Realistic for a personal app: "add text / whiteout / replace image" plus redaction, not Acrobat-grade reflow. Offline OCR is solved: OCRmyPDF (Tesseract-based, best quality, Python), Tesseract.js (WASM, in-app), ocrs (Rust).

### Cited Findings
- [verified] ONLYOFFICE PDF editor: "edit existing text, add new paragraphs, insert images, tables, shapes, hyperlinks"; built-in OCR for scanned pages (optionally AI-assisted); 9.3 (Feb 2026) added enhanced PDF editor, more signature options, multipage view. Full PDF editor first shipped in Desktop Editors 8.1 (June 2024). — [ONLYOFFICE Docs 9.3](https://onlyoffice.com/blog/2026/02/onlyoffice-docs-9-3); [ONLYOFFICE "features that shaped ONLYOFFICE" (Jul 2026)](https://onlyoffice.com/blog/2026/07/features-that-shaped-onlyoffice); [Desktop Editors 8.1 post](https://onlyoffice.com/blog/2024/06/onlyoffice-desktop-editors-v8-1)
- [verified] Stirling-PDF: text editing introduced in 2.0 (Dec 2025); v3.1.0 (Oct 2026) can edit tables and OCR'd scans; v3.4.0 (Nov 2026) edits directly in the viewer with server-provided fonts and font subsetting. — [Stirling-PDF releases](https://github.com/Stirling-Tools/Stirling-PDF/releases); [Open Source For You](https://www.opensourceforu.com/2025/12/stirling-pdf-2-0-brings-text-editing-and-enterprise-tools-to-open-source/)
- [verified] LibreOffice Draw route is rated "Fair (simple PDFs only)" by one (vendor) guide and needs manual cleanup: ungrouping text boxes, rebuilding tables, fixing spacing. — [Renee Lab guide (vendor)](https://reneelab.zendesk.com/hc/en-us/articles/55962735846425-How-to-Convert-PDF-to-Editable-Word-Documents-Using-LibreOffice-and-Better-Alternatives)
- [verified] MuPDF.js offers redaction (remove text/images/line art under marked areas) but its README lists no text-editing feature. — [ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js)
- [verified] EmbedPDF v3: redaction that removes content "from the file for good". — [embed-pdf-viewer releases](https://github.com/embedpdf/embed-pdf-viewer/releases)
- [verified] A known redaction artefact in MuPDF/PyMuPDF: a white rectangle is left where text was removed unless fill is configured. — [MuPDF forum thread](https://forum.mupdf.com/t/how-to-remove-the-white-rectangle-left-after-using-add-redact-annot-apply-redactions-to-delete-text/162)
- [verified] OCR versions: `tesseract.js` 7.0.0 (2025-12-15, Apache-2.0); `ocrmypdf` 17.14.2 (2026-11-16, MPL-2.0); `ocrs` 0.14.0 (Rust, 2026-11-08, MIT OR Apache-2.0). — [npm: tesseract.js](https://registry.npmjs.org/tesseract.js/latest); [PyPI: ocrmypdf](https://pypi.org/project/ocrmypdf/); [crates.io: ocrs](https://crates.io/crates/ocrs)
- [background] OCRmyPDF adds an invisible text layer under the scanned image, preserving the original image, can output PDF/A (via Ghostscript), deskew/clean, and needs Tesseract + Ghostscript installed; Tesseract.js runs fully offline if the WASM core and `traineddata` language files are bundled locally (by default it downloads them from a CDN). — [OCRmyPDF docs](https://ocrmypdf.readthedocs.io/); [tesseract.js local installation docs](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)

### Inferences
- Practical "edit" for the app, in order of cost: (1) FreeText annotations as "add text"; (2) cover-and-retype (white rectangle + new text, i.e. edit-by-redaction-and-replace — what PyMuPDF-style workflows do); (3) per-text-run editing with font fallback (Stirling/ONLYOFFICE class; a large engineering effort); (4) convert to DOCX, edit in the app's document editor, re-export (lossy).
- Searchable-PDF OCR in-app: render page with the viewer engine → Tesseract.js worker → write invisible text (render mode 3) with a PDF writer; or shell out to OCRmyPDF if the user has Python. Bundling OCRmyPDF's dependency chain (Python, Tesseract, Ghostscript [AGPL]) is heavy.
- Because the app is an office suite that will already embed a document editor, reusing ONLYOFFICE's PDF editor (if ONLYOFFICE is the chosen doc engine) would give text editing "for free" at the cost of AGPL and a heavyweight component — worth cross-checking with the other researchers' notes.

### Gaps
- No independent fidelity evaluation of ONLYOFFICE vs Stirling text editing was found; vendor claims only.
- Whether MuPDF (C core, 1.26–1.28) gained any text-editing API beyond redaction is unverified (docs host blocked); the brief's premise that MuPDF supports "text editing" is NOT confirmed.
- ocrs accuracy vs Tesseract not researched.

---

## 9. Export to PDF from docs/sheets/slides, and PDF to Office conversion

### Takeaway
If the app's editors render in a web view, Chromium's print-to-PDF (Electron `webContents.printToPDF`) is the natural offline exporter and gives WYSIWYG for what the app itself renders; Tauri has no programmatic print-to-PDF across platforms (open feature requests since 2022). For converting foreign Office files, LibreOffice headless is the standard offline route (high but imperfect fidelity, 500+ MB), with ONLYOFFICE x2t as an alternative. PDF to DOCX is lossy in all open-source tools.

### Cited Findings
- [background] Electron `webContents.printToPDF(options)` returns a `Promise<Buffer>`; options include `landscape`, `displayHeaderFooter`, `headerTemplate`/`footerTemplate`, `printBackground`, `scale`, `pageSize` (named or custom), `margins`, `pageRanges`, `preferCSSPageSize`, `generateTaggedPDF`, `generateDocumentOutline`. Uses Chromium's Skia PDF backend; honours CSS `@page` and print media. — [Electron webContents docs](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions) (host blocked this session; not re-verified)
- [verified] Tauri: core exposes only `window.print()` → `plugin:webview|print` (OS print dialog), no PDF buffer API. Open issues: "[feat] Provide print API" #4917 (opened Aug 2022, still open), "[feat] PDF generation programmatically" #12284 (opened Jan 2025, still open). — [tauri print.js (docs.rs)](https://docs.rs/crate/tauri/2.10.3/source/src/webview/scripts/print.js); [tauri issues search](https://github.com/tauri-apps/tauri/issues?q=is%3Aissue+print+to+pdf)
- [verified] On Linux, WebKitGTK historically lacked a complete print API with PDF generation (WebKit bug 212814; current status not confirmed). Community Tauri printer plugins send files to OS printers (e.g. Windows "Microsoft Print to PDF") rather than render the webview to a PDF. — [WebKit Bugzilla 212814](https://bugs.webkit.org/show_bug.cgi?id=212814); [tauri-plugin-printer-v2](https://docs.rs/tauri-plugin-printer-v2)
- [verified] Tauri version for reference: 2.12.7 (2026-11-18). — [crates.io: tauri](https://crates.io/crates/tauri)
- [verified] LibreOffice headless: rated high fidelity, free, but a 500+ MB external binary; reports of CLI output differing from GUI output, missing shapes and indentation problems on DOCX. — [DEV: Convert DOCX to PDF in Node.js, options compared](https://dev.to/jakexkim/convert-docx-to-pdf-in-nodejs-every-option-compared-1oee); [Ask LibreOffice: layout issue headless](https://ask.libreoffice.org/t/layout-issue-when-converting-to-docx-to-pdf-using-libreoffice-headless/127618); [Ask LibreOffice: extra empty space in CLI conversion](https://ask.libreoffice.org/t/inconsistent-docx-to-pdf-conversion-in-libreoffice-extra-empty-space-in-cli-conversion/109022)
- [verified] Stirling-PDF is moving away from LibreOffice to its own "Stirling Office Convert" (beta, Oct–Nov 2026) — a signal about the operational pain of bundling LibreOffice. — [Stirling-PDF releases](https://github.com/Stirling-Tools/Stirling-PDF/releases)
- [verified] Typst 0.15.1 (crate updated 2026-07-17, Apache-2.0): a Rust typesetting system usable as a library to produce PDF; its PDF backend ecosystem includes `krilla`. — [crates.io: typst](https://crates.io/crates/typst); [crates.io: krilla](https://crates.io/crates/krilla)
- [verified] Paged.js: latest npm 0.4.3 from 2023-07-06 (MIT) — low release activity. — [npm: pagedjs](https://registry.npmjs.org/pagedjs/latest)
- [background] Gotenberg is a Docker-based HTTP API wrapping headless Chromium and LibreOffice (plus PDF engines such as qpdf/pdfcpu/pdftk) — server-oriented; not a fit for a single-user desktop app, but its architecture (Chromium for HTML, LibreOffice for Office formats) is the standard recipe. — [Gotenberg docs](https://gotenberg.dev/)
- [background] ONLYOFFICE `x2t` is the C++ converter inside ONLYOFFICE (docx/xlsx/pptx ↔ internal format ↔ PDF etc.), AGPL-3.0, generally stronger OOXML fidelity than LibreOffice since ONLYOFFICE is OOXML-native. — [ONLYOFFICE/core repo](https://github.com/ONLYOFFICE/core)
- [verified] PDF → DOCX: `pdf2docx` 0.5.13 (2026-05-01, MIT) uses PyMuPDF (AGPL dependency) for extraction and python-docx for writing; README: rule-based, "can't 100% convert the PDF layout", normal reading direction only; PyPI states it is no longer actively maintained by Artifex. Commercial guides argue open-source tools "focus on visual extraction, not logical reconstruction" and degrade on complex layouts; scanned PDFs need OCR first. — [PyPI: pdf2docx](https://pypi.org/project/pdf2docx/); [ArtifexSoftware/pdf2docx](https://github.com/ArtifexSoftware/pdf2docx); [Nutrient PDF-to-Word guide (vendor)](https://www.nutrient.io/blog/convert-pdf-to-word/)

### Inferences
- Export of the app's own documents: use the app's own renderer → `printToPDF` (Electron). With good print CSS (`@page` size/margins, `break-inside`, header/footer templates) this is exact for what the user sees; `generateTaggedPDF` and `generateDocumentOutline` give accessibility/bookmarks. Sheets and slides need dedicated print layouts (page tiling, one slide per page).
- If Tauri is chosen, PDF export needs another path: a sidecar headless Chromium (large), Typst as a layout backend (requires mapping the document model to Typst — good for docs, awkward for arbitrary HTML), direct PDF drawing with a PDF library, or the OS print dialog's "Save as PDF" (manual, not programmatic). This is a material point in the Electron-vs-Tauri decision.
- Importing/converting third-party DOCX/XLSX/PPTX to PDF with high fidelity offline effectively requires LibreOffice or ONLYOFFICE; make LibreOffice an optional detected dependency rather than bundling 500+ MB.
- PDF → XLSX: no strong open-source tool found; table extractors (Camelot, Tabula, pdfplumber [background]) yield CSV-like tables, not faithful workbooks.

### Gaps
- No controlled fidelity comparison (printToPDF vs LibreOffice vs x2t) found; fidelity statements about x2t are background knowledge.
- Electron docs unreachable; option list from memory.
- Whether Tauri 2.12 added any print-to-PDF capability since the cited issues: issues still appear open, but changelog not checked.
- Stirling Office Convert internals unknown.

---

## 10. UX benchmarks (Preview, PDF Expert, Acrobat, Zotero reader, Stirling-PDF)

### Takeaway
Only Stirling-PDF, EmbedPDF, ONLYOFFICE and (partially) Zotero's reader were examined from primary sources this session; observations about Preview, PDF Expert and Acrobat are background knowledge and are listed under Inferences/Gaps.

### Cited Findings
- [verified] Stirling-PDF 2026 UX direction: redesigned Page Editor replacing the old "multi-tool" (v3.2.0); visual feedback during page reordering and selective page cropping (v3.0.2); arrow-key viewer navigation, dual-page with cover option, read-aloud from selection, CSV export of comments (v3.2.1); fit-to-width button (v3.2.2); password-protected PDFs usable without first removing the password (v3.2.0); text editing directly in the viewer (v3.4.0). — [Stirling-PDF releases](https://github.com/Stirling-Tools/Stirling-PDF/releases)
- [verified] EmbedPDF's UX primitives: every page operation and annotation change is undoable; multiple documents in tabs; thumbnails, outline, attachments, search, text selection, printing; rich-text comments on markup. — [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)
- [verified] ONLYOFFICE 9.3 added multipage view. — [ONLYOFFICE Docs 9.3](https://onlyoffice.com/blog/2026/02/onlyoffice-docs-9-3)
- [verified] Zotero's reader is a single component for PDF/EPUB/HTML built around PDF.js/epub.js directories. — [zotero/pdf-reader](https://github.com/zotero/pdf-reader)
- [verified] PDF.js viewer chrome was re-synced with the Firefox design system in v6.3.289 (Aug 2026) and has comment tooltips. — [mozilla/pdf.js releases](https://github.com/mozilla/pdf.js/releases)

### Inferences
(Background knowledge, not verified this session.)
- macOS Preview: thumbnail sidebar where pages can be drag-reordered, dragged between documents to merge, and deleted with the Delete key; Markup toolbar; signature capture via trackpad/camera with a reusable signature list; near-instant open. Weakness: annotations/forms sometimes break in other readers.
- PDF Expert: very smooth continuous scroll; clean annotation toolbar with tool presets; page-grid "organise" mode; inline text editing that matches font; annotation summary export.
- Adobe Acrobat: comments pane with filter/sort/reply threads; "Organize Pages" grid with drag-reorder, rotate, extract, insert; "Fill & Sign"; comprehensive but heavy and subscription-gated.
- Zotero reader: left sidebar toggling thumbnails/outline/annotations; coloured highlights with comments and tags shown as cards in the annotation sidebar; click-to-jump; annotations stored in the library DB and exportable into the PDF; area (image) annotations; ink and text annotations added in Zotero 7.
- Patterns worth copying: (1) one left sidebar with tabs Thumbnails | Outline | Annotations | Search results; (2) thumbnail multi-select + drag-reorder + drag-in files to merge + context menu (rotate, delete, extract, insert blank); (3) floating mini-toolbar on text selection (highlight colours, underline, note, copy); (4) annotation cards with colour, quote, comment, page, filter by colour/type; (5) global undo/redo across annotations AND page operations; (6) virtualised continuous scroll with low-res placeholder then sharp re-render on zoom; (7) sticky per-document state (page, zoom, sidebar).

### Gaps
- Apple, Readdle and Adobe product pages were not consulted; the Preview/PDF Expert/Acrobat/Zotero UX points are from background knowledge and should be labelled as such or checked.
- No usability studies comparing these readers were found.

---

## 11. Bottom line: recommended stack, licence implications, risks

### Takeaway
Two defensible permissive stacks: (A) conservative — PDF.js viewer components + its built-in editors, with @cantoo/pdf-lib (or @libpdf/core) for page tools and qpdf as a sidecar; (B) feature-rich — EmbedPDF (PDFium WASM) as a single engine for view/annotate/forms/redact/page-edit/sign. MuPDF.js is the most capable single engine if AGPL is acceptable. Electron makes PDF export trivial (`printToPDF`); Tauri does not.

### Cited Findings
- [verified] Licences: PDF.js Apache-2.0; EmbedPDF Apache-2.0 (`@embedpdf/pdfium` MIT); @cantoo/pdf-lib MIT; @libpdf/core MIT (+ Apache-2.0 fontbox); pdfcpu Apache-2.0; lopdf MIT; pdfium-render MIT OR Apache-2.0; tesseract.js Apache-2.0; ocrmypdf MPL-2.0; pyHanko MIT; @signpdf MIT; mupdf AGPL-3.0-or-later; PyMuPDF AGPL/commercial. — sources as cited in sections 3–8: [pdfjs-dist](https://registry.npmjs.org/pdfjs-dist/latest), [@embedpdf/core](https://registry.npmjs.org/@embedpdf/core/latest), [@cantoo/pdf-lib](https://registry.npmjs.org/@cantoo/pdf-lib/latest), [@libpdf/core](https://registry.npmjs.org/@libpdf/core/latest), [pdfcpu](https://github.com/pdfcpu/pdfcpu), [lopdf](https://crates.io/crates/lopdf), [pdfium-render](https://crates.io/crates/pdfium-render), [tesseract.js](https://registry.npmjs.org/tesseract.js/latest), [ocrmypdf](https://pypi.org/project/ocrmypdf/), [pyHanko](https://pypi.org/project/pyHanko/), [@signpdf/signpdf](https://registry.npmjs.org/@signpdf/signpdf/latest), [mupdf](https://registry.npmjs.org/mupdf/latest), [PyMuPDF](https://pypi.org/project/PyMuPDF/)
- [verified] Maturity signals: PDF.js monthly releases through Nov 2026; EmbedPDF v3.0.0 on 6 Nov 2026 with 229 open issues; pdf-lib original untouched since 2021; @libpdf/core self-labelled beta; MuPDF.js 1.28.6 on 9 Nov 2026. — [pdf.js releases](https://github.com/mozilla/pdf.js/releases); [embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer); [npm: pdf-lib](https://registry.npmjs.org/pdf-lib); [LibPDF-js/core](https://github.com/LibPDF-js/core); [npm: mupdf](https://registry.npmjs.org/mupdf/latest)
- [verified] MuPDF.js AGPL terms: free for open-source use; proprietary or SaaS use where AGPL compliance is not possible needs a commercial licence. — [ArtifexSoftware/mupdf.js](https://github.com/ArtifexSoftware/mupdf.js)

### Inferences
Recommended stack (researcher's synthesis):

| Concern | Stack A (conservative, permissive) | Stack B (single-engine, permissive) | Stack C (most capable, AGPL) |
|---|---|---|---|
| Render/view | PDF.js 6.x viewer components in the renderer process (worker enabled) | EmbedPDF 3.x headless plugins + PDFium WASM worker | MuPDF.js in a worker, custom viewer UI |
| Annotate | PDF.js editors (highlight, free text, ink, stamp, signature, comments) + `saveDocument()`; custom writers via @cantoo/pdf-lib for missing types | EmbedPDF annotation plugins (adds underline/strikeout/shapes/notes/redaction) | MuPDF annotation API (+ redaction) |
| Sign (visual) | PDF.js signature editor; flatten via pdf-lib | EmbedPDF signature tooling | Stamp/ink annotation |
| Sign (crypto, optional) | @libpdf/core (PAdES B-B..B-LTA) or @signpdf + node-forge | EmbedPDF sign/validate (+ `addValidationInfo`) | pyHanko sidecar or @libpdf/core |
| Forms | PDF.js fill + save; flatten with pdf-lib fork | EmbedPDF fill/build | MuPDF |
| Page tools | @cantoo/pdf-lib or @libpdf/core in a worker/main process | EmbedPDF page editing (undoable) | MuPDF page ops + grafting |
| Compress/repair/encrypt | qpdf sidecar (Apache-2.0); encryption also in pdf-lib fork/LibPDF | qpdf sidecar | MuPDF + qpdf |
| OCR | Tesseract.js with bundled traineddata; optional OCRmyPDF if installed | same | same |
| Export to PDF | Electron `printToPDF`; optional LibreOffice detection for foreign Office files | same | same |

- Suggested default: start with Stack A for the reader + Tier 1 annotations (lowest risk, smallest dependency, Firefox-grade rendering), while prototyping Stack B in parallel; switch the engine to EmbedPDF if (a) underline/strikeout/shapes/redaction/form-building become requirements or (b) PDF.js performance on large scanned files is unsatisfactory. Keep an engine-agnostic annotation model (app-side JSON keyed by page + quads/paths) so the engine can be swapped.
- Licence implications: Stacks A and B are fully permissive (Apache-2.0/MIT) — no obligations beyond notices, and the app can later be distributed or closed. Stack C (and any use of PyMuPDF, pdf2docx's PyMuPDF dependency, Ghostscript, ONLYOFFICE components) is AGPL: acceptable for private single-user use with no distribution, but distributing the app would require releasing the app's source under AGPL-compatible terms or buying an Artifex licence. Keeping AGPL tools as optional external executables the user installs (process boundary) limits, but does not legally guarantee to eliminate, copyleft reach — flag for legal review if distribution is ever planned.
- Do not build on Stirling-PDF code for the desktop editor: its editor/desktop directories are outside the MIT grant and it requires a bundled JVM backend.
- Key risks: (1) EmbedPDF API churn/young project (v3 two weeks old); (2) PDF.js viewer is not an officially supported embeddable product and its editor API is semi-internal — pin versions and wrap it; (3) cross-reader annotation compatibility must be tested empirically (Acrobat, Preview, Edge, Firefox); (4) data-loss risk on save — always write to a temp file and atomically replace, default to incremental saves, keep a one-step backup of the original; (5) redaction must do a full rewrite and strip prior revisions/metadata; (6) pdf-lib ecosystem fragmentation (several forks) — prefer one actively published fork or LibPDF, and isolate behind an interface; (7) Tauri lacks programmatic print-to-PDF; (8) WASM memory ceilings and manual memory management (MuPDF `.destroy()`, PDFium heap growth) on very large files; (9) font handling for any text editing.

### Gaps
- No hands-on benchmark or interop test was run in this research; recommendations rest on documentation, release notes and registry metadata.
- Hacker News / 2025–2026 developer discussion threads were not successfully retrieved (one HN mirror link for the EmbedPDF launch surfaced in search but was not read: https://hn.nuxt.dev/item/44126177).
- Hosts that must be allow-listed for a follow-up verification pass: www.electronjs.org, www.embedpdf.com, libpdf.documenso.com, deepwiki.com, mupdfjs.readthedocs.io, api.github.com.
