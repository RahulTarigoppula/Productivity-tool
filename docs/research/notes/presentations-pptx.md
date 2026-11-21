# Presentations (.pptx) for a personal, local-first all-in-one office app — state as of 2026-11-21

Reading guide for the report writer:

- **[V]** = verified in this session (page fetched, or npm/PyPI/crates.io registry queried on 2026-11-21).
- **[S]** = from a search-result summary only; the underlying page was not opened. Treat as probably right, not confirmed.
- **[K]** = from the researcher's background knowledge of the spec/product; the cited URL is the canonical reference but could **not** be fetched in this session (the sandbox blocked learn.microsoft.com, officeopenxml.com, onlyoffice.com, docs.univer.ai, python-pptx.readthedocs.io, dev.to, img.ly; the GitHub API was also blocked). These are stable, long-standing facts, but they were not re-checked here.
- Version numbers and dates from registries are exact; GitHub star counts are from fetched repo pages and are approximate. GitHub "last commit" dates could not be read for any repo.

---

## 1. PPTX format: package structure, DrawingML, inheritance, and round-trip fidelity pitfalls

### Takeaway
A .pptx is a ZIP of XML parts wired together by relationship files, where most of what you see on a slide is *not stored on the slide* but inherited through slide → layout → master → theme. The two things that break browser renderers are text layout (fonts, line breaking, autofit) and the long tail of DrawingML (preset geometry formulas, effects, SmartArt, charts); the thing that breaks editors is converting to a private JSON model and regenerating the file, which silently discards everything the model does not represent.

### Cited Findings

