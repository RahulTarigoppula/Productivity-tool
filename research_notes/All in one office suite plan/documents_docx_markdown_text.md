# Documents: DOCX, Markdown and plain text for a personal local-first office app (state as of 21 Nov 2026)

**How to read these notes.** Version numbers, release dates and licenses marked "(npm, 21 Nov 2026)" were read directly from the npm registry on that day. GitHub star counts were read from the repo pages the same day, and only for the repos where a count is given. Several hosts were unreachable from the research session (docs.superdoc.dev, docx-editor.dev, pandoc.org, codemirror.net, learn.microsoft.com, ecma-international.org, officeopenxml.com, milkdown.dev, tiptap.dev, Hacker News mirrors). Claims that rest on my background knowledge of those sources rather than a page fetched in this session are tagged **[background, not re-verified]** and the URL given is where to check them. Vendor claims about fidelity are tagged **[vendor claim]**. Nothing here was tested hands-on.

## 1. DOCX format: structure, key concepts, and why round-trip fidelity is hard

### Takeaway
A .docx is a ZIP package of interrelated XML parts in which appearance is computed (style inheritance, numbering definitions, section properties, fields, font metrics), not stored, so any editor that converts to its own HTML/JSON model and regenerates the file loses whatever its model cannot represent. The only strategies that keep unknown content are (a) editing the original XML tree in place, or (b) carrying unmodelled XML through as opaque payloads attached to the model.

