# Embeddable open-source full office-suite engines for a local-first desktop app (state as of 2026-11-21)

Reading notes for the report writer:
- Research date: 2026-11-21. Version numbers are date-stamped where the source gave a date.
- Verification tags used below: **[fetched]** = I read the primary page this session; **[search]** = from a search-result summary of the page, not the page itself; **[prior]** = from my background knowledge (cutoff mid-2026), URL given is where it is documented but was NOT re-fetched this session.
- Network limitation: `www.onlyoffice.com`, `www.collaboraonline.com` and `heise.de` could not be fetched from this session (host not in the allowed network list). Everything attributed to those sites is [search]-level only. GitHub pages were fetchable.

---

## 1. ONLYOFFICE: architecture, client-side/offline operation (x2t-WASM), license, versions, PDF editor, forks

### Takeaway
ONLYOFFICE is the only open-source engine whose complete editor UI (docx/xlsx/pptx/pdf) has been shown to run 100% in a browser with no server: community projects pair the stock `sdkjs` + `web-apps` front end with `x2t` compiled to WebAssembly, and `ranuts/document` (AGPL-3.0, ~2.0k stars) already exposes an iframe/postMessage API with open-from-bytes, save-to-bytes and dirty events, which is almost exactly the embedding surface a personal Electron/Tauri app needs. The current upstream release is 10.0 (October 2026); AGPLv3 places no obligations on purely private, non-distributed use.

### Cited Findings

