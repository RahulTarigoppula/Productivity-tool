# Universal File Conversion ("export anything to anything")

**How to read these notes.** State of the world as of 21 Nov 2026. Every finding carries a provenance tag:

- **[R]** read directly this session (page fetched and read).
- **[S]** search-summary only (a search engine's summary of the page; the page itself was not opened).
- **[K]** background knowledge (model knowledge up to mid-2026, not re-verified this session; the URL is where to verify).
- **[N]** already established in a sibling note in this folder (file named), not re-fetched.

Hosts that were unreachable from this session (network allowlist): `pandoc.org`, `developers.google.com`. Pandoc facts therefore come from the GitHub releases page and sibling notes; ML Kit facts are [K]. No quality score in these notes is measured by me. Where a quality label appears in a matrix it is a judgement label (defined in the last section) and is marked as such; the only numeric scores are quoted from the named source.

---

## 1. Format inventory worth supporting (and which Apple iWork formats open tools can read)

### Takeaway
About 45 formats in ten families cover what a personal document app meets in practice; the conversion value concentrates in a small core (docx/odt/rtf/md/html/txt/pdf, xlsx/ods/csv, pptx/odp, png/jpg/webp/svg/heic). Apple iWork files are import-only everywhere outside Apple's own apps: LibreOffice (libetonyek), ONLYOFFICE 8.3+ and Docling can read them with partial fidelity, and nothing open writes `.pages` or `.key`.

### Cited Findings

**Documents**
- ONLYOFFICE `core` (x2t) lists these convertible formats: DOC, DOCX, ODT, RTF, TXT, PDF, HTML, EPUB, XPS, DjVu, XLS, XLSX, ODS, CSV, PPT, PPTX, ODP. The README does not say which are input-only. The repo also contains `HwpFile`, `DjVuFile` and `XpsFile` directories. [R] — [ONLYOFFICE/core](https://github.com/ONLYOFFICE/core)
- Pandoc 3.12.1 added flat ODT (`fodt`) as input and output; 3.14 (12 Nov 2026) added a new **xlsx reader** and heavily extended the **pptx reader** (speaker notes, charts as tables from cached data, grouped shapes, equations, merged cells, hyperlinks). [R] — [jgm/pandoc releases](https://github.com/jgm/pandoc/releases)
- Pandoc reads/writes Markdown variants, HTML, docx, odt, rtf, epub, LaTeX, Typst, AsciiDoc, reStructuredText, Org, ipynb, and many wiki formats; it writes pptx; conversions "from formats more expressive than pandoc's Markdown can be expected to be lossy". [N: documents-docx-markdown-text.md] — [pandoc MANUAL.txt](https://raw.githubusercontent.com/jgm/pandoc/main/MANUAL.txt)
- ConvertX's bundled-converter table gives a feel for breadth per tool: Pandoc 43 in / 65 out; LibreOffice 41 / 22; Calibre 26 / 19; Vips 45 / 23; ImageMagick 245 / 183; FFmpeg ~472 / ~199; Dasel (data files) 5 / 4; Markitdown 6 / 1; msgconvert (Outlook) 1 / 1; libheif 2 / 4; resvg 1 / 1. [R] — [C4illin/ConvertX](https://github.com/C4illin/ConvertX)

**Apple iWork (.pages / .numbers / .key)**
- libetonyek is the LibreOffice-family library "for parsing Apple's Keynote, Pages, and Numbers formats". Release notes describe Keynote 1–6, Numbers 1–3 and Pages 1–4+ support; the newest version seen in listings is 0.1.13. LibreOffice Bugzilla still has open iWork import bugs (missing cells, wrong number formats). No current official support matrix was found. [S] — [libetonyek 0.1.8 announcement](https://lists.freedesktop.org/archives/libreoffice/2018-April/080058.html); [libetonyek-tools listing](https://www.mankier.com/package/libetonyek-tools); [LibreOffice bug tree 124107](https://www.libreoffice.org/get-help/bug/showdependencytree.cgi?id=124107)
- Docling lists "Apple Pages/Numbers/Keynote" among its input formats (output is Markdown/HTML/JSON, i.e. content extraction, not layout). [R] — [docling-project/docling](https://github.com/docling-project/docling)
- ONLYOFFICE Docs 8.3 (Feb 2025) added opening of `.pages`, `.numbers`, `.key` and Hancom `.hwp/.hwpx`. [K] — [ONLYOFFICE 8.3 release post](https://www.onlyoffice.com/blog/2025/02/onlyoffice-docs-8-3-released)
- `numbers-parser` (Python, MIT) reads and writes `.numbers` files; no equivalent open writer exists for Pages or Keynote. [K] — [masaccio/numbers-parser](https://github.com/masaccio/numbers-parser)

**Other families (tool existence, not fidelity)**
- Email: ConvertX uses `msgconvert` for Outlook `.msg`; Docling reads EML and MSG; MarkItDown has an `[outlook]` extra. [R] — [ConvertX](https://github.com/C4illin/ConvertX); [Docling](https://github.com/docling-project/docling); [MarkItDown](https://github.com/microsoft/markitdown)
- Data/config: ConvertX delegates json/yaml/toml/xml/csv to Dasel. [R] — [ConvertX](https://github.com/C4illin/ConvertX)
- Markdown decks: reveal.js 6.0.2, Slidev CLI 53.1.0, Marp CLI 4.5.1 (all MIT, 2026); Marp and Slidev export PPTX as one image per slide, and none of them can open a .pptx. [N: presentations-pptx.md] — [marp-team/marp-cli](https://github.com/marp-team/marp-cli); [Slidev exporting](https://sli.dev/guide/exporting)

### Inferences
- Proposed inventory by family (the tiering into v1 / v2 / later is in section 7):
  - Documents: docx, doc (in), odt, rtf, md (CommonMark/GFM), html, txt, epub, typst, tex, asciidoc, rst, org, pages (in).
  - Spreadsheets/tabular: xlsx, xls (in), ods, csv, tsv, json (array of records), parquet, sqlite (tables), numbers (in).
  - Presentations: pptx, ppt (in), odp, Markdown deck (Marp dialect as the canonical one), key (in), pdf, per-slide images.
  - PDF: pdf, pdf/a, searchable pdf (OCR layer), page images, extracted text/markdown.
  - Images: png, jpg, webp, avif, gif, tiff, bmp, svg (in; out only from vector sources), heic/heif (in; out optional), ico.
  - Data/config: json, yaml, toml, xml, csv, ndjson.
  - Ebooks: epub (in/out), mobi/azw3 (in only, DRM-free).
  - Notebooks: ipynb → md/html/pdf/py.
  - Diagrams: mermaid → svg/png/pdf; drawio → svg/png/pdf.
  - Email: eml, msg → pdf/html/md/txt (+ attachments extracted).
  - Archives: zip/7z/tar.gz as containers for batch export and for "extract then convert".
- iWork should be advertised as "import (best effort)", never as an export target. On an Apple device the reliable route is the user exporting from Pages/Numbers/Keynote; the app can document that instead of pretending.
- mobi/azw3 output has low value in 2026 (Kindle accepts EPUB via Send-to-Kindle [K] — [Amazon help](https://www.amazon.com/sendtokindle)); read-only support is enough.
- "video" as a slide export target is a different class of work (frame capture plus an encoder); keep it out of the core graph.

### Gaps
- No current statement of which iWork versions (2013+ IWA-based files from current Pages/Numbers/Keynote 14/15) libetonyek or ONLYOFFICE read well; needs a test set of real files.
- Whether the community x2t-WASM build includes the HWP and iWork readers was not checked.
- LibreOffice's authoritative filter list (help.libreoffice.org "convertfilters") was not fetched; filter names for `--convert-to` should be read from [LibreOffice convert filters](https://help.libreoffice.org/latest/en-US/text/shared/guide/convertfilters.html) [K].

---

## 2. Converters: what each really covers, versions, licences, size, WASM/mobile builds

### Takeaway
A small permissive-or-private-use-OK set covers most edges fully offline in a webview: x2t-WASM (office ↔ office, → PDF), Pandoc WASM 3.14 (markup hub, now also reading pptx/xlsx), Typst WASM (typeset PDF), a PDF engine (PDFium/MuPDF/PDF.js), wasm-vips or magick-wasm (images) and platform-native OCR. The heavy items (LibreOffice, Calibre, ML document parsers, ffmpeg) are desktop-only optional packs; the ML parsers range from 0.8 GB CPU-capable (MinerU "basic") to 12 GB-VRAM GPU models (olmOCR) and none is phone-feasible today.

### Cited Findings

**ONLYOFFICE x2t and its WASM builds**
- Licence AGPL-3.0; format list as in section 1. [R] — [ONLYOFFICE/core](https://github.com/ONLYOFFICE/core)
- `cryptpad/onlyoffice-x2t-wasm` is the community emscripten build (Dockerfile; README references core tag v9.3.0.140; no published releases; build "about an hour"). Measured in a third-party npm packaging: `x2t.wasm` 35.82 MB raw, 9.8 MB gzip, 8.0 MB brotli. [N: performance-and-footprint.md, office-suite-engines.md] — [cryptpad/onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm); [npm @kreijstal/eurooffice-sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common)
- The upstream README does not mention PDF/A, image output or Markdown. [R] — [ONLYOFFICE/core](https://github.com/ONLYOFFICE/core)
- ONLYOFFICE's server Conversion API documents image outputs (png/jpg/bmp/gif thumbnails) and a PDF/A switch, which are implemented by x2t. [K] — [ONLYOFFICE Conversion API](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/)

**LibreOffice (headless, WASM, LibreOfficeKit)**
- ZetaOffice/zetajs is LibreOffice in WASM scripted through UNO (PDF export via UNO filter); reported ≈32 MB binary + ≈15 MB data in a 2024 talk; `zetajs` npm 1.2.0 dates from 2025-05-30 (no release since); LibreOffice 24.2-era core. Native LibreOffice is roughly a 300–600 MB install. [N: office-suite-engines.md, performance-and-footprint.md] — [allotropia/zetajs](https://github.com/allotropia/zetajs); [SFSCON 2024 slides](https://sfscon.it/wp-content/uploads/2024/11/17307577791742024-11-08-Moritz-Duge-Allotropia-LibreOf)
- Collabora Office mobile apps prove the LibreOffice core runs offline on phones: the Android app "uses the same engine as LibreOffice for Windows, Mac, and Linux"; an App Store page lists the iOS app at 478.8 MB; an APKMirror listing shows Android build 25.04.7.3 as a 74.03 MB APK (uploaded 25 Mar 2026). Legacy binary formats (.doc/.ppt/.xls) were added to the Android app in 25.04.1.1. [S] — [Collabora Office for Android & iOS](https://www.collaboraoffice.com/?p=10631); [App Store listing](https://apps.apple.com/it/app/collabora-office/id1440482071); [APKMirror 25.04.1.1](https://www.apkmirror.com/apk/collabora-productivity-limited/collabora-office-rc/collabora-office-25-04-1-1-release/)

**Pandoc**
- Releases in 2026: 3.9 (4 Feb, first official WASM), 3.10 (4 Jun), 3.10.1 (22 Jul), 3.10.2 (12 Aug), 3.11 (29 Aug), 3.12 (29 Sep), 3.12.1 (8 Oct), 3.13 (26 Oct), **3.14 (12 Nov, latest)**. The 3.14 release ships `pandoc-3.14-wasm.zip` at **16.3 MB**. [R] — [jgm/pandoc releases](https://github.com/jgm/pandoc/releases); 3.9 date [N] — [pandoc-announce 3.9](https://groups.google.com/g/pandoc-announce/c/znue-42hMeI)
- 3.10.2 restored legacy WASM exception handling so `pandoc.wasm` works under wasmtime (i.e. it can run outside a browser, in a native WASI host); 3.13 fixed a pandoc.wasm link failure. [R] — [jgm/pandoc releases](https://github.com/jgm/pandoc/releases)
- 3.14: new xlsx reader (merged cells → spans, dates rendered, charts read as tables from cached data); pptx reader extended; docx reader keeps customXml contents and reads underline types; Typst reader/writer fixes across 3.10–3.14; AsciiDoc reader about 2× faster in 3.12. [R] — [jgm/pandoc releases](https://github.com/jgm/pandoc/releases)
- `pandoc-wasm` npm 1.1.0 (GPL-2.0-or-later, 2026-06-11) bundles the official 3.9 binary. PDF output needs an external engine (`typst`, `weasyprint`, LaTeX, …); `--reference-doc` styles docx/pptx output. [N: documents-docx-markdown-text.md] — [npm pandoc-wasm](https://www.npmjs.com/package/pandoc-wasm); [pandoc MANUAL.txt](https://raw.githubusercontent.com/jgm/pandoc/main/MANUAL.txt)

**Typst and LaTeX in WASM**
- typst.ts docs list the web compiler at 7.62 MB gzipped, text+math fonts about 4.42 MB, renderer 351 KB, optional emoji fonts 14.74 MB; the compiler "for browsers is in Wasm module and slower than running compiler as native code". A Yarn listing shows `@myriaddreamin/typst-ts-web-compiler` 0.7.0-rc2 (may be stale). Alternatives: `typst-wasm`, `@vedivad/typst-web-service` 0.7.1 (worker + `compilePdf`). [S] — [typst.ts get-started](https://myriad-dreamin.github.io/typst.ts/cookery/get-started.html); [typst-ts-web-compiler README](https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0-rc2/README.md); [typst-wasm forum post](https://forum.typst.app/t/typst-wasm-compile-typst-in-browsers-node-and-serverless-runtimes/9399)
- A browser-only docx → PDF pipeline (Pandoc WASM → Typst WASM) has been demonstrated. [N] — [dev.to write-up](https://dev.to/maxslashwang/browser-based-docx-to-pdf-converter-using-pandoc-and-typst-wasm-1o7g)
- A Rust crate `office2pdf` (0.5.0, with a `wasm.rs` module; a mirror shows activity on 2 Jul 2026) appeared in search as an office → PDF converter with a WASM target. Not evaluated. [S] — [docs.rs office2pdf](https://docs.rs/crate/office2pdf/latest/source/src/wasm.rs)
- SwiftLaTeX (AGPL-3.0) is the known LaTeX-in-WASM engine and has been dormant for years. [K] — [SwiftLaTeX/SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX)

**PDF → structured content: ML-based parsers (all produce Markdown/HTML/JSON, not a faithful .docx)**

| Tool | Version read | Licence (as read) | Runs locally | Hardware / size (as read) | Outputs |
|---|---|---|---|---|---|
| Docling (IBM) | 2.70+ line | Code MIT; models "refer to the model licenses" | Yes; "air-gapped" listed as a feature | x86_64 and arm64, Python ≥3.10; no numbers on page; Granite-Docling link implies 258M params | Markdown, HTML, DocTags, lossless JSON |
| Marker (Datalab) | not stated | Code Apache-2.0; weights "modified AI Pubs Open Rail-M", free for research, personal use and startups under $5M funding/revenue | Yes | `fast`/`no_ocr` modes run on CPU or MPS; `balanced` GPU+CPU; `vllm` GPU | Markdown, JSON, HTML, chunks |
| MinerU (OpenDataLab) | 4.2 | "MinerU Open Source License, based on Apache 2.0 with additional conditions" | Yes | basic/ONNX: ~0.8 GB models, 2 GB RAM, CPU OK; standard/advanced ONNX+llama.cpp: ~2 GB, 8 GB RAM, CPU works; PyTorch engines: 16 GB RAM, 8 GB+ VRAM | Markdown, JSON; 4.0 lists HTML, LaTeX, DOCX, EPUB, PDF render targets |
| olmOCR (AllenAI) | v0.4.0 (21 Oct 2025) | Apache-2.0 | Yes | 7B VLM (olmOCR-2-7B-1025-FP8); NVIDIA GPU ≥12 GB VRAM; ~30 GB disk | Markdown, Dolma |
| MarkItDown (Microsoft) | not stated | MIT | Yes (Python 3.10–3.14); captioning/transcription/Azure DI are cloud | Light; no ML by default | Markdown only |

  All rows [R] — [Docling](https://github.com/docling-project/docling); [Marker](https://github.com/datalab-to/marker); [MinerU](https://github.com/opendatalab/MinerU); [olmOCR](https://github.com/allenai/olmocr); [MarkItDown](https://github.com/microsoft/markitdown)
- MarkItDown states its output "may not be the best option for high-fidelity document conversions for human consumption", and warns it performs I/O with the process's privileges so untrusted input must be sanitised. [R] — [MarkItDown](https://github.com/microsoft/markitdown)
- MinerU accepts PDF, images, DOC/DOCX, PPT/PPTX, XLS/XLSX, RTF, ODT/ODS/ODP, EPUB, OFD, HTML, MHTML, CSV/TSV. Marker accepts PDF, image, PPTX, DOCX, XLSX, HTML, EPUB. [R] — [MinerU](https://github.com/opendatalab/MinerU); [Marker](https://github.com/datalab-to/marker)
- Licence drift to note: MinerU was AGPL-3.0 and Marker's code was GPL-3.0 in 2024–25 [K]; the READMEs read today say "Apache 2.0 with additional conditions" and "Apache 2.0" respectively [R]. The additional MinerU conditions were not read (LICENSE.md). — [MinerU](https://github.com/opendatalab/MinerU); [Marker](https://github.com/datalab-to/marker)
- PaddleOCR-VL is a 0.9B-parameter VLM; its paper self-reports 92.86 overall on OmniDocBench v1.5 against 90.67 for MinerU2.5-1.2B. MonkeyOCR v1.5 claims to beat both. MinerU2.5-Pro reports 95.69 on OmniDocBench v1.6 (not comparable with v1.5). [S] — [PaddleOCR-VL paper](https://arxiv.org/pdf/2510.14528); [MonkeyOCR v1.5 report](https://arxiv.org/html/2511.10390v1); [arXiv 2604.04771](https://arxiv.org/pdf/2604.04771)
- Others, licence from memory: Nougat (Meta; code MIT, weights CC-BY-NC; academic papers only), GOT-OCR 2.0 (~580M params), Surya (Datalab; GPL code, restricted weights), Unstructured (Apache-2.0 library; best models behind the hosted API), Mistral OCR (cloud API only, so out of scope offline). [K] — [facebookresearch/nougat](https://github.com/facebookresearch/nougat); [GOT-OCR2.0](https://github.com/Ucas-HaoranWei/GOT-OCR2.0); [datalab-to/surya](https://github.com/datalab-to/surya); [Unstructured](https://github.com/Unstructured-IO/unstructured); [Mistral OCR](https://mistral.ai/news/mistral-ocr)

**OCR: native per platform versus bundled**
- Windows: the Windows App SDK text-recognition (`TextRecognizer`) APIs are "supported only with hardware acceleration on devices with an NPU" (Copilot+ PCs), need package identity and a model-ready step (`EnsureModelIsReady`), and are described as faster and more accurate than legacy `Windows.Media.Ocr.OcrEngine`. Some Learn pages still describe them as experimental-channel; current stable status not confirmed. [S] — [Windows AI text recognition](https://learn.microsoft.com/windows/ai/apis/text-recognition); [API ref](https://github.com/MicrosoftDocs/windows-ai-docs/blob/docs/docs/apis/text-recognition-api-ref.md)
- `Windows.Media.Ocr` needs no NPU. The search summary says it is "only supported for desktop apps with package identity"; this conflicts with my background knowledge that unpackaged Win32 apps call it routinely, so treat as unresolved and test. [S, conflict] — [Windows.Media.Ocr namespace](https://learn.microsoft.com/uwp/api/windows.media.ocr)
- Apple: Vision `VNRecognizeTextRequest` (accurate/fast, on-device, iOS 13+/macOS 10.15+); `RecognizeDocumentsRequest` (iOS/macOS 26) adds document structure such as tables and paragraphs; PDFKit can write a searchable PDF with `saveTextFromOCROption` (iOS 16+/macOS 13+). [K] — [VNRecognizeTextRequest](https://developer.apple.com/documentation/vision/vnrecognizetextrequest); [RecognizeDocumentsRequest](https://developer.apple.com/documentation/vision/recognizedocumentsrequest); [saveTextFromOCROption](https://developer.apple.com/documentation/pdfkit/pdfdocumentwriteoption/savetextfromocroption)
- Android: ML Kit Text Recognition v2 runs on-device for Latin, Chinese, Devanagari, Japanese and Korean scripts, returns blocks/lines/elements with bounding boxes, and ships either bundled (a few MB per script) or unbundled via Google Play services. [K; host blocked this session] — [ML Kit text recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- Cross-platform bundle: tesseract.js (Apache-2.0, Tesseract 5 LSTM in WASM, language data downloaded per language) and OCRmyPDF (MPL-2.0; Python; orchestrates Tesseract + Ghostscript/qpdf; outputs PDF/A by default). [K] — [naptha/tesseract.js](https://github.com/naptha/tesseract.js); [ocrmypdf/OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF)
- Datalab's vendor table scores Tesseract 5 at 5.9 on its "OmniParseBench" versus 71.0 for Marker `fast` on CPU: a vendor benchmark of full-document parsing (layout, tables, reading order), not of character accuracy. [R] — [Marker README](https://github.com/datalab-to/marker)

**Images**
- wasm-vips: WordPress measured about 10 MB of inlined WASM (≈30 MB of non-minified build output) and documents a 1 GiB wasm-vips memory cap above which images fail client-side. WordPress 7.1 (July 2026) uses wasm-vips for JPEG, PNG, GIF, WebP and AVIF and handles HEIC separately. A slim fork (`@denodecom/wasm-vips`) ships only JPEG/PNG/WebP loaders. [S] — [WordPress core ticket 64734](https://core.trac.wordpress.org/ticket/64734); [Client-side media processing in WordPress 7.1](https://make.wordpress.org/core/2026/07/22/client-side-media-processing/); [slim fork README](https://cdn.jsdelivr.net/npm/@denodecom/wasm-vips@0.0.12/README.md)
- magick-wasm: only size figure found is "7 MB+" in a competitor's docs. [S] — [kimg wasm binary size notes](https://www.mintlify.com/iamkaf/kimg/advanced/wasm-binary-size)
- HEIC: Safari decodes HEIC natively via `createImageBitmap()`; other engines need a libheif WASM decoder of roughly 1.2–1.5 MB. [S] — [dev.to browser HEIC converter](https://dev.to/forze-dev/why-heic-breaks-websites-and-how-i-built-a-browser-only-converter-to-fix-it-gp0)
- Licences: libvips LGPL-2.1+, wasm-vips MIT, ImageMagick's own permissive licence, magick-wasm Apache-2.0, sharp Apache-2.0 (Node native addon, not a webview option), libheif LGPL-3.0 with HEVC patent exposure for encoding, resvg (Rust SVG rasteriser with an npm WASM build), jSquash (Squoosh codecs as per-format WASM packages). [K] — [kleisauke/wasm-vips](https://github.com/kleisauke/wasm-vips); [dlemstra/magick-wasm](https://github.com/dlemstra/magick-wasm); [strukturag/libheif](https://github.com/strukturag/libheif); [linebender/resvg](https://github.com/linebender/resvg); [jamsinclair/jSquash](https://github.com/jamsinclair/jSquash)

**Ebooks, spreadsheets/data, slides, media**
- Calibre `ebook-convert` covers 26 input and 19 output formats in ConvertX. It is a GPL-3.0 Python desktop application with no mobile build. [R for counts; K for licence/platform] — [ConvertX](https://github.com/C4illin/ConvertX); [ebook-convert manual](https://manual.calibre-ebook.com/generated/en/ebook-convert.html)
- SheetJS CE (Apache-2.0; npm frozen at 0.18.5, current 0.20.3 only via cdn.sheetjs.com) reads the widest set of spreadsheet formats but writes almost no styling; charts, pivots, conditional formatting and images are not written. ExcelJS has had no release since Oct 2023. [N: spreadsheets-xlsx-csv.md] — [SheetJS/sheetjs](https://github.com/SheetJS/sheetjs); [npm exceljs](https://www.npmjs.com/package/exceljs)
- DuckDB-WASM (MIT) queries CSV, Parquet and JSON in the browser and can attach SQLite and read xlsx through extensions. [K] — [duckdb/duckdb-wasm](https://github.com/duckdb/duckdb-wasm)
- PptxGenJS 4.0.1 (2025-06-26, MIT) writes new decks only; Marp/Slidev PPTX export is image-per-slide. [N: presentations-pptx.md] — [npm pptxgenjs](https://www.npmjs.com/package/pptxgenjs); [marp-cli](https://github.com/marp-team/marp-cli)
- ffmpeg.wasm: third-party write-ups put the payload at roughly 25–30 MB; a GitHub issue reports a 2 GB input-file ceiling. [S] — [ffmpeg.wasm issue 623](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/623)

**Aggregators to learn from**
- VERT (AGPL-3.0; Svelte + TypeScript; "250+" formats; images, audio, documents, video) converts on-device with WebAssembly; video can go to an optional self-hostable `vertd` daemon. Its `src/lib/converters` directory has one folder per engine (`ffmpeg`, `magick`, `mediabunny`, `pandoc`, `spessasynth`, `vectorizer`, `vertd`, `vips`) plus shared `converter.svelte.ts`, `index.ts`, `priority.ts`, `engine-variants.svelte.ts` and `codec-labels.ts`. [R] — [VERT-sh/VERT](https://github.com/VERT-sh/VERT); [converters directory](https://github.com/VERT-sh/VERT/tree/main/src/lib/converters)
- ConvertX (AGPL-3.0, self-hosted server) wraps 22 native CLI converters (table in section 1) rather than WASM. [R] — [C4illin/ConvertX](https://github.com/C4illin/ConvertX)
- Stirling-PDF's desktop client is a Tauri 2 app that bundles a Java backend and, in Docker builds, Calibre, Ghostscript, ImageMagick, QPDF and veraPDF; LibreOffice is "planned for removal". [N: pdf-stack.md] — [Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)

### Inferences
- VERT's layout (one adapter per engine, a registry `index.ts`, a `priority.ts` to pick when several engines accept a pair, and "engine variants") is the minimal shape of a converter registry; it has no office engine (no x2t/LibreOffice), which is exactly the gap this app's x2t-WASM fills. VERT does not appear to do multi-hop path-finding (not confirmed; file contents were not read).
- Pandoc 3.14's pptx and xlsx readers change the "content extraction" story: pptx → md and xlsx → md/csv-like tables are now possible in the same WASM module already planned, without x2t or Python tools. They are days old (12 Nov 2026) and should be treated as immature.
- The brief's "Pandoc WASM ≈56 MB" could not be confirmed: the release zip is 16.3 MB; the unpacked `.wasm` size was not read. Measure it.
- Pandoc WASM running under wasmtime (3.10.2+) gives a non-webview route: a native host (Rust/Kotlin/Swift embedding a WASM runtime) can run the same binary without webview memory limits. On iOS a WASM runtime must run in interpreter mode (no JIT outside WebKit) [K].
- For a personal, never-distributed build the copyleft licences (x2t AGPL, Pandoc GPL, Calibre GPL, MuPDF AGPL) are not a constraint; the weight-licence terms that matter are the non-commercial/revenue-capped ones (Marker/Surya weights, Nougat weights), and personal use is explicitly allowed by Marker's terms as read.
- ML parsers are an "import PDF as editable Markdown/Docx" feature, not a PDF → DOCX layout-preserving converter. MinerU "basic" on ONNX (0.8 GB, 2 GB RAM, CPU) is the lightest locally runnable option read; Docling is the cleanest licence (MIT) and has the broadest input list.
- Native OCR should be the default on every platform (zero bundle size, tuned for the hardware): Vision on Apple, ML Kit on Android, `Windows.Media.Ocr` on ordinary Windows PCs with `TextRecognizer` used opportunistically on Copilot+ PCs. Tesseract (WASM or native) is the consistent fallback and the only one that directly emits hOCR/PDF text layers; with native engines the app must build the invisible text layer itself from bounding boxes (PDFKit does this for free on Apple).

### Gaps
- x2t: no authoritative input/output direction table, PDF/A flag name, or image-output behaviour was read; the `cryptpad` WASM build's enabled feature set (PDF/A, DjVu, XPS, HWP, iWork) is unknown.
- LibreOfficeKit as an embeddable library on Android/iOS: no source found on building or licensing it for a third-party app, or on its size as a library versus the Collabora app.
- Versions/sizes not obtained: tesseract.js current version and core/lang sizes; DuckDB-WASM bundle size; magick-wasm official size and HEIC support; resvg-wasm size; Calibre install size; Typst current version.
- Docling/Marker/MinerU model download sizes for Docling and Marker, and per-page CPU timings on a laptop, were not found.
- CloudConvert's and Zamzar's format graphs and "Transmute" were not researched (ran out of budget).
- pdf2docx (PyMuPDF-based) current licence and maintenance status not verified — [ArtifexSoftware/pdf2docx](https://github.com/ArtifexSoftware/pdf2docx) [K].

---

## 3. Quality reality per important pair, and published benchmarks

### Takeaway
Layout-preserving conversion is dependable in only one direction: editable → fixed (office → PDF, md → PDF, anything → image). Fixed → editable (PDF → DOCX/XLSX) has no reliable open tool and even Adobe's export draws user complaints; the 2025–26 ML parsers are benchmarked on PDF → Markdown, where the best open models score in the low-to-mid 80s on olmOCR-bench and vendor numbers disagree with each other.

### Cited Findings
- olmOCR-bench overall scores as published in the olmOCR README: Chandra OCR 0.1.0 83.1±0.9; Infinity-Parser 7B 82.5; olmOCR v0.4.0 82.4±1.1; PaddleOCR-VL 80.0±1.0; Marker 1.10.1 76.1±1.1; DeepSeek-OCR 75.7±1.0; MinerU 2.5.4 75.2±1.1; Mistral OCR API 72.0±1.1; Nanonets-OCR2-3B 69.5±1.1. [R] — [allenai/olmocr](https://github.com/allenai/olmocr)
- Datalab's own table (vendor-reported; "OmniParseBench" headline / olmOCR-bench / pages per second): Marker `vllm` 85.9 / 83.7 / 4.5; `balanced` 80.5 / 76.0 / 16.9; `fast` (CPU/MPS) 71.0 / 66.6 / 23.6; `no_ocr` 40.8 / 43.6 / 57.0; Docling 67.5 / 50.3 / 2.1; MinerU 2.5-Pro 87.1 headline at 0.54 pg/s; MinerU pipeline 72.7 on olmOCR-bench; Tesseract 5 5.9 on OmniParseBench. [R] — [datalab-to/marker](https://github.com/datalab-to/marker)
- OmniDocBench is losing reliability as a yardstick: a May 2026 audit confirmed 2,580 annotation errors and warns that leaderboard credibility diminishes over time; v1.6 changed the protocol so scores are not comparable with v1.5. [S] — [arXiv 2605.07492](https://arxiv.org/html/2605.07492); [arXiv 2604.04771](https://arxiv.org/pdf/2604.04771)
- PDF → Word: no independent 2026 head-to-head of Acrobat, LibreOffice, pdf2docx and ONLYOFFICE was found. Anecdotes: an Acrobat Standard 2025 user reports tables exported as tab-separated text ("visually identical… no tables but tabs"); guides rate LibreOffice import "workable for simple PDFs" with tables/images/scans failing, and pdf2docx as medium fidelity that needs OCR first for scans. [S] — [Adobe community thread](https://community.adobe.com/t5/acrobat-discussions/coverting-pdf-to-word-doesn-t-keep-table-format/m-p/15610468); [Renee Lab guide](https://reneelab.zendesk.com/hc/en-us/articles/55962735846425-How-to-Convert-PDF-to-Editable-Word-Documents-Using-LibreOffice-and-Better-Alternatives); [dev.to: why PDF to Word is hard](https://dev.to/charles_snow_fastly/why-pdf-to-word-conversion-is-harder-than-you-think-and-how-to-do-it-right-3i5n)
- docx → md / md → docx via Pandoc preserves structure, not formatting (margins, fonts, exact layout); tracked changes are handled on read only. mammoth-style import is likewise deliberately lossy. [N: documents-docx-markdown-text.md] — [pandoc MANUAL.txt](https://raw.githubusercontent.com/jgm/pandoc/main/MANUAL.txt)
- xlsx through SheetJS CE loses styles, charts, pivots, images, conditional formatting and validation on write; "Charts in file breaks roundtrip" is a long-standing issue. [N: spreadsheets-xlsx-csv.md] — [SheetJS issue 111](https://git.sheetjs.com/sheetjs/sheetjs/issues/111)
- md deck → pptx via Marp/Slidev yields image slides (pixel-accurate but not editable); Pandoc md → pptx yields native editable slides laid out by a reference deck. [N: presentations-pptx.md; K for Pandoc behaviour] — [marp-cli](https://github.com/marp-team/marp-cli); [pandoc MANUAL.txt](https://raw.githubusercontent.com/jgm/pandoc/main/MANUAL.txt)

### Inferences
Per-pair expectations (judgement, to be validated by the spikes in section 7):

| Pair | Realistic outcome | Main failure modes |
|---|---|---|
| docx → pdf | Good with x2t or LibreOffice when the document's fonts are available; neither equals Word's own layout | Font substitution reflows pages; complex tables, text boxes, SmartArt, fields/TOC not updated |
| pdf → docx | Poor to fair. Either a "looks right, uneditable" page of text boxes or an "editable, layout lost" reflow | Tables, multi-column, headers/footers, lists; scans need OCR first |
| xlsx → pdf | Fair. Pagination is the product decision (fit-to-width, print areas, landscape) | Wide sheets split across pages; charts; hidden rows; print titles |
| pptx → pdf | Good for static slides; fonts and effects are the risk | Missing fonts, gradients/shadows/SmartArt, animations flattened |
| md → docx | Good (structure exact, look comes from the reference doc) | Complex tables, raw HTML, footnote/citation styles |
| md → pptx | Good with Pandoc for simple decks; image-only with Marp | Overflowing text, custom layouts |
| md → pdf | Exact for the app's own rendering (print-to-PDF) or typeset via Typst | Raw HTML/CSS is ignored by the Typst route |
| docx → md | Good for prose; lossy by design | Layout, colours, text boxes, nested tables, tracked changes |
| pdf → md | Text-layer PDFs: good for single-column prose; tables/math need an ML parser | Reading order, tables, formulas; scans need OCR/VLM |
| html → docx | Fair to good via Pandoc (semantic) or x2t (visual); CSS layout is not carried | Flex/grid layouts, web fonts |
| csv ↔ xlsx | Exact for data; type inference is the trap | Leading zeros, dates, long numbers, encodings/delimiters |
| image → pdf | Exact | Page size/DPI choices only |
| pdf → images | Exact at chosen DPI | Memory on large pages at high DPI |
| scanned pdf → searchable pdf | Good on clean scans with native OCR or Tesseract | Handwriting, skew, low DPI, mixed languages |
| epub ↔ docx/md | Good for reflowable text (Pandoc) | Fixed-layout EPUBs, CSS styling, DRM |

- "Adobe export as benchmark" should be stated to the user as "nobody does this well", not as a bar the app will reach.
- Because benchmark numbers from Datalab (Docling 50.3 on olmOCR-bench) and from AllenAI disagree in tool versions and methodology, the plan should not quote a single ranking; it should run its own 20–30 document test set.

### Gaps
- No published 2025–26 comparison of docx → pdf fidelity for x2t vs LibreOffice vs Word was found (not searched in depth).
- No benchmark of PDF → DOCX (as opposed to PDF → Markdown) exists in the sources found.
- xlsx → pdf and pptx → pdf quality claims above are judgement, not sourced.
- olmOCR-bench entries marked with an asterisk in the source were not explained on the page read.

---

## 4. Running converters on mobile

### Takeaway
Android WebView (Chromium) can host the same WASM converters as desktop within device RAM; iOS WKWebView is the hard limit, with WebKit's own tracker titled "Only ~300 MB of RAM is reliably available to WebAssembly pages" and no way to raise the ceiling. Plan for small/medium WASM modules on iOS, native platform APIs where they exist, and a "convert on your PC" hand-off for the heavy edges.

### Cited Findings
- WebKit bug 269777: "Only ~300 MB of RAM is reliably available to WebAssembly pages"; Unity developers could not allocate "even a tenth" of what Android Chrome allowed. [S] — [WebKit bug 269777](https://bugs.webkit.org/show_bug.cgi?id=269777)
- Apple Developer Forums: the WKWebView content-process memory limit cannot be increased and depends on device RAM and system load. [S] — [Apple forum thread 771787](https://developer.apple.com/forums/thread/771787); [thread 133449](https://developer.apple.com/forums/thread/133449)
- Repeated WASM instantiation exhausts memory on iOS/macOS WebKit ("RangeError: Out of memory" after several reloads; failure on the 7th reload of a page allocating 256 MB); shared WASM memory failed on iOS 16.4. [S] — [emscripten issue 19374](https://github.com/emscripten-core/emscripten/issues/19374); [WebKit bug 256023](https://bugs.webkit.org/show_bug.cgi?id=256023); [WebKit bug 255103](https://bugs.webkit.org/show_bug.cgi?id=255103)
- LibreOffice core does run natively on phones (Collabora Office: iOS app ≈478.8 MB per App Store listing; Android APK 74.03 MB). [S] — [App Store](https://apps.apple.com/it/app/collabora-office/id1440482071); [APKMirror 25.04.7.3](https://www.apkmirror.com/apk/collabora-productivity-limited/collabora-office-rc/collabora-office-25-04-6-2-release/)
- wasm-vips has a 1 GiB memory cap in WordPress's deployment, above which processing is sent elsewhere. [S] — [WordPress client-side media docs](https://developer.wordpress.org/block-editor/how-to-guides/client-side-media/)
- Module sizes to budget: x2t.wasm 35.8 MB raw / 8.0 MB brotli [N]; Pandoc WASM zip 16.3 MB [R]; Typst compiler 7.62 MB gz + 4.42 MB fonts [S]; ZetaOffice ≈32 + 15 MB [N]. — [npm eurooffice-sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common); [pandoc releases](https://github.com/jgm/pandoc/releases); [typst.ts](https://myriad-dreamin.github.io/typst.ts/cookery/get-started.html)
- iOS long-running work: `BGContinuedProcessingTask` (iOS 26) lets a user-initiated job continue in the background with system progress UI; otherwise background time is short. Android: long conversions belong in WorkManager with a foreground service. [K] — [BGContinuedProcessingTask](https://developer.apple.com/documentation/backgroundtasks/bgcontinuedprocessingtask); [Android long-running workers](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running)

### Inferences
- Practical on a phone (webview WASM or native API): md ↔ html ↔ docx (Pandoc), md → pdf (webview print or Typst), image ↔ image and image → pdf (canvas / vips / native ImageIO/Bitmap), pdf → images/text and merge/split (PDFium/PDF.js), csv/json/yaml/toml (pure JS), OCR (Vision / ML Kit), small-to-medium office → pdf via x2t-WASM (must be proven on iOS).
- Desktop-only or "do it on your PC and sync": LibreOffice-class conversion (legacy formats, second-opinion PDF), Calibre, ML document parsers, ffmpeg/video, batch folder conversion of hundreds of files, very large xlsx/pptx.
- iOS specifics that shape the design: no child processes (no sidecar binaries; everything is a linked library or WASM); memory peak = module code + linear memory + input + output all at once, so one converter instance at a time, torn down after each job, files streamed through OPFS/native file handles rather than base64 over the bridge; avoid threaded (SharedArrayBuffer) builds on iOS.
- A native-library route sidesteps the webview ceiling: Rust crates (typst, resvg, image, pdfium-render, calamine) linked into the app core via the shell's plugin layer run on all four platforms, and Pandoc WASM under an embedded interpreter is possible. x2t has no known mobile-native packaging for third parties (ONLYOFFICE's own mobile apps use it [K]), so x2t on phones means WASM.
- Each converter in the registry needs a per-platform availability and a size ceiling (e.g. "x2t on iOS: files up to N MB"), learned from spikes, with a graceful "too large for this device" result rather than a webview crash. A WKWebView content-process crash must be detected (`webViewWebContentProcessDidTerminate`) and reported as a failed job [K].
- Thermal/battery: show progress and allow cancel; run batch jobs only when the app is foregrounded or under the platform's background-task API; do not auto-OCR whole libraries on mobile.

### Gaps
- No 2026 measurement of WKWebView WASM limits on current iPhones (8–12 GB RAM) was found; bug 269777's present status is unknown.
- No source found for Android WebView WASM memory ceilings (Chromium allows up to 4 GB wasm32 memory in principle [K] — [V8 blog](https://v8.dev/blog/4gb-wasm-memory); real limits depend on device RAM and 32-bit WebView on low-end devices).
- Nobody was found running x2t-WASM or Pandoc WASM inside WKWebView or Android WebView; this is the top spike.
- Whether the `com.apple.developer.kernel.increased-memory-limit` entitlement affects WKWebView content processes is unverified (mentioned only in a 2022 chat log).

---

## 5. Architecture patterns for a conversion engine

### Takeaway
Model conversion as a directed graph: formats are nodes, converter capabilities are edges carrying fidelity class, loss flags, options, platform availability and cost; pick routes with a best-path search that maximises the worst fidelity on the path and then minimises hops and cost. Run every converter in an isolated worker or process with no network and a scratch directory, because converters are a classic attack surface.

### Cited Findings
- VERT structures converters as one module per engine with a shared converter base, an index/registry and a `priority.ts`. [R] — [VERT converters directory](https://github.com/VERT-sh/VERT/tree/main/src/lib/converters)
- ConvertX exposes per-converter from/to format counts and lets the same pair be served by several engines (e.g. ImageMagick, GraphicsMagick, Vips, libheif for images). [R] — [ConvertX](https://github.com/C4illin/ConvertX)
- MarkItDown's own README warns that it "performs I/O with the privileges of the current process" and tells integrators to sanitise untrusted input and call the narrowest `convert_*` method. [R] — [MarkItDown](https://github.com/microsoft/markitdown)
- Security history of converters: ImageMagick "ImageTragick" (CVE-2016-3714, command injection via crafted images) and its policy.xml mitigation; recurring Ghostscript RCEs (e.g. CVE-2023-36664); LibreOffice security advisories for macro/link handling. [K] — [imagetragick.com](https://imagetragick.com/); [ImageMagick security policy](https://imagemagick.org/script/security-policy.php); [LibreOffice security advisories](https://www.libreoffice.org/about-us/security/advisories/)
- Fonts: Liberation Sans/Serif/Mono are metric-compatible with Arial/Times New Roman/Courier New, Carlito with Calibri, Caladea with Cambria; they are what LibreOffice uses to avoid reflow when Microsoft fonts are absent. [K] — [Document Foundation wiki: Fonts](https://wiki.documentfoundation.org/Fonts)
- The ONLYOFFICE client-side stack ships without fonts in the measured package (sizes quoted "no fonts, no dictionaries"), so font supply is the embedder's job. [N: performance-and-footprint.md] — [npm eurooffice-sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common)
- Validation tools: veraPDF (PDF/A, bundled by Stirling-PDF) and qpdf (`--check`) for structural PDF checks. [N: pdf-stack.md] — [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF); [qpdf](https://github.com/qpdf/qpdf)

### Inferences
- **Registry record (edge) fields:**
  - `id`, `engine` (x2t, pandoc, typst, pdfium, vips, native-ocr, …), `engineVersion`.
  - `from`, `to` (canonical format ids; variants as parameters, e.g. `pdf{variant: a-2b}`, `md{flavor: gfm}`).
  - `fidelity`: one of `exact`, `high`, `good`, `content-only`, `text-only`, `image-only`.
  - `loses`: a set of loss flags, e.g. `layout`, `styles`, `fonts`, `formulas`, `charts`, `comments`, `tracked-changes`, `animations`, `macros`, `metadata`, `editability`, `vector`.
  - `options` schema (page size, range, DPI, quality, sheet selection, password), with defaults and presets.
  - `platforms` (win/android/mac/ios × webview-wasm/native/sidecar), `pack` (core or optional pack id and size), `maxInputBytes` per platform.
  - `cost`: startup ms, relative speed, peak-memory class; `deterministic` flag; `needsFonts`, `needsNetwork: false` (enforced).
- **Path-finding:** the graph is small (tens of nodes, low hundreds of edges), so Dijkstra or exhaustive search with a hop limit of 3 is enough. Rank lexicographically: (1) best worst-edge fidelity class, (2) fewest loss flags in the union, (3) fewest hops, (4) lowest cost, (5) available on this device without a pack. Return the top 2–3 routes so the UI can offer "exact look (PDF-based)" versus "editable (content-based)". Forbid "fidelity laundering" loops (e.g. docx → pdf → docx) unless the user explicitly asks.
- **Two kinds of hub** keep the graph honest: a *layout* hub (PDF, then raster images) and a *content* hub (Pandoc AST / Markdown; tabular data as Arrow/rows). Edges into a hub declare what was lost; a path that crosses from layout hub to content hub (pdf → md) is always flagged as reconstruction.
- **Execution:** one job = one fresh worker (Web Worker for WASM; a spawned sidecar process on desktop for native tools). Inputs are copied into an ephemeral virtual FS (emscripten MEMFS/OPFS or a temp dir); outputs are collected from it; the worker is terminated after the job. Cancellation = terminate the worker/process (most WASM converters have no cooperative cancel). Timeouts and output-size caps per edge. Progress is coarse (per hop, per page where the engine reports it).
- **Sandboxing:** WASM in a worker has no file or network access beyond what is passed in, which is the strongest cheap sandbox and a reason to prefer WASM engines even on desktop for untrusted files. For native sidecars: no network, temp working dir, dropped privileges where the OS allows (Windows AppContainer/job objects, macOS sandbox profile), macros and external links disabled (LibreOffice: no macro execution, no linked-content updates), ImageMagick restricted by `policy.xml` (no delegates, no URL/MVG/MSL coders), Ghostscript always with `-dSAFER`. Zip-bomb and decompression-size guards on OOXML/EPUB/archives. Detect input type by magic bytes and container inspection, not by extension.
- **Caching and determinism:** cache key = hash(input bytes) + edge id + engine version + options + font-set id. Intermediate artefacts (e.g. the PDF in pptx → pdf → png) are cached so "export also as images" is free. Deterministic output needs fixed timestamps/IDs where engines allow (PDF creation date, zip entry times); mark edges that cannot be made deterministic.
- **Fonts:** ship one font pack (Liberation, Carlito, Caladea, Noto Sans/Serif + one CJK subset on demand) used identically by x2t, Typst and LibreOffice on every platform; after an office → PDF job, list fonts that were substituted and surface them as a warning. Aptos (Office's default since 2023) has no metric-compatible open substitute that I know of [K, unverified], so recent Word files will reflow unless the user supplies the font.
- **Post-conversion validation:** cheap structural checks per target (PDF opens and page count > 0 and matches slide/page expectation; docx/xlsx/pptx re-open in the app's own parser; image dimensions; JSON/YAML/TOML re-parse; row/column counts preserved for tabular). Optional deep checks on desktop (veraPDF for PDF/A). A failed validation downgrades to the next-best route automatically.
- **Metadata:** carry title/author/dates/keywords in a neutral record across hops and write them into the target (PDF Info/XMP, OOXML core properties, EXIF/XMP for images) with a privacy option "strip metadata on export".
- **Batch:** a queue with concurrency 1 for heavy engines (x2t, LibreOffice, ML) and N for light ones; per-file result records (ok / warnings / failed with reason); never overwrite sources; name collisions resolved by suffix.

### Gaps
- VERT's `converter.svelte.ts` and `priority.ts` contents were not read, so its exact interface and selection logic are unconfirmed.
- No public description of CloudConvert's or Zamzar's routing (single-engine per pair versus multi-hop) was obtained.
- Whether x2t and Pandoc WASM output is byte-deterministic for identical input was not checked.
- The Aptos substitution claim and any open metric-compatible replacement need verification.

---

## 6. UX patterns for Export / Convert

### Takeaway
No source in this session documents export-dialog research; the pattern below is design inference from how the engines behave. The essential ideas are: one "Export as…" surface that lists targets grouped by intent with an honest fidelity label per target, options that appear only when relevant, a preview for fixed-layout targets, and a clear split between "Open as…" (import, creates a new editable copy) and "Export as…" (the original stays untouched).

### Cited Findings
- VERT's product framing is drag in, pick target, convert locally, with video optionally offloaded to a daemon the user runs: a working precedent for "this conversion needs your other machine". [R] — [VERT-sh/VERT](https://github.com/VERT-sh/VERT)
- Marker exposes named quality/speed modes (`fast`, `balanced`, `vllm`, `no_ocr`) and MinerU exposes tiers (flash, basic, standard, advanced): precedent for presenting conversion quality as a small set of named presets rather than raw parameters. [R] — [Marker](https://github.com/datalab-to/marker); [MinerU](https://github.com/opendatalab/MinerU)
- The ONLYOFFICE embed used in sibling notes only lists DOCX/XLSX/PPTX/CSV as programmatic save targets, with PDF via UI export; so the app's own Export dialog must drive x2t directly for other targets. [N: office-suite-engines.md] — [ranuts/document](https://github.com/ranuts/document)

### Inferences
- **Dialog structure:** (1) target chooser grouped as "Share as final (PDF, image)", "Edit elsewhere (docx/xlsx/pptx/odt)", "Plain content (md, txt, csv, html)", "More…"; (2) each target shows a label chip and a one-line loss summary generated from the route's `loses` flags (e.g. "Good: animations and speaker notes are dropped"); (3) options panel generated from the edge's options schema; (4) destination (save, share, copy to clipboard) and a "remember as preset" toggle.
- **Fidelity labels (user-facing):** *Exact* (same bytes of content or pixel-identical rendering), *High* (looks the same, minor differences possible, e.g. fonts), *Good* (content and structure kept, appearance may change), *Content only* (text, headings, tables, images; layout dropped), *Text only*, *Picture only* (looks exact, not editable). Never show a percentage.
- **Per-format options worth exposing:** PDF (page size, orientation, margins, range, PDF/A, embed fonts, image quality, password); xlsx → pdf (sheets, fit to width/page, gridlines, headers, landscape); pptx → pdf/images (slides range, notes pages, handouts, hidden slides, DPI); images (format, quality, max dimension, strip metadata, background for transparent → jpg); csv (delimiter, encoding, BOM, quote rule, date format, which sheet); md (flavour, embed images as files or data URIs, front matter); OCR (languages, deskew, keep original image).
- **Preview before export** for fixed-layout targets (first pages rendered from the actual output, since x2t/Typst are fast enough) and a "what changed" summary for content targets (counts: n images kept, n tables, n comments dropped).
- **Round-trip warnings:** when a file was opened through a lossy import (pdf → docx, pptx → md), saving back to the source format warns once and defaults to "Save as copy". Keep the original alongside and record provenance (source hash, route, date) in the export's metadata or a sidecar.
- **"Open as…" versus "Export as…":** Open as = pick how to interpret an input (pdf as PDF, as editable document via reconstruction, as images; csv as sheet or as text); Export as = write a new file. Both use the same graph; Open as only shows routes ending in a format the app edits natively.
- **Batch:** "Convert folder…" with a source filter, one target, one preset, output folder or "next to source", a dry-run list showing the route and label per file, then a results table with retry for failures.
- **Desktop integrations:** drag-out export (drag the tab or a format chip to Explorer/Finder to materialise the file), "Copy as" (Markdown, HTML, image) to clipboard, recent export presets on the tab's context menu, Explorer context-menu "Convert with…" later.
- **Mobile:** export ends in the system share sheet; the app registers as a share target/"Open in" handler so any file can be sent in and converted; long jobs show a persistent progress notification (Android foreground service, iOS Live Activity/continued processing) [K]. When a route needs a desktop-only pack, offer "Queue for my PC": the job syncs and the result comes back into the same folder.
- **Missing pack flow:** targets that need an optional pack are shown (not hidden) with the pack size and a one-tap install on desktop.

### Gaps
- No user-research or HIG-level source on conversion dialogs was consulted (Apple HIG, Material, Office/Acrobat export flows); the above is unreferenced design reasoning.
- iOS Live Activity suitability for conversion progress and share-extension memory limits (share extensions have a much lower memory ceiling than apps [K]) were not verified; in-extension conversion should be avoided in favour of handing the file to the main app.

---

## 7. Bottom line: tiers, conversion matrix, per-platform converter set, risks, spikes

### Takeaway
Ship v1 on four in-webview engines (x2t-WASM, Pandoc WASM, a PDF engine, an image engine) plus native OCR, with Typst as the typeset-PDF route; make LibreOffice, Calibre, an ML PDF parser and ffmpeg desktop-only optional packs. Promise "exact/high" only for editable → fixed conversions and label everything else honestly.

### Cited Findings
(Every tool fact below is sourced in sections 1–4; the sizes repeated here are the only ones with a source.)
- x2t.wasm 35.8 MB raw / 8.0 MB brotli; AGPL-3.0. [N] — [npm eurooffice-sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common)
- Pandoc 3.14 WASM zip 16.3 MB; GPL-2.0-or-later. [R] — [pandoc releases](https://github.com/jgm/pandoc/releases)
- Typst web compiler 7.62 MB gz + 4.42 MB fonts. [S] — [typst.ts](https://myriad-dreamin.github.io/typst.ts/cookery/get-started.html)
- PDFium WASM about 2.7 MB gzipped (EmbedPDF, Apache-2.0/MIT); MuPDF.js AGPL; PDF.js Apache-2.0. [N: pdf-stack.md] — [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)
- wasm-vips about 10 MB WASM, 1 GiB cap; libheif decoder 1.2–1.5 MB. [S] — [WordPress ticket 64734](https://core.trac.wordpress.org/ticket/64734); [dev.to HEIC](https://dev.to/forze-dev/why-heic-breaks-websites-and-how-i-built-a-browser-only-converter-to-fix-it-gp0)
- MinerU basic/ONNX: ~0.8 GB models, 2 GB RAM, CPU. olmOCR: ≥12 GB VRAM. [R] — [MinerU](https://github.com/opendatalab/MinerU); [olmOCR](https://github.com/allenai/olmocr)
- LibreOffice native 300–600 MB install; ffmpeg.wasm ≈25–30 MB with a 2 GB input ceiling. [N / S] — [ffmpeg.wasm issue 623](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/623)

### Inferences

**Tiered format list (proposal)**

| Tier | In and out | In only |
|---|---|---|
| v1 | docx, odt, rtf, md, html, txt, pdf, xlsx, ods, csv, tsv, pptx, odp, png, jpg, webp, json, yaml, toml | doc, xls, ppt, svg, heic, gif, tiff, bmp |
| v2 | epub, typst, pdf/a, searchable pdf (OCR), Markdown deck (Marp), xml, ipynb, avif, parquet, sqlite, mermaid (→ svg/png/pdf), eml (→ pdf/md) | msg, mobi/azw3, pages, numbers, key, djvu, xps, drawio |
| Later / desktop pack | tex, asciidoc, rst, org (cheap via Pandoc, low demand), pdf → docx reconstruction, pptx → video, audio/video transcodes, archives as batch containers | hwp/hwpx, legacy WordPerfect/Works etc. via LibreOffice |

**Conversion matrix (rows = from, columns = to).** Cell = tool, quality label. Labels are judgement labels (Exact / High / Good / Content / Text / Picture; "—" = not offered). Tools: X = x2t-WASM, P = Pandoc WASM, T = Typst WASM (via Pandoc's Typst writer), W = webview render + print-to-PDF, F = PDF engine (PDFium/PDF.js/pdf-lib fork), I = image engine (canvas/wasm-vips/resvg), S = spreadsheet lib (SheetJS/own writer), J = pure JS data libs, O = native OCR, LO = LibreOffice pack (desktop), ML = ML parser pack (desktop).

| From \ To | pdf | docx | odt | md | html | txt | xlsx | csv | pptx | png/jpg | epub |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **docx** | X High (LO second opinion) | — | X High | P Content | P Content / X Good | X or P Text | — | — | — | X→F Picture | P Good |
| **doc / rtf / odt** | X High | X High | X High | X→P Content | X Good | X Text | — | — | — | X→F Picture | X→P Good |
| **md** | W Exact (app look) / T High (typeset) | P Good | P Good | Exact | P Exact | P Text | — | — | P Good (simple decks) | W→F Picture | P Good |
| **html** | W High | P Good / X Good | P Good | P Content | Exact | P Text | — | — | — | W→F Picture | P Good |
| **txt** | W or T Exact | P Exact | P Exact | Exact | P Exact | — | — | — | — | — | P Good |
| **pdf** | F Exact (merge/split/PDF-A re-save: v2) | X or LO Fair-to-poor; ML→P Content (pack) | via docx | F text-layer Content; ML Good (pack) | F Content | F Text | ML tables only (pack), Content | same, Content | — | F Exact (chosen DPI) | via md, Content |
| **scanned pdf / image of text** | O Good (searchable PDF) | O→P Text | — | O Text | — | O Text | — | — | — | F/I Exact | — |
| **xlsx / xls / ods** | X Good (pagination options) | — | — | P Content (3.14 reader, new) | X Good | — | X High | X or S Exact data (one sheet; formulas → values) | — | X→F Picture | — |
| **csv / tsv** | X or W Good | — | — | J Exact (table) | J Exact | Exact | S Exact data (type-inference options) | Exact | — | — | — |
| **pptx / ppt / odp** | X High (static slides) | — | — | P Content (3.14 reader, new) | P Content | P Text | — | — | X High | X→F Picture | — |
| **Markdown deck** | W Exact | — | — | Exact | W Exact | — | — | — | P Good (editable) / W→image slides Picture | W→F Picture | — |
| **png / jpg / webp / heic / tiff / gif** | F Exact (image → page) | — | — | O Text | — | O Text | — | — | — | I Exact (lossy codecs: High) | — |
| **svg** | I/W Exact (vector kept via print) | — | — | — | Exact (inline) | — | — | — | — | I Exact (raster at chosen size) | — |
| **epub** | P→T Good / W Good | P Good | P Good | P Good | P Good | P Text | — | — | — | — | Exact |
| **json / yaml / toml / xml** | — | — | — | J (code block) | — | Exact | J→S Content (flat records only) | J Content (flat records only) | — | — | — |

Notes on the matrix:
- json ↔ yaml ↔ toml among themselves: J, Exact for data; comments and key order/formatting are lost (yaml → json drops comments; toml has no null).
- Every "→F Picture" cell is a two-hop route through PDF and is where the cached intermediate pays off.
- pdf → docx is deliberately labelled "Fair-to-poor" in core and only becomes "Content (good)" with the ML pack; it should be presented as "Rebuild as editable document", not "Convert".

**Converter set per platform (proposal)**

| Engine | Windows | macOS | Android | iOS | Size (sourced) | Ships as |
|---|---|---|---|---|---|---|
| x2t-WASM | Yes | Yes (WKWebView, to prove) | Yes (to prove) | To prove; size-capped | 35.8 MB raw / 8.0 MB br | Core on desktop; first-use download on mobile |
| Pandoc WASM 3.14 | Yes | Yes | Yes (to prove) | To prove | 16.3 MB zip | Core (lazy-loaded) |
| Typst WASM (or native Rust crate) | Yes | Yes | Yes | Yes | 7.62 MB gz + 4.42 MB fonts | Core or small pack |
| PDF engine (PDFium WASM / PDF.js) | Yes | Yes | Yes | Yes | PDFium ≈2.7 MB gz | Core |
| Image engine (canvas + wasm-vips or magick-wasm; resvg; libheif decode) | Yes | Yes | Yes (or native Bitmap/ImageDecoder) | Yes (or native ImageIO, which decodes HEIC) | vips ≈10 MB; libheif 1.2–1.5 MB | Core (vips lazy) |
| Data libs (csv/json/yaml/toml/xml), SheetJS-class | Yes | Yes | Yes | Yes | small (unmeasured) | Core |
| Native OCR | `Windows.Media.Ocr`; `TextRecognizer` on Copilot+ | Vision + PDFKit | ML Kit v2 | Vision + PDFKit | 0 (OS) / ML Kit model few MB | Core |
| Tesseract (WASM) fallback | Optional | Optional | Optional | Optional | unmeasured; per-language data | Pack per language |
| Shared font pack | Yes | Yes | Yes | Yes | unmeasured | Core (Latin) + CJK pack |
| LibreOffice headless | Pack | Pack | No | No | 300–600 MB install | Desktop optional pack |
| Calibre | Pack | Pack | No | No | unmeasured | Desktop optional pack (low priority) |
| ML PDF parser (Docling or MinerU basic) | Pack | Pack | No | No | MinerU basic ≈0.8 GB models; Python runtime extra | Desktop optional pack |
| ffmpeg | Pack (native) | Pack | No | No | wasm ≈25–30 MB; native unmeasured | Desktop optional pack, later |

**Top risks**
1. **Quality expectations.** "Anything to anything" invites pdf → docx and pptx → perfect-pdf expectations that no open tool meets; mitigated only by honest labels and by offering two routes (looks-right vs editable).
2. **iOS memory.** x2t and Pandoc WASM inside WKWebView may hit the roughly 300 MB reliable ceiling on real documents; no evidence either way.
3. **Maintenance of the x2t-WASM build.** Community-maintained, no releases, lags upstream; a private build pipeline is needed.
4. **Fonts.** Without the document's fonts every office → PDF is at best "High"; recent Office defaults (Aptos) are not freely substitutable.
5. **Security.** Parsing untrusted office/PDF/image files in large C++ codebases; mitigated by WASM-worker isolation and locked-down sidecars.
6. **Size creep.** Core engines already total tens of MB compressed before fonts; packs must be genuinely optional and removable.
7. **Licences.** AGPL/GPL engines are fine for private use but would force AGPL/GPL terms on the app if it were ever distributed; ML weight licences carry revenue/non-commercial clauses (personal use allowed by Marker as read).
8. **Immature edges.** Pandoc's xlsx reader and expanded pptx reader are from a release nine days old; Windows AI OCR's stable status is unconfirmed.
9. **Benchmark noise.** Published ML-parser scores are mostly vendor-run and mutually inconsistent.

**Spike experiments (in priority order)**
1. Load x2t.wasm and pandoc.wasm in Android WebView and iOS WKWebView on real devices; convert a graded set (1, 10, 50 MB docx/xlsx/pptx); record peak memory, time, crashes, behaviour on the fifth consecutive job (instance teardown).
2. docx/xlsx/pptx → PDF fidelity set (20–30 real files incl. Aptos/Calibri fonts, tables, text boxes, charts): x2t-WASM vs LibreOffice vs Word/Excel/PowerPoint reference; page-count and visual diff; decide when to offer the LibreOffice "second opinion".
3. Confirm x2t-WASM feature flags: PDF/A output, image output, DjVu/XPS/HWP/iWork input, font directory injection, determinism.
4. Pandoc 3.14 pptx → md and xlsx → md on real files; md → pptx with a reference deck; md → Typst → PDF versus webview print for the app's Markdown documents.
5. OCR bake-off on 20 scans: Vision, ML Kit, `Windows.Media.Ocr`, `TextRecognizer` (if a Copilot+ PC is available), tesseract.js; and build a searchable-PDF writer from bounding boxes (verify selection/search alignment in PDF.js and Acrobat).
6. PDF → editable: x2t PDF → DOCX, LibreOffice import, Docling, MinerU basic (CPU) on 15 PDFs (prose, tables, two-column, scanned); time per page on the owner's PC; decide whether the ML pack is worth shipping.
7. Graph engine prototype: registry of about 40 edges, best-path search, loss-flag union, worker-per-job execution with kill-to-cancel, cache keyed on input hash + edge + version + options.
8. Image path: canvas-only vs wasm-vips vs magick-wasm for heic/tiff/large jpg; memory at 50–100 MP; HEIC decode on Windows without the paid HEVC extension (libheif WASM).
9. Measure unpacked sizes and cold-start times for every core engine to set the "lazy-load" and "pack" boundaries.

### Gaps
- Sizes marked "unmeasured" above (fonts, Tesseract, data libs, Calibre, native ffmpeg, Docling/Marker models) have no source in this session.
- The matrix labels are untested judgement; spikes 2, 4 and 6 are what turn them into facts.
- macOS WKWebView behaviour with x2t-WASM remains unproven (also flagged in sibling notes).
- No assessment was made of on-device VLMs on phones for document parsing (e.g. sub-1B models such as Granite-Docling 258M or PaddleOCR-VL 0.9B running via llama.cpp/MLX on a phone); nothing found claiming it works well, so treat as not feasible until shown otherwise.