### Cited Findings
**Package structure [background, not re-verified in this session]**
- The standard is ECMA-376 (5th edition parts 1-4) / ISO/IEC 29500; Part 1 defines WordprocessingML, Part 2 the Open Packaging Conventions (ZIP + `[Content_Types].xml` + `_rels/*.rels` relationship files), Part 3 Markup Compatibility (`mc:AlternateContent`, `mc:Ignorable`), Part 4 the Transitional (legacy, incl. VML) features — [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- Typical parts: `word/document.xml` (body), `word/styles.xml`, `word/numbering.xml`, `word/settings.xml`, `word/fontTable.xml`, `word/theme/theme1.xml`, `word/header*.xml`, `word/footer*.xml`, `word/footnotes.xml`, `word/endnotes.xml`, `word/comments.xml` (+ `commentsExtended.xml`, `commentsIds.xml`, `people.xml` for threaded/resolved comments), `word/media/*`, `word/embeddings/*`, `word/glossary/*`, `customXml/*`, `docProps/core.xml` and `app.xml`, and `word/_rels/document.xml.rels` binding relationship ids (`r:id`) to images, hyperlinks, headers and footers — [Microsoft: Structure of a WordprocessingML document](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document); [officeopenxml.com anatomy](http://officeopenxml.com/anatomyofOOXML.php)
- Content model: body → paragraphs (`w:p`, with `w:pPr`) → runs (`w:r`, with `w:rPr`) → text (`w:t`); tables (`w:tbl`/`w:tr`/`w:tc`) with a separate grid, merged cells via `w:gridSpan`/`w:vMerge`; sections are defined by `w:sectPr` (page size, margins, columns, header/footer references, page numbering), where the last one sits at the end of `w:body` and earlier ones live inside the last paragraph of each section — [officeopenxml.com WordprocessingML](http://officeopenxml.com/WPcontentOverview.php)
- Effective formatting is resolved through a chain: document defaults (`w:docDefaults`) → table style → paragraph style (with `w:basedOn` inheritance) → numbering-level properties → character style → direct formatting, plus theme fonts/colours; toggle properties such as bold XOR across levels — [officeopenxml.com styles](http://officeopenxml.com/WPstyles.php)
- Numbering is indirect: a paragraph's `w:numPr` points to a `w:num` instance, which points to a `w:abstractNum` with up to 9 levels and optional per-instance level overrides; the visible number is never stored, it is computed by counting — [officeopenxml.com numbering](http://officeopenxml.com/WPnumbering.php)
- Fields (page numbers, TOC, cross-references, dates, MERGEFIELD, citations) are instructions with a cached result, either `w:fldSimple` or a `w:fldChar` begin/separate/end sequence that can span runs and paragraphs and nest — [officeopenxml.com fields](http://officeopenxml.com/WPfields.php)
- Tracked changes are inline markup: `w:ins`, `w:del` (with `w:delText`), `w:moveFrom`/`w:moveTo`, and property-change records (`w:rPrChange`, `w:pPrChange`, `w:sectPrChange`, `w:tblPrChange`), each with author/date/id — [Microsoft Open XML SDK: accept all revisions](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-accept-all-revisions-in-a-word-processing-document)
- Content controls (`w:sdt`) wrap block/inline/cell content and can bind to custom XML parts; drawings are DrawingML (`w:drawing` with `wp:inline` or `wp:anchor` for floating/wrapped objects), legacy VML (`w:pict`), charts and SmartArt as separate parts, and equations as OMML (`m:oMath`); newer Word features are written inside `mc:AlternateContent` with a fallback — [Microsoft Open Specifications [MS-DOCX]](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/b839fe1f-e1ca-4fa6-8c26-5954d0abbccd)

**Evidence that conversion-based tools are lossy (fetched this session)**
- Pandoc's manual: "Pandoc attempts to preserve the structural elements of a document, but not formatting details such as margin size... conversions from formats more expressive than pandoc's Markdown can be expected to be lossy." — [pandoc MANUAL.txt](https://raw.githubusercontent.com/jgm/pandoc/main/MANUAL.txt)
- Mammoth's stated philosophy: "Mammoth aims to produce simple and clean HTML by using semantic information in the document, and ignoring other details"; it does not copy fonts, sizes or colours, ignores table borders, ignores comments unless a style mapping is added, and "performs no sanitisation of the source document" — [mammoth.js README](https://github.com/mwilliamson/mammoth.js)
- docx-preview (docxjs) renders to HTML and states "Realtime page breaking is not implemented"; pages break only on explicit breaks, `lastRenderedPageBreak` markers (opt-in) and section changes; tracked-change and comment rendering are flagged experimental — [docxjs README](https://github.com/VolodymyrBaydalka/docxjs)
- Tiptap's own Markdown package notes a normalisation on export ("spaces at the start or end of formatted text move outside its delimiters") — a small example of model-based serialisers rewriting content — [@tiptap/markdown README](https://raw.githubusercontent.com/ueberdosis/tiptap/main/packages/markdown/README.md)
- A commercial competitor (Apryse) characterises ProseMirror/JSON-based editors including Tiptap and SuperDoc as having "lossy DOCX roundtrip" / "Partial" Word fidelity; this is rival marketing, several rows are marked not independently verified — [Apryse comparison](https://apryse.com/capabilities/docx-editor/comparison)

**Preservation strategies claimed by current editors**
- SuperDoc: "Edits write back to OOXML without an HTML conversion step"; "Save and export write changes back into the OOXML package instead of rebuilding a DOCX from HTML"; tracked changes, comments, tables, headers and footers "stay DOCX structures" **[vendor claim]** — [SuperDoc README](https://raw.githubusercontent.com/superdoc/docx-editor/main/README.md)
- EigenPal DOCX Editor: "Preserve document structure, unsupported OOXML, and embedded files" on save and reopen; core described as "OOXML parse/serialize, the canonical document tree, layout and paint" **[vendor claim]** — [eigenpal/docx-editor README](https://raw.githubusercontent.com/eigenpal/docx-editor/main/README.md); [@docx-editor.dev/core on npm](https://www.npmjs.com/package/@docx-editor.dev/core)
- A third-party fork's self-reported audit of an open DOCX editor: "19 of 39 fixtures round-trip with zero element drops; remaining drops are tracked" (surfaced via search snippet, not opened) — [schnsrw/docx](https://github.com/schnsrw/docx)
- Pandoc handles tracked changes only on read: `--track-changes=accept|reject|all`; `accept`/`reject` both discard comments, `all` wraps them in spans; "This option only affects the docx reader" — [pandoc MANUAL.txt](https://raw.githubusercontent.com/jgm/pandoc/main/MANUAL.txt)

### Inferences
- Constructs most likely to be dropped or flattened by convert-and-regenerate editors (ranked by how often the tools above omit them): section properties and multi-section layout (margins, orientation changes, columns), headers/footers and first/even-page variants, fields other than plain text results (TOC, cross-references, page numbers), numbering definitions (lists come back as "bullets" with new ids, restart/continue semantics lost), style inheritance (styles flattened to direct formatting, or direct formatting discarded), floating/anchored drawings and text wrapping, text boxes, SmartArt/charts/OLE embeds, equations (OMML), content controls and custom XML bindings, tracked-change property records and moves, threaded/resolved comment metadata, footnote/endnote separators, bookmarks, compatibility settings in `settings.xml`, theme references, and `mc:AlternateContent` blocks.
- Three architectural tiers exist: (1) "semantic import" (mammoth, pandoc) — deliberately lossy, good for DOCX → Markdown/HTML; (2) "generate from scratch" (docx npm, prosemirror-docx, html-to-docx) — one-way export, never a round trip; (3) "OOXML-native model + own layout engine" (SuperDoc, EigenPal, ONLYOFFICE, LibreOffice) — the only tier where round trip is plausible.
- A practical safeguard regardless of engine: never overwrite the original; keep the source .docx, write to a new file or keep versioned backups, and run a regression corpus (open → save → diff XML parts / compare rendering) before trusting any editor with real documents.
- Exact layout equality with Word additionally needs the same fonts (or metric-compatible substitutes) and reimplementing undocumented line-breaking/justification behaviour; both SuperDoc and EigenPal ship font-substitute packages, and EigenPal warns "Fallback measurement can change wrapping and pagination" ([README](https://raw.githubusercontent.com/eigenpal/docx-editor/main/README.md)).

### Gaps
- ECMA, Microsoft Learn and officeopenxml.com were unreachable; the format description above is from background knowledge and should be spot-checked against those URLs.
- No independent, public round-trip benchmark comparing SuperDoc, EigenPal and ONLYOFFICE on a shared corpus was found. The Hacker News "Show HN: Open-source .docx editor library" thread (item 48228411) could not be opened.
- SuperDoc's and EigenPal's per-feature fidelity tables (docs.superdoc.dev; docx-editor.dev/docs/2.x/docx-fidelity) could not be read, so what each one specifically passes through versus drops is unknown.

## 2. Word-processor feature inventory (Word / Google Docs / ONLYOFFICE), tiered

### Takeaway
A credible word processor needs a paginated, style-driven core (styles, lists, tables, images, headers/footers, page setup, find/replace, undo, export to PDF) before anything else; "professional" status comes from long-document and review machinery (sections, TOC/fields, footnotes, track changes, comments, cross-references, citations, mail merge), most of which only matter if the app must interoperate with other people's DOCX files.

### Cited Findings
- ONLYOFFICE Docs covers text documents, spreadsheets, presentations, forms, PDFs and diagrams, with "real-time collaborative editing, reviewing, spell-checking, and dark mode", 46 interface languages, RTL and CJK — [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)
- SuperDoc's stated scope: tracked changes, threaded comments, tables, headers, footers, Word-like paginated layout, three document modes (`editing`, `suggesting`, `viewing`) — [SuperDoc README](https://raw.githubusercontent.com/superdoc/docx-editor/main/README.md)
- EigenPal's stated scope: WYSIWYG editing, tracked changes and comments (Pro), collaboration (Pro), RTL and CJK, DrawingML/chart rendering (Pro), PDF export (Pro, Node.js), Markdown export, 15 UI locales — [eigenpal/docx-editor README](https://raw.githubusercontent.com/eigenpal/docx-editor/main/README.md)
- Open-source Univer Docs lists only "Rich-text editing, paragraph formatting, lists, hyperlinks, comments, and drawing integration" — a useful marker of how far a "basic" tier goes — [dream-num/univer](https://github.com/dream-num/univer)
- Docxodus lists rendering of numbering, tables, footnotes, headers/footers, a paginated mode, comments, in-place header/footer editing, and compare/redline producing native tracked changes — [JSv4/Docxodus](https://github.com/JSv4/Docxodus)

**Tiered inventory [background synthesis of Word / Google Docs / ONLYOFFICE feature sets; check against** [Word support](https://support.microsoft.com/en-us/word), [Google Docs help](https://support.google.com/docs), [ONLYOFFICE document editor](https://www.onlyoffice.com/document-editor.aspx)**]**

| Tier | Features |
| --- | --- |
| Must-have | Character formatting (font, size, bold/italic/underline/strike, colour, highlight, super/subscript); paragraph formatting (alignment, indents, spacing, line height); bulleted/numbered/multilevel lists; headings and named styles; tables (insert, merge/split, borders, shading, column resize); inline images (resize, alt text); hyperlinks; page breaks; page size/orientation/margins; headers, footers and page numbers; find and replace; undo/redo; clipboard with paste-as-plain-text and reasonable paste from Word/web; spellcheck; word/character count; zoom; print and PDF export; autosave and crash recovery |
| Expected | Style management (modify, based-on, quick style gallery, format painter); automatic table of contents; footnotes and endnotes; comments (threads, resolve); track changes / suggestion mode with accept/reject; sections with different headers, orientation, first/odd/even pages; multi-column layout; tab stops and ruler; image wrapping and positioning (square, tight, behind/in front); text boxes and shapes; document outline / navigation pane; bookmarks and internal links; symbols and special characters; non-breaking space/hyphen, line and paragraph pagination controls (keep with next, widow/orphan); version history; templates; export to other formats; language tagging per run; RTL/CJK; dark mode |
| Advanced / professional | Fields (PAGE, NUMPAGES, DATE, REF, SEQ, STYLEREF, IF); cross-references and captions; table of figures; index; citations and bibliography; equations (OMML/LaTeX input); mail merge; content controls and fillable forms; document protection and restricted editing; compare and combine documents; watermarks, page borders, line numbers; drop caps; SmartArt and charts; embedded objects (OLE); master/sub-documents; macros/scripting and plugins; hyphenation and advanced typography (ligatures, kerning, OpenType features); accessibility checker; digital signatures; real-time co-editing; grammar/style checking; AI assistance |

### Inferences
- For a single-user offline app, the collaboration-shaped features (real-time co-editing, sharing permissions) can be dropped entirely, but track changes and comments cannot if the user exchanges DOCX with others, because those are stored in the file and must at minimum be displayed and preserved.
- The features that force an OOXML-native paginating engine (rather than an HTML rich-text editor) are: sections, headers/footers, page-accurate TOC and page-number fields, footnotes, floating images and columns. If these are required, "TipTap + export" class solutions are out.

### Gaps
- No single authoritative, current side-by-side feature matrix of Word vs Google Docs vs ONLYOFFICE was fetched; the tiering is a synthesis and inherently a judgement call.

## 3. Embeddable DOCX editors and DOCX libraries (JS/TS, WASM, Rust)

### Takeaway
As of November 2026 there are three realistic routes to real DOCX editing in a local web-tech app: SuperDoc (AGPL-3.0, OOXML-native, full review features in the open-source build), EigenPal's DOCX Editor (Apache-2.0 core, but tracked changes, comments, collaboration and PDF export moved into a commercial "Pro" package), and ONLYOFFICE (AGPL-3.0, the most complete suite, heavier, now runnable fully client-side through the community `ranuts/document` x2t-WASM project). Everything else is a viewer, a one-way converter or a generator.

### Cited Findings
**Full editors**

| Project | License | Latest (npm, 21 Nov 2026) | Stars | Notes |
| --- | --- | --- | --- | --- |
| SuperDoc (`superdoc`) | AGPL-3.0, commercial license available | 2.34.0, published 2026-11-21 | 1.2k | Repo now at `superdoc/docx-editor` (formerly Harbour-Enterprises/SuperDoc, then superdoc-dev/superdoc) |
| EigenPal DOCX Editor (`@docx-editor.dev/core`, `/react`, `/vue`) | Apache-2.0 core; `pro`, `editor-api`, `docx-to-pdf`, `telemetry` under "EigenPal Pro License" | 2.39.0, published 2026-11-18 | 590 | Old names `@eigenpal/docx-js-editor` (MIT, 0.5.3) and `@eigenpal/docx-editor-react` (1.9.0, June 2026) are deprecated |
| ONLYOFFICE Docs | AGPL-3.0 | 10.0.x current per README (fix branches 10.0.2 / 9.4.2) | 7.1k | Server product; React wrapper `@onlyoffice/document-editor-react` 2.3.0 (Apache-2.0, 2026-10-14) |
| ranuts/document | AGPL-3.0 | n/a (static site) | 2.0k | ONLYOFFICE sdkjs/web-apps + x2t compiled to WASM, no server |
| Univer (`@univerjs/docs`) | Apache-2.0 core; commercial modules separate | 1.5.2, 2026-11-16 | 31.0k | DOCX import/export is not in the open-source core |
| Docxodus | MIT | 16.1.0, 2026-11-16 | 118 | .NET engine compiled to WASM, built on Open-Xml-PowerTools |

- SuperDoc architecture: parses "content, styles, relationships, media, headers, footers, and the other OOXML parts into editable document state"; a layout engine paginates and the browser paints pages; "The same engine runs without a browser DOM, so the editor, SDKs, CLI, and MCP server share one document model"; "The editor needs no server of its own" — [SuperDoc README](https://raw.githubusercontent.com/superdoc/docx-editor/main/README.md)
- SuperDoc packages: `superdoc`, `@superdoc/react`, `@superdoc/vue`, `@superdoc/sdk` (Node, wraps the CLI), `@superdoc/cli`, `@superdoc/mcp`, `@superdoc/fonts` (metric-compatible substitutes), Python and Rust SDKs — [SuperDoc README](https://raw.githubusercontent.com/superdoc/docx-editor/main/README.md); versions: `@superdoc/react` 2.29.0, `@superdoc/sdk` 2.31.0, `@superdoc/cli` 0.54.0, all AGPL-3.0, all published 2026-11-21 — [npm: superdoc](https://www.npmjs.com/package/superdoc)
- SuperDoc release cadence is very high: the `superdoc` npm package lists 1,796 published versions, and the repo shows 9,033 commits, 112 open issues; "Pull requests are limited to repository collaborators" — [npm: superdoc](https://www.npmjs.com/package/superdoc); [superdoc/docx-editor](https://github.com/superdoc/docx-editor)
- Earlier SuperDoc READMEs (1.x line) described it as built on ProseMirror with Yjs CRDT collaboration; the current README no longer names ProseMirror — [superdoc@1.45.0 README](https://cdn.jsdelivr.net/npm/superdoc@1.45.0/README.md) (seen via search snippet); [current README](https://raw.githubusercontent.com/superdoc/docx-editor/main/README.md)
- EigenPal: "a complete document ecosystem featuring a WYSIWYG editor with real-time collaboration, tracked changes, and rich editing capabilities, a headless layout engine that runs on both client and server, and a PDF generation engine"; the `@docx-editor.dev/pro` package holds "Tracked changes, comments, collaboration, custom nodes, and advanced drawing rendering" — [eigenpal/docx-editor README](https://raw.githubusercontent.com/eigenpal/docx-editor/main/README.md)
- EigenPal Pro license id on npm is `LicenseRef-EigenPal-Pro-Evaluation-1.0`; the repo says "Production use of a Pro package requires a commercial agreement" — [npm: @docx-editor.dev/pro](https://www.npmjs.com/package/@docx-editor.dev/pro); [eigenpal/docx-editor](https://github.com/eigenpal/docx-editor)
- EigenPal repo status: 1,254 commits, 66 open issues, 25 open PRs; Node requirement `^20.16.0 || >=22.3.0`; first npm publish of the original package was 2026-02-04, so the project is under a year old — [eigenpal/docx-editor](https://github.com/eigenpal/docx-editor); [npm: @eigenpal/docx-js-editor](https://www.npmjs.com/package/@eigenpal/docx-js-editor)
- ONLYOFFICE Docs 9.4 (May 2026) removed the 20-simultaneous-connection limit from the Community edition and moved it to a simpler single-process architecture ("Single process, no RabbitMQ or database"); the README's edition table still recommends Community for "up to 20" users and excludes mobile web editors, in-editor AI tools, automation API and white-labelling — [ONLYOFFICE blog 9.4](https://onlyoffice.com/blog/2026/05/onlyoffice-docs-9-4); [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)
- ONLYOFFICE component split: `server`, `core` (format conversion), `sdkjs` (editor engine), `web-apps` (UI), `core-fonts`, `dictionaries` — [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)
- A fork named Euro-Office based on ONLYOFFICE's code was launched by a European consortium at the end of March 2026 (single secondary report) — [it-connect.tech](https://www.it-connect.tech/onlyoffice-docs-9-4-drops-the-20-connection-limit-and-updates-its-open-source-license/)
- ranuts/document: "Core document processing runs locally, with no account or Office installation required"; uses `onlyoffice-x2t-wasm`; self-hostable "as a static site"; "Offline use needs cached editor assets"; not an official ONLYOFFICE product — [ranuts/document](https://github.com/ranuts/document)
- Univer: "Server SDK adds backend services for real-time collaboration, edit history, and Office file import and export"; commercial plugins evaluate with "watermarks and feature limits" — [dream-num/univer](https://github.com/dream-num/univer)
- Docxodus: "The engine ships inside the package as WebAssembly"; DOCX → HTML with numbering, tables, footnotes, headers/footers and a paginated mode; compare/redline emitting native Word tracked changes; accept/reject; a framework-agnostic in-browser editor with ribbon UI and comments; an "anchor-addressed markdown" projection for LLM agents — [JSv4/Docxodus](https://github.com/JSv4/Docxodus)
- LibreOffice in WASM: ZetaOffice/zetajs (allotropia) runs LibreOffice fully client-side, scripted via UNO; a 2025 talk reported "32 MB binary and 15 MB data"; `zetajs` npm is 1.2.0 (MIT wrapper, 2025-05-30), i.e. no npm release for about 18 months — [npm: zetajs](https://www.npmjs.com/package/zetajs); [allotropia launch post](https://blog.allotropia.de/2024/11/08/launching-zetaoffice/); [The Register](https://www.theregister.com/2025/02/13/libreoffice_wasm_zetaoffice/)

**Rich-text frameworks with DOCX bolt-ons (not round-trip editors)**
- Tiptap core is MIT (`@tiptap/core` 3.35.0, 2026-11-20), but DOCX import/export are `@tiptap-pro/*` extensions from a private registry tied to paid plans; a third-party 2026 breakdown lists Start $49/mo, Team $149/mo, Business $999/mo and says the free plan was removed in June 2025 (third-party figures, unverified); legacy conversion packages are being sunset in 2026 — [Tiptap pricing](https://tiptap.dev/pricing); [Tiptap DOCX docs](https://tiptap.dev/docs/conversion/import-export/docx); [dev.to breakdown](https://dev.to/eddyter/tiptap-pricing-explained-2026-free-vs-pro-vs-cloud-cost-breakdown-3l5g); [legacy conversion guide](https://tiptap.dev/docs/guides/legacy-conversion)
- CKEditor 5 (49.1.0, 2026-11-04) is dual-licensed GPL 2+ / commercial; Import from Word and Export to Word are premium features needing a commercial license and use CKSource's conversion service — [CKEditor license](https://ckeditor.com/docs/ckeditor5/latest/support/license-and-legal.html); [Import from Word](https://ckeditor.com/docs/ckeditor5/latest/features/import-word.html)
- `prosemirror-docx` 0.6.1 (MIT, last release 2025-07-03): "Export a prosemirror document to a Microsoft Word file", "a light wrapper around docx.js" — export only — [curvenote/prosemirror-docx](https://github.com/curvenote/prosemirror-docx)
- BlockNote core is MPL-2.0 (`@blocknote/core` 0.57.0, 2026-10-30) but its DOCX exporter `@blocknote/xl-docx-exporter` is "GPL-3.0 OR PROPRIETARY" — [npm: @blocknote/xl-docx-exporter](https://www.npmjs.com/package/@blocknote/xl-docx-exporter)
- `@docen/docx` 0.7.0 (MIT, 2026-09-07): "DOCX editor and converter powered by @office-open/docx with a Tiptap editing layer — bidirectional DOCX and Markdown conversion"; young project (first publish January 2026) — [npm: @docen/docx](https://www.npmjs.com/package/@docen/docx)
- Lexical (0.53.0, MIT, 2026-10-28), Slate (0.147.4, MIT, 2026-10-26) and Plate (`platejs` 53.5.2, MIT, 2026-10-30) are actively released rich-text frameworks — [npm: lexical](https://www.npmjs.com/package/lexical); [npm: slate](https://www.npmjs.com/package/slate); [npm: platejs](https://www.npmjs.com/package/platejs)

**Generators, converters, viewers**

| Library | Role | License | Latest (npm, 21 Nov 2026) |
| --- | --- | --- | --- |
| `docx` (dolanmiu) | Generate DOCX from code | MIT | 9.16.0, 2026-11-19 |
| `@office-open/docx` | Generate/parse/patch DOCX from JSON | MIT | 0.15.3, 2026-11-18 (first publish May 2026) |
| `mammoth` | DOCX → clean semantic HTML | BSD-2-Clause | 1.13.0, 2026-09-26 (6.3k stars) |
| `docx-preview` | DOCX → HTML viewer | Apache-2.0 | 0.4.1, 2026-09-21 (2.2k stars) |
| `html-to-docx` (privateOmega) | HTML → DOCX | MIT | 1.8.0, 2023-03-26 (stale) |
| `@turbodocx/html-to-docx` | Maintained fork of the above | MIT | 1.23.3, 2026-10-30 |
| `docxtemplater` | Template filling | MIT core | 3.71.1, 2026-10-15 |
| `docx-wasm` (docx-rs) | Rust read/write via WASM | MIT | 0.4.23-rc1, 2026-07-28 |
| `docx4js` | Parser | MIT | 3.3.0, 2024-09-09 |

- Sources for the table: [npm: docx](https://www.npmjs.com/package/docx), [npm: @office-open/docx](https://www.npmjs.com/package/@office-open/docx), [npm: mammoth](https://www.npmjs.com/package/mammoth), [npm: docx-preview](https://www.npmjs.com/package/docx-preview), [npm: html-to-docx](https://www.npmjs.com/package/html-to-docx), [npm: @turbodocx/html-to-docx](https://www.npmjs.com/package/@turbodocx/html-to-docx), [npm: docxtemplater](https://www.npmjs.com/package/docxtemplater), [npm: docx-wasm](https://www.npmjs.com/package/docx-wasm), [npm: docx4js](https://www.npmjs.com/package/docx4js)
- docx-rs describes itself as "Read and write .docx files with Rust, WebAssembly, and JavaScript" (crate line 0.4) — [bokuweb/docx-rs README](https://raw.githubusercontent.com/bokuweb/docx-rs/main/README.md)
- docx-preview's author says there is no final parsing approach or API yet; only `renderAsync` is considered stable — [docxjs README](https://github.com/VolodymyrBaydalka/docxjs)
- Mammoth has deprecated its own Markdown output and recommends converting its HTML with a separate library — [mammoth.js README](https://github.com/mwilliamson/mammoth.js)

### Inferences
- **License fit for private use:** AGPL-3.0 (SuperDoc, ONLYOFFICE, ranuts/document) imposes no practical obligation on a single user running the software privately; obligations arise on distributing the app or offering it to others over a network, at which point the whole combined app would need to be AGPL-compatible or a commercial license bought. This should be recorded as a constraint on ever publishing the app.
- **EigenPal's open-core shift is the key 2026 change:** the Apache-2.0 packages now give rendering, layout and basic editing, but review features need the Pro package. For a personal app that must show and preserve other people's tracked changes and comments, the open part alone is likely insufficient (whether the open core at least preserves such markup untouched on save is unverified).
- **SuperDoc is the strongest "embed a component" candidate** on features-per-license, but risks are: AGPL, a contribution model closed to outside PRs, extremely rapid version churn (three repo/org renames and ~1,800 releases), and a commercial vendor that could re-license future versions (the AGPL versions already published would remain usable).
- **ONLYOFFICE is the highest-fidelity open option** by maturity and scope (it also covers xlsx/pptx/pdf for the wider suite), at the cost of a large opaque codebase that is hard to restyle or integrate with a custom UI; `ranuts/document` shows the serverless path works, but it is a community project depending on unofficial WASM builds.
- No Rust-native option reaches editor level: docx-rs is a reader/writer library, useful for generation or extraction in a Tauri backend, not for round-trip editing.
- A hybrid is viable: use a native engine for true .docx editing, and use mammoth/pandoc only for one-way "import DOCX into Markdown notes" and `docx`/pandoc for "export Markdown to DOCX".

### Gaps
- GitHub stars for docx, tiptap, lexical, BlockNote, Slate, CKEditor 5, docx-rs, prosemirror-docx and turbodocx could not be read (GitHub API blocked; page scraping returned nothing). Only the counts in the table above are verified.
- GitHub release dates for SuperDoc, EigenPal and ONLYOFFICE were not retrievable; npm publish dates are used instead. ONLYOFFICE 10.0's release date and what its "updated open source license" in 9.4 changed were not confirmed.
- How each editor behaves on complex real-world documents (legal contracts with nested numbering, academic papers with equations and citations, heavily floated layouts) is unverified by any independent source found; this needs a hands-on test corpus.
- EigenPal Pro and SuperDoc commercial pricing were not found. Whether EigenPal offers free Pro use for personal/non-commercial projects is unknown.
- Whether SuperDoc still uses ProseMirror internally in 2.x was not confirmed.
- Collabora Online's WASM/offline status and the TDF "LibreOffice Online on Qt 6 + WASM" prototype were mentioned only in a secondhand forum post ([trashbox.ru](https://trashbox.ru/link/2026-05-27-libre-office-dlya-veba-i-mobilnyh-ustrojstv)) and are unverified.

## 4. Markdown editing: editors, parsers, extensions, and lossless save

### Takeaway
The architecture choice decides losslessness: editors that keep the Markdown text as the document (CodeMirror 6 with decorations, Obsidian-style live preview) save byte-for-byte what the user typed, while editors that parse into a rich-text tree (Milkdown/ProseMirror, Tiptap, Lexical, BlockNote) re-serialise and therefore normalise the source on every save. For a file-based local app, a CodeMirror 6 source-of-truth editor with live-preview decorations is the safer base.

### Cited Findings
**Editor components**

| Library | Model | License | Latest (npm, 21 Nov 2026) |
| --- | --- | --- | --- |
| CodeMirror 6 (`@codemirror/view`, `@codemirror/lang-markdown`) | Text is the document; decorations for rendering | MIT | view 6.43.15 (2026-10-19); lang-markdown 6.5.2 (2026-08-04); `@lezer/markdown` 1.8.1 |
| Milkdown (`@milkdown/kit`, `@milkdown/crepe`) | ProseMirror tree + remark | MIT | 7.23.0 (2026-10-27) |
| Tiptap Markdown (`@tiptap/markdown`) | ProseMirror tree | MIT | 3.35.0 (2026-11-20); official package first published 2025-10-14 |
| `tiptap-markdown` (community) | ProseMirror tree | MIT | 0.9.0 (2025-09-08) |
| `prosemirror-markdown` | ProseMirror tree + markdown-it | MIT | 1.14.0 (2026-11-19) |
| Lexical (`@lexical/markdown`) | Lexical tree | MIT | 0.53.0 (2026-10-28) |
| BlockNote | Block tree on ProseMirror/Tiptap | MPL-2.0 | 0.57.0 (2026-10-30) |
| Vditor | Three modes (WYSIWYG, instant rendering, split view) | MIT | 4.0.1 (2026-10-18) |
| Toast UI Editor | Markdown + WYSIWYG dual mode | MIT | 3.2.3; npm shows "Package no longer supported" |
| Monaco | Code editor, text is the document | MIT | 0.57.0 (2026-09-24) |
| Atomic Editor (`@atomic-editor/editor`) | CM6 Obsidian-style live preview, React | MIT | 0.6.2 (2026-07-11) |

- Sources: [npm: @codemirror/view](https://www.npmjs.com/package/@codemirror/view), [npm: @codemirror/lang-markdown](https://www.npmjs.com/package/@codemirror/lang-markdown), [npm: @lezer/markdown](https://www.npmjs.com/package/@lezer/markdown), [npm: @milkdown/crepe](https://www.npmjs.com/package/@milkdown/crepe), [npm: @tiptap/markdown](https://www.npmjs.com/package/@tiptap/markdown), [npm: tiptap-markdown](https://www.npmjs.com/package/tiptap-markdown), [npm: prosemirror-markdown](https://www.npmjs.com/package/prosemirror-markdown), [npm: @lexical/markdown](https://www.npmjs.com/package/@lexical/markdown), [npm: @blocknote/core](https://www.npmjs.com/package/@blocknote/core), [npm: vditor](https://www.npmjs.com/package/vditor), [npm: @toast-ui/editor](https://www.npmjs.com/package/@toast-ui/editor), [npm: monaco-editor](https://www.npmjs.com/package/monaco-editor), [npm: @atomic-editor/editor](https://www.npmjs.com/package/@atomic-editor/editor)
- Milkdown is "A plugin-driven WYSIWYG markdown Editor, inspired by Typora, built on top of prosemirror and remark" — [Milkdown README](https://raw.githubusercontent.com/Milkdown/milkdown/main/README.md)
- The three UX models: a live-preview editor like Obsidian "shows rendered text inline but reveals raw syntax when your cursor enters a block", whereas Typora-style WYSIWYG "hides all syntax and renders formatting in place"; split view shows source and preview side by side — [AFFiNE: Typora vs Obsidian](https://affine.pro/blog/typora-vs-obsidian)
- Atomic Editor's design statement: "Raw markdown is the source of truth. Every decoration is view-only, so copy, save, and round-trip through any other markdown tool are byte-for-byte identical to a plain textarea"; "CM6 renders only the viewport... open a 500-page document and scroll stays smooth"; includes in-place table editing, wiki links, task checkboxes, lazy-loaded code highlighting — [npm: @atomic-editor/editor](https://www.npmjs.com/package/@atomic-editor/editor)
- Other CM6 live-preview building blocks exist but are small or stale: `codemirror-live-markdown` 0.5.1-alpha.1 (2026-01-18), `@retronav/ixora` 0.3.3 (2023), `codemirror-rich-markdoc` 0.0.2 (2024); HyperMD (CM5) is dead since 2018 — [npm: codemirror-live-markdown](https://www.npmjs.com/package/codemirror-live-markdown); [npm: @retronav/ixora](https://www.npmjs.com/package/@retronav/ixora); [npm: hypermd](https://www.npmjs.com/package/hypermd)
- One app (Markra 2.0.0) reported moving its editor core "from Milkdown / ProseMirror completely to CodeMirror 6", describing it as effectively a rewrite (single Chinese-language anecdote) — [sspai.com](https://sspai.com/post/112810)
- remark-stringify cannot promise round-tripping: it "will do its best to serialize markdown to match the syntax tree, but there are several cases where that is impossible"; output is canonicalised to CommonMark with configurable but global style options (`bullet`, `fence`, `incrementListMarker`, ...) — [remark-stringify](https://unifiedjs.com/explore/package/remark-stringify/)
- Parser versions: `remark` 15.0.1 (2023-09-18), `unified` 11.0.5, `micromark` 4.0.3 (2026-09-26), `mdast-util-to-markdown` 2.2.4 (2026-11-20), `markdown-it` 15.0.3 (2026-10-16), `remark-gfm` 4.0.1 (tables, task lists, strikethrough, footnotes, autolinks), `remark-frontmatter` 5.0.0 (YAML/TOML), `remark-math` 6.0.0; all MIT — [npm: remark](https://www.npmjs.com/package/remark); [npm: micromark](https://www.npmjs.com/package/micromark); [npm: markdown-it](https://www.npmjs.com/package/markdown-it); [npm: remark-gfm](https://www.npmjs.com/package/remark-gfm); [npm: remark-frontmatter](https://www.npmjs.com/package/remark-frontmatter); [npm: remark-math](https://www.npmjs.com/package/remark-math)
- Rendering add-ons: KaTeX 0.19.1 (MIT, 2026-10-23), Mermaid 12.3.0 (MIT, 2026-11-03) — [npm: katex](https://www.npmjs.com/package/katex); [npm: mermaid](https://www.npmjs.com/package/mermaid)

### Inferences
- **Guaranteeing "no reformat on save":** (1) keep the file's text as the editor state and apply rendering purely as view decorations — nothing is serialised, so nothing changes; (2) if a tree-based WYSIWYG mode is offered, use position-aware patching: parse with micromark/mdast (which records source offsets), and on save rewrite only the byte ranges of nodes the user actually changed, leaving untouched nodes as original text; (3) as a fallback, detect the document's existing conventions (bullet character, emphasis marker, fence style, list indentation, hard-wrap) and feed them into the serialiser options — this reduces but does not eliminate diffs; (4) always preserve front matter, HTML blocks and unknown syntax as opaque raw nodes; (5) test with an idempotency suite (open → save with no edits must be byte-identical).
- Typical normalisations a tree-based editor introduces: `*`↔`-` bullets, `_`↔`*` emphasis, renumbered ordered lists, re-aligned table pipes, escaped characters (`\_`, `\*`), collapsed blank lines, reflowed hard-wrapped paragraphs, reference-style links inlined, setext headings converted to ATX, trailing whitespace line breaks changed, raw HTML altered or dropped.
- Recommended shape: CodeMirror 6 + `@codemirror/lang-markdown` (Lezer incremental parser with GFM) as the single engine for both Markdown and plain text, with live-preview decorations (hide markers off the active line, render images, KaTeX, Mermaid, task checkboxes, table widgets), a toggle to raw source, and an optional read-only preview rendered by markdown-it or remark for export.
- Milkdown/Crepe gives the most Typora-like experience out of the box, and is the pragmatic choice only if canonicalised Markdown on save is acceptable (e.g. for notes created inside the app, not for files shared in git).
- Toast UI Editor should be treated as unmaintained/at risk given the npm deprecation banner on its latest version; Vditor is maintained and is the only listed editor shipping all three modes, but it is a monolithic widget with its own engine (Lute).

### Gaps
- milkdown.dev, tiptap.dev and codemirror.net docs were unreachable, so details such as Crepe's feature list, `@tiptap/markdown`'s exact round-trip guarantees, and the Lezer Markdown extension list are unverified.
- Obsidian is closed source; that it uses CodeMirror 6 for Live Preview rests on secondary reports ([everydev.ai](https://www.everydev.ai/tools/atomic-editor)).
- The Toast UI deprecation message is npm's generic "Package no longer supported" text on a version dated 2026-11-15; the reason was not investigated and should be checked before ruling it in or out.
- No benchmark comparing editing latency of these editors on very large Markdown files was found.

## 5. Plain text: large files, encodings, line endings, CodeMirror 6 vs Monaco

### Takeaway
CodeMirror 6 is the better fit for a writing-oriented local app (small, modular, mobile-capable, viewport-rendered, same engine as the Markdown editor); Monaco brings a VS Code-grade code experience at many times the bundle size and weak mobile support. Encoding and line-ending fidelity is not solved by either editor and must be handled by the app's file layer.

### Cited Findings
- Replit measured that "monaco-editor and related libraries contributed a whopping 51.17 MB to our bundle size (5.01 MB when parsed + gzipped)" and describes CodeMirror 6 as having "first class mobile support"; it notes Monaco "doesn't work well on mobile" — [Replit: Betting on CodeMirror](https://replit.com/blog/codemirror); [Replit: code editors comparison](https://replit.com/blog/code-editors)
- Sourcegraph migrated from Monaco to CodeMirror, noting that "CodeMirror ships without unneeded parts by default" — [Sourcegraph: Migrating from Monaco to CodeMirror](https://sourcegraph.com/blog/migrating-monaco-codemirror)
- Third-party size estimates vary widely (CodeMirror 6 roughly 50-400 kB depending on features; Monaco roughly 1-5 MB or more); treat as rough — [pkgpulse comparison](https://www.pkgpulse.com/guides/monaco-editor-vs-codemirror-6-vs-sandpack-in-browser-2026)
- CodeMirror 6 renders only the viewport; a CM6-based editor reports smooth scrolling on a "500-page document... even on iOS" — [npm: @atomic-editor/editor](https://www.npmjs.com/package/@atomic-editor/editor)
- CodeMirror publishes a "million lines" demo of a huge document **[background, page not reachable this session]** — [codemirror.net/examples/million](https://codemirror.net/examples/million/)
- Encoding libraries: `jschardet` 4.1.0 (0BSD, 2026-10-25) and `chardet` 2.2.0 (MIT, 2026-06-20) for detection; `iconv-lite` 0.7.3 (MIT, 2026-07-03) for decoding/encoding legacy charsets — [npm: jschardet](https://www.npmjs.com/package/jschardet); [npm: chardet](https://www.npmjs.com/package/chardet); [npm: iconv-lite](https://www.npmjs.com/package/iconv-lite)
- `@codemirror/merge` 6.12.3 (MIT) provides a diff/merge view, useful for "file changed on disk" and version comparison — [npm: @codemirror/merge](https://www.npmjs.com/package/@codemirror/merge)

### Inferences
- **File-layer rules to implement:** read bytes, not strings; detect BOM (UTF-8/16LE/16BE) first, then try strict UTF-8 decode, then fall back to statistical detection with a user-visible override; remember encoding, BOM presence, dominant line ending (LF/CRLF/CR, and flag mixed endings) and whether the file ended with a newline; write back with exactly those properties unless the user changes them; show them in a status bar.
- **CodeMirror specifics [background, verify at** [codemirror.net/docs/ref](https://codemirror.net/docs/ref/)**]:** CM6 normalises line breaks internally and can re-emit a chosen separator (`EditorState.lineSeparator`), so mixed line endings are not preserved per line unless the app handles it; its known weak spot is extremely long single lines (minified/one-line files), not line count.
- **Large files:** beyond roughly tens of MB, any in-memory browser editor becomes impractical; the app should switch to a degraded mode (no highlighting/wrapping, or read-only chunked viewer) above a size threshold, and offload search to the native side (Rust/Node) if a desktop shell is used.
- Using one engine (CM6) for .txt and .md halves the surface area: shared keymaps, search, spellcheck integration, theming and focus/typewriter modes.

### Gaps
- No authoritative numeric file-size limits for CodeMirror 6 or Monaco were found; thresholds must be measured on target hardware.
- Monaco's large-file optimisations and tokenisation limits were not checked against its docs.

## 6. Conversions, word count, offline spellcheck, print/PDF

### Takeaway
Pandoc is now a first-class in-browser converter (official WASM build since 3.9, February 2026), which makes docx ↔ md ↔ html conversion possible entirely offline; high-fidelity DOCX → PDF still needs a real layout engine (the DOCX editor's own paginator, LibreOffice, or ONLYOFFICE's x2t), and offline proofing is best covered by Harper for English plus a Hunspell-dictionary speller for other languages.

### Cited Findings
- Pandoc 3.9 (2026-02-04) is "the first release for which an official wasm version is available"; it ships a `wasm/pandoc.js` bridge; pandoc.org/app converts in the browser client-side — [pandoc-announce: 3.9](https://groups.google.com/g/pandoc-announce/c/znue-42hMeI); [Haskell Discourse](https://discourse.haskell.org/t/ann-pandoc-3-9-wasm/13659); [pandoc.org/app](https://pandoc.org/app)
- `pandoc-wasm` npm 1.1.0 (GPL-2.0-or-later, 2026-06-11): "includes the official pandoc.wasm binary (currently version 3.9). No additional downloads are required"; the 3.9 wasm zip is listed at 16.2 MB — [npm: pandoc-wasm](https://www.npmjs.com/package/pandoc-wasm); [SourceForge mirror 3.9](https://sourceforge.net/projects/pandoc.mirror/files/3.9)
- A newer Pandoc 3.11 dated 29 Aug 2026 is reported by Wikipedia (snippet only) — [Wikipedia: Pandoc](https://en.wikipedia.org/wiki/Pandoc)
- Pandoc DOCX features: `--reference-doc` to supply output styles, `custom-style` attributes and the `styles` extension to map named Word styles, `native_numbering`, `--track-changes`, `--extract-media`; PDF engines include `typst`, `weasyprint`, `pagedjs-cli`, `prince`, `wkhtmltopdf`, LaTeX engines — [pandoc MANUAL.txt](https://raw.githubusercontent.com/jgm/pandoc/main/MANUAL.txt)
- A browser-only DOCX → PDF pipeline using Pandoc WASM + Typst WASM has been demonstrated — [dev.to: Browser-based DOCX to PDF using Pandoc and Typst WASM](https://dev.to/maxslashwang/browser-based-docx-to-pdf-converter-using-pandoc-and-typst-wasm-1o7g)
- Typst in the browser: `@myriaddreamin/typst.ts` 0.7.0 (Apache-2.0, 2026-06-01) — [npm: @myriaddreamin/typst.ts](https://www.npmjs.com/package/@myriaddreamin/typst.ts)
- HTML → Markdown: `turndown` 7.2.5 (MIT, 2026-11-04); DOCX → HTML: `mammoth` 1.13.0 — [npm: turndown](https://www.npmjs.com/package/turndown); [npm: mammoth](https://www.npmjs.com/package/mammoth)
- EigenPal ships `@docx-editor.dev/docx-to-markdown` (open) and `@docx-editor.dev/docx-to-pdf` ("Convert DOCX to PDF on Node.js with searchable text, embedded fonts, and comments", Pro license) — [eigenpal/docx-editor README](https://raw.githubusercontent.com/eigenpal/docx-editor/main/README.md); [npm: @docx-editor.dev/docx-to-pdf](https://www.npmjs.com/package/@docx-editor.dev/docx-to-pdf)
- SuperDoc's CLI can "inspect, convert, and edit .docx files from a terminal or a script" — [npm: @superdoc/cli](https://www.npmjs.com/package/@superdoc/cli)
- Paged.js (`pagedjs` 0.4.3, MIT) has had no npm release since 2023-07-06 — [npm: pagedjs](https://www.npmjs.com/package/pagedjs)
- Harper (Automattic): English-only grammar checker in Rust, Apache-2.0, `harper.js` 3.2.0 (2026-11-13); "it take[s] milliseconds to lint a document, take[s] less than 1/50th of LanguageTool's memory footprint", "small enough to load via WebAssembly"; "Harper currently only supports English" — [Harper README](https://raw.githubusercontent.com/Automattic/harper/master/README.md); [npm: harper.js](https://www.npmjs.com/package/harper.js)
- Harper's author on LanguageTool: needs "gigabytes of RAM" and the "~16GB n-gram dataset" and takes "several seconds to lint even a moderate-size document" (author's claim, not a benchmark) — [Harper README](https://raw.githubusercontent.com/Automattic/harper/master/README.md)
- A hands-on review found Harper catching spelling but missing some grammar errors — [It's FOSS](https://itsfoss.com/harper-grammar-checker/)
- Spelling libraries: `nspell` 2.1.5 (MIT, last release 2021-01-17, pure-JS Hunspell-compatible); `hunspell-asm` 4.0.2 (2020); `hunspell-wasm` 0.3.0 (2024-10-31, LGPL/GPL/MPL tri-license); `typo-js` 2.0.0 (BSD-3-Clause, 2026-11-16); `spellchecker-wasm` 0.4.0 (MIT, SymSpell-based, 2026-10-18) — [npm: nspell](https://www.npmjs.com/package/nspell); [npm: hunspell-asm](https://www.npmjs.com/package/hunspell-asm); [npm: hunspell-wasm](https://www.npmjs.com/package/hunspell-wasm); [npm: typo-js](https://www.npmjs.com/package/typo-js); [npm: spellchecker-wasm](https://www.npmjs.com/package/spellchecker-wasm)

### Inferences
- **Suggested conversion matrix:** md → html (markdown-it/remark); md → docx (Pandoc WASM with a reference doc for styling; `docx` npm if finer control is needed); docx → md (Pandoc WASM, or mammoth → turndown for cleaner semantic output); docx → pdf (print from the DOCX engine's paginated view, or LibreOffice headless / ONLYOFFICE x2t for fidelity; Pandoc → Typst only for "content, not layout" fidelity); md → pdf (Pandoc → Typst WASM for typeset output, or render HTML and print through the shell's Chromium `printToPDF` with `@page` CSS); html → md (turndown).
- Pandoc's GPL-2.0-or-later license applies to the WASM binary too; fine for private use, a distribution constraint otherwise. The ~16 MB binary should be lazy-loaded on first conversion.
- Paged.js looks stagnant on npm; relying on the browser engine's native CSS paged-media support plus Chromium `printToPDF` (Electron `webContents.printToPDF`, or the system webview's print path in Tauri) is the lower-risk default for Markdown printing. Typst is the better route when page-accurate, book-quality output matters.
- Spellcheck layering: use the OS/webview native spellchecker where available (free, multilingual); add Harper for offline English grammar; add a Hunspell-dictionary library (nspell is unmaintained but stable; typo-js and hunspell-wasm are alternatives) where the native checker is missing, such as inside a canvas-rendered DOCX engine. LanguageTool local server is the multilingual grammar option but is heavy.
- Word count: straightforward from text, but should use `Intl.Segmenter` for CJK/Thai word segmentation and exclude Markdown syntax, front matter and code blocks; for DOCX, count from the engine's text model so that footnotes/headers can be included or excluded as Word does.

### Gaps
- pandoc.org was unreachable; WASM-build limitations (the search summary says Lua filters work unless they run system commands, and that some features are sandbox-limited) were not confirmed from the manual, and it is unverified whether PDF output is possible from the WASM build without a separate engine.
- No source was fetched for LibreOffice headless conversion quality, Chromium `printToPDF` options, CSS paged-media support levels, or LanguageTool's current local-server requirements.
- Harper's bundle size and non-English roadmap were not verified.

## 7. UX benchmarks: what makes Typora, iA Writer, Notion, Apple Pages and Obsidian pleasant

### Takeaway
The writing-app qualities people praise are mostly about removing chrome and keeping the caret in a stable place: inline rendering without a preview pane, focus and typewriter modes, keyboard-first block insertion, an always-available outline, and typography that is good by default.

### Cited Findings
- Typora: Focus Mode "blurs the others, helping you focus only on the current line"; Typewriter Mode "always keeps the currently active line in the middle of the window"; toggled from the View menu, default shortcuts F8 and F9 — [Typora support: Focus and Typewriter Mode](https://support.typora.io/Focus-and-Typewriter-Mode)
- Typora's defining trait is seamless live preview with no separate preview window or mode switch — [typora.io](https://typora.io/); [AFFiNE: Typora vs Obsidian](https://affine.pro/blog/typora-vs-obsidian)
- iA Writer's Focus Mode has three settings: Sentence, Paragraph and Typewriter — [iA Writer support: Focus Mode](https://ia.net/writer/support/editor/focus-mode)
- Obsidian has no built-in typewriter or focus mode; users add them via community plugins (e.g. Typewriter Mode: "typewriter scroll, writing focus, current line highlight, paragraph dimming") — [obsidian-typewriter-mode](https://github.com/davisriedel/obsidian-typewriter-mode); [Obsidian forum](https://forum.obsidian.md/t/moving-over-from-typora-can-i-replicate-the-focus-and-typewriter-modes/30818)
- Obsidian-style live preview shows rendered text but reveals raw syntax where the cursor is — [AFFiNE: Typora vs Obsidian](https://affine.pro/blog/typora-vs-obsidian)

**Commonly cited strengths [background, not re-verified; see** [Notion help](https://www.notion.com/help), [Apple Pages user guide](https://support.apple.com/guide/pages/welcome/mac), [iA Writer](https://ia.net/writer), [Obsidian help](https://help.obsidian.md/)**]**
- Typora: outline and file-tree sidebar, theme-by-CSS, in-place table and math editing, auto-pairing of Markdown markers, export via Pandoc, image paste with configurable copy-to-folder.
- iA Writer: one carefully tuned typeface family and measure, syntax highlighting of parts of speech (adjectives, nouns, adverbs, verbs, conjunctions) for editing, style check, plain files on disk, very few settings.
- Notion: `/` slash-command menu, blocks draggable by handle, Markdown shortcuts that convert as you type, turn-into, toggle blocks, inline `@` mentions and page links, hover toolbar on selection.
- Apple Pages: templates, a context-sensitive format inspector instead of a ribbon, alignment guides for objects, strong default typography, clean track-changes and comments UI, page-layout vs word-processing modes.
- Obsidian: local Markdown files as the source of truth, command palette and quick switcher, backlinks/wiki links, split panes and tabs, plugin ecosystem, source/live-preview/reading mode toggle.

### Inferences
- A shortlist worth copying for the document module: (1) inline live preview with no split pane as the default; (2) focus mode (dim all but current sentence/paragraph) and typewriter scrolling; (3) slash menu plus Markdown input shortcuts in both the Markdown and DOCX editors; (4) persistent, collapsible outline with drag-to-reorder; (5) command palette and quick file switcher; (6) a contextual inspector rather than a dense ribbon for DOCX formatting; (7) fixed comfortable measure (about 60-75 characters), good default fonts, light/dark themes; (8) live word/character/reading-time counts with selection awareness and optional targets; (9) silent autosave with version snapshots; (10) paste/drop images saved next to the file.
- With CodeMirror 6, focus and typewriter modes are implementable as small view plugins (line decorations for dimming, scroll margins/`scrollIntoView` centring), which is another reason to keep one text engine.

### Gaps
- No user-research or review source was fetched that ranks which of these features drive satisfaction; the Notion, Pages and Obsidian strengths are background knowledge.
- iA Writer's syntax-highlight feature page was not fetched.

## 8. Bottom line: recommended options and risks

### Takeaway
For DOCX, choose between SuperDoc (best balance of fidelity, features in the open build and hackability; AGPL) and ONLYOFFICE via x2t-WASM (highest maturity and breadth; AGPL; hard to customise), keeping EigenPal's Apache-2.0 core as the permissive but review-feature-limited alternative; for Markdown and plain text, build on CodeMirror 6 with live-preview decorations so files are never reformatted, and use Pandoc WASM for conversions.

### Cited Findings
- SuperDoc is AGPL-3.0 with tracked changes, comments, headers/footers and paginated layout in the open build, needs no server, and writes back to OOXML **[vendor claim on fidelity]** — [SuperDoc README](https://raw.githubusercontent.com/superdoc/docx-editor/main/README.md)
- EigenPal's permissively licensed core excludes tracked changes, comments, collaboration and DOCX → PDF, which require a commercial agreement for production use — [eigenpal/docx-editor](https://github.com/eigenpal/docx-editor)
- ONLYOFFICE is AGPL-3.0, covers documents/spreadsheets/presentations/PDF, and has a community serverless WASM packaging — [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer); [ranuts/document](https://github.com/ranuts/document)
- Tiptap and CKEditor DOCX conversion are paid, service-backed features — [Tiptap pricing](https://tiptap.dev/pricing); [CKEditor Import from Word](https://ckeditor.com/docs/ckeditor5/latest/features/import-word.html)
- CM6-based live preview keeps Markdown byte-identical; ProseMirror/remark-based editors cannot promise that — [npm: @atomic-editor/editor](https://www.npmjs.com/package/@atomic-editor/editor); [remark-stringify](https://unifiedjs.com/explore/package/remark-stringify/)
- Pandoc runs officially in WASM since 3.9 — [pandoc-announce: 3.9](https://groups.google.com/g/pandoc-announce/c/znue-42hMeI)

### Inferences
**DOCX options**

| Option | Best for | Main risks |
| --- | --- | --- |
| SuperDoc (AGPL-3.0) | "Most hackable with real fidelity": embeddable component, custom UI on a document API, headless SDK/CLI for automation and AI edits as tracked changes | AGPL if the app is ever distributed; vendor-controlled (no outside PRs), very fast churn and repeated renames; fidelity claims unverified on complex documents; must pin versions |
| ONLYOFFICE sdkjs + x2t WASM (AGPL-3.0), e.g. via ranuts/document | "Best fidelity and breadth": most mature open engine, same stack also handles xlsx/pptx/pdf | Large, opaque, canvas-based UI that resists restyling and deep integration; serverless WASM path is community-maintained; AGPL; heavy assets |
| EigenPal core (Apache-2.0) | Permissive license, modern layout engine, React/Vue adapters, DOCX → Markdown | Review features and PDF export are commercial; project is under a year old; open-core boundary may move again |
| LibreOffice (headless native, or ZetaOffice WASM) | Conversion backend (DOCX → PDF, legacy .doc/.odt/.rtf import) rather than the editing UI | Large binary; WASM wrapper has had no npm release since May 2025; UI not embeddable in a custom design |
| Tiptap/Lexical/BlockNote + exporters | Authoring new documents that are merely exported to .docx | Not a DOCX editor; import of existing files is lossy; paid extensions for the better converters |

- **Suggested approach:** treat .docx as a "foreign format edited by a dedicated engine" and never route it through the Markdown/rich-text model. Prototype SuperDoc and the ONLYOFFICE WASM build against a personal corpus of 20-30 real documents (contracts with multilevel numbering, a thesis with footnotes/TOC/equations, a letterhead with header images and text boxes, a document with tracked changes and threaded comments, RTL/CJK samples) and score: opens without error, visual match to Word, save-reopen-in-Word integrity, XML part diff, tracked-change/comment survival.
- **Safety net regardless of engine:** open originals read-only by default or auto-snapshot before first save; warn when a document contains features the engine reports as unsupported; offer "export a copy" as the default save path until the corpus test passes.
- **Markdown/TXT:** CodeMirror 6 for both, Markdown text as the source of truth, live preview through decorations (build on or learn from `@atomic-editor/editor`, MIT), KaTeX and Mermaid widgets, GFM tables with a cell-editing widget, front matter preserved as an opaque block, encoding/line-ending/BOM preserved by the file layer. Offer Milkdown Crepe only as an optional full-WYSIWYG mode with an explicit "this will normalise formatting" caveat, or skip it.
- **Risks for MD/TXT:** live-preview decorations in CM6 are substantial custom work (tables, nested lists, cursor behaviour around hidden markers, IME and mobile edge cases); the small open-source live-preview packages are young; very long lines and very large files need a degraded mode.
- **Cross-cutting:** Pandoc WASM (GPL) for conversions, Harper (Apache-2.0) for English grammar, native or Hunspell-dictionary spelling, Chromium print-to-PDF or Typst for Markdown PDFs, the DOCX engine's own paginator for DOCX PDFs.

### Gaps
- The recommendation between SuperDoc and ONLYOFFICE cannot be settled from published material; no independent fidelity comparison exists in what was reachable, so a hands-on bake-off is required.
- Commercial terms (SuperDoc commercial license, EigenPal Pro) and whether either offers free personal-use terms are unknown.
- Hosts that need to be allowed to close the verification gaps: docs.superdoc.dev, docx-editor.dev, pandoc.org, codemirror.net, milkdown.dev, tiptap.dev, learn.microsoft.com, ecma-international.org, officeopenxml.com, news.ycombinator.com, api.github.com.
