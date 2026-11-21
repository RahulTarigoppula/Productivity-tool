# Spreadsheets (.xlsx / .csv) for a personal, local-first all-in-one office app

Research date: 2026-11-21. Versions and dates below were read from the npm registry, crates.io and PyPI on that day unless noted. Stars were read from GitHub repo pages on that day.

Access caveat for the report writer: this session could not reach docs.univer.ai, docs.sheetjs.com, handsontable.com, ironcalc.com, learn.microsoft.com or ecma-international.org directly (network allowlist). Facts from those sites come from search-result summaries of the pages, not a full read, and are marked "(search summary)". GitHub repo pages and package registries were read directly. Items I know from background knowledge but could not source this session are in Inferences or Gaps, never in Cited Findings.

---

## 1. XLSX format: package structure and round-trip fidelity pitfalls

### Takeaway
An .xlsx is a ZIP of many interrelated XML parts, and almost every JS library reads it into its own object model and re-serializes, so anything outside that model (charts, pivot caches, shapes, macros, threaded-comment metadata) is silently dropped on save. The only reliable route to lossless save is to keep the original package and patch only the parts you changed, passing everything else through byte-for-byte.

### Cited Findings

Mechanism of loss
- SheetJS, ExcelJS and xlsx-populate "all parse workbooks into proprietary object models, then re-serialize them as new files", so content outside the model (charts, pivot caches, macros) can be dropped. Source is promotional for a competing library; the mechanism claim is consistent with the other findings below. — [DEV Community article](https://dev.to/pavkode/addressing-javascript-excel-library-flaws-a-new-approach-to-prevent-data-loss-and-ensure-2e5d)
- Microsoft's own position is that .xlsx preserves chart data and features; the loss comes from the library, not the format. (search summary) — [Microsoft Support](https://support.microsoft.com/excel/excel-formatting-and-features-that-are-not-transferred-to-other-file-formats)
- SheetJS has a long-standing issue titled "Charts in file breaks roundtrip". — [git.sheetjs.com issue 111](https://git.sheetjs.com/sheetjs/sheetjs/issues/111)
- openpyxl (Python reference point): "openpyxl does currently not read all possible items in an Excel file so images and charts will be lost from existing files"; its reader code warns DrawingML support is limited to charts and images and "shapes and drawings will be lost". (search summary) — [openpyxl reader source](https://openpyxl.readthedocs.io/en/3.0/_modules/openpyxl/reader/drawings.html); [openpyxl issue 847](https://foss.heptapod.net/openpyxl/openpyxl/-/issues/847)
- A competitor's feature matrix rates SheetJS CE, ExcelJS and xlsx-js-style round-trip as "Partial", and lists ExcelJS with no pivot-table support and SheetJS CE as read-only for pivots. Competitor marketing; verify. (search summary) — [hucre README](https://raw.githubusercontent.com/productdevbook/hucre/main/README.md)
- The `@protobi/exceljs` fork advertises "Pivot table and chart round-trip preservation (read files with existing pivot tables/charts, write them back without corruption)" as something upstream ExcelJS lacks, with 6 PRs pending upstream. — [npm @protobi/exceljs](https://www.npmjs.com/package/@protobi/exceljs)
- xlsx-populate describes itself as having "a focus on keeping existing workbook features and styles in tact" (it edits the original XML rather than rebuilding), but its last release was 1.21.0 on 2020-03-01. — [npm xlsx-populate](https://www.npmjs.com/package/xlsx-populate)

Dates
- Excel treats 1900 as a leap year (it was not), a deliberate Lotus 1-2-3 compatibility choice; Microsoft says fixing it is possible but the disadvantages outweigh the advantages. WEEKDAY is wrong for dates before 1 March 1900. (search summary) — [Microsoft KB 214326](https://support.microsoft.com/kb/214326)
- There are two date systems, 1900 and 1904, differing by 1,462 days; a workbook read under the wrong one is about four years off. (search summary) — [Microsoft: 1900 and 1904 date system](https://learn.microsoft.com/en-US/office/troubleshoot/excel/1900-and-1904-date-system)
- IronCalc rounds results to 15 significant digits "as Excel does" (v0.9.0), an example of numeric-semantics matching that engines must do. — [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)

Dynamic arrays, LAMBDA, new functions
- A dynamic-array workbook needs a sheet-metadata relationship to an `xl/metadata.xml` part; each spill anchor cell carries a `cm` attribute pointing to a record there (record type XLDAPR). A `UNIQUE` example has `cm="1"` plus an array-type formula. (search summary) — [openpyxl-users thread](https://groups.google.com/g/openpyxl-users/c/aacD5eRiP7w); [OfficeCLI write-up](https://instagit.com/iofficeai/OfficeCLI/how-does-the-formula-evaluation-engine-handle-excel-dynamic-arrays/)
- Dynamic arrays are written as `t="array"` with a `ref` range on the formula element; the difference from legacy CSE array formulas is the metadata flag. (search summary) — [Telerik docs](https://www.telerik.com/document-processing-libraries/documentation/libraries/radspreadprocessing/features/formulas/dynamic-array-formulas)
- Newer functions are stored with an `_xlfn.` prefix (e.g. `_xlfn.LAMBDA`); FILTER is stored as `_xlfn._xlws.FILTER`. A writer that omits the prefix produces `#NAME?` in Excel. (search summary) — [libxlsxwriter: working with formulas](https://libxlsxwriter.github.io/working_with_formulas.html); [libxlsxwriter issue 311](https://github.com/jmcnamara/libxlsxwriter/issues/311)
- openpyxl has an open feature request for cell metadata (the `cm` mechanism), i.e. even mature libraries lack it. (search summary) — [openpyxl issue 1898](https://foss.heptapod.net/openpyxl/openpyxl/-/issues/1898)
- openpyxl users report a VLOOKUP using a named Table (structured reference) being corrupted on save. (search summary) — [openpyxl-users thread](https://groups.google.com/g/openpyxl-users/c/VN-NhB84MUg)

Comments
- Threaded comments live in `xl/threadedComments/threadedComment{N}.xml` with authors in `xl/persons/person.xml` (namespace `http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments`). A legacy comment is written alongside as a fallback; older Excel shows it as plain text prefixed "[Threaded comment]". (search summary) — [MS-XLSX spec](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/e0fb917a-1107-409a-852f-13b47aea70dc); [sheetkit-xml source](https://docs.rs/crate/sheetkit-xml/0.5.1/source/src/threaded_comment.rs)
- LibreOffice re-saving an xlsx with threaded comments destroys the threading metadata. (search summary) — [LibreOffice bug 127105](https://lists.freedesktop.org/archives/libreoffice-bugs/2019-August/211141.html)

Themes and styles
- IronCalc only gained correct theme-colour resolution against the workbook's theme file in v0.8.0 and theme-tint writing in v0.9.0, showing theme/tint handling is a real fidelity item. — [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)

### Inferences
- Package map (background knowledge of ECMA-376 / MS-XLSX, not fetched this session; the report writer should cite [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/) and [MS-XLSX](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/2c5dee00-eff2-4b22-92b6-0738acd4475e) after checking): `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml` (sheets, defined names, calc properties, date1904 flag, workbook views), `xl/_rels/workbook.xml.rels`, `xl/worksheets/sheetN.xml` (cells, merges, sheet views and freeze panes, conditional formatting, data validations, autofilter, hyperlinks, page setup), `xl/sharedStrings.xml`, `xl/styles.xml` (number formats, fonts, fills, borders, cellXfs, dxfs), `xl/theme/theme1.xml`, `xl/calcChain.xml`, `xl/tables/tableN.xml`, `xl/pivotTables/` plus `xl/pivotCache/` (definition and records), `xl/drawings/` plus `xl/charts/` (DrawingML), `xl/media/`, `xl/comments*.xml` plus VML drawing for legacy notes, `xl/threadedComments/`, `xl/persons/`, `xl/externalLinks/`, `xl/metadata.xml`, `xl/vbaProject.bin` (xlsm only, opaque binary), `docProps/`, `customXml/`.
- Likely loss list when reading into a typical JS model and re-writing: charts and chartsheets, pivot tables and caches, slicers and timelines, shapes/SmartArt/text boxes, sparklines and other `extLst` extensions (newer conditional-format types such as data bars with extended options and icon sets live in `x14` extensions), threaded-comment threading, external links, VBA project, custom XML, theme (colours then shift), `cm`/`vm` cell metadata (dynamic arrays degrade to legacy arrays and get implicit-intersection `@`), rich-data types and in-cell images, print settings, workbook protection, unknown attributes on known elements.
- Shared formulas (`<f t="shared" si="N" ref="...">` on a master cell, bare `<f t="shared" si="N"/>` on followers) must be expanded with correct relative-reference shifting on read; an editor that edits the master cell without rewriting followers corrupts them. No source found this session; standard knowledge.
- `calcChain.xml` is a derived cache: the safe approach when formulas change is to delete the part, its relationship and its content-type override, and set full-recalc-on-load. No source found this session.
- Cached values: each formula cell stores its last computed value. If the app's engine cannot compute a function, it should keep the cached value and formula text untouched rather than writing an error.
- Number formats: a date is only a number plus a format code; built-in format IDs (e.g. 14) are locale-dependent in Excel, so type inference must go through the style, never the value.
- Lossless-save strategy that follows from all of this: keep the original ZIP entries in memory or on disk; track dirty parts; regenerate only dirty worksheet XML (ideally patching rows/cells within the original XML so unknown attributes and `extLst` survive); append to rather than rebuild `styles.xml` and `sharedStrings.xml`; pass every unknown part and relationship through unchanged; drop `calcChain`. This is what xlsx-populate and the paid SheetJS Pro "edit" tier do in spirit, and what Rust `umya-spreadsheet` aims at.

### Gaps
- I could not read ECMA-376 or MS-XLSX directly this session, so the package map above is unsourced here.
- No source found describing exactly which style data SheetJS CE drops when reading and rewriting a file; needs a direct test.
- No measured round-trip test matrix (library by feature) from a neutral party was found. The app should build its own corpus test: open, save, diff the part list and XML.
- How LET specifically is stored (prefix, metadata) was not confirmed by any source.

---

## 2. Feature inventory by tier (Excel / Google Sheets / ONLYOFFICE)

### Takeaway
The open-source building blocks cover the must-have and most of the expected tier today; the advanced tier (pivot tables, slicers, charts round-trip, macros, Power Query) is where every permissive-licence option is thin and where ONLYOFFICE (AGPL) or a commercial layer is the only complete answer.

### Cited Findings
- Univer's Apache-2.0 core covers: cell styles, merged cells, in-cell rich text, freeze panes, floating images, undo/redo, formulas, defined names, filtering, sorting, data validation, conditional formatting, hyperlinks, comments, find and replace. Charts, shapes, pivot tables, SmartArt, collaboration and XLSX import/export are commercial. — [dream-num/univer README](https://github.com/dream-num/univer)
- FortuneSheet (MIT) covers: formatting, borders, fill, merged cells, row/column insert/delete/hide, sort, filter, copy/paste, built-in formulas, images, comments, data validation, undo/redo, fill handle, format painter, conditional formatting, find and replace, freeze panes. Pivot tables and charts are unchecked roadmap items. — [ruilisi/fortune-sheet](https://github.com/ruilisi/fortune-sheet)
- IronCalc's own 1.0 milestone lists arrays and array formulas, merged cells, pivot tables and dynamic arrays as targets, which is a fair proxy for what a new engine considers "complete". (search summary of the IronCalc GitHub org roadmap) — [github.com/ironcalc](https://github.com/ironcalc)
- By v0.9.0 (15 Oct 2026) IronCalc shipped dynamic arrays with spill operator, SORT/SORTBY/FILTER/UNIQUE/SEQUENCE/RANDARRAY/TEXTSPLIT, LET, LAMBDA, merged cells, name manager, autofill, i18n; pivot tables and charts are not in the release notes. — [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)
- HyperFormula added dynamic-array-style functions only in 2026: VSTACK, HSTACK and SORT or UNIQUE in 3.4.0 (10 Aug 2026), 12 database functions in 3.3.0 (20 May 2026). (search summary) — [HyperFormula release notes](https://hyperformula.handsontable.com/docs/guide/release-notes)
- ONLYOFFICE Docs 10.0 (Oct 2026) spreadsheet additions: charts from non-adjacent data, AutoComplete setting for cell values, save-as XLS, Ctrl+D fill down; open roadmap items include smooth scrolling and iterative calculations. (search summary) — [ONLYOFFICE roadmap](https://helpcenter.onlyoffice.com/docs/docs-roadmap.aspx); [ONLYOFFICE blog, Nov 2026](https://www.onlyoffice.com/blog/2026/11/onlyoffice-10-features-you-asked-for)
- ONLYOFFICE has a product page for pivot tables and filters in its spreadsheet editor. (search result title only) — [ONLYOFFICE pivot tables and filters](https://www.onlyoffice.com/en/spreadsheet-editor/pivot-tables-and-filters.aspx)
- AG Grid gates Formulas, Pivoting and Excel Export to its commercial Enterprise edition. — [npm ag-grid-community README](https://www.npmjs.com/package/ag-grid-community)

### Inferences
Suggested tiering for the plan (synthesis; feature names are common knowledge of the three products):
- Must-have: multi-sheet workbook; cell editing with formula bar; ~150 core functions (SUM, AVERAGE, COUNT, IF/IFS, VLOOKUP, INDEX/MATCH, SUMIF(S), COUNTIF(S), text and date functions); relative/absolute references; number/date/currency/percent formats; font, fill, borders, alignment, wrap; merge cells; row/column insert, delete, resize, hide; freeze panes; sort and autofilter; find/replace; fill handle and Ctrl+D/Ctrl+R; undo/redo; copy/paste including paste-values and paste from Excel/Sheets via HTML/TSV clipboard; basic charts (column, bar, line, pie, scatter); CSV and XLSX open/save.
- Expected: conditional formatting (rules, colour scales, data bars, icon sets); data validation with dropdown lists; named ranges and name manager; tables with structured references; custom number-format codes; notes and comments; hyperlinks; images; print areas, page setup, PDF export; grouping/outline; cell protection; text-to-columns; remove duplicates; XLOOKUP, dynamic arrays (FILTER, SORT, UNIQUE, SEQUENCE), LET.
- Advanced: pivot tables and pivot charts; slicers and timelines; LAMBDA and helper functions (MAP, REDUCE, BYROW); what-if (goal seek, data tables, scenario manager, Solver); macros (VBA in Excel, Apps Script in Sheets, JS macros in ONLYOFFICE); Power Query / Power Pivot data model; external links; sparklines; threaded comments; real-time collaboration (out of scope for single-user).
- For a personal offline tool the pragmatic cut is: build must-have plus the expected tier; for the advanced tier aim at "preserve on round trip, show a read-only placeholder" rather than "edit".

### Gaps
- No single authoritative source enumerating ONLYOFFICE Spreadsheet's support for slicers, macros, LAMBDA and dynamic arrays was reached; the help centre should be checked.
- No source reached for a function-count comparison across Excel, Google Sheets and ONLYOFFICE.

---

## 3. UI grid / spreadsheet component libraries

### Takeaway
Univer is the most complete permissively licensed spreadsheet UI in late 2026 but keeps XLSX import/export, charts, pivots and printing behind a commercial layer with a capped free tier; IronCalc is the most promising fully open (MIT/Apache) engine-plus-UI with native XLSX I/O but is still pre-1.0. Luckysheet is dead, FortuneSheet and x-spreadsheet are slow-moving, and Handsontable and AG Grid are not viable open-source choices for full spreadsheet features.

### Cited Findings

| Library | Licence | Latest (date) | Stars | Rendering | Notes |
|---|---|---|---|---|---|
| Univer | Apache-2.0 core; Pro separately licensed | 1.5.2 (2026-11-16) | 31.0k | Canvas | see below |
| Luckysheet | MIT | 2.1.13 (2021-01-19) | 16.6k | Canvas | archived 2025-10-30 |
| FortuneSheet | MIT | 1.0.4 (2025-11-06) | ~3.8k | Canvas + React | Luckysheet successor |
| Handsontable | proprietary (trial / commercial / non-commercial on application) | 18.1.3 (2026-11-20) | 22.1k | DOM, virtualized | ~400 formulas via HyperFormula |
| jspreadsheet CE | MIT | 5.0.4 (2025-08-25) | 7.2k | DOM table | Pro is commercial |
| x-spreadsheet | MIT | 1.1.9 (2021-05-20) | not read | Canvas | stale |
| RevoGrid | MIT core; Pro paid | 4.31.8 (2026-11-19) | not read | virtual DOM | data grid, not a spreadsheet |
| AG Grid Community | MIT; Enterprise commercial | 36.3.0 (2026-11-04) | not read | DOM, virtualized | formulas, pivot, Excel export are Enterprise |
| Glide Data Grid | MIT | 6.0.3 (2024-02-03) | ~5.4k | Canvas | no release for ~2.75 years |
| IronCalc | MIT OR Apache-2.0 | 0.9.1 (2026-10-21) | 4.3k | web app in React | engine in Rust/WASM |
| ONLYOFFICE Docs | AGPL-3.0 | 10.0.x (Oct 2026) | 7.1k | Canvas | full suite |

Rendering-column caveat: only Univer, Glide Data Grid, ONLYOFFICE (canvas) and RevoGrid (virtual DOM) were confirmed by sources this session. The rendering entries for Luckysheet, FortuneSheet, x-spreadsheet, Handsontable, jspreadsheet CE, AG Grid and IronCalc are background knowledge and unverified; the FortuneSheet page itself only says "native React ... immer for DOM and state management".

Sources for the table: versions and licences from [registry.npmjs.org](https://registry.npmjs.org/) entries for `@univerjs/core`, `luckysheet`, `@fortune-sheet/react`, `handsontable`, `jspreadsheet-ce`, `x-data-spreadsheet`, `@revolist/revogrid`, `ag-grid-community`, `@glideapps/glide-data-grid`, `@ironcalc/wasm`; stars from the GitHub pages cited below.

Univer
- 31.0k stars; open-source packages Apache-2.0, "commercial SDK modules are licensed separately"; rendering is "the Canvas rendering and layout engine behind the editors". — [dream-num/univer](https://github.com/dream-num/univer)
- XLSX import/export is a Pro feature using `@univerjs-pro/exchange-client` (licence field on npm: "Univer Office SDK Licensing", v1.5.2, 2026-11-16). — [npm @univerjs-pro/exchange-client](https://www.npmjs.com/package/@univerjs-pro/exchange-client); [Univer import/export docs](https://docs.univer.ai/guides/sheets/features/import-export) (search summary)
- Unlicensed free-tier limits of Pro features: watermark; import capped at files under 1 MB; export capped at 10k cells; one pivot table per document; printing capped at 3 pages; charts limited to a few basic types. (search summary) — [Univer Pro licence docs](https://docs.univer.ai/guides/pro/license)
- Export "by unit ID" requires the collaboration server; without it, snapshot export is used, which suggests the exchange path is tied to Univer's server-side conversion service. (search summary) — [Univer import/export docs](https://docs.univer.ai/guides/sheets/features/import-export); [Univer server file exchange](https://docs.univer.ai/server/import-export)
- Vendor claims: 500+ built-in functions; Canvas2D renderer at 50–60 FPS scrolling up to 6M cells; loading 10 million cells within 500 ms; formula engine can run in a Web Worker or on a server; Pro performance report cites 20,000 formulas over random ranges in 1.32 s. All vendor-published, no independent benchmark found. (search summary) — [Univer performance report](https://docs.univer.ai/guides/pro/performance-report); [univer README](https://raw.githubusercontent.com/dream-num/univer/dev/README.md)
- Community workaround: `@mertdeveci55/univer-import-export` (MIT, v0.2.1, 2026-01-05), a LuckyExcel-derived converter claiming formulas, styling, images, charts and conditional formatting on import; its own plan document says "fundamental limitations in the ExcelJS library prevent complete Excel compatibility". Single maintainer, no release since Jan 2026. — [npm package](https://www.npmjs.com/package/@mertdeveci55/univer-import-export); [plan.md](https://app.unpkg.com/@mertdeveci55/univer-import-export@0.1.40/files/plan.md)
- Univer is embedded by other local-first note apps (Trilium spreadsheets note type; Obsidian plugins), a useful precedent. (search result titles) — [Trilium docs](https://docs.triliumnotes.org/user-guide/note-types/spreadsheets); [Obsidian Univer plugin](https://community.obsidian.md/plugins/univer)

Luckysheet / FortuneSheet
- Luckysheet: "This repository was archived by the owner on Oct 30, 2025"; "Luckysheet is no longer maintained. It is recommended to use the upgraded version of Univer". 16.6k stars, MIT. — [dream-num/Luckysheet](https://github.com/dream-num/Luckysheet). Note: AlternativeTo says archived March 2024; the GitHub banner (primary) says Oct 30, 2025. — [AlternativeTo](https://alternativeto.net/software/luckysheet/about)
- FortuneSheet: ~3.8k stars, MIT, 982 commits; formula engine is "a fork of handsontable/formula-parser"; XLSX not built in; pivot tables and charts unchecked on roadmap; README warns the API may change before 1.0 and that some docs are outdated. — [ruilisi/fortune-sheet](https://github.com/ruilisi/fortune-sheet)
- XLSX for FortuneSheet is a third-party plugin, `@corbe30/fortune-excel` (MIT, v2.3.5, 2026-10-22). — [npm @corbe30/fortune-excel](https://www.npmjs.com/package/@corbe30/fortune-excel)

Handsontable
- Three licence options: time-limited evaluation trial; paid commercial ("For commercial use, a paid license is required"); free non-commercial only on application ("Non-commercial projects, such as teaching or academic research, may qualify for a free license"). Not open source. — [handsontable/handsontable](https://github.com/handsontable/handsontable)
- Handsontable left open source for a non-commercial licence years ago. (search result title) — [Handsontable blog](https://handsontable.com/blog/?p=1263)

jspreadsheet CE
- MIT, 7.2k stars; v5 separates spreadsheet and worksheets (tabs). The open-source version lacks a full formula engine and built-in Excel import/export; those are in Pro. (search summary of vendor blog) — [jspreadsheet/ce](https://github.com/jspreadsheet/ce); [Jspreadsheet CE vs Pro](https://bossanova.uk/jspreadsheet/blog/jspreadsheet-ce-vs-pro)

RevoGrid, AG Grid, Glide Data Grid
- RevoGrid: "Render 1M+ rows and millions of cells with no hard row limit"; virtual DOM keeps only the viewport rendered; has a paid Pro tier. — [npm @revolist/revogrid](https://www.npmjs.com/package/@revolist/revogrid)
- AG Grid Community lacks Formulas, Pivoting, Excel Export and Integrated Charting (Enterprise only). — [npm ag-grid-community](https://www.npmjs.com/package/ag-grid-community)
- Glide Data Grid: "A canvas-based data grid, supporting millions of rows, rapid updating, and native scrolling"; no formulas; "Filtering and sorting are something you would have to implement with your data source". — [glideapps/glide-data-grid](https://github.com/glideapps/glide-data-grid)

IronCalc
- 4.3k stars, MIT OR Apache-2.0, 2,336 commits, 241 open issues; self-described as early: "An early preview of the technology running entirely in your browser", "We don't have a vibrant community just yet". Repo contains "the main engine and the xlsx reader and writer". Bindings: Python, JS (WASM), Node.js. — [ironcalc/IronCalc](https://github.com/ironcalc/IronCalc)
- `@ironcalc/wasm` is the engine only; XLSX import/export ships as a separate WASM package `@ironcalc/wasm-xlsx` since v0.9.0. — [npm @ironcalc/wasm](https://www.npmjs.com/package/@ironcalc/wasm); [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)
- Release cadence: v0.5.0 "MVP" Feb 2025; v0.6.0 Oct 2025; v0.7.0 Jan 2026; v0.8.0 29 Jul 2026 (array formulas, dynamic arrays, spill, LET, LAMBDA); v0.9.0 15 Oct 2026 (merged cells in UI, streaming parser, lower memory per cell, IndexedDB storage, only formula cells evaluated); v0.9.1 21 Oct 2026. Years inferred from npm/crates dates because the releases page omits them. — [IronCalc releases](https://github.com/ironcalc/IronCalc/releases); [crates.io ironcalc](https://crates.io/crates/ironcalc)

ONLYOFFICE
- AGPL-3.0; 7.1k stars; components: sdkjs (client-side editor API), web-apps (UI), core (format conversion incl. XLS/XLSX/ODS/CSV), server. Version 10.0 with ~50 features; 10.0.2 branch active Oct 2026. Community edition: "Up to 20" recommended users. Desktop Editors (Windows, macOS, Linux) "edit files offline". — [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)
- Built in JavaScript on HTML5 Canvas with Node.js server side. (search summary) — [ONLYOFFICE technology FAQ](https://guides.onlyoffice.com/faq/technology.aspx)
- The open-source edition of 10.0 removed built-in AI; it is installed separately. (search summary, Japanese blog) — [ONLYOFFICE Docs 10 blog](https://www.onlyoffice.com/blog/2026/10/onlyoffice-docs-10)
- A third-party project runs the x2t converter compiled to WebAssembly for in-browser conversion. (search summary, third party) — [mvp-onlyoffice listing](https://awesome.ecosyste.ms/projects/github.com%2Felectroluxcode%2Fmvp-onlyoffice)

### Inferences
- "OSS vs paid" for Univer in one line: the grid, formula engine, formatting, filter/sort, validation, conditional formatting and comments are Apache-2.0; XLSX in/out, charts, pivots, print, sparklines-class features and collaboration are not, and the free tier's 1 MB import / 10k-cell export caps make the official exchange path unusable for a real personal tool without a licence. The workable open route is Univer core plus your own XLSX layer writing to Univer's snapshot JSON.
- DOM-rendered grids (Handsontable, jspreadsheet CE, RevoGrid, AG Grid) virtualize well for row counts but are record-grid shaped; canvas renderers (Univer, FortuneSheet, x-spreadsheet, Glide, ONLYOFFICE) are the norm for true spreadsheet behaviour (merged cells, overflow text, frozen panes, arbitrary selection). For 100k+ rows the grid is rarely the bottleneck; parsing, the data model's memory per cell and recalculation are.
- Glide Data Grid (no npm release since Feb 2024) and x-spreadsheet (2021) should be treated as unmaintained unless the report writer confirms recent commits.
- Embedding ONLYOFFICE means running its document server (Node.js plus the native converter) locally or reusing Desktop Editors; it is a whole application, not a component, and AGPL-3.0 applies to anything linked into it (fine for private use, relevant if the app is ever distributed or offered as a service).

### Gaps
- Stars and last-commit dates for x-spreadsheet, RevoGrid and AG Grid were not read. Successor `wolf-table` status not checked.
- No independent 100k-row benchmark across these libraries was found; all performance numbers above are vendor claims.
- IronCalc's function count and its current published roadmap (ironcalc.com) could not be read. Whether its XLSX writer passes through unknown parts (charts, pivots) is unknown; given its "load into model, write from model" design it very likely does not.
- Univer Pro pricing is not public (contact sales), per search summaries of [Univer docs](https://docs.univer.ai/guides/sheets/getting-started/pro) and [G2](https://www.g2.com/products/univer/pricing).
- "GRID/other": not researched. `formualizer` (Rust, crates.io 0.14.0, 2026-11-08, "Embeddable spreadsheet engine — parse, evaluate & mutate Excel workbooks") surfaced via [crates.io](https://crates.io/crates/formualizer) but was not evaluated.

---

## 4. Formula engines

### Takeaway
HyperFormula is the most mature headless JS engine (423 functions, GPLv3 or paid) but only started adding dynamic-array functions in 2026; IronCalc is the permissive alternative with real dynamic arrays, LET and LAMBDA as of v0.8–0.9; Univer's engine is the broadest permissive JS option by vendor count (500+) but is coupled to Univer's model.

### Cited Findings
- HyperFormula: 3.5.0 (2026-10-09), licence `GPL-3.0-only` on npm, "GPLv3 or a commercial license"; use with `licenseKey: 'gpl-v3'`. 2.8k stars. Named expressions, undo/redo, 18 built-in languages, Excel and Google Sheets syntax compatibility modes, custom functions. — [npm hyperformula](https://www.npmjs.com/package/hyperformula); [handsontable/hyperformula](https://github.com/handsontable/hyperformula)
- HyperFormula built-in function total: 423. 2026 releases: 3.2.0 (19 Feb; IRR, N, VALUE; "Removing Scalability Limits"), 3.3.0 (20 May; 20 functions incl. DCOUNT–DVARP), 3.4.0 (10 Aug; VSTACK, HSTACK, XIRR and SORT or UNIQUE; function-introspection API), 3.5.0 (9 Oct; VERSION function; changed which API methods are gated by the licence key). (search summary) — [HyperFormula built-in functions](https://hyperformula.handsontable.com/docs/guide/built-in-functions.md); [release notes](https://hyperformula.handsontable.com/docs/guide/release-notes)
- IronCalc: Rust engine with WASM, Node and Python bindings; dynamic arrays, spill operator, implicit intersection, SORT/SORTBY/FILTER/UNIQUE/SEQUENCE/RANDARRAY/TEXTSPLIT, LET, LAMBDA (v0.8.0); 56 statistical functions in one PR plus database functions (v0.7.0); 15-significant-digit rounding and "only cells with formulas are evaluated" (v0.9.0). — [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)
- Univer engine: `@univerjs/engine-formula` 1.5.2, Apache-2.0; vendor says 500+ functions, array formulas, named ranges, worker or server execution. (search summary for the count) — [npm @univerjs/engine-formula](https://www.npmjs.com/package/@univerjs/engine-formula); [Univer docs home](https://docs.univer.ai/)
- formula.js (`@formulajs/formulajs` 4.6.1, 2026-07-28, MIT): a function library, not an engine (no parser, no dependency graph). Semantic differences from Excel: DATE, DATEVALUE, EDATE, EOMONTH, NOW, TODAY "return plain JS Date instead of the serial Excel number", so `DATE(2020,5,9) - DATE(2020,5,8)` gives 86400000 instead of 1. — [npm @formulajs/formulajs](https://www.npmjs.com/package/@formulajs/formulajs)
- fast-formula-parser (1.0.19, 2020-11-26, MIT): Chevrotain-based parser/evaluator, claims "at least 3x faster" than the older formula-parser; no release in six years. — [npm fast-formula-parser](https://www.npmjs.com/package/fast-formula-parser)
- FortuneSheet uses a fork of handsontable/formula-parser (the pre-HyperFormula library). — [ruilisi/fortune-sheet](https://github.com/ruilisi/fortune-sheet)
- Grist (Apache-2.0) takes a different route: formulas are full Python evaluated by a sandboxed interpreter per document, with many Excel functions available; documents are SQLite files. (search summary) — [gristlabs/grist-core](https://github.com/gristlabs/grist-core)

### Inferences
- XLOOKUP, IFS, SUMIFS, INDEX/MATCH and VLOOKUP support in HyperFormula 3.x and in Univer is expected but was not individually verified this session; HyperFormula's late addition of SORT/UNIQUE/VSTACK suggests its array model is closer to legacy array formulas than to Excel's spill semantics. Verify against the built-in functions list before committing.
- GPLv3 for HyperFormula is acceptable for a private single-user tool; it would require the whole app to be GPL-compatible if ever distributed. The 3.5.0 licence-key gating change is worth reading before adoption.
- LibreOffice Calc via LibreOfficeKit (LOK) gives the highest function coverage and Excel-compatibility of any open option (MPL-2.0), but it is a native, heavyweight dependency rendered as tiles, not a JS engine; it suits a "convert/recalculate in a sidecar process" role, not an in-page grid. No source was fetched for LOK this session.
- A Rust/WASM engine (IronCalc) in a Web Worker avoids main-thread stalls on recalculation and gives the same engine for a desktop shell (Tauri) and the web.

### Gaps
- No independent recalculation benchmark (HyperFormula vs IronCalc vs Univer) found. Univer's 1.32 s for 20,000 formulas is vendor data for the Pro build.
- IronCalc total function count not obtained.
- LOK and Collabora Online were not researched (no sources fetched).
- Volatile functions, iterative calculation, and locale-dependent parsing (argument separators, decimal comma) compatibility were not compared.

---

## 5. File I/O libraries (XLSX)

### Takeaway
No open JS library round-trips charts and pivot tables reliably: SheetJS CE is the best reader but writes almost no styling, upstream ExcelJS has had no release since October 2023, and the forks that add pass-through are young. A Rust core via WASM (calamine to read fast, umya-spreadsheet or a custom patcher to edit in place, rust_xlsxwriter to write new files) is the most actively maintained base.

### Cited Findings
- SheetJS CE: Apache-2.0, 36.3k stars on the GitHub mirror; source moved to git.sheetjs.com; "Scripts and NodeJS modules are available at https://cdn.sheetjs.com". The npm `xlsx` package is frozen at 0.18.5 (2022-03-24); 0.20.3 exists only via the CDN tarball and third-party republishes (e.g. `xlsx-republish` 0.20.3, 2024-09-17). — [SheetJS/sheetjs](https://github.com/SheetJS/sheetjs); [npm xlsx](https://www.npmjs.com/package/xlsx); [npm xlsx-republish](https://www.npmjs.com/package/xlsx-republish)
- SheetJS Pro (paid) is where styling lives ("let out your inner Picasso with styling"), plus editing complex templates, images, graphs, PivotTables and formula evaluation. — [SheetJS/sheetjs README](https://github.com/SheetJS/sheetjs)
- Community styling fork `xlsx-js-style` (Apache-2.0) adds alignment, border, fill, font, numFmt, but its last release is 1.2.0 on 2022-04-05. — [npm xlsx-js-style](https://www.npmjs.com/package/xlsx-js-style)
- ExcelJS: MIT, 15.5k stars, 670 open issues and 159 open PRs; last npm release 4.4.0 on 2023-10-19, over three years ago; Snyk rates maintenance Inactive; still ~3M weekly downloads. — [exceljs/exceljs](https://github.com/exceljs/exceljs); [npm exceljs](https://www.npmjs.com/package/exceljs); [Snyk](https://security.snyk.io/package/npm/exceljs) (search summary)
- ExcelJS forks: `@protobi/exceljs` (4.4.0-protobi.10, 2026-05-07; self-described "Temporary Fork", adds pivot/chart round-trip preservation and security maintenance); `@zurmokeeper/exceljs` (4.4.9, 2025-02-26); `@cj-tech-master/excelts` (10.2.0, 2026-06-12, MIT, a TypeScript rewrite line); `@mui/x-internal-exceljs-fork` (internal to MUI, ~99.8k weekly downloads per Snyk, search summary). — [npm @protobi/exceljs](https://www.npmjs.com/package/@protobi/exceljs); [npm @zurmokeeper/exceljs](https://www.npmjs.com/package/@zurmokeeper/exceljs); [npm @cj-tech-master/excelts](https://www.npmjs.com/package/@cj-tech-master/excelts)
- xlsx-populate: MIT, preserve-in-place design, encryption support, README has a "Missing Features" section; last release 1.21.0 on 2020-03-01. — [npm xlsx-populate](https://www.npmjs.com/package/xlsx-populate)
- Rust: `calamine` 0.38.0 (2026-11-02; reader); `rust_xlsxwriter` 0.103.0 (2026-11-18; "A Rust library for writing Excel 2007 xlsx files", write-only, 7.1M downloads); `umya-spreadsheet` 4.0.0-beta.1 (2026-10-26; "pure Rust to read and write xlsx", 1.6M downloads; a limitations page exists for its Elixir wrapper); `edit-xlsx` 0.4.6 (2024-11-02, stale). — [crates.io calamine](https://crates.io/crates/calamine); [crates.io rust_xlsxwriter](https://crates.io/crates/rust_xlsxwriter); [crates.io umya-spreadsheet](https://crates.io/crates/umya-spreadsheet); [UmyaSpreadsheet limitations](https://hexdocs.pm/umya_spreadsheet_ex/limitations.html)
- IronCalc ships its own XLSX reader and writer in Rust, published for the browser as `@ironcalc/wasm-xlsx` (export works on wasm32 since v0.9.0). — [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)
- openpyxl (Python reference): 3.1.5, last release 2024-06-28; maintainer has "no plans to extend the support" for unread items. — [PyPI openpyxl](https://pypi.org/project/openpyxl/); [openpyxl-users](https://groups.google.com/g/openpyxl-users/c/G2YDgF6v0ZM) (search summary)
- ONLYOFFICE's `core` component is the open (AGPL) converter for XLS, XLSX, ODS and CSV. — [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)
- `fflate` 0.8.3 (2026-05-16, MIT) is a current, fast ZIP library suitable for a custom package patcher. — [npm fflate](https://www.npmjs.com/package/fflate)

### Inferences
- Preservation on round trip, best current understanding (needs the app's own corpus test to confirm):
  - SheetJS CE: values, formulas, number formats, merges, basic column/row props, comments, defined names survive; cell styles, images, charts, pivots, conditional formatting and data validation are not written by CE.
  - ExcelJS 4.4.0: styles, number formats, images, conditional formatting, data validation, tables, notes, defined names, views/freeze panes and page setup are modelled and re-written; charts, pivot tables read from a file, slicers, shapes, VBA and threaded comments are dropped. The ExcelJS README could not be read this session, so this row is background knowledge.
  - xlsx-populate / umya-spreadsheet: keep unmodified XML, so more survives, with gaps where they do parse and re-emit.
  - `@protobi/exceljs`: explicitly targets chart/pivot pass-through; young and self-described temporary.
- Recommended architecture: separate "editing model" from "package preservation". On open, keep the raw ZIP entries; parse only the parts the editor understands; on save, re-emit those parts and copy the rest, fixing up `[Content_Types].xml` and relationships. This is implementable in TypeScript with fflate plus an XML tokenizer, or in Rust.
- Supply-chain note: installing SheetJS from a CDN tarball rather than npm means no npm audit/advisory flow; pin the tarball URL with an integrity hash or vendor it.

### Gaps
- ExcelJS README feature list and "known issues" could not be fetched (GitHub blob rendered without content; npm registry returns an empty readme).
- umya-spreadsheet's precise limitations (charts, pivots, conditional formats) not read.
- `excelts` capabilities (chart/pivot pass-through, streaming) not verified; npm readme field was empty.
- No source on WASM bundle sizes or parse speed for calamine vs SheetJS on a 100k-row file.

---

## 6. CSV

### Takeaway
Papa Parse remains the default browser CSV parser (actively released in Nov 2026) and covers delimiter detection, streaming and workers; the hard part is not parsing but refusing to coerce types and remembering the file's original dialect so save does not alter it.

### Cited Findings
- Papa Parse 5.7.1 (2026-11-11), MIT; "reliable and correct according to RFC 4180"; features: auto-detect delimiter, stream large files (also over HTTP), worker threads, fast mode, optional type conversion. — [npm papaparse](https://www.npmjs.com/package/papaparse)
- Delimiter auto-detection runs when `delimiter` is left blank, guessing from `delimitersToGuess`, default `[',', '\t', '|', ';', Papa.RECORD_SEP, Papa.UNIT_SEP]`, by scanning the first rows. (search summary) — [Papa Parse docs](https://www.papaparse.com/docs)
- Streaming "is necessary for large files which would otherwise crash the browser"; when streaming, results are delivered per step/chunk and are not available in the completion callback. In Node, `worker`, `download` and chunk-size options are unavailable. (search summary) — [@types/papaparse](https://app.unpkg.com/@types/papaparse@5.5.2/files/index.d.ts); [npm papaparse](https://www.npmjs.com/package/papaparse)
- Encoding for local files must be a value supported by the FileReader API; the library exposes `Papa.BYTE_ORDER_MARK` ('﻿'). (search summary) — [@types/papaparse](https://app.unpkg.com/@types/papaparse@5.5.2/files/index.d.ts)
- `dynamicTyping` converts numeric and boolean strings; guidance is to leave it off for identifiers with leading zeros or account numbers; it can be set per column with a function or object. (search summary) — [Papa Parse parsing docs mirror](https://tessl.io/registry/tessl/npm-papaparse/files/docs/parsing.md)
- Alternatives current in 2026: `csv-parse` 7.0.3 (2026-09-25, MIT), `d3-dsv` 3.0.2 (ISC). — [npm csv-parse](https://www.npmjs.com/package/csv-parse); [npm d3-dsv](https://www.npmjs.com/package/d3-dsv)

### Inferences
- Type-inference pitfalls to design against (well-known Excel behaviours; no source fetched this session): leading zeros stripped (ZIP codes, phone numbers, IDs); integers over 15 significant digits lose precision (IEEE-754 double; card numbers, long IDs); date-like strings auto-converted and locale-ambiguous (01/02/2026); gene-name-style strings turned into dates; scientific-notation lookalikes ("1E5"); values starting with `=`, `+`, `-`, `@` treated as formulas (CSV injection).
- Recommended behaviour: load every field as text; display with a non-destructive "looks like a number/date" presentation layer; only rewrite cells the user edited; offer an explicit "convert column" action.
- Dialect preservation: on open, record encoding, BOM presence, delimiter, quote character, quoting style (always vs minimal), line ending (CRLF/LF), trailing newline and header row; on save, write back the same dialect. Papa Parse reports the detected delimiter and line break in `meta`, but not encoding or BOM, so detect those from the raw bytes first (e.g. BOM sniff, then UTF-8 validity check, then fall back to a legacy code page chooser).
- Excel needs a UTF-8 BOM to open UTF-8 CSV correctly on double-click; offer "UTF-8 with BOM" as an export option but do not add one to files that lacked it.
- For very large CSV (hundreds of MB) parse in a worker in chunks into a columnar or row-chunk store and virtualize the grid; do not instantiate a spreadsheet cell object per field.

### Gaps
- Whether Papa Parse strips a leading BOM automatically was not confirmed by the sources.
- No benchmark figures for Papa Parse on 100k–1M row files were gathered.
- Encoding-detection libraries (jschardet, chardet ports) were not researched.

---

## 7. Charts

### Takeaway
All four mainstream chart libraries are healthy and permissively licensed; none reads or writes DrawingML, so chart round-trip is a mapping layer the app must own, and the realistic first goal is to preserve original chart XML untouched while rendering an approximation.

### Cited Findings
- Current versions and licences: ECharts 6.1.0 (2026-05-19, Apache-2.0); Chart.js 4.6.1 (2026-10-22, MIT); Plotly.js 4.3.0 (2026-11-10, MIT); Vega-Lite 6.5.0 (2026-10-08, BSD-3-Clause). — [npm echarts](https://www.npmjs.com/package/echarts); [npm chart.js](https://www.npmjs.com/package/chart.js); [npm plotly.js](https://www.npmjs.com/package/plotly.js); [npm vega-lite](https://www.npmjs.com/package/vega-lite)
- Univer's charts are a commercial plugin (`@univerjs-pro/sheets-chart`, "Univer Office SDK Licensing"); the unlicensed tier restricts charts to a few basic types. — [npm @univerjs-pro/sheets-chart](https://www.npmjs.com/package/@univerjs-pro/sheets-chart); [Univer Pro licence docs](https://docs.univer.ai/guides/pro/license) (search summary)
- ONLYOFFICE includes charts in the AGPL spreadsheet editor, and 10.0 added charts from non-adjacent data. (search summary) — [ONLYOFFICE roadmap](https://helpcenter.onlyoffice.com/docs/docs-roadmap.aspx)
- Web apps commonly break Excel charts and images on import/export; a vendor article is devoted to the causes. (search result, vendor blog, not read in full) — [Syncfusion blog](https://www.syncfusion.com/blogs/post/excel-charts-images-break-during-import-export)
- FortuneSheet has no charts (roadmap item); IronCalc release notes mention none. — [ruilisi/fortune-sheet](https://github.com/ruilisi/fortune-sheet); [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)
- rust_xlsxwriter is a writer for new xlsx files and is the Rust counterpart of the XlsxWriter family, which generates native Excel charts. (description only) — [crates.io rust_xlsxwriter](https://crates.io/crates/rust_xlsxwriter)

### Inferences
- DrawingML mapping: a chart is `xl/charts/chartN.xml` (`c:chartSpace` with plot types such as `c:barChart`, `c:lineChart`, `c:pieChart`, `c:scatterChart`; each `c:ser` has `c:cat`/`c:val` holding a range formula plus a cached copy of the data), anchored by `xl/drawings/drawingN.xml` and linked from the sheet by relationship. Newer chart types (waterfall, treemap, sunburst, histogram, box-and-whisker, funnel) use the separate `cx` "chartex" schema. Background knowledge; not sourced this session.
- A minimal internal chart model (type, series ranges, category range, titles, axes, legend position, colours) maps cleanly to ECharts options for column/bar/line/area/pie/doughnut/scatter/combo/radar. ECharts is the best fit: canvas rendering, broad type coverage, large-data modes, Apache-2.0. Chart.js is lighter with fewer types; Plotly is heavy but strong for scientific plots; Vega-Lite is declarative and good for an "explore data" mode rather than Excel-fidelity charts.
- Strategy: on import, parse the subset you can render, and keep the original chart part bytes. On save, if the chart was not edited, write the original part back (update only ranges if rows/columns shifted); if edited or new, generate fresh DrawingML from the internal model. Expect styling drift for edited charts.

### Gaps
- No open-source DrawingML-to-ECharts (or reverse) converter was identified this session.
- Whether ExcelJS forks or `excelts` can author charts (the hucre README claims ExcelJS-family support for 9 chart types) is unverified. — claim from [hucre README](https://raw.githubusercontent.com/productdevbook/hucre/main/README.md)

---

## 8. UX benchmarks: keyboard-first use

### Takeaway
Few sources on UX were reachable this session; the durable lesson from the products surveyed is that Excel-compatible keyboard behaviour is table stakes, and the newer tools differentiate on data model (Grist: relational plus Python; Quadratic: code cells) rather than on grid interaction. Two of the "newer tools" changed status in 2026 and should not be treated as stable references.

### Cited Findings
- Quadratic: Rust + WebAssembly + WebGL (PixiJS) grid with Python/Pandas cells. Licence history: a source-available licence ("Quadratic Source Available License 2024", classed non-commercial by a licence database); a Quadratic-authored page says that as of March 2026 it is closed-source. The GitHub repo URL returned HTTP 404 on 2026-11-21, consistent with that. Single secondary statement plus the 404; no primary announcement found. (search summary) — [Quadratic blog comparison](https://www.quadratichq.com/blog/comparing-the-5-best-open-source-spreadsheets); [licence database entry](https://scancode-licensedb.aboutcode.org/quadratic-sal-2024.html); [github.com/quadratichq/quadratic](https://github.com/quadratichq/quadratic)
- Rows: a Quadratic competitor page carries the headline "Rows shuts down May 31, 2026". Competitor-sourced and unverified. (search result title) — [Quadratic: Rows alternative](https://www.quadratichq.com/competitors/rows-alternative)
- Grist: grist-core is Apache-2.0, self-hostable via Docker, every document is a portable SQLite file, formulas are Python with many Excel functions; some features exist only in the hosted or paid edition. (search summary) — [gristlabs/grist-core](https://github.com/gristlabs/grist-core)
- ONLYOFFICE added Ctrl+D fill-down and an animated copy/cut selection outline only in 10.0 (2026), illustrating that even mature suites are still closing Excel keyboard-parity gaps. (search summary) — [ONLYOFFICE blog, Nov 2026](https://www.onlyoffice.com/blog/2026/11/onlyoffice-10-features-you-asked-for)
- Handsontable and RevoGrid both market "Excel-like" keyboard navigation and copy/paste from Excel and Google Sheets as core features. — [handsontable/handsontable](https://github.com/handsontable/handsontable); [npm @revolist/revogrid](https://www.npmjs.com/package/@revolist/revogrid)
- IronCalc's recent UI work: workbook search in a left drawer, Enter-to-confirm in modals, autofill incl. merged cells, dark mode. — [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)

### Inferences
Keyboard-first checklist distilled from Excel and Google Sheets conventions (common knowledge, not sourced this session):
- Navigation: arrows; Ctrl+arrows to jump to data-region edges; Ctrl+Shift+arrows to extend; Home / Ctrl+Home / Ctrl+End; PageUp/PageDown; Ctrl+PageUp/PageDown to switch sheets; Ctrl+G or a Name Box for go-to.
- Editing: type to overwrite, F2 to edit in place, Esc to cancel, Enter/Shift+Enter and Tab/Shift+Tab to commit and move, Alt+Enter for newline, Ctrl+Enter to fill the selection, F4 to cycle absolute references and to repeat the last action, Ctrl+D / Ctrl+R fill, Ctrl+; for today's date.
- Selection and structure: Shift+Space row, Ctrl+Space column, Ctrl+A region then all, Ctrl+Shift+Plus / Ctrl+Minus insert/delete, Ctrl+Shift+L toggle filter, Alt+Down open dropdown.
- Formula entry: autocomplete with argument hints, point-mode range picking with arrow keys while typing a formula, coloured range highlights.
- Formatting: Ctrl+B/I/U, Ctrl+1 format dialog, Ctrl+Shift+1..5 number formats.
- What each does well: Excel has the deepest keyboard model (Alt key-tip sequences reach every command); Google Sheets adds a searchable command menu (Alt+/) and the shortcut help overlay (Ctrl+/); Apple Numbers favours multiple free-floating tables on a canvas with typed columns and is less keyboard-dense; Grist and Quadratic show the value of typed columns, relational links and code cells. A command palette plus Excel-compatible shortcuts is the cheapest high-value combination for a personal tool.

### Gaps
- No primary sources were fetched for Excel, Google Sheets or Apple Numbers keyboard shortcuts or UX; the checklist above is unsourced.
- Rows' shutdown and Quadratic's closed-source move each rest on a single Quadratic-authored page; confirm before citing in the final report.
- No Hacker News or 2025–2026 developer comparison threads were retrieved.

---

## 9. Bottom line: recommended options and risks

### Takeaway
There is no single open component that delivers Excel-grade editing and lossless XLSX; pick by priority. Best fidelity is ONLYOFFICE (AGPL, heavyweight, hard to restyle). Most hackable with a real spreadsheet UI today is Univer core (Apache-2.0) with your own XLSX layer. Most open and future-proof is IronCalc (MIT/Apache, Rust/WASM, native XLSX) accepting pre-1.0 gaps.

### Cited Findings
- ONLYOFFICE Docs is AGPL-3.0, at version 10.0.x with ~50 new features and an active patch branch in Oct 2026, with an offline Desktop Editors build. — [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)
- Univer core is Apache-2.0, released 2026-11-16 (1.5.2), 31.0k stars; XLSX, charts, pivots and print are commercial with free-tier caps of 1 MB import and 10k-cell export. — [dream-num/univer](https://github.com/dream-num/univer); [Univer Pro licence docs](https://docs.univer.ai/guides/pro/license) (search summary)
- IronCalc is MIT OR Apache-2.0 at 0.9.1 (2026-10-21), with dynamic arrays, LET, LAMBDA and a WASM XLSX package, and describes itself as an early preview; pivot tables are a 1.0 target. — [ironcalc/IronCalc](https://github.com/ironcalc/IronCalc); [IronCalc releases](https://github.com/ironcalc/IronCalc/releases)
- HyperFormula is GPL-3.0-only or commercial, 423 functions, released 2026-10-09. — [npm hyperformula](https://www.npmjs.com/package/hyperformula); [HyperFormula built-in functions](https://hyperformula.handsontable.com/docs/guide/built-in-functions.md) (search summary)
- Upstream ExcelJS has not released since 2023-10-19; SheetJS CE is off npm and keeps styling in Pro. — [npm exceljs](https://www.npmjs.com/package/exceljs); [SheetJS/sheetjs](https://github.com/SheetJS/sheetjs)
- Luckysheet is archived; Quadratic appears closed; Glide Data Grid and x-spreadsheet have had no npm release since 2024 and 2021. — [dream-num/Luckysheet](https://github.com/dream-num/Luckysheet); [npm @glideapps/glide-data-grid](https://www.npmjs.com/package/@glideapps/glide-data-grid); [npm x-data-spreadsheet](https://www.npmjs.com/package/x-data-spreadsheet)

### Inferences
Option A, best fidelity: embed ONLYOFFICE (local document server or Desktop Editors components).
- For: closest to Excel across formulas, charts, pivots, conditional formatting, printing; the converter handles XLS/XLSX/ODS/CSV; one vendor also covers documents and slides, which matters for an all-in-one suite.
- Risks: AGPL-3.0 (fine privately, binding if distributed or hosted); needs a local Node.js service and native converter, so "local-first" means bundling a server; large footprint; UI is hard to restyle or integrate with the app's own data model; open-source edition lost bundled AI in 10.0; you inherit its release cadence.

Option B, most hackable today: Univer core + custom XLSX layer.
- For: Apache-2.0, very active, canvas grid, large function library, plugin architecture, worker-capable formula engine, same vendor has docs and slides components.
- Risks: you must build and maintain XLSX import/export yourself (convert to/from Univer snapshot JSON, plus the pass-through patcher from section 1); charts, pivots and print are not in the open core; the vendor's commercial boundary could move; the community converter is single-maintainer; performance claims are vendor-only.

Option C, most open and long-term: IronCalc engine (+ its React workbook or your own grid).
- For: permissive dual licence, Rust engine usable in web, Node, Python and a Tauri shell; native XLSX reader/writer; true dynamic arrays, LET, LAMBDA; fast release cadence through 2026.
- Risks: pre-1.0 with API churn; no charts or pivot tables; conditional formatting and data validation status unknown; XLSX writer almost certainly does not preserve unknown parts; small community (4.3k stars, 241 open issues).

Option D, assemble from parts: canvas or virtual-DOM grid (Glide Data Grid, RevoGrid) + HyperFormula (GPLv3) + SheetJS CE or an ExcelJS fork + ECharts.
- For: maximum control over UX and data model.
- Risks: most engineering effort; you re-implement spreadsheet interaction (selection model, fill handle, merged cells, formula editing); HyperFormula's GPL; ExcelJS upstream is stalled and forks are fragmented; Glide Data Grid looks unmaintained.

Suggested path for a personal tool: start with B or C behind an internal workbook interface so the engine can be swapped; implement the "keep original package, patch dirty parts" saver from day one because it is what protects the user's existing files regardless of engine; treat charts and pivots as preserve-and-display-read-only at first; use Papa Parse with text-only loading and dialect preservation for CSV; use ECharts for new charts; keep ONLYOFFICE Desktop Editors or LibreOffice as an "open in full editor" escape hatch for files the app flags as containing unsupported features. Add a round-trip corpus test (real-world xlsx files, open then save, diff part lists and XML) to CI before trusting any library.

### Gaps
- No hands-on test was run; every fidelity statement about specific libraries should be validated against a sample corpus before the plan is fixed.
- Univer Pro pricing for a single personal licence is unknown; it could change the calculus for Option B.
- IronCalc's coverage of conditional formatting, data validation, tables/structured references and number-format codes was not established.
- Sites that must be allowed for a follow-up pass: docs.univer.ai, docs.sheetjs.com, hyperformula.handsontable.com, handsontable.com, ironcalc.com, learn.microsoft.com, ecma-international.org, helpcenter.onlyoffice.com, news.ycombinator.com.