**Package structure (Open Packaging Conventions)**
- [K] A .pptx is an OPC ZIP package: `[Content_Types].xml`, `_rels/.rels`, and parts under `ppt/`. The main part `ppt/presentation.xml` holds the slide ID list, slide master ID list, notes master/handout master IDs, slide size (`p:sldSz`) and notes size, default text styles, and (optionally) the embedded font list. — [Microsoft: Structure of a PresentationML document](https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document)
- [K] Typical parts: `ppt/slides/slideN.xml`, `ppt/slideLayouts/slideLayoutN.xml`, `ppt/slideMasters/slideMasterN.xml`, `ppt/theme/themeN.xml`, `ppt/notesSlides/notesSlideN.xml`, `ppt/notesMasters/notesMaster1.xml`, `ppt/handoutMasters/handoutMaster1.xml`, `ppt/media/*` (images, audio, video), `ppt/charts/chartN.xml` (+ `ppt/embeddings/*.xlsx` holding the chart's data workbook), `ppt/diagrams/*` (SmartArt), `ppt/embeddings/*` (OLE objects), `ppt/comments/*`, `ppt/presProps.xml`, `ppt/viewProps.xml`, `ppt/tableStyles.xml`, `ppt/fonts/*.fntdata`, `docProps/*`, plus `customXml/`. — [officeopenxml.com: PresentationML overview](http://officeopenxml.com/prPresentation.php)
- [K] Every part has a sibling `_rels/<part>.rels` file; elements reference other parts by relationship ID (`r:id`, `r:embed`, `r:link`), never by path. A slide points to exactly one layout; a layout to exactly one master; a master to its theme and to all its layouts. Deleting or adding a slide therefore means editing presentation.xml, its rels, `[Content_Types].xml`, and often docProps/app.xml consistently. — [Microsoft: Structure of a PresentationML document](https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document)
- [K] Notes pages, the notes master and the handout master each have their own theme part; a deck commonly contains 2–3 theme files even with one slide master. — [officeopenxml.com: PresentationML overview](http://officeopenxml.com/prPresentation.php)

**Units**
- [K] Geometry is in EMU (English Metric Units): 914,400 per inch, 12,700 per point, 360,000 per cm. A 16:9 slide is 12,192,000 x 6,858,000 EMU (13.333 x 7.5 in). Font sizes are hundredths of a point (`sz="1800"` = 18 pt); angles are 60,000ths of a degree; percentages are 1,000ths of a percent (`100000` = 100%). — [officeopenxml.com: DrawingML object positioning](http://officeopenxml.com/drwSp-location.php)
- [V] pptxtojson (the parser behind PPTist) converts to its own unit system rather than keeping EMU, documented in a separate "units" section of its guide. — [pptxtojson repo](https://github.com/pipipi-pikachu/pptxtojson)

**DrawingML shapes**
- [K] The slide's shape tree (`p:cSld/p:spTree`) contains `p:sp` (shape/text box), `p:pic` (picture; also the carrier for video/audio), `p:grpSp` (group, with its own child coordinate space via `a:chOff`/`a:chExt`, so nested groups need matrix composition), `p:cxnSp` (connector, with `stCxn`/`endCxn` referencing shape IDs and connection-site indices), and `p:graphicFrame` (tables, charts, SmartArt, OLE). — [officeopenxml.com: DrawingML shapes](http://officeopenxml.com/drwShape.php)
- [K] Preset geometry (`a:prstGeom prst="..."`) names one of roughly 187 preset shapes whose outlines are defined as *formulas* (guides, adjust values `a:avLst`, connection sites, text rectangle) in the spec's `presetShapeDefinitions.xml`; a renderer must implement the guide-formula evaluator, not just a table of paths, because adjust handles reshape the outline. Custom geometry (`a:custGeom`) uses the same guide/path language. — [ECMA-376 standard (Part 1, DrawingML)](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- [V] Even a current dedicated renderer is incomplete here: @aiden0z/pptx-renderer supports "common DrawingML preset families and numeric custom geometry" but states arbitrary symbolic guides in custom geometry are not yet supported. — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)
- [K] Fills (solid, gradient, pattern, picture/blip with crop and tile), lines (dash, compound, arrowheads, joins), and effects (outer/inner shadow, glow, soft edge, reflection, 3D bevel/extrusion `a:sp3d`/`a:scene3d`) are all DrawingML; colors are expressed as a base (sRGB, scheme color, system color, preset) plus transform children (`lumMod`, `lumOff`, `tint`, `shade`, `alpha`, `satMod`), so resolving a color requires the theme and the master's color map. — [officeopenxml.com: DrawingML overview](http://officeopenxml.com/drwOverview.php)

**Text body and autofit**
- [K] Text lives in `p:txBody` = `a:bodyPr` (insets, anchor, wrap, columns, vertical text, rotation, autofit) + `a:lstStyle` (per-level overrides) + paragraphs `a:p` with `a:pPr` (level, alignment, indent/margin, spacing, bullets/numbering, tab stops) and runs `a:r` / `a:fld` (fields like slide number) / `a:br`. — [officeopenxml.com: text body properties](http://officeopenxml.com/drwSp-text-bodyPr.php)
- [K] Three autofit modes: `a:noAutofit`, `a:spAutoFit` (shape resizes to fit text), `a:normAutofit` (text shrinks; carries `fontScale` and `lnSpcReduction`). The scale values are *computed by PowerPoint's layout engine and cached in the file*; another application that edits the text must either recompute them with its own text measurement or leave stale values. python-pptx documents that it does not do this automatically (it offers a best-effort `fit_text()`), and PowerPoint only recalculates when the text is next edited in PowerPoint. — [python-pptx: auto-fit text analysis](https://python-pptx.readthedocs.io/en/latest/dev/analysis/txt-autofit-text.html)
- [S] pptxtojson's docs note that with no autofit setting the box size is fixed and the font size is not scaled — i.e. shrink behaviour depends entirely on what the file declares. — [pptxtojson README (jsDelivr)](https://cdn.jsdelivr.net/npm/pptxtojson@2.2.0/README.md)
- [V] pptx-renderer (Oct 2026) describes its text support as covering the master/layout/placeholder/shape cascade, CJK, bullets, tab stops, "common wrap/overflow combinations" and "selected spAutoFit growth", and states plainly that font substitution can change line breaks and that exact Office layout for text is not achieved. — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)

**Placeholders and inheritance**
- [K] A placeholder shape on a slide (`p:nvPr/p:ph type=".." idx=".."`) usually has *no* position, size, font, or bullet definition of its own. Resolution order for geometry: slide shape → matching placeholder on the layout (by `idx`, falling back to `type`) → matching placeholder on the master. For text properties: run → paragraph → shape `lstStyle` → layout placeholder `lstStyle` → master placeholder `lstStyle` → master `p:txStyles` (`titleStyle`/`bodyStyle`/`otherStyle`, 9 indent levels) → `presentation.xml` `defaultTextStyle` → theme fonts (`+mj-lt`/`+mn-lt` major/minor) and theme colors through the master's `p:clrMap` (which a layout or slide can override with `p:clrMapOvr`). — [officeopenxml.com: PresentationML slide layouts/masters](http://officeopenxml.com/prSlideLayout.php)
- [K] Backgrounds, master/layout decorative shapes (shown unless `showMasterSp="0"`), headers/footers/date/slide-number placeholders, and theme format scheme (fill/line/effect style matrices referenced by `p:style` idx) are all inherited too. — [officeopenxml.com: PresentationML slide masters](http://officeopenxml.com/prSlideMaster.php)
- [V] pptxtojson names "complex masters, deeply nested groups, special shape effects, complex gradients, non-standard shapes, complex SmartArt" as where its fidelity drops. — [pptxtojson repo](https://github.com/pipipi-pikachu/pptxtojson)

**Tables**
- [K] Tables are `a:tbl` inside a `p:graphicFrame`: `a:tblGrid` column widths, rows with heights (a row's stored height is a *minimum*; actual height grows with text, so rendering requires text layout), cells with `gridSpan`/`rowSpan`/`hMerge`/`vMerge`, per-cell borders/fills/margins, and a table style referenced by GUID resolved against `ppt/tableStyles.xml` with banding/first-row/last-col flags. PowerPoint's built-in table styles are referenced by GUID and are *not necessarily written into the file*, so a renderer needs its own copy of the built-in style definitions. — [officeopenxml.com: DrawingML tables](http://officeopenxml.com/drwTable.php)
- [V] Corroboration: @diceui/pptx ships a table-style data file under a separate licence (MPL-2.0), and pptx-renderer says it supports "built-in and document table styles" validated against an eight-case native PowerPoint matrix. — [sadmann7/pptx](https://github.com/sadmann7/pptx); [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)

**Charts**
- [K] A chart is a separate ChartML part (`ppt/charts/chartN.xml`, `c:chartSpace`) with cached series values plus an embedded .xlsx workbook that is the editable data source; newer chart types (waterfall, treemap, sunburst, funnel, histogram, box-and-whisker) use a different schema (`cx:` chartex) wrapped in `mc:AlternateContent`. The file stores *no drawn picture of the chart* — axis scaling, label placement and legend layout are computed by the consuming application. — [officeopenxml.com: DrawingML charts](http://officeopenxml.com/drwCharts.php)
- [V] pptx-renderer renders charts by mapping them onto ECharts and says "chart layout is approximate"; 3D charts fall back to 2D. — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)

**SmartArt**
- [K] SmartArt is four parts per diagram — data model (`dataN.xml`), layout definition (`layoutN.xml`, an algorithmic layout language), quick style, colors — plus a fifth Microsoft-extension part `drawingN.xml` (`dsp:` namespace) that caches the laid-out result as ordinary shapes. Almost every non-Microsoft implementation renders the cached drawing rather than executing the layout definition; if the data is edited without regenerating the drawing, the two go out of sync. — [Microsoft: Working with SmartArt / diagram parts (Open XML SDK)](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.packaging.diagramdatapart)
- [V] pptx-renderer: "renders available diagram fallback data… layout fidelity varies". — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)

**Animations and transitions**
- [K] Animations are a SMIL-derived timing tree in `p:timing/p:tnLst`: nested `p:par`/`p:seq` time containers with `p:cTn` nodes (preset ID/class/subtype, trigger conditions: on click / with previous / after previous, delay, duration, repeat) and behaviours (`p:anim`, `p:animEffect`, `p:animMotion`, `p:animRot`, `p:animScale`, `p:set`, `p:cmd`, audio/video nodes) targeting shape IDs or text paragraph ranges, plus `p:bldLst`. PowerPoint's ~200 named effects are encoded as preset IDs *and* as an explicit expansion into primitive behaviours. — [officeopenxml.com: PresentationML animation](http://officeopenxml.com/prSlide-animation.php)
- [K] Transitions are `p:transition` on the slide. Effects added after 2007 (and Morph, `p159:morph`, 2016+) sit inside `mc:AlternateContent` with a `mc:Fallback` to a basic effect (usually fade); an app that does not understand the newer namespace and re-saves will usually keep only the fallback. — [Microsoft: Morph transition extension ([MS-PPTX] / Office 2016 extensions)](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-pptx/)
- [V] Current dedicated OSS renderers still skip this entirely: pptx-renderer lists "animation playback or transitions" as unsupported. — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)
- [S] Real-world report of loss in a full editor: a Nextcloud user reported that opening an animated deck in ONLYOFFICE changed the file and stripped animations; a commenter suggested ONLYOFFICE supports only a limited set of complex animations. Undated/older thread — treat as anecdote. — [Nextcloud forum thread](https://help.nextcloud.com/t/nextcloud-or-onlyoffice-changes-my-animated-pptx-files/44796)

**Media and embedded objects**
- [K] Video/audio are `p:pic` shapes with a poster image plus `a:videoFile`/`a:audioFile` and a `p14:media` extension pointing at the media part (or an external link); playback controls live in the timing tree. OLE embeddings (`p:oleObj`) carry a binary payload plus a preview image, frequently EMF/WMF — vector formats browsers cannot draw natively. — [officeopenxml.com: PresentationML slide content](http://officeopenxml.com/prSlide.php)
- [V] pptx-renderer lists "arbitrary EMF/WMF vector rendering", "executable or editable OLE objects", a complete equation (OMML) engine, slide-note rendering, embedded 3D models and text-shadow parity as unsupported. — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)

**Fonts**
- [K] Decks reference fonts by name only; the theme defines major/minor fonts per script (Latin, East Asian, complex script). Fonts can optionally be embedded (`p:embeddedFontLst`, `ppt/fonts/fontN.fntdata`) in an obfuscated/compressed EOT-style container, subject to the font's embedding permissions. — [Microsoft: Structure of a PresentationML document](https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document)
- [V] Corroboration that embedded fonts need real decoding work: @diceui/pptx states its font decoder is "an original implementation of W3C MTX and EOT submissions". — [sadmann7/pptx](https://github.com/sadmann7/pptx)
- [S] Several 2026 viewers map Calibri/Cambria etc. to metric-compatible open fonts; READMEs warn that substitutes do not share exact metrics, so text reflows, overflows boxes and breaks lines differently; one notes glyph metrics/kerning differ from Windows text rendering and that PowerPoint's faux-bold widens text. One viewer lists embedded fonts as unsupported; another deobfuscates and injects them. — [pptx-browser README](https://cdn.jsdelivr.net/npm/pptx-browser@4.1.5/README.md); [quicklook-pptx-renderer README](https://cdn.jsdelivr.net/npm/quicklook-pptx-renderer@0.3.5/README.md); [mdurbar/pptx-viewer](https://github.com/mdurbar/pptx-viewer)
- [S] An ONLYOFFICE community thread reports custom fonts not being imported when opening .pptx files — font availability is a problem even for the full editors. — [ONLYOFFICE community](https://community.onlyoffice.com/t/custom-fonts-are-not-imported-when-opening-pptx-files/19577)

**Stated fidelity of the JSON-conversion route**
- [V] PPTist states import fidelity "~85%+" and export "~95%+", says animations, special charts, deeply nested structures, non-standard elements and some advanced styles may differ, and that "100% fidelity cannot be guaranteed". — [PPTist repo](https://github.com/pipipi-pikachu/PPTist)
- [V] pptxtojson states ~85%+ overall layout/styling fidelity, 95%+ for simple manually-created files. — [pptxtojson repo](https://github.com/pipipi-pikachu/pptxtojson)

### Inferences
- **Hardest to render in a browser, in rough order:** (1) text — matching PowerPoint's line breaks needs the same fonts *and* the same shaping/kerning/line-height rules, and autofit feeds layout back into font size; (2) full preset/custom geometry with adjust handles; (3) charts, because the file has data but no layout; (4) SmartArt when the cached drawing is absent or stale; (5) effects (soft shadows, glow, reflection, 3D bevel) which have no exact CSS/SVG equivalent; (6) EMF/WMF and OLE previews; (7) animation playback. Every OSS renderer surveyed disclaims at least four of these.
- **What is lost in "pptx → own JSON → pptx" (the PPTist / PptxGenJS pattern):** the export is a *new* file built from the editor's flattened model. Inheritance is baked in (placeholders become absolutely-positioned text boxes, so the deck no longer responds to layout/master/theme changes in PowerPoint); masters/layouts beyond what the writer emits, theme format schemes, SmartArt data, chart workbooks, the animation timing tree, post-2007 transitions, comments, sections, custom XML, OLE objects, embedded fonts, VBA, accessibility metadata (alt text, reading order) and any `mc:AlternateContent` / extension-list (`a:extLst`) content are dropped unless explicitly modelled. The practical rule: anything the editor cannot draw, it also cannot save.
- **The alternative is "patch the original package":** keep the original ZIP/XML as the source of truth, model only what you edit, and write changes back into the existing XML, passing unknown elements through untouched. pptx-automizer (template patching), python-pptx (lxml proxies over the real XML), @pptx-glimpse/document and @diceui/pptx-core are built this way. It preserves unknown content but makes structural edits (new slide from a layout, delete slide, copy between decks) fiddly because of relationship bookkeeping.
- For a personal tool, a realistic contract is **"opens most decks legibly, never destroys what it doesn't understand"** rather than pixel parity. That contract is only achievable with the patch-the-original design.

### Gaps
- No primary spec page could be fetched this session; all [K] items should be spot-checked against ECMA-376 Part 1 (5th ed.) or Microsoft's Open XML docs before being quoted as exact (in particular the "~187 presets" count and exact inheritance order).
- No independent, quantitative fidelity benchmark comparing OSS renderers on a common corpus was found; the 85%/95% figures are self-reported by the PPTist author with no published methodology.
- The planned-for developer write-ups (dev.to "Render PowerPoint PPTX to HTML in pure JavaScript", img.ly "native PPTX editing in the browser") were found by search but could not be opened; their specific lessons are not captured. — [dev.to post](https://dev.to/darksun113/render-powerpoint-pptx-to-html-in-pure-javascript-no-libreoffice-no-headless-browser-2921); [img.ly post](https://img.ly/blog/powerpoint-online-native-pptx-editing-in-the-browser-with-creativeeditor-sdk/)
- No relevant Hacker News discussion was retrieved.

---

## 2. Feature inventory in tiers (PowerPoint / Keynote / Google Slides / ONLYOFFICE)

### Takeaway
The must-have tier is small and well within a solo developer's reach; PPTist already demonstrates that a single maintainer can ship most of the "must-have" and "expected" tiers in a web stack. The advanced tier (full animation engine, SmartArt editing, Morph, video export) is where the commercial suites have decades of lead and where even ONLYOFFICE is still adding pieces in 2025–2026.

### Cited Findings

**What an open-source single-maintainer editor actually covers (useful as a floor)**
- [V] PPTist's feature list: undo/redo, shortcuts, slide and element editing, grouping, alignment, layer order; elements = rich text, images, shapes, lines, charts (eight types), tables, video, audio, LaTeX formulas; slide show with annotation brushes, presenter and audience views, timer, laser pointer; transition and element animations; speaker notes; template-based AI deck generation; basic mobile editing/preview; import PPTX/JSON, export PPTX/JSON/images/PDF (via print). — [PPTist repo](https://github.com/pipipi-pikachu/PPTist)

**What ONLYOFFICE has been adding recently (shows where a mature OSS editor still had gaps)**
- [S] ONLYOFFICE Docs 9.0 (June 2025): dynamic text animations, advanced chart customisation (up/down bars, WordArt titles). 9.1 (Oct 2025): Slide Master settings moved to a dedicated toolbar tab. 9.3 (Feb 2026): GIF playback in slideshow mode. 9.4 (May 2026): 25 new slide themes and new transition effects. — [ONLYOFFICE 9.0 release](https://www.onlyoffice.com/blog/en/2025/06/onlyoffice-docs-9-0-released); [9.1 release](https://onlyoffice.com/blog/2025/10/docs-9-1-released); [9.3 release](https://onlyoffice.com/blog/2026/02/onlyoffice-docs-9-3); [9.4 release](https://onlyoffice.com/blog/2026/05/onlyoffice-docs-9-4)
- [S] ONLYOFFICE marketing claims SmartArt creation and preservation of "layouts, animations, transitions, and styles"; Morph status is unclear — a community feature-request list asks for a "Transformation (Morph)" transition while a 2022 ONLYOFFICE blog post describes applying morph. Conflicting; unverified. — [ONLYOFFICE presentation editor page](https://www.onlyoffice.com/presentation-editor); [community thread](https://community.onlyoffice.com/t/lack-of-compatibility/4928); [2022 transitions blog](https://www.onlyoffice.com/blog/2022/04/powerpoint-transitions)
- [S] Collabora Online/CODE 26.04 added mixing slide sizes in one deck and "present to all" in Impress. — [Collabora Office 26.04 release notes](https://www.collaboraonline.com/collabora-office-26-04-release-notes/)

**Tiered inventory** (compiled from product knowledge [K]; canonical feature references: [PowerPoint help](https://support.microsoft.com/en-us/powerpoint), [Keynote user guide](https://support.apple.com/guide/keynote/welcome/mac), [Google Slides help](https://support.google.com/docs/topic/9052835), [ONLYOFFICE presentation editor](https://www.onlyoffice.com/presentation-editor))

| Tier | Features |
|---|---|
| **Must-have** | Slide navigator (thumbnails; add/duplicate/delete/reorder by drag); canvas with select/move/resize/rotate; text boxes with rich text (font, size, bold/italic/underline, colour, alignment, bullets/numbering, line spacing); basic shapes and lines/arrows with fill/stroke; images (insert, paste, drag-drop, crop, replace); simple tables; speaker notes; slide show mode (fullscreen, keyboard/clicker navigation); a few themes and layouts (title, title+content, two-column, blank); slide size 16:9 / 4:3; undo/redo; copy/paste; zoom; open/save .pptx; export PDF. |
| **Expected** | Editable masters/layouts and placeholders; theme colours and fonts; smart guides, snapping, grid, rulers; align/distribute; group/ungroup; z-order; multi-select and marquee; format painter; connectors that stay attached; charts (bar/line/pie/scatter) with a data grid; slide transitions; presenter view (current + next slide, notes, elapsed timer/clock, on a second display); hyperlinks and slide links; slide numbers/footers/date; hide slide; sections; find/replace; spell check; image adjustments (opacity, corner radius, shadow); gradient fills; slide sorter/grid view; outline view; export images; print. |
| **Advanced** | Element animations (entrance/emphasis/exit/motion path, on-click/with/after sequencing, text by paragraph); Morph (PowerPoint) / Magic Move (Keynote); SmartArt creation and editing; embedded video/audio with trim and playback options; export to video / animated GIF; handouts and notes pages printing; equation editor; freeform/Bezier drawing, edit points, boolean shape operations (merge/subtract); WordArt and 3D effects; background removal; comments and review; rehearse timings and recorded narration; custom shows; zoom/summary slides; laser pointer and ink annotation in show; embedded fonts; accessibility checker; macros; live captions; real-time collaboration (not needed for single-user). |

### Inferences
- The must-have + most of the expected tier corresponds closely to what PPTist ships, which is evidence that it is a one-person-achievable scope *when the document model is your own*. The cost multiplier comes from doing the same on top of real PPTX semantics (placeholders, inheritance, masters).
- For personal use, the highest-value "expected" items are presenter view, snapping/alignment guides, masters/themes, and PDF export. Charts and animations are the first items to defer: both are expensive and both round-trip poorly.
- Features that only matter with other people (comments, co-editing, review) can be dropped, but should be *preserved on round-trip* if present in an opened file.

### Gaps
- The tier table is the researcher's synthesis; no single authoritative source ranks presentation features by necessity. Vendor help centres were not fetched this session.
- ONLYOFFICE's actual support level for PowerPoint's animation set, Morph and SmartArt *editing* (as opposed to display) in 9.4+ was not confirmed from a primary source (onlyoffice.com was blocked).
- No versions later than ONLYOFFICE Docs 9.4 (May 2026) were found; a 9.5/10.x may exist by November 2026.

---

## 3. Embeddable editors and alternative deck formats

### Takeaway
Only two open-source codebases edit real PPTX at near-commercial fidelity — ONLYOFFICE (and its 2026 fork Euro-Office) and LibreOffice-based Collabora — and both are large embedded suites rather than libraries. PPTist is the only mature, hackable, web-native slide editor, but it uses its own JSON model with lossy PPTX conversion; Univer Slides exists but its PPTX import/export depends on a conversion backend.

### Cited Findings

**ONLYOFFICE Presentation Editor**
- [S] Latest release found: ONLYOFFICE Docs 9.4, May 2026, which also included a licence update. — [ONLYOFFICE Docs 9.4](https://onlyoffice.com/blog/2026/05/onlyoffice-docs-9-4)
- [S] Licence: AGPL-3.0 with additional terms. Before 9.4 those terms required keeping the ONLYOFFICE logo in derivatives while granting no trademark rights, which Nextcloud and (reportedly) the FSF considered contradictory / removable under AGPL section 7. Secondary sources say 9.4 dropped the logo obligation and made the terms non-contradictory, and that 9.4 removed the community-edition connection limit; ONLYOFFICE's own post still says additional terms accompany every copy. Exact current terms unverified. — [Nextcloud: Euro-Office licence compliance](https://nextcloud.com/blog/euro-office-license-compliance-and-what-open-source-means/); [desdelinux on 9.4](https://blog.desdelinux.net/onlyoffice-documentserver-9-4-lanzamiento-novedades-licencia-conexiones/); [OMG! Ubuntu: 9.4 "stricter licence"](https://omgubuntu.co.uk/2026/05/onlyoffice-9-4-released); [Wikipedia: OnlyOffice](https://en.wikipedia.org/wiki/OnlyOffice)
- [V] Official React wrapper `@onlyoffice/document-editor-react` 2.3.0 (2026-10-14), Apache-2.0; it is a component "for ONLYOFFICE Document Server", i.e. it embeds an iframe served by a running Document Server rather than bundling the editor. — [npm: @onlyoffice/document-editor-react](https://www.npmjs.com/package/@onlyoffice/document-editor-react)
- [K] Architecture: editors are a canvas-rendered JS app (`sdkjs` + `web-apps`) that works natively on OOXML structures, with conversion (`x2t`, C++) to an internal binary format; ONLYOFFICE Desktop Editors packages the same editors offline in a Chromium shell. — [ONLYOFFICE/sdkjs](https://github.com/ONLYOFFICE/sdkjs); [ONLYOFFICE/DesktopEditors](https://github.com/ONLYOFFICE/DesktopEditors)

**Euro-Office (fork of ONLYOFFICE)**
- [S] Launched 27 March 2026 by a coalition led by IONOS and Nextcloud as a fork of ONLYOFFICE; listed as AGPL-3.0-only; first stable release reported 9 June 2026; ONLYOFFICE initially alleged licence violations and the dispute was later reported resolved after ONLYOFFICE changed its licence text (the "resolved" claim rests on thin sourcing). — [It's FOSS](https://itsfoss.com/news/onlyoffice-forked/); [Wikipedia: Euro-Office](https://en.wikipedia.org/wiki/Euro-Office); [heise](https://heise.de/-11241334); [ONLYOFFICE open letter](https://onlyoffice.com/blog/2026/04/open-letter-to-the-euro-office-team)

**Collabora (LibreOffice Impress engine)**
- [S] Collabora launched "Collabora Office" as a new open-source *desktop* suite for Linux, macOS and Windows in November 2025, bringing the Collabora Online interface offline; described as offline-first; an early review noted Draw was missing. First major update 26.04 was covered in July 2026. — [Collabora press release](https://www.collaboraonline.com/blog/press-release-bringing-collabora-online-to-the-desktop/); [It's FOSS launch coverage](https://itsfoss.com/news/collabora-launches-desktop-office-suite/); [It's FOSS 26.04](https://itsfoss.com/news/collabora-office-26-04/); [betanews](https://betanews.com/2025/11/26/collabora-office-is-an-open-source-desktop-suite-for-windows-macos-and-linux)
- [K] Collabora Online renders documents server-side in LibreOfficeKit and streams tiles to a browser canvas; licence MPL-2.0 (a weaker copyleft than AGPL). Embedding it in your own app normally means running the `coolwsd` service locally and loading it in an iframe via the WOPI protocol. — [CollaboraOnline/online](https://github.com/CollaboraOnline/online)

**LibreOffice in WebAssembly (ZetaOffice / zetajs)**
- [S] allotropia's ZetaOffice is a LibreOffice WASM build with a JS wrapper (zetajs) for embedding and automating it via UNO in the browser; a 2025 conference deck lists ongoing bug-fixing, size/performance work and OPFS support; Impress is listed among its offerings. No 2026 status report was found. — [allotropia: launching ZetaOffice](https://blog.allotropia.de/2024/11/08/launching-zetaoffice/); [npm: zetajs](https://npmjs.com/package/zetajs); [The Register, Feb 2025](https://www.theregister.com/2025/02/13/libreoffice_wasm_zetaoffice/); [Chemnitzer Linux-Tage 2025 slides](https://chemnitzer.linux-tage.de/2025/media/programm/folien/354.pdf)

**Univer Slides**
- [V] `@univerjs/slides` 1.3.1 (2026-10-30), `@univerjs/core` 1.5.2 (2026-11-16), Apache-2.0. — [npm: @univerjs/slides](https://www.npmjs.com/package/@univerjs/slides)
- [S] Univer's docs: the browser API imports .ppt/.pptx and exports .pptx, but **the import APIs need a conversion backend** ("file exchange integration" for uploads, conversion, task queries, downloads); .pptm/.ppsx/.potx are not accepted in the browser; since 1.2.0 Univer no longer ships built-in import/export menus (services and Facade APIs remain). — [Univer docs: Slides import/export](https://docs.univer.ai/guides/slides/features/import-export)
- [S] Maturity signal is mixed: 2024 README snapshots said "Univer Slide is under development"; 2026 secondary coverage says Univer 1.0 ships six editors (Sheets, Docs, Slides, Boards, Bases, PDFs) under Apache-2.0. Not confirmed against official release notes. — [dream-num/univer](https://github.com/dream-num/univer); [ByteIota article](https://byteiota.com/?p=27256)

**PPTist**
- [V] ~9.5k stars, 1.8k forks, 1,331 commits; Vue 3 + TypeScript, no UI component library, Vite, Node 20+. Licence AGPL-3.0; closed-source commercial use prohibited without a paid licence (2,999 RMB/year or 5,999 RMB perpetual, "not a software sale", no support/SDK); an older Apache-2.0 version exists but is unmaintained (last updated May 2022). — [PPTist repo](https://github.com/pipipi-pikachu/PPTist)
- [V] PPTX import goes through the author's separate `pptxtojson` (MIT; 3.0.0 published 2026-11-15, 57 versions since 2022 — actively maintained). — [npm: pptxtojson](https://www.npmjs.com/package/pptxtojson); [pptxtojson repo](https://github.com/pipipi-pikachu/pptxtojson)
- [K] PPTX export is generated with PptxGenJS (a fresh file from PPTist's model), and elements are DOM/SVG-rendered, not canvas. — [PPTist repo](https://github.com/pipipi-pikachu/PPTist)

**Canvas-design SDKs**
- [V] Polotno 4.22.1 (2026-11-20): "Design editor SDK: embed a Canva-like editor… export PNG, PDF…"; npm licence field is "SEE LICENSE IN LICENSE.md" — i.e. proprietary/commercial, not open source. — [npm: polotno](https://www.npmjs.com/package/polotno)
- [V] tldraw 5.6.2 (2026-11-20): licence "SEE LICENSE IN LICENSE.md" (custom, not an OSI licence). Whiteboard, not PPTX. — [npm: tldraw](https://www.npmjs.com/package/tldraw)
- [K] Excalidraw is MIT and whiteboard-oriented; neither it nor tldraw reads/writes PPTX. — [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)

**Markdown/HTML deck frameworks (alternative deck format, not PPTX editors)**
- [V] reveal.js 6.0.2 (2026-09-10, MIT); Slidev `@slidev/cli` 53.1.0 (2026-11-05, MIT); Marp CLI 4.5.1 (2026-09-06, MIT). — [npm: reveal.js](https://www.npmjs.com/package/reveal.js); [npm: @slidev/cli](https://www.npmjs.com/package/@slidev/cli); [npm: @marp-team/marp-cli](https://www.npmjs.com/package/@marp-team/marp-cli)
- [K] Marp CLI can export .pptx, but by default each slide is a rendered image (not editable shapes); Slidev likewise exports PPTX as images. These tools cannot open a .pptx. — [marp-team/marp-cli](https://github.com/marp-team/marp-cli); [Slidev exporting guide](https://sli.dev/guide/exporting)

**Newer 2025–2026 OSS PPTX viewer/editor projects** (all young; registry data verified 2026-11-21)

| Package | Version / date | First published | Licence | What it is |
|---|---|---|---|---|
| [@aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer) | 1.4.0 / 2026-10-18 | 2026-02-28 | Apache-2.0 | Browser-only parse → model → HTML/SVG DOM renderer; ~145 stars; viewer only |
| [@diceui/pptx](https://github.com/sadmann7/pptx) | 0.6.0 / 2026-11-17 | 2026-09-01 | Apache-2.0 (table-style data MPL-2.0) | React primitives + framework-free core that "parses, renders, edits and saves"; selection overlay with move/resize/rotate, inline text edit, multi-select, undo/redo; parser derived from pptx-renderer; ~19 stars |
| [pptx-glimpse](https://github.com/hirokisakabe/pptx-glimpse) | 5.3.1 / 2026-09-21 | 2026-02-11 | MIT | PPTX → SVG/PNG in Node (22+) or browser without Office/LibreOffice; `createPptxEditorSession` for read/edit/re-render/history/save; split into document, editor and render packages; ~12 stars |
| [pptxviewjs](https://github.com/gptsci/pptxviewjs) | 1.1.9 / 2026-03-22 | 2025-09-17 | MIT | Canvas-based viewer |
| [pptx-viewer](https://github.com/mdurbar/pptx-viewer) | 0.2.2 / 2026-04-13 | 2026-01-30 | MIT | Lightweight viewer |
| [pptx-browser](https://www.jsdelivr.com/package/npm/pptx-browser) | 4.1.5 / 2026-02-28 | 2026-02-28 | MIT | Claims render + edit + export (canvas, SVG, PDF, PPTX writer); all 6 versions published the same day; no repo listed — treat with caution |
| [slidecanvas](https://www.jsdelivr.com/package/npm/slidecanvas) | 1.2.2 / 2026-01-26 | 2026-01-15 | MIT | Claims browser-native view/edit of .pptx; 23 versions in 11 days, then silent |
| [pptx-preview](https://www.npmjs.com/package/pptx-preview) | 1.0.7 / 2025-10-17 | 2024-10-15 | ISC | Pure front-end preview library (Chinese-language docs); no repo listed |

- [S] Commercial (not OSS) browser PPTX editors exist: Syncfusion JavaScript PPTX Editor and IMG.LY CE.SDK with a PPTX importer; also Nutrient (PSPDFKit) viewers. — [Syncfusion](https://www.syncfusion.com/pptx-editor-sdk/javascript-pptx-editor); [IMG.LY](https://img.ly/blog/powerpoint-online-native-pptx-editing-in-the-browser-with-creativeeditor-sdk/); [Nutrient](https://nutrient.io/blog/how-to-build-a-powerpoint-viewer-using-javascript)

### Inferences
- For **private single-user use, AGPL is not an obstacle**: AGPL obligations are triggered by distributing the software or offering it to others over a network. PPTist, ONLYOFFICE and Euro-Office are all usable; the licence only matters if the app is ever shared or published (then the whole combined work must be AGPL). Collabora's MPL-2.0 and the Apache/MIT libraries carry no such concern.
- ONLYOFFICE and Collabora are "embed a whole suite" options: they bring a local server process (or the Desktop Editors shell), hundreds of MB, and their own UI. They give the best fidelity but almost no ability to integrate the slide editor with the rest of a custom app's data model or UI.
- 2026 saw a burst of small TypeScript PPTX renderer/editor projects (several clearly AI-assisted, judging by version cadence). @diceui/pptx and pptx-glimpse are the first OSS attempts at *edit-in-place-and-save* in the browser, which is architecturally the right design for round-trip safety — but both are under a year old with tens of stars. They are worth evaluating as a foundation or reference, not relying on blind.
- Univer Slides is not currently a local-first PPTX solution: the file conversion sits behind a backend service.
- Markdown decks (Marp/Slidev/reveal.js) are a legitimate *second* deck format for a personal tool — trivially local-first, diff-able, fast to author — but they do not satisfy "open the .pptx someone sent me".

### Gaps
- GitHub commit recency, issue counts and release notes could not be read for ONLYOFFICE/sdkjs, Univer, PPTist, Collabora (GitHub API blocked); npm publish dates were used as the maintenance proxy where available. PPTist is not on npm, so its latest version/date is unknown.
- Whether Univer's conversion backend is open source or part of the paid/pro server is unconfirmed (docs.univer.ai blocked).
- Whether Collabora Office desktop is embeddable in a third-party app (versus being a standalone app) was not established.
- ZetaOffice's 2026 status and whether a full Impress editing UI works in WASM is unconfirmed.
- No hands-on fidelity test of any option was performed.

---

## 4. Libraries: writing, parsing, rendering, patching, converting

### Takeaway
The JS ecosystem splits cleanly into write-only generation (PptxGenJS, mature but slow-moving), lossy parse-to-JSON (pptxtojson, active), template patching that preserves original XML (pptx-automizer, active, Node-oriented), and a new 2026 crop of renderers. Nothing open-source in JS is both mature and round-trip-safe; LibreOffice headless remains the dependable fallback for PPTX → PDF/images.

### Cited Findings

**Writing**
- [V] **PptxGenJS** — 4.0.1 published 2025-06-26 (no npm release in the ~17 months since); MIT; ~6.4k stars; 239 open issues; creates text, tables, shapes, images, charts, custom slide masters; SVG, animated GIF, YouTube embeds, RTL, Asian fonts; HTML-table-to-slides; outputs base64/Blob/Buffer/stream; runs in Node, browsers, Electron; JSZip is its dependency. The project page describes generation only — it does not read or modify existing .pptx files. — [gitbrent/PptxGenJS](https://github.com/gitbrent/PptxGenJS); [npm: pptxgenjs](https://www.npmjs.com/package/pptxgenjs)
- [K] PptxGenJS has no API for animations, transitions beyond basics, SmartArt, or arbitrary layouts imported from another deck. — [PptxGenJS docs](https://gitbrent.github.io/PptxGenJS/docs/introduction)

**Parsing to JSON**
- [V] **pptxtojson** — 3.0.0 (2026-11-15), MIT, ~459 stars; browser-first parser to structured JSON (slides, elements, assets, themes), extracts text, notes, media; also runs in Node with TS types; aimed at data extraction and PPTist-style editors, explicitly not an HTML converter; self-reported ~85% fidelity. One-way: it has no writer. — [pptxtojson repo](https://github.com/pipipi-pikachu/pptxtojson)
- [V] Legacy converters are stale: `pptx2html` 0.3.4 last published 2017-11-28; `pptx-in-html-out` 0.0.2 (2024-12-27). — [npm: pptx2html](https://www.npmjs.com/package/pptx2html); [npm: pptx-in-html-out](https://www.npmjs.com/package/pptx-in-html-out)
- [K] PPTXjs (meshesha) is a jQuery-era PPTX→HTML converter, largely unmaintained. — [meshesha/PPTXjs](https://github.com/meshesha/PPTXjs)

**Template patching (preserves original XML)**
- [V] **pptx-automizer** — 0.9.4 (2026-09-28), MIT, ~255 stars, 843 commits, 70 npm versions since 2021; "a template based pptx generator for Node.js" that edits and merges existing .pptx files, wraps PptxGenJS to create new elements on top of template slides, and exposes xmldom callbacks so "most content can be changed" directly in the XML. Described as Node.js; browser support is not mentioned. — [singerla/pptx-automizer](https://github.com/singerla/pptx-automizer); [npm: pptx-automizer](https://www.npmjs.com/package/pptx-automizer)

**Rendering** — see the 2025–2026 table in section 3. Key verified limits of the most complete one, pptx-renderer 1.4.0: no animations/transitions, approximate chart layout via ECharts, SmartArt from fallback drawing only, no EMF/WMF, no notes rendering, no exact text parity, browser-only (needs DOM). — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)

**Python**
- [V] **python-pptx** — 1.0.2, released 2024-08-07, MIT, Python ≥3.8; no release in over two years. — [PyPI: python-pptx](https://pypi.org/project/python-pptx/)
- [K] python-pptx reads and writes real PPTX by wrapping the original XML with lxml (so unknown content survives a load/save), but has no renderer, no animation/SmartArt/transition API, and limited chart types; it depends on lxml and Pillow, both of which have Pyodide builds, so running it in-browser via Pyodide is feasible at the cost of a multi-MB runtime download and slow start. — [python-pptx docs](https://python-pptx.readthedocs.io/); [Pyodide package list](https://pyodide.org/en/stable/usage/packages-in-pyodide.html)
- [V] Aspose.Slides for Python 26.11.0 (2026-11-14) is current but proprietary (EULA). — [PyPI: aspose-slides](https://pypi.org/project/aspose-slides/)

**Rust** (relevant if the shell is Tauri)
- [V] `ooxmlsdk` 0.15.0 (2026-11-03) — "OOXML SDK for Rust" (typed schema bindings, low-level). — [crates.io: ooxmlsdk](https://crates.io/crates/ooxmlsdk)
- [V] `ppt-rs` 0.2.38 (2026-11-16) — "Markdown → PowerPoint in pure Rust: create, read, update, and validate .pptx". — [crates.io: ppt-rs](https://crates.io/crates/ppt-rs)
- [V] `office2pdf` 0.11.0 (2026-11-14) — "Convert DOCX, XLSX, and PPTX files to PDF using pure Rust"; ~14k downloads, pre-1.0. — [crates.io: office2pdf](https://crates.io/crates/office2pdf)
- [V] `pptx-to-md` 2.0.0 (2026-10-30) — PPTX/ODP to Markdown text extraction. — [crates.io: pptx-to-md](https://crates.io/crates/pptx-to-md)

**LibreOffice headless**
- [K] `soffice --headless --convert-to pdf deck.pptx` (then PDF → PNG via pdftoppm/pdf.js) is the standard open-source route to high-fidelity static slide images; LibreOffice is MPL-2.0, a ~300–600 MB install, with cold start of a few seconds per conversion. Its Impress import filter is the most complete open implementation of PresentationML alongside ONLYOFFICE's. — [LibreOffice command-line parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html)

**JVM / .NET (likely out of scope)**
- [K] Apache POI XSLF (Apache-2.0) reads/writes PPTX and can render slides to Java2D images; docx4j (Apache-2.0) offers pptx4j; ShapeCrawler (MIT, .NET) and Microsoft's Open XML SDK (MIT, .NET) are solid for manipulation. All require a JVM/.NET runtime sidecar. — [Apache POI XSLF](https://poi.apache.org/components/slideshow/); [docx4j](https://github.com/plutext/docx4j); [ShapeCrawler](https://github.com/ShapeCrawler/ShapeCrawler); [Open XML SDK](https://github.com/dotnet/Open-XML-SDK)

### Inferences
- **PptxGenJS is stable but effectively in maintenance mode** (one release in 2025, none found in 2026). Fine as an exporter for a custom model; not a foundation for editing existing files.
- **python-pptx looks dormant** (last release August 2024). It is still the best-documented reference for PPTX semantics, and its "proxy objects over the real XML" design is the model to copy.
- A workable hybrid for a custom editor: *parse* with a 2026 renderer's model (or your own), *edit* by patching the original XML in place (pptx-automizer-style, using JSZip + an XML DOM), and *generate new elements* as XML fragments. PptxGenJS can supply known-good XML for new shapes, as pptx-automizer already does.
- A useful safety net regardless of path: bundle or detect a local LibreOffice and offer "render exactly" (PPTX → PDF) for decks the built-in renderer handles badly, and for PDF export of imported decks.

### Gaps
- pptx-automizer's "Requirements and limitations" guide could not be retrieved (guessed URL 404'd), so its documented constraints and browser compatibility are unconfirmed.
- pptx-glimpse's feature-support matrix and @diceui/pptx-core's `OOXML-SUPPORT.md` were not read; whether either truly preserves unknown XML on save is **unverified** and is the single most important thing to test.
- The maturity and fidelity of the Rust crates (`ppt-rs`, `office2pdf`) were not assessed beyond registry metadata.
- No measurements of Pyodide + python-pptx load time or bundle size were found.

---

## 5. Canvas editor technology choice (if building custom)

### Takeaway
For a slide editor (tens to low hundreds of objects per slide, text-heavy, needs crisp zoom and PDF export), DOM + SVG is the pragmatic choice and is what the hackable open-source editors use; Canvas2D libraries buy raw performance that slides rarely need and make text editing harder. Whatever the renderer, exact text parity with PowerPoint is not attainable in a browser — plan for "close", not "identical".

### Cited Findings
- [V] pptx-renderer outputs "a self-contained HTML/SVG DOM with inline styles", using Canvas only inside its 3D path. — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)
- [V] @diceui/pptx implements editing as a `Selection` overlay over rendered slides (drag-move, resize, rotate, inline text editing, marquee, keyboard nudge), with all mutations going through a single `store.edit(operation)` command path and `batch` for undo grouping. — [sadmann7/pptx](https://github.com/sadmann7/pptx)
- [V] PPTist is Vue 3 + TypeScript with no canvas framework or UI library dependency. — [PPTist repo](https://github.com/pipipi-pikachu/PPTist)
- [V] ONLYOFFICE-style and pptxviewjs-style approaches render to Canvas instead ("renders slides using HTML5 Canvas"). — [pptxviewjs README](https://cdn.jsdelivr.net/npm/pptxviewjs@1.1.9/README.md)
- [V] Konva 10.10.0 (2026-11-20, MIT) — "HTML5 2d canvas library for interactive graphics, design editors, whiteboards, and diagrams"; very actively released. Fabric.js 7.4.0 (2026-05-18, MIT) — "object model for HTML5 canvas, and SVG-to-canvas parser". — [npm: konva](https://www.npmjs.com/package/konva); [npm: fabric](https://www.npmjs.com/package/fabric)
- [K] Canvas libraries draw text themselves: Konva's `Text` has no inline rich-text runs (mixed bold/colour within a paragraph needs custom work, and editing is done by overlaying a DOM textarea); Fabric's `IText`/`Textbox` supports per-character styles and in-canvas editing but not bullets/numbering, tab stops, or paragraph indents. — [Konva editable text docs](https://konvajs.org/docs/sandbox/Editable_Text.html); [Fabric.js docs](https://fabricjs.com/docs/)
- [S] Text-parity problems reported by renderer authors: substituted fonts have different metrics → reflow and overflow; glyph metrics and kerning differ from Windows text rendering; PowerPoint synthesises bold for single-weight fonts, widening text; one project widens single-line boxes slightly to avoid clipping; one uses a fixed browser engine (Playwright WebKit) to get reproducible output across machines. — [quicklook-pptx-renderer README](https://cdn.jsdelivr.net/npm/quicklook-pptx-renderer@0.3.5/README.md); [pptx-browser README](https://cdn.jsdelivr.net/npm/pptx-browser@4.1.5/README.md)
- [S] Nutrient's guide warns that a substitute font "won't necessarily have the same metrics as the presentation's original font". — [Nutrient: build a PowerPoint viewer](https://nutrient.io/blog/how-to-build-a-powerpoint-viewer-using-javascript)

### Inferences
- **Trade-offs in one place:**
  - *DOM (contenteditable text) + SVG (shapes)*: native text editing, IME, selection, accessibility, spell-check and clipboard for free; resolution-independent zoom; print-to-PDF gives vector output. Costs: browser line-breaking you cannot fully control; SVG filter effects are slow; contenteditable is quirky and needs a disciplined model layer (ProseMirror/Lexical-style, or a constrained custom one).
  - *Canvas2D (Konva/Fabric/custom)*: full control of every pixel and consistent rendering, good for thousands of objects. Costs: you re-implement text layout, caret, selection, IME, accessibility; blurry unless you manage devicePixelRatio; PDF export must be re-rendered through a PDF library to stay vector.
  - *Full custom canvas with own text engine* (ONLYOFFICE's approach): the only route to near-PowerPoint text parity, and far beyond solo scope.
- If the same app also has a document editor, reusing its rich-text engine inside slide text boxes is a significant saving and argues for DOM text.
- Practical parity tactics: bundle metric-compatible open fonts (Carlito for Calibri, Caladea for Cambria, Liberation Sans/Serif/Mono for Arial/Times/Courier) and use locally installed fonts when present; honour the cached `fontScale` from the file rather than recomputing on open; only recompute autofit for boxes the user actually edits; never rewrite `a:bodyPr` for untouched shapes.
- The model should store EMU integers and original XML references, converting to pixels only at render time, to avoid cumulative rounding drift on save.

### Gaps
- No benchmark comparing Konva / Fabric / SVG for slide-scale scenes was found; the performance statements are qualitative.
- The Konva/Fabric text-capability notes are from background knowledge of the libraries; Fabric 7 and Konva 10 release notes were not checked for new rich-text features.

---

## 6. Presentation mode: fullscreen, presenter view, PDF export

### Takeaway
Presenter view is straightforward in a desktop shell — two windows sharing state, one fullscreen on the external display — and is easier in Electron/Tauri than in a plain browser, where it depends on the Chromium-only Window Management API. PDF export is nearly free if slides are rendered as DOM/SVG.

### Cited Findings
- [S] The Window Management API (formerly Multi-Screen Window Placement) lets a page enumerate connected displays and place/fullscreen windows on a specific screen; Chrome's documentation gives slideshow apps — speaker notes on one screen, presentation on a projector — as the motivating use case. It is a W3C Working Draft implemented in Chromium. — [Chrome for Developers: Window Management API](https://developer.chrome.com/articles/window-management); [W3C Window Management draft](https://www.w3.org/TR/2023/WD-window-management-20230330/)
- [S] In Tauri v2 each window is a native OS window hosting a webview, created at runtime with `WebviewWindowBuilder` and identified by a unique label. — [Tauri windows skill summary](https://stuffbucket.github.io/skills/catalog/tauri-windows/)
- [V] PPTist ships presenter and audience views, a timer, laser pointer and annotation brushes in a pure web app, and exports PDF via the browser's print function. — [PPTist repo](https://github.com/pipipi-pikachu/PPTist)
- [K] Electron: `screen.getAllDisplays()` enumerates monitors; a second `BrowserWindow` can be positioned on the external display and set fullscreen/kiosk; `webContents.printToPDF({pageSize, printBackground})` produces a vector PDF from the rendered page without a print dialog; windows synchronise over IPC or `BroadcastChannel`. — [Electron: screen](https://www.electronjs.org/docs/latest/api/screen); [Electron: webContents.printToPDF](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions)
- [K] Tauri: monitor enumeration (`availableMonitors`, `currentMonitor`) and `setFullscreen` exist in the window API; there is no built-in silent print-to-PDF equivalent across all platform webviews, so PDF export typically goes through a JS PDF library or the OS print dialog. — [Tauri JS window API reference](https://v2.tauri.app/reference/javascript/api/namespacewindow/)
- [K] The standard Fullscreen API (`element.requestFullscreen()`) covers the single-screen case in any browser/webview and requires a user gesture. — [MDN: Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)

### Inferences
- Minimal presenter view: audience window (fullscreen on display 2, renders slide N + current animation step) and presenter window (current slide, next slide/next step preview, notes with adjustable font size, elapsed timer + clock, slide jump). State = `{slideIndex, stepIndex, startedAt}` broadcast between windows. This is a few days of work once a read-only slide renderer exists.
- Offer a single-display fallback (presenter view in a window, or notes hidden) and a "swap displays" control — the commercial apps all have it and display detection is frequently wrong.
- PDF export: one page per slide sized to the slide's aspect ratio; with DOM/SVG rendering in Electron this is `printToPDF` with a print stylesheet. Notes pages and handouts (2/3/4/6 per page) are just alternative print layouts. On Tauri, PDF export is a real design decision (platform webviews differ), which is a point in Electron's favour for this feature.
- Export to video is separable and deferrable (would need offscreen frame capture + ffmpeg).

### Gaps
- Electron and Tauri API details are from background knowledge; their docs were not fetched this session and should be checked against current versions (Tauri's print/PDF support in particular may have changed).
- No source was found on platform-webview differences (WKWebView/WebView2/WebKitGTK) affecting fullscreen-on-second-monitor in Tauri.

---

## 7. UX benchmarks: Keynote, Pitch, Google Slides, Figma Slides

### Takeaway
The products people praise are praised for restraint — few, well-chosen controls, strong defaults, and excellent alignment/snapping — rather than feature count; that is good news for a solo build, because the UX bar is about polish on the must-have tier.

### Cited Findings
- [S] Figma Slides supports importing PowerPoint files (still supported as of July 2026 per Figma's forum), and users have repeatedly reported problems exporting to .pptx (failed exports, text vertical alignment set wrongly in exported files) — evidence that even a well-funded design-tool vendor treats PPTX as a lossy interchange format rather than a native one. — [Figma help: Import PowerPoint files to Figma Slides](https://help.figma.com/hc/nl/articles/30601628883607); [Figma forum: import status](https://forum.figma.com/ask-the-community-7/what-happened-to-the-ability-to-import-powerpoint-slides-and-templates-into-figma-slides-56306); [Figma forum: export text-align bug](https://forum.figma.com/report-a-problem-6/figma-slides-export-to-pptx-text-align-property-set-to-middle-in-exported-files-41505); [Figma forum: unable to export](https://forum.figma.com/report-a-problem-6/unable-to-export-from-figma-slide-to-pptx-50172)
- [K] **Keynote**: context-sensitive Format inspector (controls change with selection instead of a ribbon); best-in-class alignment guides showing equal spacing and sizes; Magic Move (auto-animate objects shared between consecutive slides); high-quality default themes and typography; a customisable presenter display; "light table" slide sorter. — [Keynote user guide](https://support.apple.com/guide/keynote/welcome/mac)
- [K] **Google Slides**: instant open, no save step (autosave + version history), a deliberately small toolbar, simple theme/layout picker, speaker notes always visible under the slide, presenter view with timer and audience Q&A. Fidelity with complex PPTX is mediocre, and users accept that. — [Google Slides help](https://support.google.com/docs/topic/9052835)
- [K] **Pitch**: keyboard-first workflow (command palette, quick-insert menu), opinionated templates with smart layouts that keep spacing consistent, slide status/assignment, polished presenter mode; a web/Electron app. — [Pitch](https://pitch.com/)
- [K] **Figma Slides**: design-tool canvas concepts applied to decks — a grid view of all slides, auto layout, components and shared styles, a "design mode" toggle for precise control versus a simplified slide mode, and interactive elements in presentation. — [Figma Slides](https://www.figma.com/slides/)

### Inferences
- Patterns worth copying, in priority order: (1) smart guides with spacing/size hints and snapping to slide centre/edges and other objects; (2) a contextual right-hand inspector instead of a ribbon; (3) autosave + undo history with no explicit save dialog for native files; (4) a command palette / "/" quick-insert; (5) notes visible beneath the slide; (6) a grid overview for reordering; (7) layouts that re-flow content when the layout is switched (which requires real placeholders — another argument for respecting PPTX's layout model rather than flattening it).
- Magic Move/Morph-style transitions are comparatively cheap to implement in a DOM/SVG renderer (match objects by ID/name between slides and interpolate transform, size, opacity, colour) and give a large perceived-quality gain; writing them out as PowerPoint Morph is a single transition element with a fallback, since PowerPoint does the matching itself at playback.

### Gaps
- All four product descriptions are from background knowledge; no vendor pages or 2026 reviews were fetched, and feature sets may have changed during 2026. No comparative UX study was found.
- Pitch's current product status and pricing in late 2026 were not checked.

---

## 8. Bottom line: recommended options and what a solo developer can realistically match

### Takeaway
There is a hard trade between fidelity and hackability, and no open-source option in late 2026 gives both. The realistic solo-developer target is a pleasant native slide editor that opens typical PPTX legibly, edits it without destroying what it does not understand, and delegates "exact" rendering to an optional local LibreOffice — roughly the everyday 20–30% of PowerPoint's surface that covers most personal use, not PowerPoint parity.

### Cited Findings
- [V] The most capable single-maintainer web editor, PPTist, self-reports ~85% import and ~95% export fidelity and disclaims animations, special charts, deep nesting and advanced styles. — [PPTist repo](https://github.com/pipipi-pikachu/PPTist)
- [V] The most complete 2026 OSS renderer (pptx-renderer 1.4.0, eight months old) is viewer-only and lists animations, transitions, exact text and chart layout, EMF/WMF, OLE, notes and full equations as unsupported. — [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer)
- [V] In-place edit-and-save browser libraries exist but are very young: @diceui/pptx first published 2026-09-01 (v0.6.0, ~19 stars); pptx-glimpse first published 2026-02-11 (v5.3.1, ~12 stars). — [npm: @diceui/pptx](https://www.npmjs.com/package/@diceui/pptx); [npm: pptx-glimpse](https://www.npmjs.com/package/pptx-glimpse)
- [V] The established building blocks are slow-moving: PptxGenJS last released 2025-06-26; python-pptx last released 2024-08-07. — [npm: pptxgenjs](https://www.npmjs.com/package/pptxgenjs); [PyPI: python-pptx](https://pypi.org/project/python-pptx/)
- [S] ONLYOFFICE — a full-time team's product — was still adding slide-master UI, text animations, GIF playback and transition effects across 9.0–9.4 (June 2025 – May 2026), and users still report compatibility gaps. — [ONLYOFFICE 9.1](https://onlyoffice.com/blog/2025/10/docs-9-1-released); [ONLYOFFICE 9.4](https://onlyoffice.com/blog/2026/05/onlyoffice-docs-9-4); [community: lack of compatibility](https://community.onlyoffice.com/t/lack-of-compatibility/4928)
- [S] Figma, with far greater resources, ships PPTX import/export that users report as lossy. — [Figma forum](https://forum.figma.com/report-a-problem-6/figma-slides-export-to-pptx-text-align-property-set-to-middle-in-exported-files-41505)

### Inferences

**Option A — Best fidelity: embed ONLYOFFICE (or Euro-Office) or Collabora.**
- What you get: near-complete PPTX editing including masters, charts, SmartArt display, animations and transitions, with someone else maintaining format compatibility.
- Costs/risks: a local Document Server or `coolwsd` process inside your app (hundreds of MB, start-up time, ports); an iframe whose UI, shortcuts and theme are theirs, not yours; minimal integration with your own document model, search, or linking; AGPL for ONLYOFFICE/Euro-Office (fine privately, binding if you ever distribute) versus MPL-2.0 for Collabora; ONLYOFFICE's licence terms and the Euro-Office split are recent and still settling, so pin a version. This is "integrating an office suite", not "building one".

**Option B — Most hackable: fork or study PPTist.**
- What you get: a complete, readable Vue 3/TS slide editor with presenter view, animations, charts and tables, running fully client-side today.
- Costs/risks: AGPL; Vue (a mismatch if the rest of the app is React/Svelte); its own JSON as the native format with PPTX as lossy import/export — opening someone's deck and saving it back will flatten placeholders/masters and drop anything unmodelled. Acceptable if PPTX is an *interchange* format for you; unacceptable if you need to hand edited decks back to PowerPoint users intact.

**Option C — Custom editor on an "edit the original XML" core (recommended if PPTX is to be the real file format).**
- Design: keep the unzipped package in memory as the source of truth; build a resolved view model (inheritance applied) for rendering in DOM/SVG; apply each edit as a targeted XML patch; pass all unknown parts and elements through byte-for-byte; generate new shapes as XML fragments (PptxGenJS can be mined for known-good output). Evaluate @diceui/pptx-core and pptx-glimpse as a starting point or reference implementation, and pptx-renderer (Apache-2.0) for the rendering model.
- Costs/risks: the candidate foundations are under a year old and unproven; you own the long tail. Mitigate by scoping what is *editable* tightly and rendering everything else read-only.

**Option D — Native format of your own plus PPTX import/export (the Google Slides/Figma/Pitch stance).**
- Simplest to build and gives the best UX freedom; PPTX in via pptxtojson or a 2026 renderer's parser, out via PptxGenJS. Be explicit in the UI that import is a one-way conversion and keep the original file alongside.

**Suggested staging for a solo developer (C or D):**
1. Read-only viewer + slide show + presenter view + PDF export (reuses a renderer; delivers value immediately).
2. Edit text, move/resize/rotate, add text boxes/shapes/images, reorder/duplicate/delete slides, notes; save without loss of untouched content.
3. Layout/master awareness (new slide from layout, change layout, theme colours/fonts), alignment guides, grouping, tables.
4. Transitions and a small animation set (appear/fade/fly-in, on-click sequencing), Morph-style auto-animate.
5. Charts (render cached data first; editing later), connectors, video.
- Optional LibreOffice sidecar for "exact render"/PDF of difficult decks from stage 1.

**Honest assessment of achievable scope without embedding ONLYOFFICE/LibreOffice:**
- *Realistic for one person (months, not years):* the whole must-have tier; presenter view; PDF export; snapping/guides, grouping, z-order; basic masters/layouts/themes; simple tables; fade/push-style transitions; legible rendering of typical business decks with visible but tolerable text differences.
- *Feasible but expensive (each a multi-week to multi-month project):* faithful preset-geometry coverage with adjust handles; chart rendering and editing; a usable animation timeline that round-trips with PowerPoint; robust autofit; embedded-font handling; EMF/WMF.
- *Not realistic solo:* PowerPoint-identical text layout; SmartArt layout engine/editing; the full ~200-effect animation catalogue with exact timing semantics; 3D effects and models; all chart types including chartex; OLE editing; export to video with animation parity; guaranteed lossless round-trip of arbitrary decks through *edits* to complex content.
- The differentiator a solo developer can actually win on is the surrounding experience — speed, local-first storage, integration with the rest of the personal suite, keyboard-driven UX — not format coverage.

**Key risks to flag in the report:**
- Round-trip data loss is silent; it needs an explicit test corpus (real decks opened → saved → reopened in PowerPoint/LibreOffice and diffed) from day one.
- Dependence on sub-one-year-old libraries with tiny communities (bus factor of one each).
- Font availability on the user's machine dominates perceived fidelity.
- Licence drift: PPTist already moved Apache → AGPL; ONLYOFFICE changed terms in 2026; tldraw and Polotno are source-available/proprietary, not open source.

### Gaps
- The scope estimates ("months", "multi-week") are the researcher's judgement; no source quantifies solo-developer effort for a PPTX editor.
- None of the options was run or tested in this session; fidelity, bundle size, start-up time and offline behaviour of an embedded ONLYOFFICE/Collabora inside Electron/Tauri are unmeasured.
- Whether @diceui/pptx-core or pptx-glimpse preserve unknown XML on save — the property Option C depends on — is unverified and should be the first experiment.
- Sources that could not be opened because the sandbox blocked their hosts (onlyoffice.com, docs.univer.ai, learn.microsoft.com, officeopenxml.com, python-pptx.readthedocs.io, dev.to, img.ly, christophervr.github.io) and the GitHub API; allowing these would let the [K] and [S] items be upgraded to verified.