**Architecture / components**
- ONLYOFFICE Desktop Editors is composed of: `desktop-apps` (per-OS UI front end), `desktop-sdk` ("core part of the application"), `core` (format conversion between office and PDF formats; this is where the `x2t` converter lives), `sdkjs` (JavaScript editor engine/API), `web-apps` (editor front end UI), and `dictionaries`. [fetched] — [ONLYOFFICE/DesktopEditors](https://github.com/ONLYOFFICE/DesktopEditors)
- Desktop Editors works on local files "without an Internet connection"; ships for Windows, Linux, macOS (deb, rpm, exe, dmg, Snap, Flatpak, AppImage, MS Store); AGPL-3.0; ~5.8k stars; latest release 10.0. [fetched] — [ONLYOFFICE/DesktopEditors](https://github.com/ONLYOFFICE/DesktopEditors)
- The editors do not edit OOXML directly: the server (or desktop shell) runs `x2t` to convert docx/xlsx/pptx into an internal binary format (`Editor.bin`) which `sdkjs` loads; saving reverses the conversion. This is why "no server" projects need x2t in WASM. [prior] — [ONLYOFFICE/core](https://github.com/ONLYOFFICE/core); [ONLYOFFICE/sdkjs](https://github.com/ONLYOFFICE/sdkjs)
- Desktop Editors' shell is Qt + Chromium Embedded Framework (CEF), with the native side doing conversion and file I/O. [prior] — [ONLYOFFICE/desktop-sdk](https://github.com/ONLYOFFICE/desktop-sdk)
- From 9.4, the Document Server application reportedly runs as a single process (architecture simplification). [search] — [it-connect.tech on 9.4](https://www.it-connect.tech/onlyoffice-docs-9-4-drops-the-20-connection-limit-and-updates-its-open-source-license/)

**Versions and cadence**
- DocumentServer GitHub releases (page shows day/month only; years inferred from corroborating coverage): 9.0.2 (26 Jun 2025), 9.0.3 (8 Jul), 9.0.4 (5 Aug), 9.1.0 (14 Oct 2025), 9.2.0 (1 Dec 2025), 9.2.1 (17 Dec), 9.3.0 (24 Feb 2026), 9.3.1 (3 Mar), 9.4.0 (19 May 2026), **10.0.0 (12 Oct 2026, marked "Latest")**. Cadence: a feature release roughly every 2-3 months. [fetched] — [ONLYOFFICE/DocumentServer releases](https://github.com/ONLYOFFICE/DocumentServer/releases)
- ONLYOFFICE Docs 10.0: ~50 new features, 1,000+ bug fixes, ~35 vulnerabilities fixed, AI tools and "modular apps". Reports put the announcement at 10-11 Oct 2026. [search] — [ONLYOFFICE blog: Docs 10](https://www.onlyoffice.com/blog/2026/10/onlyoffice-docs-10); [Phoronix](https://phoronix.com/news/ONLYOFFICE-10.0); [Linuxiac](https://linuxiac.com/onlyoffice-docs-10-0-released-with-50-new-features-and-ai-integration/)
- Conflict: one report said the 10.0 cloud service was available but the self-hosted build would come later; the GitHub DocumentServer page does list a 10.0.0 release dated 12 Oct. [search] — [Linuxiac](https://linuxiac.com/onlyoffice-docs-10-0-released-with-50-new-features-and-ai-integration/); [fetched] [DocumentServer releases](https://github.com/ONLYOFFICE/DocumentServer/releases)
- Docs 9.0 (June 2025) introduced a new UI and a Diagram (Visio) Viewer. [search] — [AlternativeTo news](https://alternativeto.net/news/2025/6/onlyoffice-docs-and-desktop-editors-9-launches-with-new-ui-diagram-viewer-ai-tools-and-more)
- Docs 9.4 (May 2026) removed the Community Edition 20-simultaneous-connection limit. [search] — [it-connect.tech](https://www.it-connect.tech/onlyoffice-docs-9-4-drops-the-20-connection-limit-and-updates-its-open-source-license/); [ONLYOFFICE blog 9.4](https://onlyoffice.com/blog/2026/05/onlyoffice-docs-9-4)

**PDF editor capabilities**
- 9.1 (Oct 2025) added PDF redaction. [search] — [It's FOSS on 9.1](https://itsfoss.com/news/onlyoffice-docs-9-1-release/)
- 10.0 PDF Editor: metadata removal via the redaction tab, customizable annotation borders/background/opacity, automatic table recognition, reusable signatures, OFD support, AI Q&A/summaries/redaction; PDF form fields support Validate, Calculate and Action settings. [search] — [ONLYOFFICE blog: Docs 10](https://www.onlyoffice.com/blog/2026/10/onlyoffice-docs-10); [LinuxLinks](https://www.linuxlinks.com/onlyoffice-docs-10-ai-tools-pdf-editing-modular-apps/)
- 10.0 for developers: PDF editing in Document Builder, modernized async Plugin API, and `OpenFile` routing (ONLYOFFICE-created PDF forms open in the document editor; other PDFs open in the PDF editor with the PDF API). [search] — [ONLYOFFICE 10.0 for developers](https://www.onlyoffice.com/blog/2026/10/onlyoffice-10-developers)
- ranuts/document (the client-side build) describes its PDF support as "annotate, fill, and export"; PDFs are in the "also opens" list rather than the full-edit list. [fetched] — [ranuts/document](https://github.com/ranuts/document)

**Running fully client-side: x2t-WASM projects**
- `cryptpad/onlyoffice-x2t-wasm`: "CryptPad WebAssembly file conversion tool"; contains a modified copy of ONLYOFFICE `core`, built to WASM with emscripten via a Dockerfile (`./build.sh`). The README's update instructions use tag `v9.3.0.140` as the example upstream tag. No GitHub releases; 7 open issues. [fetched] — [cryptpad/onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm)
- CryptPad maintains forks of `web-apps` and `sdkjs` plus x2t-wasm; its modifications "replace OnlyOffice's server with the real time collaboration of CryptPad". [search] — [cryptpad/web-apps](https://www.github.com/cryptpad/web-apps); [CryptPad forum](https://forum.cryptpad.org/d/232-onlyoffice-concerns-vendor-makes-shady-moves)
- `ranuts/document`: "local-first, browser-based editor for Word, Excel, PowerPoint, and PDF"; a modified build of the ONLYOFFICE editors (sdkjs + web-apps) with conversion by onlyoffice-x2t-wasm; "Core document processing runs locally". AGPL-3.0; ~2.0k stars, 229 forks, 1,014 commits, 4 open issues; hosted demo at edit.chaxus.com. [fetched] — [ranuts/document](https://github.com/ranuts/document)
- ranuts formats: full edit for `.docx`, `.xlsx`, `.csv`, `.pptx`; opens `.doc`, `.odt`, `.rtf`, `.txt`, `.xls`, `.ods`, `.ppt`, `.odp`, `.pdf`; any supported document can be exported to PDF. [fetched] — [ranuts/document](https://github.com/ranuts/document)
- ranuts deployment: static site, Docker (`docker run -d -p 8080:80 ghcr.io/ranuts/document:latest`), PWA, or from source (`pnpm install --frozen-lockfile`, `pnpm run dev`). No npm package. Offline use requires assets to be cached/bundled. [fetched] — [ranuts/document](https://github.com/ranuts/document)
- ranuts saving: writes back to the chosen file where the browser supports it or downloads an export; recovery copies kept in browser storage for 7 days ("is not a backup"). [fetched] — [ranuts/document](https://github.com/ranuts/document)
- **ranuts embed API (the key integration surface)**: iframe at `/editor?embed=1` (optional `embedOrigin=`). Parent -> iframe postMessage commands: `document:open-url`, `document:open-file` (File/Blob), `document:open-buffer` (ArrayBuffer/Uint8Array), `document:set-readonly`, `document:save` (optional `targetExt` of `XLSX`/`DOCX`/`PPTX`/`CSV`), `document:get-state`. Iframe -> parent events: `document:ready`, `document:opened`, `document:readonly-changed`, `document:saved` (payload `file`, `fileName`, `dirty`), `document:dirty-changed` (fires when the flag flips, not per keystroke), `document:state`, `document:error`. URL opens are capped at 100 MiB / 60 s; buffers are the recommended path. [fetched] — [ranuts/document docs/embed-api.md](https://github.com/ranuts/document/blob/main/docs/embed-api.md)
- The embed-api doc does not document options for hiding chrome, theming, or a PDF `targetExt`. [fetched] — [docs/embed-api.md](https://github.com/ranuts/document/blob/main/docs/embed-api.md)
- ZIZIYI Office: "100% client-side, no backend" web office built on ONLYOFFICE code with x2t WASM; repos `baotlake/office-website` and a derivative `InledGroup/office` (AGPLv3 for the ONLYOFFICE/Ziziyi code, "MIT-Inled" for Inled's changes). Supports docx, xlsx, pptx, csv, odt, rtf. [search] — [baotlake/office-website](https://github.com/baotlake/office-website); [InledGroup/office](https://github.com/InledGroup/office); [ziziyi.com/office](https://ziziyi.com/office/)
- Other small "no server" examples surfaced: `sweetwisdom/onlyoffice-web-local`, `electroluxcode/mvp-onlyoffice`. [search] — [ecosyste.ms listing 1](https://awesome.ecosyste.ms/projects/github.com%2Fsweetwisdom%2Fonlyoffice-web-local); [listing 2](https://awesome.ecosyste.ms/projects/github.com%2Felectroluxcode%2Fmvp-onlyoffice)

**Official (server-based) embedding API, for the bundled-local-server route**
- Official integration: load `api.js` from the Document Server, `new DocsAPI.DocEditor(placeholderId, config)` with `document.url` (server must be able to HTTP-fetch the file) and `editorConfig.callbackUrl` (server POSTs status; status 2 carries a URL to download the saved file; `forcesave` gives save-on-demand). `editorConfig.customization` offers compact toolbar, hidden right menu, UI theme, etc.; removing/replacing the logo is gated to the paid Developer Edition. JWT is on by default. [prior] — [api.onlyoffice.com Docs API](https://api.onlyoffice.com/docs/docs-api/get-started/basic-concepts/)
- Running the real Document Server locally means bundling its Node services plus x2t (historically also PostgreSQL/RabbitMQ in the standard package); official packaging is Linux deb/rpm/Docker, Windows installer exists. [prior] — [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)

**License (AGPLv3 + Section 7 terms)**
- ONLYOFFICE source files carry AGPLv3 Section 7 additional terms: 7(b) retain the product logo, 7(e) no trademark rights; these were added on 25 May 2021 per heise. [search] — [heise: OnlyOffice accuses of license violations](https://heise.de/-11241334)
- With 9.4 (May 2026) ONLYOFFICE reworded its AGPLv3 additional terms (attribution, copyright notices, labeling of modified versions, trademarks under a separate Trademark Policy). The official blog says the license permits modification but grants no trademark rights. [search] — [ONLYOFFICE blog 9.4](https://onlyoffice.com/blog/2026/05/onlyoffice-docs-9-4); [It's FOSS on 9.4](https://itsfoss.com/news/onlyoffice-docs-9-4-release/)
- Conflicting/unverified detail: a Spanish-language report says 9.4 dropped the obligation to keep the ONLYOFFICE logo in derivative works; Wikipedia says the earlier added terms were self-contradictory and are consistent from 9.4. Neither was confirmed against the license text. [search] — [desdelinux](https://blog.desdelinux.net/onlyoffice-documentserver-9-4-lanzamiento-novedades-licencia-conexiones/); [Wikipedia: OnlyOffice](https://en.wikipedia.org/wiki/OnlyOffice)
- A Dutch legal commentary ("the logo trap") argued the old terms made compliant forks effectively impossible: keep the logo (7(b)) while having no trademark license to show it (7(e)). [search] — [ie-forum.nl](https://ie-forum.nl/artikelen/the-logo-trap-onlyoffice-s-agplv3-gambit-and-what-it-means-for-free-and-open-source-compliance)
- AGPLv3 text: "You may make, run and propagate covered works that you do not convey, without conditions so long as your license otherwise remains in force" (Section 2); the network clause (Section 13) applies only when users interact with a modified version "remotely through a computer network". [prior, standard license text] — [gnu.org AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html)

**Forks: Euro-Office**
- Euro-Office is a fork of the ONLYOFFICE AGPL codebase initiated by Nextcloud and IONOS, unveiled 27 March 2026 in Berlin; partners include Eurostack, XWiki, OpenProject, Soverin, Abilian, BTactic, Open-Xchange, Office.eu. [search] — [heise](https://heise.de/-11228123); [It's FOSS](https://itsfoss.com/news/onlyoffice-forked/)
- ONLYOFFICE alleged AGPL/branding violations and suspended its ~8-year Nextcloud partnership (April 2026). Nextcloud's position: Section 7 allows removing "further restrictions", a product logo is not a "reasonable legal notice" under 7(b), and it claims FSF support. [search] — [ONLYOFFICE blog](https://onlyoffice.com/blog/2026/03/onlyoffice-flags-license-violations-in-euro-office-project-by-nextcloud-and-ionos); [Neowin](https://www.neowin.net/news/OnlyOffice-suspends-nextcloud-partnership-over-unapproved-euro-office-fork/); [Nextcloud blog](https://nextcloud.com/blog/euro-office-license-compliance-and-what-open-source-means)
- A first Euro-Office version has shipped (heise headline); Computerworld reported a 9 June 2026 launch date. Exact version number not verified. [search] — [heise](https://heise.de/-11322160); [Computerworld](https://www.computerworld.com/article/4178807/open-source-euro-office-productivity-suite-to-launch-june-9.html)
- GitHub org `euro-office` is active as of 20-21 Nov 2026 (34 repos; `DocumentServer` 1.9k stars, `DesktopEditors` 999 stars, `sdkjs`, `core`, `server`, `web-apps`, `MobileEditors`, `eurooffice-nextcloud`, all AGPL-3.0). Stated motivations: upstream is hard to build/contribute to, has binary/obfuscated blobs, closed-off mobile features, removed admin panel. Desktop and mobile apps are "still in progress". [fetched] — [github.com/euro-office](https://github.com/euro-office)
- Euro-Office DocumentServer "is not a standalone application and needs a platform such as Nextcloud that stores the files"; distributed as deb/rpm and `ghcr.io/euro-office/documentserver`. [fetched] — [euro-office/DocumentServer](https://github.com/euro-office/DocumentServer)

### Inferences
- For a personal app that is never distributed and has no remote users, AGPLv3 imposes no source-publication or branding duty; you may modify sdkjs/web-apps (hide logo, restyle) privately. Obligations (source offer, Section 7 notices, trademark policy) only bite if the app is later shared or hosted for others. This is my reading of the license text, not legal advice.
- The x2t-WASM stack tracks upstream with lag: CryptPad's README references core tag v9.3.0.140 (Feb 2026 line) while upstream is at 10.0. Expect the client-side route to be 1-3 minor versions behind and to miss the newest PDF-editor/AI features. ranuts' README does not state which ONLYOFFICE version it bundles.
- Since `document:save` only lists DOCX/XLSX/PPTX/CSV as `targetExt`, programmatic PDF export through the ranuts embed API may need a small patch (x2t itself can produce PDF, and the UI has an export-to-PDF action).
- Embedding effort, lowest to highest: (1) bundle the ranuts static build as an iframe in Electron and drive it via postMessage (days); (2) fork ranuts / wire sdkjs + web-apps + x2t-wasm yourself for deeper chrome control (weeks); (3) bundle the real Document Server as a local sidecar and use the official DocsAPI with a localhost file/callback shim (weeks, heavy footprint, Windows/macOS packaging pain).
- Electron (Chromium) is the lower-risk shell: sdkjs/web-apps are developed against Chromium/CEF, and Tauri's WKWebView/WebKitGTK webviews are a less-tested target for the canvas-heavy editors and large WASM modules. Not verified by a source.
- Chrome hiding beyond what the config exposes is done by editing or CSS-overriding `web-apps` (same-origin iframe in a desktop shell makes CSS injection straightforward).
- Euro-Office is not a better embedding target today: server-coupled (needs Nextcloud-like host), desktop app unfinished. It is worth watching because its stated goal is a cleaner, buildable codebase.

### Gaps
- Could not read ONLYOFFICE's own blog/API docs or the current LICENSE text (host blocked), so the exact post-9.4 Section 7 wording, including whether the logo-retention term still exists, is unverified.
- No measured numbers found for x2t-WASM binary size, load time, memory, or large-file limits.
- No systematic round-trip fidelity benchmark (ONLYOFFICE vs LibreOffice vs MS Office) from 2025-2026 was found; fidelity claims in the recommendation section are reputation-level.
- ranuts/document's bundled ONLYOFFICE version, last-commit date, and whether fonts/spellcheck/macros/plugins fully work client-side were not confirmed.
- Whether the client-side builds support password-protected files, embedded OLE, or VBA macros round-trip was not found.

---

## 2. Collabora Online / LibreOfficeKit / LibreOffice / ZetaOffice (LibreOffice WASM)

### Takeaway
The LibreOffice family offers the broadest feature set and format coverage under a permissive-copyleft MPL-2.0 license, and Collabora's new desktop app (Nov 2025; 26.04 line in 2026) proves the "web UI + in-process LibreOfficeKit, no server" architecture works offline on all three desktop OSes. But there is no turnkey embeddable widget equivalent to the ONLYOFFICE iframe: you either build against LibreOfficeKit's C API, bundle the Linux-only `coolwsd` server, fork Collabora Office itself, or use the still-niche ZetaOffice WASM build.

### Cited Findings

**Collabora Office (new desktop app)**
- First release 26 Nov 2025 for Windows, macOS, Linux; it reuses the Collabora Online interface (HTML, JavaScript, Canvas, CSS, WebGL) instead of the classic VCL toolkit; engine is LibreOffice core. The older suite is renamed "Collabora Office Classic". [search] — [Collabora press release](https://www.collaboraonline.com/blog/press-release-bringing-collabora-online-to-the-desktop/); [heise](https://heise.de/-11093278); [It's FOSS](https://itsfoss.com/news/collabora-launches-desktop-office-suite/)
- Packaging at launch: Linux x86_64 Flatpak, Windows 11 64-bit APPX, macOS 15+ ARM only; no Base (database) app. [search] — [AlternativeTo news](https://alternativeto.net/news/2025/11/collabora-launches-new-open-source-collabora-office-desktop-suite-for-linux-mac-and-windows); [Mac App Store listing](https://apps.apple.com/us/app/collabora-office-desktop/id6754639856?mt=12)
- Collabora Office 26.04 (2026): Windows build described as Win32 / WebView2 that "runs the engine in-process and serves the UI locally"; Linux build is a native Qt6 WebEngine app (Flatpak and Snap); added dark-mode detection, WebView zoom following GNOME font scaling, single-instance document routing over DBus. [search] — [Collabora Office 26.04 release](https://www.collaboraonline.com/blog/collabora-office-26-04-release/)
- The Linux executable is `coda-qt` and builds from the Collabora Online source tree with Qt6 WebEngine/WebChannel modules. [search] — [Collabora Online community: build CO for Linux](https://collaboraonline.github.io/post/build-co-linux)
- Described by a secondary source as running "completely offline" with no server or cloud. [search] — [igorslab](https://www.igorslab.de/en/collabora-office-brings-modern-libreoffice-technology-completely-offline-to-the-desktop-for-the-first-time/)

**Collabora Online (server) and repo**
- `CollaboraOnline/online` on GitHub (3.4k stars) now holds container/Helm/build assets; full source is in the read-only mirror `CollaboraOnline/online.mirror` and changes go through Gerrit. Has a "Collabora Office Development Preview" (CODA) snapshot badge. [fetched] — [CollaboraOnline/online](https://github.com/CollaboraOnline/online)
- Collabora Online and LibreOffice core are MPL-2.0. [prior] — [LibreOffice licenses](https://www.libreoffice.org/about-us/licenses); [online.mirror COPYING](https://github.com/CollaboraOnline/online.mirror)
- Embedding model of the server product: the editor is an iframe served by `coolwsd`, and the host implements the WOPI REST endpoints (`CheckFileInfo`, `GetFile`, `PutFile`) to supply and receive bytes; a postMessage API covers save/export actions, hiding menu items/buttons, and `ui_defaults`/CSS-variable theming. `coolwsd` runs on Linux only (Docker "CODE" image is the usual distribution). [prior] — [Collabora Online SDK](https://sdk.collaboraonline.com/)

**LibreOfficeKit and headless**
- LibreOfficeKit (LOK) is the C/C++ API to LibreOffice core used by Collabora Online: load a document, render tiles to a bitmap buffer, post keyboard/mouse events, receive callbacks, `saveAs` to any export filter (including PDF). The embedder must supply all UI (toolbars, dialogs, cursor/selection overlays). [prior] — [LibreOfficeKit docs](https://docs.libreoffice.org/libreofficekit.html)
- Headless conversion: `soffice --headless --convert-to pdf|docx|xlsx|pptx <file>` works with a stock LibreOffice install and no UI. [prior] — [LibreOffice help: start parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html)

**ZetaOffice / zetajs (LibreOffice WASM)**
- ZetaOffice is Allotropia's LibreOffice-Technology product for browser/desktop/mobile; `zetajs` is a JS wrapper (npm) that runs ZetaOffice WASM in a page and controls it through LibreOffice UNO from JavaScript. Announced Nov 2024. [search] — [Allotropia launch post](https://blog.allotropia.de/2024/11/08/launching-zetaoffice/); [The Register](https://www.theregister.com/2025/02/13/libreoffice_wasm_zetaoffice/)
- zetajs repo: MIT license, 231 stars, 16 forks, 348 commits, 8 open issues, no GitHub releases, "tested with BrowserStack". Examples: standalone Writer, Vue letter demo, "full web office suite", `convertpdf` (local file to PDF), ping-monitor charts. Docs cover self-hosting the WASM and compiling a custom LOWA build; a `config.sample.js` points at alternative builds. Loading is shown via `loadComponentFromURL`. [fetched] — [allotropia/zetajs](https://github.com/allotropia/zetajs)
- npm version: 1.1.0 per one listing, 1.2.0 per another (dates unverified). WASM binaries come from LibreOffice branch `distro/allotropia/zeta-24-2` (LibreOffice 24.2 line) and are served from `cdn.zetaoffice.net/zetaoffice_latest/`. [search] — [npm zetajs](https://npmjs.com/package/zetajs); [pkgstats](https://www.pkgstats.com/pkg:zetajs)
- Size given in a 2024 talk: ~32 MB binary + ~15 MB data; 2025 roadmap: bug fixing, performance and size reduction, OPFS support, TypeScript typings. [search] — [SFSCON 2024 slides](https://sfscon.it/wp-content/uploads/2024/11/17307577791742024-11-08-Moritz-Duge-Allotropia-LibreOffice-JavaScript-WebWidget-SFSCON-2024.pdf); [Chemnitzer Linux-Tage 2025 slides](https://chemnitzer.linux-tage.de/2025/media/programm/folien/354.pdf)
- The WASM UI is the classic LibreOffice VCL UI rendered through a Qt/emscripten canvas, not a web-native UI (see FOSDEM 2025 talk "LOWA in need of a VCL plug"). [search] — [FOSDEM 2025 slides](https://fosdem.org/2025/events/attachments/fosdem-2025-5169-lowa-in-need-of-a-vcl-plug/slides/236790/FOSDEM25_mjUvdiJ.pdf)
- Lead only (not read): The Register, March 2026, "LibreOffice Online dragged out of the attic" suggests TDF revived its own LibreOffice Online line. [search] — [The Register](https://www.theregister.com/applications/2026/03/02/libreoffice-online-dragged-out-of-the-attic/4388766)

### Inferences
- "Maximum feature parity" in the sense of breadth (legacy formats, macros/Basic, mail merge, pivot tables, ODF, Draw, PDF import via Draw) favors the LibreOffice engine; "looks like MS Office and round-trips OOXML layout closely" is the usual argument for ONLYOFFICE, whose native model is OOXML. Both are reputation-level statements; no 2026 benchmark was found.
- Realistic local-embedding options, in order of practicality for a solo dev:
  1. Headless `soffice` as a sidecar purely for conversion/PDF export/thumbnailing (hours of work; pairs well with any editor engine).
  2. Fork/build Collabora Office desktop (`coda-qt` / WebView2 app) and customize its JS UI: gives the full in-process engine offline, MPL-2.0, but you inherit a large C++ build (LibreOffice core + online) and the app is its own shell rather than a widget inside Electron/Tauri.
  3. Bundle `coolwsd` + a tiny localhost WOPI host and iframe it in Electron: clean bytes-in/bytes-out via WOPI and good UI-hiding hooks, but Linux-only server means Docker/WSL2/VM on Windows and macOS.
  4. Bind LibreOfficeKit natively (Rust/Node addon) and render tiles into your own canvas: full control, but you must rebuild every piece of editor UI; months of work.
  5. ZetaOffice WASM in the webview: bytes via the emscripten FS and UNO `storeToURL`, PDF export via UNO filters, but ~47 MB+ download (bundleable locally), needs cross-origin isolation for threads (typical for threaded emscripten builds; not confirmed on the zetajs page), LibreOffice 24.2-era core, classic desktop-style UI inside a canvas, small community (231 stars).
- Collabora's own move to WebView2/Qt WebEngine + in-process LOK is strong evidence that "web UI over a native engine in one desktop window" is viable and performant, but its code is structured as an application, not an SDK.
- MPL-2.0 is file-level copyleft: private modification and use carry no obligations; even distribution only requires publishing changes to MPL-covered files. Far lighter than AGPL should the project ever be shared.

### Gaps
- Could not fetch collaboraonline.com, so the 26.04 architecture description (in-process engine on Windows) is search-level; whether Linux/macOS builds are likewise in-process with no `coolwsd` is not explicitly confirmed. macOS build tech (presumably WKWebView) not confirmed.
- No documented, supported API for embedding the Collabora Office desktop web UI as a component inside a third-party Electron/Tauri app was found.
- Installed size, RAM use and cold-start times for Collabora Office desktop and for ZetaOffice in 2026 were not found.
- Current ZetaOffice core version in late 2026 (still 24.2-based?) and zetajs release dates are unverified; no maturity statement from Allotropia was found.
- sdk.collaboraonline.com postMessage/WOPI details are from prior knowledge, not re-read.

---

## 3. Univer (dream-num/univer)

### Takeaway
Univer is the most hackable modern codebase (Apache-2.0, plugin architecture, ~31k stars), but it is not a full offline office suite on OSS alone: xlsx/docx import/export lives in the commercial Server SDK, Slides is now a separately distributed commercial product, and Docs is a basic rich-text editor. It fits only if spreadsheets are the focus and you are willing to write or borrow your own xlsx converter.

### Cited Findings
- Repo: Apache-2.0 for the open-source packages; "Commercial SDK modules are distributed and licensed separately"; evaluation of commercial options includes watermarks and feature limits. ~31.0k stars, 2.8k forks. [fetched] — [dream-num/univer](https://github.com/dream-num/univer)
- OSS Sheets features: cell styles, merged cells, in-cell rich text, freeze panes, floating images, undo/redo, formulas, defined names, filtering, sorting, data validation, conditional formatting, hyperlinks, comments, find and replace. [fetched] — [dream-num/univer](https://github.com/dream-num/univer)
- OSS Docs features: rich-text editing, paragraph formatting, lists, hyperlinks, comments, drawing integration. [fetched] — [dream-num/univer](https://github.com/dream-num/univer)
- Slides: appears only as a demo card; described as a "separately distributed commercial product". [fetched] — [dream-num/univer](https://github.com/dream-num/univer)
- Commercial Web SDK plugins: charts, shapes, pivot tables, SmartArt. Commercial Server SDK: real-time collaboration, revision history, and Office file import/export ("separately distributed file-conversion capabilities"). OSS also includes headless (Node.js) operation. [fetched] — [dream-num/univer](https://github.com/dream-num/univer)
- Docs state that some Pro features require access to the Univer Server, including Import and Export, Collaborative Editing, Live Share. [search] — [Univer docs: Pro](https://docs.univer.ai/guides/pro)
- Unlicensed (free) Pro limits: import files no larger than 1 MB, export no more than 10k cells, watermark; an older page also lists a three-page print limit. License is delivered as a `license.txt` configured into a license plugin. Pro pricing is not public (contact sales). [search] — [Univer docs: upgrade to Pro (Sheets)](https://docs.univer.ai/guides/sheets/getting-started/pro); [Univer docs: license](https://docs.univer.ai/guides/pro/license); [G2 pricing page](https://www.g2.com/products/univer/pricing)
- Version: docs site banner reads "Univer Office SDK v1.5.2 has been released"; an aggregator reports v1.0.0 dated 24 Sep 2026. These two are hard to reconcile and neither date was confirmed on an official release page. [search] — [docs.univer.ai](https://docs.univer.ai/); [ai-tldr.dev](https://ai-tldr.dev/releases/dream-num-univer-1-0/)

### Inferences
- With OSS only, xlsx import/export does NOT work out of the box offline: the conversion is a server-side commercial component. A personal app would have to map xlsx <-> Univer's JSON snapshot itself (e.g., via SheetJS/ExcelJS or a LibreOffice/x2t sidecar), which loses fidelity on charts, pivots, shapes (also commercial in Univer).
- Running the Univer Server locally as a sidecar under the free tier is technically conceivable but the 1 MB import / 10k-cell export / watermark limits make it unsuitable for a real daily-driver tool.
- Embedding is trivial (it is a JS library rendered into a div/canvas; full control over toolbars, theming, headless mode), so Univer wins on custom UX but loses badly on "full suite, near-complete parity, high round-trip fidelity".
- Docs and Slides are not credible Word/PowerPoint replacements on the OSS tier.

### Gaps
- Exact current version/date, and whether any xlsx import/export moved into OSS at 1.0, could not be confirmed from an official page (README fetched shows it as commercial).
- Whether a licensed self-hosted Univer Server validates licenses fully offline is unknown.
- Univer commercial license terms for personal/non-commercial use were not read.

---

## 4. Other engines: rule in / rule out

### Takeaway
Nothing outside the ONLYOFFICE and LibreOffice families qualifies as an embeddable, full-fidelity docx/xlsx/pptx engine; the rest are either derivatives of those two (CryptPad, Ziziyi, Euro-Office, Nextcloud Office, openDesk), proprietary (WPS), or stale/weak on OOXML (Apache OpenOffice, Calligra).

### Cited Findings
- CryptPad: embeds forked ONLYOFFICE `sdkjs`/`web-apps` client-side and replaces the Document Server with its own encrypted collaboration layer plus x2t-WASM for conversion. Useful as proof and as the upstream of x2t-wasm, not as an embeddable component by itself. [search/fetched] — [cryptpad/web-apps](https://www.github.com/cryptpad/web-apps); [cryptpad/onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm)
- Ziziyi Office (`baotlake/office-website`) and `InledGroup/office`: ONLYOFFICE-on-WASM static sites, same class as ranuts/document; AGPLv3. Rule in as alternatives/reference implementations. [search] — [baotlake/office-website](https://github.com/baotlake/office-website); [InledGroup/office](https://github.com/InledGroup/office)
- Euro-Office: active ONLYOFFICE fork (AGPL-3.0), server needs a host platform such as Nextcloud; desktop/mobile "in progress". Rule out for now as an embed target; watch. [fetched] — [github.com/euro-office](https://github.com/euro-office); [euro-office/DocumentServer](https://github.com/euro-office/DocumentServer)
- Nextcloud Office: historically Collabora Online packaged for Nextcloud; Euro-Office is intended as an additional/alternative office component in Nextcloud and IONOS Nextcloud Workspace, with users able to choose. Euro-Office's README refers to signed "Nextcloud Office" builds of its DocumentServer. Server-integration products, not local engines. [search/fetched] — [heise](https://heise.de/-11228123); [euro-office/DocumentServer](https://github.com/euro-office/DocumentServer)
- openDesk (ZenDiS, German public sector): a bundled sovereign-workplace distribution that integrates existing components (Collabora Online for office editing) rather than its own engine. Rule out. [prior] — [opendesk.eu](https://www.opendesk.eu/)
- WPS Office: proprietary; no open-source embeddable engine. Rule out. [prior] — [wps.com](https://www.wps.com/)
- Apache OpenOffice: 4.1.x maintenance line, cannot save OOXML (import only). Rule out. [prior] — [openoffice.org](https://www.openoffice.org/)
- Calligra (KDE): Qt/KDE suite, ODF-native with limited OOXML import and weak/no OOXML export fidelity. Rule out. [prior] — [calligra.org](https://calligra.org/)

### Inferences
- The decision space is effectively two engines (ONLYOFFICE sdkjs+x2t vs LibreOffice core) plus Univer as a spreadsheet-only UX toolkit.
- Format-specific JS libraries (not full suites; outside this brief) would only matter as glue for Univer.

### Gaps
- openDesk, WPS, Apache OpenOffice and Calligra statements are from prior knowledge and were not re-verified in 2026 sources.
- Did not find any new (2025-2026) independent full-suite OSS engine; absence of evidence from a limited search, not proof.

---

## 5. Embedding in an Electron/Tauri shell: effort, chrome control, bytes in/out, auto-save, PDF export

### Takeaway
ONLYOFFICE-on-WASM (ranuts/document or a private fork) gives the shortest path: one iframe per tab, `open-buffer` in, `save` out, `dirty-changed` for auto-save. LibreOffice-based routes give a stronger engine but cost far more integration work, except as a headless conversion sidecar.

### Cited Findings
| Engine / route | Bytes in | Bytes out | Dirty / auto-save hook | PDF export | Hide/theme chrome | Offline, no server | Source |
|---|---|---|---|---|---|---|---|
| ranuts/document iframe (ONLYOFFICE + x2t-wasm) | `document:open-buffer` (ArrayBuffer/Uint8Array), `open-file`, `open-url` | `document:save` -> `document:saved` with `File`; `targetExt` DOCX/XLSX/PPTX/CSV | `document:dirty-changed`, `document:get-state` | UI export to PDF; not in documented `targetExt` list | Not documented in embed API; fork/CSS needed | Yes (static assets) | [fetched] [embed-api.md](https://github.com/ranuts/document/blob/main/docs/embed-api.md); [README](https://github.com/ranuts/document) |
| Official ONLYOFFICE Document Server (local sidecar) | `document.url` over HTTP | `callbackUrl` POST with download URL (status 2 / forcesave 6) | callback statuses; `onDocumentStateChange` event | conversion API / `downloadAs` | `editorConfig.customization`; logo removal gated to paid edition | Only with bundled local server | [prior] [api.onlyoffice.com](https://api.onlyoffice.com/docs/docs-api/get-started/basic-concepts/) |
| Collabora Online (`coolwsd` sidecar) | WOPI `GetFile` | WOPI `PutFile` | postMessage `Doc_ModifiedStatus`; built-in autosave to WOPI host | postMessage export / `convert-to` endpoint | postMessage hide menu/button, `ui_defaults`, CSS vars | Local server, Linux-only binary | [prior] [sdk.collaboraonline.com](https://sdk.collaboraonline.com/) |
| Collabora Office desktop (fork) | native file open | native save | internal | built-in | edit its JS/CSS UI (MPL-2.0) | Yes | [search] [26.04 release](https://www.collaboraonline.com/blog/collabora-office-26-04-release/); [build guide](https://collaboraonline.github.io/post/build-co-linux) |
| LibreOfficeKit native | `documentLoad(path)` | `saveAs(path, format)` | LOK callbacks (document modified state) | `saveAs(..., "pdf")` | You draw all UI yourself | Yes | [prior] [LOK docs](https://docs.libreoffice.org/libreofficekit.html) |
| ZetaOffice / zetajs (WASM) | emscripten FS + `loadComponentFromURL` | UNO `storeToURL` + read FS | UNO modify listeners | UNO PDF export filter (`convertpdf` example) | UNO can hide toolbars/menus; UI is classic LO in a canvas | Yes if WASM self-hosted | [fetched] [allotropia/zetajs](https://github.com/allotropia/zetajs) |
| Univer OSS | your own converter -> JSON snapshot | snapshot -> your own converter | command/mutation listeners | print/export are commercial | Total (it is a UI library) | Yes, but no OOXML I/O | [fetched] [dream-num/univer](https://github.com/dream-num/univer) |

### Inferences
- Rough solo-developer effort to "tabs + open/save docx/xlsx/pptx": ranuts iframe ~days; private ONLYOFFICE-WASM fork with custom toolbar ~2-6 weeks; coolwsd sidecar ~2-4 weeks on Linux, more with VM/Docker on Win/macOS; Collabora Office fork ~weeks just to build, then open-ended; LOK-native or Univer+own converters ~months. These are my estimates, not sourced.
- A fully custom toolbar over ONLYOFFICE is feasible by hiding `web-apps` chrome and calling sdkjs/plugin APIs, but sdkjs is minified/Closure-compiled and sparsely documented, so "custom tabs, stock editor toolbar, restyled via CSS" is the pragmatic level of customization.
- Auto-save in the ONLYOFFICE-WASM route = debounce on `document:dirty-changed`, call `document:save`, write the returned bytes atomically from the main process; each save is a full x2t conversion, so large files will make frequent auto-save expensive.
- Tauri is attractive for size, but an Electron/Chromium runtime removes webview-compatibility risk for both ONLYOFFICE canvas editors and big threaded WASM (ZetaOffice). Tauri remains fine for a sidecar-server design.

### Gaps
- No public write-up was found of someone shipping ranuts/document or CryptPad's stack inside Electron/Tauri specifically; feasibility is inferred from it being a static site with an iframe API.
- Performance of x2t-WASM saves on large documents (e.g., 50 MB xlsx) is unknown.
- The ONLYOFFICE and Collabora rows marked [prior] should be re-checked against current docs before implementation.

---

## 6. Bottom-line ranked recommendation

### Takeaway
For a personal, never-distributed, local-first app, build on ONLYOFFICE-in-the-webview via x2t-WASM (start from ranuts/document's embed API inside Electron) and add headless LibreOffice as an optional conversion/fallback sidecar; choose a Collabora/LibreOffice-centered design only if LibreOffice-level feature breadth matters more than integration speed, and Univer only for a spreadsheet-first custom UX.

### Cited Findings
- ONLYOFFICE-on-WASM already delivers docx/xlsx/pptx editing, PDF annotate/fill/export, bytes-in/bytes-out and dirty events with no server. — [ranuts/document](https://github.com/ranuts/document); [embed-api.md](https://github.com/ranuts/document/blob/main/docs/embed-api.md)
- Upstream ONLYOFFICE is actively released (10.0.0 on 12 Oct 2026; ~2-3 month cadence) and its PDF editor now covers redaction, forms logic, signatures and annotations. — [DocumentServer releases](https://github.com/ONLYOFFICE/DocumentServer/releases); [ONLYOFFICE blog: Docs 10](https://www.onlyoffice.com/blog/2026/10/onlyoffice-docs-10)
- Collabora has shipped an offline, web-UI-over-in-process-LibreOffice desktop app on Windows (WebView2), Linux (Qt6 WebEngine) and macOS. — [Collabora Office 26.04](https://www.collaboraonline.com/blog/collabora-office-26-04-release/)
- Univer's Office import/export, charts, pivots and Slides are commercial. — [dream-num/univer](https://github.com/dream-num/univer)

### Inferences
**(a) Maximum feature parity and fidelity**
1. ONLYOFFICE engine. Best practical MS-Office look-alike and OOXML-native model; for the newest features (10.0 PDF editor, etc.) the truest build is the official Desktop Editors/Document Server, while the WASM route trails upstream slightly. Trade-off: AGPL (irrelevant privately), opaque minified codebase, vendor/licensing controversy, client-side builds are community-maintained.
2. LibreOffice engine via Collabora Office fork or coolwsd sidecar. Broadest feature set and format coverage, MPL-2.0, but heavier, harder to embed as a widget, and OOXML layout fidelity is generally regarded as a step behind ONLYOFFICE for complex Word/PowerPoint files.
3. ZetaOffice WASM. Same engine in the webview, but older core, desktop-style UI in a canvas, small community.

**(b) Maximum hackability / custom UX**
1. Univer (sheets only, plus your own xlsx bridge): cleanest architecture and total UI control, but fails the "full suite + round-trip" requirement on OSS alone.
2. Collabora Online/Office JS UI: readable, non-obfuscated UI code under MPL-2.0 with documented hide/theming hooks; the cost is the build and the server/desktop-app coupling.
3. ONLYOFFICE web-apps fork: workable for restyling and removing chrome; deep changes are painful.

**(c) Hybrid (recommended)**
- Electron shell with native tabs; one ONLYOFFICE-WASM iframe per document (ranuts embed API or a private fork) for docx/xlsx/pptx/pdf editing; headless `soffice` sidecar (optional install) for batch conversion, legacy/odd formats, a second-opinion PDF export, and recovery when x2t fails on a file; keep the original file and write saves atomically with versioned backups, because round-trip through any non-Microsoft engine can drop unsupported constructs.
- Keep the engine behind a thin adapter (`open(bytes) / save() -> bytes / onDirty / exportPdf`) so a Collabora/LOK or Euro-Office backend can be swapped in later.
- Pin and vendor the engine build (offline assets, fonts, dictionaries) instead of loading from any CDN.

### Gaps
- The fidelity ranking between ONLYOFFICE and LibreOffice is not backed by a 2026 benchmark found in this session; the writer should present it as common assessment, and the developer should test with their own real documents.
- Not verified: macro (VBA) handling, tracked-changes/comment round-trip, and embedded-font behavior in the WASM route.
- Sites that could not be read directly this session (onlyoffice.com, collaboraonline.com, heise.de) should be opened to confirm the license wording after 9.4, the 10.0 self-hosted availability, and Collabora Office's per-platform architecture.
