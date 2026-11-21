# Performance, Install Size and Dependency Footprint

Research date: 2026-11-21. Evidence tags used on every finding:

- **[M]** measured by me in this session (npm tarballs downloaded from registry.npmjs.org, files measured on disk, gzip -9 / brotli via Node zlib; brotli quality 5 for large trees, 9 for single files).
- **[R]** read directly on the source page.
- **[S]** search-engine summary only; the page itself was not opened.
- **[K]** background knowledge (training data, cutoff mid-2026), not re-verified; the URL is where it should be checked.

Access limits in this session (they shape the gaps): betterstack.com, dev.to, danluu.com, pavelfatin.com, zed.dev, v2.tauri.app, code.visualstudio.com download hosts and GitHub release-asset downloads were all blocked, and the GitHub API was not enabled for other repos. Installer sizes that depend on those hosts are marked "not found".

## 1. Shell frameworks: real numbers (Electron, Tauri v2, Wails, Electrobun, Neutralino, native toolkits)

### Takeaway
No single authoritative 2026 benchmark exists; the one continuously updated, reproducible set (Elanis, GitHub CI, single runs) shows Tauri at about 3–5 MB versus Electron at hundreds of MB on disk, but Electron starting *faster* than Tauri in release mode on all three OSes and Tauri using *more* memory than Electron on Windows. The "Tauri is 10x lighter and faster" headline is true for download size and macOS/Linux memory, and not established for startup or Windows memory.

### Cited Findings
- [R] Elanis comparison, "01 – Empty app", release builds, all rows updated 10–11/2026, run on GitHub CI, no repeated runs, versions not printed on the page:

  | Framework | Build size Win / macOS arm64 / Linux | Startup (release) Win / macOS / Linux | Memory, main + children (release) Win / macOS / Linux |
  |---|---|---|---|
  | Electron | ≈373 / ≈268 / ≈286 MB | ≈195 / ≈431 / ≈191 ms | ≈279 / ≈370 / ≈596 MB |
  | Tauri | ≈3 / ≈5 / ≈4 MB | ≈650 / ≈1933 / ≈30343 ms | ≈312 / ≈96 / ≈94 MB |
  | Wails | ≈11 / ≈8 / ≈9 MB | ≈572 / ≈1785 / ≈271 ms | ≈330 / ≈101 / ≈360 MB |
  | Neutralino | ≈2 / ≈2 / ≈2 MB | ? / ≈1995 (debug) / ≈350 ms | ≈502 / ≈180 (debug) / ≈821 MB |
  | NW.js | ≈572 / ≈423 / ≈534 MB | ≈676 / ≈886 / ≈517 ms | ≈618 / ≈657 MB / ≈1 GB |
  | Flutter | ≈25 MB / ? / ? | ≈2008 ms / debug only / debug only | ≈377 MB / debug only / debug only |

  — [Elanis/web-to-desktop-framework-comparison](https://github.com/Elanis/web-to-desktop-framework-comparison)
- [R] The same page states the numbers are from GitHub CI runners and should be read "with a margin of error"; it has no installed-size column, and does not cover Electrobun, Qt, Dioxus, Slint, egui or GPUI. The Tauri Linux startup figure (≈30 s) is an obvious CI artefact (headless WebKitGTK), not a real-world number. — [Elanis comparison](https://github.com/Elanis/web-to-desktop-framework-comparison)
- [S] July 2026 blog figures: Tauri hello-world 3.2 MB vs Electron 85 MB; 380 ms vs 1,420 ms startup; 42 MB vs 168 MB idle memory. The article uses "Electron 34.x" as its baseline although Electron 45 is current, so treat as dated/marketing-grade. — [tech-insider.org](https://tech-insider.org/tauri-vs-electron-2026/)
- [S] Hopp's six-window app: 8.6 MiB (Tauri) vs 244 MiB (Electron) bundle, ≈172 MB vs ≈409 MB memory, startup difference "negligible"; single run on one MacBook (N=1). — [Hopp benchmark on dev.to](https://dev.to/gethopp/tauri-vs-electron-performance-bundle-size-and-the-real-trade-offs-1el4) (host blocked; not read)
- [S] Better Stack (July 2026, median of 10 launches) measured a demo app at 323 MB for Electron and 418 MB / 773 ms startup for Electrobun, because the system webview lacked a needed feature and Electrobun had to bundle Chromium. Electrobun's own site claims "14MB bundle" and "<50ms startup" (marketing; not reproduced). — [Better Stack comparison](https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/); [Electrobun docs](https://blackboard.sh/electrobun/docs/guides/what-is-electrobun)
- [M] Current Electron on npm is 45.4.1 (`electron` package `latest`, 2026-11-21). [S] Electron 45.0 ships Chromium 156, V8 15.6, Node v24.22.0. — [npm: electron](https://www.npmjs.com/package/electron); [Electron 45 blog](https://www.electronjs.org/blog/electron-45-0)
- [S] Electron 43+ boots the main process from an embedded Node.js startup snapshot, and Electron 45's sandboxed renderer skips Electron's JS bootstrap bundle unless `webviewTag` is enabled (both are upstream startup wins that arrive for free). — [Electron release PR 51703](https://releases.electronjs.org/pr/51703); [Electron 45 blog](https://www.electronjs.org/blog/electron-45-0)
- [S] Wails v3 was promoted from alpha to beta on 2026-08-02 (v3.0.0-beta.2); later betas up to beta.12 are listed, and a "v3.0.0" page exists whose date and finality could not be confirmed. — [Wails changelog](https://docs-preview.wails.io/changelog/); [newreleases.io v3.0.0](https://newreleases.io/project/github/wailsapp/wails/release/v3.0.0)
- [S] Native Rust toolkits, uncontrolled anecdotes only: a Slint hello-world reported at 45 MB RAM / 12.5 MB on disk; an egui app at ≈135 MB RAM dropping to ≈30 MB after moving to Slint with GPU rendering off; another egui report of 102 MB. None are like-for-like. — [dev.to case study](https://dev.to/trystan_sarrade/how-i-took-my-rust-gui-from-135-mb-to-30-mb-by-ditching-the-gpu-2i7d); [pistack comparison](https://www.pistack.xyz/posts/2026-08-25-rust-gui-frameworks-egui-iced-slint-comparison/)
- [S] Third-party Zed (GPUI) figures conflict: cold start 0.12–0.6 s vs VS Code 1.2–2.5 s; idle memory 150–250 MB vs 300–650 MB; keystroke latency ≈2 ms vs 12–25 ms. Several of these posts look machine-generated; only the direction is consistent. — [dev.to Zed review](https://dev.to/pickuma/zed-editor-review-a-gpu-accelerated-code-editor-worth-switching-for-2hjk)

### Inferences
- For *this* app the shell runtime is a minority of the footprint: one office engine is 2–4x the size of Electron's compressed download (see section 3). Tauri's size win is real for the base app only if the office engine is not in the base install.
- Electron's weakness in the Elanis data is disk and memory, not startup; a well-built Electron shell can open in ≈200–450 ms empty. "Instant launch" is achievable in either family; it is decided by what the app does before first paint, not by the framework.
- Native toolkits (Qt, Flutter, WinUI, AppKit, GPUI, Slint, egui, Dioxus-native) are not viable hosts here regardless of their numbers, because every chosen engine (ONLYOFFICE sdkjs, Monaco/CodeMirror, PDF.js) is a web application that needs a browser engine; a native shell would still embed a webview per tab and so inherits the webview's costs while adding a second UI stack.

### Gaps
- Electron 45 zip / installer sizes per OS: not found (GitHub release assets unreachable). The Elanis "build size" (≈268–373 MB) is unpacked size, not installer size.
- Per-window / per-webview incremental memory for Electron, WebView2 and WKWebView: no measured 2026 source found.
- No measured hello-world numbers found for Qt, .NET/WinUI, Swift/AppKit, GPUI or Dioxus.
- Better Stack's and Hopp's full tables could not be read (hosts blocked).

## 2. Webview specifics: WebView2, WKWebView, WebKitGTK, and engine compatibility

### Takeaway
WebView2 is the only system webview that is Chromium-equivalent and therefore the only one where ONLYOFFICE/Monaco/PDF.js behave as they do in Electron; it is preinstalled on Windows 11 and nearly all Windows 10. WKWebView and especially WebKitGTK are where the risk sits, and Tauri still has no shipped print-to-PDF API.

### Cited Findings
- [S] Microsoft: the Evergreen WebView2 Runtime "is preinstalled onto all Windows 11 devices as a part of the Windows 11 operating system"; "a small number of Windows 10 devices don't have the WebView2 Runtime installed", so apps should still handle its absence (tiny bootstrapper, or full offline installer). — [WebView2 distribution](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution)
- [S] Microsoft: only one Evergreen runtime install is needed for all apps on a device, and "binaries for Microsoft Edge and the Evergreen WebView2 Runtime are hard-linked together when they are on the same version", which "provides benefits for disk footprint, memory, and performance" (qualitative; no numbers given). — [Evergreen vs fixed version](https://learn.microsoft.com/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)
- [S] WebView2 has `PrintToPdfAsync` and `PrintToPdfStreamAsync`; only one PrintToPdf operation can run at a time and the file is lost if the app exits first. — [CoreWebView2.PrintToPdfAsync](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.printtopdfasync)
- [R] Tauri/Wry still has no merged print-to-PDF: wry PR #1317 ("Add API to allow print options", opened 2024-07-13) is a **draft** with no reviews; it has no Windows implementation (a contributor only suggested WebView2 `PrintToPdf` and posted an unverified proof of concept), and its WebKitGTK path fails with "lpr: Error - No default destination". Related: tauri#4917 (feature request), tauri#10275 ("first implementation of print API", draft), wry #1324 (open), wry #1167 (earlier failed Windows attempt). — [wry PR #1317](https://github.com/tauri-apps/wry/pull/1317)
- [S] WebKitGTK itself lacks a complete print-to-file API. — [WebKit bug 212814](https://bugs.webkit.org/show_bug.cgi?id=212814)
- [S] Tauri's own docs: on some Linux setups ("most often NVIDIA GPUs") WebKitGTK and the driver disagree, giving "anything from a blank window to subtle rendering problems"; "WebGL and canvas content can silently land on a slow path while the rest of the app looks fine"; the `WEBKIT_DISABLE_DMABUF_RENDERER=1` workaround "disables a faster path for everyone". A 2026 crate applies the quirk only on NVIDIA. — [Tauri: Linux graphics issues](https://v2.tauri.app/develop/debug/linux-graphics/); [webkit2gtk-nvidia-quirk](https://docs.rs/crate/webkit2gtk-nvidia-quirk/latest/source/src/lib.rs)
- [S] A 2026 WebKit bug (WebKitGTK 2.50.3, RTX 5070 laptop) reports a blank WebView from GBM buffer failure, with the DMABUF workaround breaking `backdrop-filter`, i.e. "NO working configuration" for that user. — [WebKit bug 303811](https://bugs.webkit.org/show_bug.cgi?id=303811)
- [S] SharedArrayBuffer (needed for threaded WASM) is only exposed to cross-origin-isolated pages (COOP/COEP headers), including in Safari/WebKit 16+; an April 2026 WebKit bug proposes tightening this further. — [WebKit bug 313579](https://bugs.webkit.org/show_bug.cgi?id=313579); [Apryse: WASM threads](https://docs.apryse.com/web/faq/wasm-threads)
- [S] WASM linear memory is capped at 4 GB and "browsers may impose even stricter limits". — [DuckDB-WASM known issues](https://duckdb.org/docs/current/clients/wasm/known_issues)
- [S] ONLYOFFICE in Safari: a community thread reports documents not opening in Safari on Document Server 9.4.0 while working in Chromium browsers and Firefox (attributed there to the integrator's frontend, not confirmed as an editor bug). — [ONLYOFFICE community thread](https://community.onlyoffice.com/t/blank-page-in-safari-and-saving-reloading-issues-with-onlyoffice-doc-server-seafile-ce/20094)
- [K] ONLYOFFICE Desktop Editors itself ships its own Chromium (CEF) rather than using system webviews on any OS, which is the vendor's own answer to the webview question. — [ONLYOFFICE/DesktopEditors](https://github.com/ONLYOFFICE/DesktopEditors)
- [K] WKWebView allows JIT for WASM/JS in macOS apps (the no-JIT restriction is an iOS lockdown-mode / third-party-browser topic, not a macOS WKWebView one); its version is tied to the OS version, so an old macOS means an old WebKit. — [Tauri webview versions](https://v2.tauri.app/reference/webview-versions/) (host blocked; not read)

### Inferences
- Windows-only: Tauri/WebView2 gives Electron-class engine compatibility without shipping Chromium. The missing piece is PDF export of web content, which must be done by calling `ICoreWebView2_7::PrintToPdf` from custom Rust (webview2-com) or by generating PDFs in the engines themselves (x2t for office files, pdf-lib/PDFium for PDFs) rather than via the webview.
- macOS: WKWebView is plausible but unproven for ONLYOFFICE; nobody was found shipping sdkjs inside WKWebView, and the vendor does not.
- Linux: WebKitGTK is the weakest target for a canvas-heavy app; shipping Chromium (Electron) is the low-risk route if Linux matters.

### Gaps
- Official ONLYOFFICE browser support matrix (Chrome/Edge/Firefox/Safari minimum versions): not found in two searches; helpcenter pages returned only hardware requirements.
- WKWebView-specific WASM memory ceiling, OPFS/IndexedDB quota inside a Tauri custom-scheme origin, and whether Tauri's custom protocol can be made cross-origin isolated on macOS: not found.
- Monaco, CodeMirror 6 and PDF.js official support statements per engine were not fetched this session. [K] CodeMirror 6 and PDF.js target Safari explicitly; Monaco supports desktop Safari but not mobile browsers — check [Monaco README](https://github.com/microsoft/monaco-editor) and [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions).
- Whether WebView2 processes are actually shared with a running Edge (memory) beyond hard-linked binaries: only the qualitative Microsoft statement was found.

## 3. Engine sizes (unpacked and compressed)

### Takeaway
Measured directly: a complete client-side ONLYOFFICE-family stack (sdkjs + web-apps + x2t WASM, no fonts, no dictionaries) is about 363 MB unpacked and about 93–103 MB compressed, with x2t.wasm alone 35.8 MB raw / 8.0 MB brotli. Everything else the app needs is one to two orders of magnitude smaller: CodeMirror 6 ≈0.12–0.22 MB gzip, Monaco ≈0.6 MB gzip core (5.5 MB with all languages and workers), PDF.js ≈2.6 MB gzip complete, PDFium WASM ≈2.1 MB gzip.

### Cited Findings
Office engine. Measured on the npm packages `@kreijstal/eurooffice*` 9.3.5-rc.1.build.1 (published 2026-10-02, AGPL-3.0-only). The package README says the editors are the "Euro-Office" fork's Document Server build of sdkjs/web-apps, hosted in the Ranuts/document shell, with x2t built from cryptpad/onlyoffice-x2t-wasm. It is an unofficial third-party build, used here only as a size proxy for the same architecture as the current plan.

- [M] Whole stack, four packages: 363 MB raw, ≈103 MB gzip, ≈93 MB brotli-5 (2,816 files). Per package: `eurooffice` 92.4 MB raw / 18.0 MB br; `eurooffice-sdkjs-common` 123.2 / 39.6; `eurooffice-web-apps-1` 75.5 / 22.1; `eurooffice-web-apps-2` 72.0 / 13.3. npm tarballs: 19.5 + 44.7 + 25.1 + 16.7 = 106 MB. — [npm: @kreijstal/eurooffice](https://www.npmjs.com/package/@kreijstal/eurooffice); [sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common); [web-apps-1](https://www.npmjs.com/package/@kreijstal/eurooffice-web-apps-1); [web-apps-2](https://www.npmjs.com/package/@kreijstal/eurooffice-web-apps-2)
- [M] x2t.wasm: 35.82 MB raw, 9.8 MB gzip, 8.0 MB brotli-5. The README says the site serves a brotli copy (`x2t.wasm.br`). — [npm: sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common)
- [M] sdkjs per editor (raw / brotli-5): word 20.1 / 3.2 MB (`sdk-all-min.js` 2.37 MB + `sdk-all.js` 17.69 MB); cell 22.0 / 3.5; slide 21.7 / 5.1; visio 16.2 / 2.6. — [npm: @kreijstal/eurooffice](https://www.npmjs.com/package/@kreijstal/eurooffice)
- [M] sdkjs shared parts: `sdkjs/common` 83.7 MB raw / 29.2 MB br, of which x2t 35.8, `Images` 18.2 (incompressible, 14.8 br), `libfont` 10.3 (fonts.wasm 3.69), SmartArts ≈9, hash engine.wasm 1.90, zlib.wasm 1.90, spell.wasm 0.80. `sdkjs/pdf` 39.3 MB raw / 10.4 br (drawingfile.wasm 12.03 MB). — [npm: sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common)
- [M] web-apps UI per editor (raw / brotli-5): documenteditor 27.1 / 5.1 MB; spreadsheeteditor 43.3 / 7.4; presentationeditor 21.0 / 3.9; pdfeditor 14.0 / 2.3; `vendor` 23.3 / 4.7 (dominated by a bundled Monaco, ≈25 MB on disk). Within documenteditor (35 MB on disk): `main` 20 MB of which `locale` 15 MB; `mobile` 13 MB; `forms` 3 MB. Spreadsheet: `main` 31 MB, `mobile` 20 MB. — [web-apps-2](https://www.npmjs.com/package/@kreijstal/eurooffice-web-apps-2); [web-apps-1](https://www.npmjs.com/package/@kreijstal/eurooffice-web-apps-1)
- [M] Fonts and spell-check dictionaries are *not* in those four packages (only 3 font files found); the README lists fonts in separate `eurooffice-fonts-1/-2` packages (not found on the registry) and says dictionaries are "not in these packages" (source: ONLYOFFICE/dictionaries). — [npm: @kreijstal/eurooffice](https://www.npmjs.com/package/@kreijstal/eurooffice)
- [R] cryptpad/onlyoffice-x2t-wasm: Dockerfile + emscripten build of a modified ONLYOFFICE core; README references core tag v9.3.0.140; no releases published, so no official binary size. The third-party README above says the x2t build takes "about an hour". — [cryptpad/onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm)
- [R] ranuts/document: AGPL-3.0, 2.0k stars, 1,014 commits, no size or load-time figures published. — [ranuts/document](https://github.com/ranuts/document)
- [M] ONLYOFFICE Document Server Docker image 10.0.0 (2026-10-12): ≈900 MB compressed (amd64 900 MB, arm64 903 MB) — the cost of the server-based alternative. — [Docker Hub: onlyoffice/documentserver](https://hub.docker.com/r/onlyoffice/documentserver/tags)
- [R] ONLYOFFICE Desktop Editors latest release is v10.0.0 (13 Oct) with 32 assets; asset sizes did not load. — [DesktopEditors releases](https://github.com/ONLYOFFICE/DesktopEditors/releases/latest)
- [K] LibreOffice is roughly a 300–600 MB install; ZetaOffice (LibreOffice WASM) was reported as ≈32 MB binary + ≈15 MB data in a 2024 talk (already in sibling notes). — [SFSCON 2024 slides](https://sfscon.it/wp-content/uploads/2024/11/17307577791742024-11-08-Moritz-Duge-Allotropia-LibreOffice-JavaScript-WebWidget-SFSCON-2024.pdf)

Code/text editors.

- [M] CodeMirror 6, bundled with esbuild (minified ESM): `basicSetup` only = 0.37 MB raw / 0.12 MB gzip / 0.11 MB brotli; plus JS/TS, Markdown, Python, JSON, HTML, CSS language packages = 0.63 MB raw / 0.22 MB gzip / 0.20 MB brotli. — [npm: codemirror](https://www.npmjs.com/package/codemirror)
- [M] monaco-editor 0.57.0: npm unpacked 96.96 MB (three builds: `dev` 45, `esm` 35, `min` 25 MB); the shippable `min` tree is 24.38 MB raw / 5.49 MB gzip / 4.80 MB brotli. Core `editor-*.js` 2.36 MB raw / 0.59 MB gzip; language services 7.62 / 1.64; workers 9.31 / 2.15, of which `ts.worker` alone is 6.71 MB raw; NLS 2.51 / 0.36. — [npm: monaco-editor](https://www.npmjs.com/package/monaco-editor)
- [M] `@codingame/monaco-vscode-api` 40.0.0: 55.93 MB unpacked, 8,013 files, 12 dependencies (the API package only; a full workbench needs many additional service-override packages, not measured). — [npm: @codingame/monaco-vscode-api](https://www.npmjs.com/package/@codingame/monaco-vscode-api)
- [M] Tree-sitter: runtime `web-tree-sitter.wasm` 0.20 MB (0.08 gzip); `tree-sitter-wasms` 0.1.13 has 36 grammars totalling 49.37 MB raw / 4.32 MB gzip / 2.94 MB brotli, ranging from JSON 0.01 MB to JavaScript 0.62, C 0.76, PHP 0.77, Objective-C 7.35 MB. `@vscode/tree-sitter-wasm` 0.3.1 is 21.06 MB unpacked. — [npm: web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter); [npm: tree-sitter-wasms](https://www.npmjs.com/package/tree-sitter-wasms); [npm: @vscode/tree-sitter-wasm](https://www.npmjs.com/package/@vscode/tree-sitter-wasm)
- [M] Language servers on npm (unpacked): pyright 1.1.414 18.56 MB (5,423 files); basedpyright 1.40.2 26.56 MB; typescript-language-server 6.1.0 2.34 MB; vscode-langservers-extracted 4.10.0 0.81 MB (+16 deps); `typescript` 7.0.2 package itself 2.38 MB with 20 dependencies (contents not inspected). All of these need a Node runtime. — [npm: pyright](https://www.npmjs.com/package/pyright); [npm: typescript](https://www.npmjs.com/package/typescript); [npm: typescript-language-server](https://www.npmjs.com/package/typescript-language-server)
- [M] A standalone Node runtime is itself large: Node v24.11.0 Windows x64 zip 34.7 MB, bare `node.exe` 85.7 MB, Linux x64 tar.xz 30.6 MB. — [nodejs.org dist v24.11.0](https://nodejs.org/dist/v24.11.0/)
- [K] Native language servers are tens of MB each (rust-analyzer ≈40 MB, gopls ≈30 MB, clangd ≈80–100 MB unpacked); approximate, from memory. — [rust-analyzer releases](https://github.com/rust-lang/rust-analyzer/releases); [clangd releases](https://github.com/clangd/clangd/releases)
- [R] Replit measured Monaco "and related libraries" at 51.17 MB in their bundle (5.01 MB parsed + gzipped) before moving to CodeMirror (sibling note). — [Replit: Betting on CodeMirror](https://replit.com/blog/codemirror)

PDF.

- [M] pdfjs-dist 6.5.438: npm unpacked 35.87 MB (includes `legacy` 18 MB and source maps). Shippable set: `pdf.min.mjs` 0.45 MB raw / 0.13 gzip; `pdf.worker.min.mjs` 1.21 / 0.36; cmaps 1.11 / 0.94; standard fonts 0.76 / 0.52; wasm decoders (openjpeg, jbig2, qcms, quickjs) 1.32 / 0.49; `web/` viewer components 0.55 / 0.13. Total ≈5.4 MB raw / ≈2.6 MB gzip. — [npm: pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist)
- [M] `@embedpdf/pdfium` 2.15.1: `pdfium.wasm` 4.43 MB raw / 2.05 MB gzip / 1.83 MB brotli, JS glue 0.28 MB / 0.06 gzip; package 7.20 MB unpacked, zero dependencies. (A sibling note cites ≈2.7 MB gzip from a third-party doc; this direct measurement is lower.) — [npm: @embedpdf/pdfium](https://www.npmjs.com/package/@embedpdf/pdfium)
- [M] `mupdf` 1.28.6 (AGPL): `mupdf-wasm.wasm` 9.93 MB raw / 4.54 gzip / 3.99 brotli. `@hyzyla/pdfium` 3.0.0 13.47 MB unpacked. `pdf-lib` 1.17.1 18.56 MB unpacked (bundle size not measured). — [npm: mupdf](https://www.npmjs.com/package/mupdf); [npm: pdf-lib](https://www.npmjs.com/package/pdf-lib)
- [S] Stirling-PDF desktop (Tauri 2 + jlink-minimised JRE + backend JAR): 2.6.0 installers ≈218 MB (.msi), ≈225 MB (.deb), ≈219–221 MB (.dmg); a developer guide estimates the jlink runtime at ≈80 MB vs ≈200 MB for a full JRE. — [SourceForge mirror 2.6.0](https://sourceforge.net/projects/stirling-pdf/files/v2.6.0/); [Stirling desktop dev guide (mirror)](https://git.laurivan.com/Mirrors/Stirling-PDF/src/branch/infra/tauri-actions/DesktopApplicationDevelopmentGuide.md)

Other components.

- [M] `pandoc-wasm` 1.1.0: `pandoc.wasm` is **55.87 MB raw**, 15.52 MB gzip, 12.20 MB brotli (the commonly quoted "≈16 MB" is the compressed size). — [npm: pandoc-wasm](https://www.npmjs.com/package/pandoc-wasm)
- [M] SQLite: `@sqlite.org/sqlite-wasm` 3.54.1 `sqlite3.wasm` 0.84 MB raw / 0.39 gzip; `sql.js` 1.17.0 30.2 MB unpacked (many build variants); `wa-sqlite` 2.08 MB unpacked. — [npm: @sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm)
- [M] Native Node modules carry weight and build risk: `better-sqlite3` 13.2.0 26.5 MB unpacked; `node-pty` 1.1.0 61.38 MB unpacked (286 files). — [npm: better-sqlite3](https://www.npmjs.com/package/better-sqlite3); [npm: node-pty](https://www.npmjs.com/package/node-pty)
- [M] Spell-check: `hunspell-asm` 4.67 MB unpacked; `nspell` 0.04 MB; `dictionary-en` 0.55 MB. — [npm: dictionary-en](https://www.npmjs.com/package/dictionary-en)
- [K] ripgrep is a single static binary of roughly 4–6 MB unpacked. — [ripgrep releases](https://github.com/BurntSushi/ripgrep/releases)

### Inferences
- A pruned office pack is feasible but still large. Dropping `mobile` UIs (≈33 MB raw), visio (≈29 MB raw across sdkjs and web-apps), the marketing/help site and unused locales (≈15 MB per editor), and reusing the app's own Monaco instead of the vendored copy, would bring the three-editor pack to very roughly 200–250 MB unpacked / 60–75 MB compressed before fonts. This is an estimate from the measured directory sizes, not a build that was produced.
- Per-editor lazy loading matters inside the pack too: opening a .docx needs `sdkjs/word` + `common` + `documenteditor`, not cell/slide; and x2t.wasm (8 MB compressed, 36 MB to compile) is only needed at open/save/convert time.
- The base app's editing engines (CodeMirror 6 + PDF.js or PDFium + SQLite WASM + a handful of tree-sitter grammars) total roughly 3–6 MB compressed. The base app can be tiny; only the office family and Pandoc break the budget.
- Monaco's cost is its language workers, not its core; Monaco "core only" is 5x CodeMirror, Monaco "everything" is 25–45x.
- Any Node-based language server implies a Node runtime: free inside Electron (`ELECTRON_RUN_AS_NODE` / utility process), a 30–85 MB extra in Tauri/Wails. This is a concrete point in Electron's favour if language servers are in scope, and an argument for making language servers optional packs otherwise.

### Gaps
- ONLYOFFICE Desktop Editors installer and installed sizes, VS Code installer size, Zed, Obsidian, Typora, LibreOffice and Collabora Office download sizes: not found (download hosts blocked).
- Size of the ONLYOFFICE font set and dictionary set as actually shipped: not found.
- Official upstream ONLYOFFICE sdkjs/web-apps build sizes (the measurement above is a fork's build of 9.3.5; upstream is at 10.0).
- Peak memory and load time of the office editors: not measured anywhere found.

## 4. Comparable apps and what they did to be fast

### Takeaway
The fast Electron apps got there by doing less at startup (one bundle, code cache, lazy everything, one shared process instead of one per workspace), and the apps that left the web stack (Zed, Sublime) did so for input latency and memory, not for launch time. Hard, primary-source numbers are scarcer than folklore suggests.

### Cited Findings
- [S] VS Code (CovalenceConf 2019 talk, via aggregator summaries): JS bundle load cut from ≈1.5 s to ≈0.5 s; V8 cached data saved ≈400 ms and bundling into a single file ≈400 ms; the built-in "Startup Performance" command showed ≈2 s total and TTI ≈977 ms. Secondary source. — [besthub summary](https://besthub.dev/articles/how-vs-code-achieves-sub-second-startup-secrets-from-covalenceconf-2019-ff7aaa570b58)
- [S] A VS Code engineer reported on the V8 list (2018) that a startup snapshot's gains "were lost during UI creation", and a V8 maintainer noted snapshots do not persist compiled code by default — i.e. code caching mattered more than heap snapshots for them. — [v8-users thread](https://groups.google.com/g/v8-users/c/KddMkLLHh2w)
- [S] V8: caching code after top-level execution gives a 20–40% reduction in parse + compile time on later loads (Chrome 66+). — [V8: improved code caching](https://v8.dev/blog/improved-code-caching)
- [S] VS Code's 2024 migration to ES modules "massively improves startup performance" and shrank the main workbench bundle by more than 10% (no timings given). — [DevClass](https://www.devclass.com/development/2024/10/14/vs-code-migration-to-ecmascript-modules-massively-improves-startup-performance-but-extensions-left-behind-for-now/1624637)
- [S] VS Code documents a "Startup Performance" command and perf tooling for contributors. — [VS Code wiki: perf tools](https://github.com/microsoft/vscode/wiki/%5BDEV%5D-Perf-Tools-for-VS-Code-Development)
- [S] Slack's 2019 desktop rebuild: launch ≈33% faster, ≈50% less memory (company claims). Root cause fixed: every signed-in workspace had been "a stand-alone copy of the web client inside a separate Electron process"; the rebuild moved to one shared client. It stayed on Electron. — [Slack Engineering: rebuilding Slack on the desktop](https://slack.engineering/rebuilding-slack-on-the-desktop/); [VentureBeat](https://venturebeat.com/ai/slacks-desktop-app-now-launches-33-faster-uses-50-less-memory/)
- [S] Notion: SQLite caching in the desktop apps made initial page load and navigation ≈50% faster for most users; later, WASM SQLite in the browser (OPFS SyncAccessHandle Pool VFS, chosen partly because it avoids the cross-origin-isolation requirement) improved navigation by 20%, but initial load first got *slower* because downloading the WASM library blocked page load until it was made asynchronous. — [Notion: faster page load](https://www.notion.com/blog/faster-page-load-navigation); [Notion: WASM SQLite](https://www.notion.com/blog/how-we-sped-up-notion-in-the-browser-with-wasm-sqlite)
- [S] Zed's stated rationale for leaving Electron/Atom: web tooling was paid for "with increased memory consumption, higher CPU usage, and noticeable UI latency"; GPUI renders the whole UI on the GPU targeting 120 FPS. — [Zed: rendering UIs at 120 FPS](https://zed.dev/blog/videogame); [Zed: why the big rewrite](https://zed.dev/blog/why-the-big-rewrite) (host blocked; not read)
- [K] At 120 FPS the whole frame budget is 8.33 ms; at 60 FPS, 16.67 ms. — [Zed: videogame post](https://zed.dev/blog/videogame)
- [K] 1Password 8 is an Electron front end over a shared Rust core; Figma renders its canvas with a C++/WASM engine on WebGL/WebGPU and reported about 3x faster load after moving from asm.js to WebAssembly (2017); Obsidian and Typora are Electron apps; Sublime Text is native C++ with a custom UI toolkit. Not re-verified this session. — [Figma: WebAssembly cut load time by 3x](https://www.figma.com/blog/webassembly-cut-figmas-load-time-by-3x/); [1Password: behind the scenes of 1Password 8](https://blog.1password.com/1password-8-the-story-so-far/)

### Inferences
- The Slack lesson maps directly onto this app: do not give every tab its own heavyweight process/webview by default. One renderer for shell + light editors; isolate only the office engine.
- The Notion lesson: a WASM engine fetched or compiled on the critical path makes first load slower. x2t, Pandoc and PDFium must be loaded off the critical path and after first paint.
- The VS Code lesson: single bundle + V8 code cache + lazy `require` beat exotic snapshot work for a UI-heavy app.

### Gaps
- No primary-source numbers found this session for Obsidian, Typora, Linear, 1Password, Sublime Text, or ONLYOFFICE Desktop Editors startup/memory.
- Zed's own published latency/startup numbers could not be read (zed.dev blocked); third-party numbers conflict (section 1).

## 5. Packaging strategies to keep the base product small

### Takeaway
A small core plus on-demand "engine packs" is the established pattern (VS Code extensions, Zed language servers, JetBrains plugins), and the measured sizes make it almost mandatory here: the base editors are a few MB while the office pack is ≈60–100 MB compressed. The cost is that "offline" becomes "offline after first use" unless a full/offline installer variant is also offered.

### Cited Findings
- [M] Compression ratios on the actual engines: ONLYOFFICE JS compresses ≈5–6x (word sdkjs 20.1 → 3.2 MB brotli-5); x2t.wasm 35.8 → 9.8 MB gzip → 8.0 MB brotli-5; pandoc.wasm 55.9 → 15.5 gzip → 12.2 brotli; pdfium.wasm 4.43 → 2.05 gzip → 1.83 brotli; tree-sitter grammars 49.4 → 4.3 gzip → 2.9 brotli (≈17x). Image and font assets barely compress (sdkjs `Images` 18.2 → 14.8 MB; PDF.js cmaps 1.11 → 0.91). — [npm: sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common); [npm: pandoc-wasm](https://www.npmjs.com/package/pandoc-wasm); [npm: tree-sitter-wasms](https://www.npmjs.com/package/tree-sitter-wasms)
- [M] `mupdf` already ships a pre-compressed `mupdf-wasm.wasm.br` (3.45 MB) next to the 9.93 MB raw file, and the eurooffice build serves `x2t.wasm.br` — shipping brotli-compressed WASM and decompressing at load is existing practice. — [npm: mupdf](https://www.npmjs.com/package/mupdf); [npm: @kreijstal/eurooffice](https://www.npmjs.com/package/@kreijstal/eurooffice)
- [M] Locale files are a large removable slice: 15 MB of the 20 MB document-editor `main` UI is `locale`. Mobile UI variants are 13 MB (word) and 20 MB (cell). — [web-apps-2](https://www.npmjs.com/package/@kreijstal/eurooffice-web-apps-2)
- [S] WebView2 offers both a tiny online bootstrapper and a full offline installer for the runtime — the same two-variant pattern an engine pack can follow. — [WebView2 distribution](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution)
- [S] Stirling-PDF avoided shipping a full JRE (≈200 MB) by using jlink (≈80 MB), and still lands at ≈218 MB — a worked example of what a bundled second runtime costs. — [Stirling desktop dev guide (mirror)](https://git.laurivan.com/Mirrors/Stirling-PDF/src/branch/infra/tauri-actions/DesktopApplicationDevelopmentGuide.md)
- [K] Precedents for on-demand components: VS Code downloads extensions (and many extensions download their own language-server binaries) on first use; Zed downloads language servers and WASM extensions on first open of a language; JetBrains IDEs fetch plugins from Marketplace; Obsidian keeps community plugins out of the core install. — [VS Code extension marketplace docs](https://code.visualstudio.com/docs/editor/extension-marketplace); [Zed extensions docs](https://zed.dev/docs/extensions); [Obsidian community plugins](https://help.obsidian.md/Extending+Obsidian/Community+plugins)
- [K] Electron packs app code into an ASAR archive (faster reads on Windows, fewer files), supports V8 code cache and differential (blockmap) updates through electron-builder/NSIS; Tauri's updater downloads full signed bundles (small because the bundle is small). — [Electron ASAR docs](https://www.electronjs.org/docs/latest/tutorial/asar-archives); [electron-builder auto update](https://www.electron.build/auto-update); [Tauri updater plugin](https://v2.tauri.app/plugin/updater/)

### Inferences
- Recommended packaging shape: (1) base app = shell + CodeMirror + PDF engine + SQLite + a few grammars; (2) "Office pack" = pruned sdkjs + web-apps + x2t + a curated font set; (3) optional packs = Pandoc conversions (12 MB), extra dictionaries, language servers (each with or without a Node runtime), extra fonts. Each pack is a versioned, hash-pinned, signed archive unpacked into the app-data directory.
- Offer two installers to keep the local-first promise honest: a small "core" installer that fetches packs on first use, and a "full offline" installer with the office pack pre-seeded. A single user can also simply pre-download all packs once; after that the app is fully offline. Never fetch code from a CDN at runtime; only fetch immutable, checksummed packs.
- Size wins available without losing features, in rough order: drop mobile/embed UIs and unused locales; drop visio; de-duplicate Monaco; subset/curate fonts; keep WASM brotli-compressed on disk if decompression time is acceptable (must be measured; decompressing 36 MB costs CPU on every cold open unless the decompressed or compiled module is cached).
- Avoid second runtimes in the base app (JVM, Python, standalone Node). If a language server needs Node, either use Electron's built-in Node or make that server a pack that brings its own runtime.

### Gaps
- No measured data found on delta-update sizes for an app of this shape, or on brotli-decompress time for a 36 MB WASM in each webview.
- How Zed/VS Code handle pack integrity and offline fallback in detail was not re-read this session.

## 6. Runtime performance techniques for a multi-engine tabbed app

### Takeaway
The durable techniques are: paint a static shell before loading any engine; load each engine only when a tab of that type opens; compile WASM with the streaming API from a URL so the engine's optimised code is cached; keep heavy engines in their own frame/process and hibernate them under memory pressure; and keep parsing, indexing and file I/O off the UI thread.

### Cited Findings
- [S] V8 caches the optimised (TurboFan) native code of WASM modules so later loads skip compilation, but only for modules ≥128 kB, only when loaded via the streaming APIs (`WebAssembly.compileStreaming` / `instantiateStreaming`; the cache key is the module URL), and within a compiled-code cache budget of about 150 MB; functions that never tier up are recompiled by the baseline compiler on every start. — [V8: code caching for WebAssembly developers](https://v8.dev/blog/wasm-code-caching); [V8: wasm compilation pipeline](https://v8.dev/docs/wasm-compilation-pipeline)
- [S] V8 JS code caching: 20–40% less parse/compile time on warm loads. — [V8: improved code caching](https://v8.dev/blog/improved-code-caching)
- [S] Electron's official performance checklist warns against eager `require()` and loading/running code too soon; third-party guides call `require()` the single biggest Electron startup bottleneck. — [Electron performance tutorial](https://electronjs.org/docs/latest/tutorial/performance); [palette.dev](https://palette.dev/blog/improving-performance-of-electron-apps)
- [S] Chromium Site Isolation cost about 10–13% total memory overhead in real workloads (Chrome 67, desktop) because of the larger number of renderer processes; the process-model doc notes per-process overhead but gives no MB figure, and Chrome reuses processes once a limit is reached. — [Chromium: Site Isolation](https://www.chromium.org/Home/chromium-security/site-isolation); [Chromium process model doc](https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md)
- [S] WKWebView can terminate web content processes under memory pressure, with no documented way to adjust the threshold. — [Apple developer forums, WebKit tag](https://developer.apple.com/forums/tags/webkit?page=7)
- [S] Notion's WASM SQLite post: run SQLite in a worker, use the OPFS SyncAccessHandle Pool VFS (no COOP/COEP needed), and load the WASM asynchronously so it never blocks first paint. — [Notion: WASM SQLite](https://www.notion.com/blog/how-we-sped-up-notion-in-the-browser-with-wasm-sqlite)
- [M] `@embedpdf/pdfium` ships a worker-capable browser build; PDF.js ships its parser as a separate 1.21 MB worker file — both PDF engines are designed to keep parsing off the main thread. — [npm: @embedpdf/pdfium](https://www.npmjs.com/package/@embedpdf/pdfium); [npm: pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist)
- [K] Chromium throttles timers in background/hidden pages and can freeze or discard hidden tabs; Electron exposes `webContents.setBackgroundThrottling` and `backgroundThrottling` in `webPreferences`; hidden `WebContentsView`s keep their memory unless destroyed. — [Electron webContents docs](https://www.electronjs.org/docs/latest/api/web-contents); [Chrome: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [K] Text-buffer data structures: VS Code moved to a piece-tree buffer in 2018 for large-file memory and edit speed; CodeMirror 6 stores documents as a tree of line chunks and renders only the viewport; tree-sitter and Lezer parse incrementally. — [VS Code: text buffer reimplementation](https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation); [CodeMirror system guide](https://codemirror.net/docs/guide/)
- [K] `OffscreenCanvas` is available in Chromium, Firefox and Safari 16.4+, allowing canvas rendering in workers. — [MDN: OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

### Inferences
- Startup recipe: static HTML/CSS skeleton of the tab strip and last-session tab titles painted immediately; one bundled shell script with V8 code cache; restore only the *active* tab's engine; other tabs stay as placeholders until first activated.
- Tab-switch recipe: light tabs (text/code/Markdown/CSV) live in the single shell renderer and are kept alive (they cost little); PDF tabs keep the document handle but render only visible pages; office tabs live in their own frame/webview, are kept alive for the most-recently-used N (start with N=2–3), and beyond that are hibernated by serialising state (path, scroll/selection, unsaved changes flushed to a recovery file) and destroying the frame.
- Each isolated engine frame costs a renderer process; the per-process overhead is not published, so it must be measured, and it is the main reason not to put every tab in its own webview.
- WASM engines should be fetched from a stable app-protocol URL with `instantiateStreaming` so the compiled code is cached; whether WKWebView/WebKitGTK cache compiled WASM across launches was not established and should be assumed absent until measured (i.e. expect a recompile of a 36 MB x2t on every cold start there).
- Search/indexing (SQLite FTS) belongs in a worker or utility process; never on the UI thread.

### Gaps
- Per-renderer / per-OOPIF baseline memory in MB on current Chromium/Electron/WebView2: not found; measure.
- WASM compiled-code caching behaviour in WKWebView and WebKitGTK: not found.
- x2t.wasm instantiate time and conversion time for typical and large documents: not found.

## 7. Defensible budgets and how to measure them

### Takeaway
Use the long-standing human-factors thresholds (≈100 ms feels instant, 1 s keeps flow, 10 s loses attention; one frame = 16.7 ms at 60 Hz) as the outer frame, and editor typing-latency measurements as the bar for "no lag"; enforce them with automated startup timing, trace capture and bundle-size limits in CI.

### Cited Findings
- [K] RAIL model: respond to input within 100 ms (aim to process within 50 ms), produce each animation frame within 16 ms (≈10 ms of work), keep idle tasks under 50 ms, and be interactive within 5 s on slow devices; rooted in Nielsen's 0.1 s / 1 s / 10 s limits. — [web.dev: RAIL](https://web.dev/articles/rail); [NN/g: response time limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [K] Core Web Vitals "good" Interaction to Next Paint is ≤200 ms; long tasks are >50 ms. — [web.dev: INP](https://web.dev/articles/inp)
- [S] Measured end-to-end typing latency in Sublime Text and Xcode 9 of "around 42 ms" on one setup (keyboard-to-photon, includes keyboard and display); the author stresses that good latency measurement "is actually quite difficult". — [thume.ca: fixing my keyboard's latency](https://thume.ca/2017/12/29/fixing-my-keyboards-latency/); [thume.ca: latency tester](https://thume.ca/2020/05/20/making-a-latency-tester/)
- [S] Typometer (Pavel Fatin) is the standard software tool for editor typing latency; his "Typing with pleasure" study gives per-editor numbers (not retrievable this session). — [frarees/typometer](https://github.com/frarees/typometer); [Typing with pleasure](https://pavelfatin.com/typing-with-pleasure/) (host blocked; not read)
- [K] Dan Luu's measurements show whole-system keypress-to-display latency ranging from ≈30 ms on a 1983 Apple IIe to 100 ms+ on many modern machines, and terminal/editor software latency varying from a few ms to tens of ms. — [danluu.com/input-lag](https://danluu.com/input-lag/); [danluu.com/term-latency](https://danluu.com/term-latency/) (host blocked; not read)
- [S] Third-party editor figures (unverified, conflicting): Zed ≈2 ms vs VS Code ≈12–25 ms keystroke latency. — [dev.to Zed review](https://dev.to/pickuma/zed-editor-review-a-gpu-accelerated-code-editor-worth-switching-for-2hjk)
- [R] Elanis' empty-app release startup of ≈195 ms (Windows) / ≈431 ms (macOS) for Electron and ≈650 ms / ≈1933 ms for Tauri is the floor each shell starts from on CI hardware. — [Elanis comparison](https://github.com/Elanis/web-to-desktop-framework-comparison)
- [M] `size-limit` 14.3.0 is a 0.05 MB package with 2 dependencies, suitable as a CI bundle-size gate. — [npm: size-limit](https://www.npmjs.com/package/size-limit)
- [K] Measurement tooling: Electron `contentTracing` and `app.getAppMetrics()`; Playwright's Electron support and Chromium tracing (`browser.startTracing`); `hyperfine` for repeated cold-start timing; `performance.mark/measure` for in-app milestones; Tauri apps on Windows can be driven through WebView2's remote-debugging port (CDP) and tauri-driver/WebDriver. — [Electron contentTracing](https://www.electronjs.org/docs/latest/api/content-tracing); [Playwright Electron](https://playwright.dev/docs/api/class-electron); [hyperfine](https://github.com/sharkdp/hyperfine); [Tauri WebDriver testing](https://v2.tauri.app/develop/tests/webdriver/)

### Inferences
- Proposed budget table (targets to be confirmed by the spikes in section 10; these are my proposals derived from the thresholds and measurements above, not published standards):

  | Item | Budget | Basis |
  |---|---|---|
  | Cold launch to visible shell (skeleton + tabs) | ≤ 500 ms; hard limit 1 s | Empty Electron ≈200–430 ms (Elanis); 1 s flow limit |
  | Cold launch to active light tab editable | ≤ 1 s | 1 s limit; CodeMirror bundle 0.12–0.22 MB gzip |
  | Switch to a kept-alive tab | ≤ 50 ms (≤ 3 frames) | "instant" needs well under 100 ms |
  | Switch to a hibernated light/PDF tab | ≤ 300 ms | under 1 s, with content visible at first paint |
  | First office document open (pack installed, cold engine) | ≤ 3 s with progress shown after 300 ms | unmeasured; honesty requires a spike |
  | Reopen/switch to hibernated office tab | ≤ 1.5 s | warm caches |
  | Keystroke to paint (software part), text/code | p95 ≤ 16 ms, max ≤ 33 ms | one to two 60 Hz frames |
  | Keystroke to paint, office editor | p95 ≤ 33 ms | canvas-rendered engine |
  | Scroll/zoom | 60 fps, no frame > 33 ms | RAIL |
  | Main-thread long tasks while interacting | none > 50 ms | RAIL / long-task definition |
  | Idle memory, shell + one text tab | ≤ 250 MB (Electron) / ≤ 150 MB (Tauri macOS) | Elanis empty app ≈279–370 MB Electron, ≈96 MB Tauri macOS |
  | Extra memory per light tab | ≤ 15 MB | same renderer, no new process |
  | Extra memory per PDF tab | ≤ 80 MB | estimate; measure |
  | Extra memory per live office tab | ≤ 400 MB, max 2–3 live | sibling-note estimate 150–400 MB; measure |
  | Base installer (system-webview shell) | ≤ 15 MB | Tauri 3–5 MB + ≈5 MB engines |
  | Base installer (Electron shell) | ≤ 120 MB | Electron runtime dominates; exact zip size not found |
  | Office pack download / on disk | ≤ 80 MB / ≤ 250 MB (plus fonts) | measured 93–103 MB / 363 MB unpruned |
  | PDF engine in base | ≤ 3 MB compressed | PDF.js ≈2.6 MB gzip; PDFium ≈2.1 MB gzip |
  | Pandoc pack | ≈12–16 MB download / 56 MB on disk | measured |
  | Language-server pack (each) | 3–100 MB, optional | measured/estimated above |

- CI gates worth automating: (a) `hyperfine`-style 10x cold start to a "shell-ready" marker; (b) a Playwright script that opens one file per type and records `performance.measure` milestones plus a trace; (c) size-limit on the shell bundle and each engine chunk; (d) installer and pack artefact size checks with a fail threshold; (e) a memory snapshot after opening N tabs.

### Gaps
- Dan Luu's and Pavel Fatin's exact per-editor numbers could not be re-read (hosts blocked); cite the pages, not specific values, unless re-verified.
- No published per-tab memory budgets from comparable apps were found.

## 8. Dependency hygiene for a solo developer

### Takeaway
2025–2026 saw repeated self-propagating npm compromises, so the design should minimise install-time code execution and dependency count, pin and vendor what ships, and prefer built-in or WASM components over native Node modules.

### Cited Findings
- [S] September 2025: a maintainer was phished and malicious versions of about 18 packages including `chalk` (≈300M weekly downloads) and `debug` (≈358M) were published; the follow-on "Shai-Hulud" worm self-propagated to 187 packages. — [Sonatype](https://www.sonatype.com/blog/npm-chalk-and-debug-packages-hit-in-software-supply-chain-attack); [BleepingComputer](https://www.bleepingcomputer.com/news/security/self-propagating-supply-chain-attack-hits-187-npm-packages/amp/); [Wiz](https://wiz.io/blog/widespread-npm-supply-chain-attack-breaking-down-impact-scope-across-debug-chalk)
- [S] "Shai-Hulud 2.0" exposed secrets across 25K+ repositories. — [Wiz: Shai-Hulud 2.0](https://www.wiz.io/ja-jp/authors/gal-benmocha)
- [S] 2026 (Unit 42 tracking): new waves on 22 April ("The Third Coming") and 29 April ("Mini Shai-Hulud"); in May a campaign across npm and PyPI entered via TanStack's GitHub Actions pipeline; the worm's source was published and a copycat appeared within five days; on 1 June at least 32 `@redhat-cloud-services` packages were compromised ("Miasma"); on 14 July four AsyncAPI release pipelines were compromised. The 2026 waves were mostly CI-pipeline and token compromises rather than phishing. — [Unit 42: monitoring npm supply chain attacks](https://unit42.paloaltonetworks.com/monitoring-npm-supply-chain-attacks/); [The Register, 2026-05-18](https://www.theregister.com/cyber-crime/2026/05/18/shai-hulud-copycat-hits-another-npm-package/5242180)
- [M] Dependency counts of candidate components (direct `dependencies`): pdfjs-dist 0; @embedpdf/pdfium 0; @sqlite.org/sqlite-wasm 0; web-tree-sitter 0; @tauri-apps/api 0; esbuild 0; monaco-editor 2; `codemirror` 7 (the transitive count for a full CM6 install was not tallied); the ONLYOFFICE-family packages 0 (pre-built static assets). — [npm: pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist); [npm: codemirror](https://www.npmjs.com/package/codemirror); [npm: monaco-editor](https://www.npmjs.com/package/monaco-editor)
- [M] Native modules are the heavy, fragile ones: better-sqlite3 26.5 MB unpacked, node-pty 61.4 MB unpacked; both compile against the Electron ABI. — [npm: better-sqlite3](https://www.npmjs.com/package/better-sqlite3); [npm: node-pty](https://www.npmjs.com/package/node-pty)
- [S] Electron 45 bundles Node v24.22.0. [K] Node has shipped a built-in `node:sqlite` module since v22.5 (no flag needed from 22.13/23.4), which would remove the need for better-sqlite3; whether it is enabled in Electron 45's main/utility process was **not confirmed** by any source found. — [Electron 45 blog](https://www.electronjs.org/blog/electron-45-0); [Node.js sqlite docs](https://nodejs.org/api/sqlite.html)
- [K] Hygiene controls: commit the lockfile and install with `npm ci`; disable lifecycle scripts by default (`ignore-scripts=true`, allow-list the few that need them); delay adoption of freshly published versions (pnpm `minimumReleaseAge`, npm `min-release-age`/`--before`); pin exact versions; vendor pre-built engine assets with recorded SHA-256. — [npm config: ignore-scripts](https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts); [pnpm settings: minimumReleaseAge](https://pnpm.io/settings#minimumreleaseage)

### Inferences
- The engines themselves are low-risk from a dependency-graph point of view (zero runtime deps, static assets). The risk concentrates in build tooling and UI-framework dependencies; keep the shell framework-light (few hundred transitive packages at most, ideally tens) and bundle with esbuild/Vite.
- Vendor the office engine as a checksum-pinned artefact built once (the reference build takes about an hour and pins toolchain versions), not as a floating npm dependency. The `@kreijstal/eurooffice*` packages ship `SHA256SUMS` and a reproducible build script, which is the right model even if a different build is used.
- For the store/index layer prefer, in order: `node:sqlite` if confirmed available in the chosen Electron; SQLite WASM in a worker (0.39 MB gzip, no native build); in Tauri, rusqlite in the Rust core. Avoid node-pty unless an integrated terminal is truly in scope.
- In a Tauri build the dependency surface moves to Cargo (hundreds of crates is typical); the same pin/audit discipline applies (`cargo-deny`, `cargo-audit`, `Cargo.lock`). [K] — [cargo-deny](https://github.com/EmbarkStudios/cargo-deny)

### Gaps
- Confirmation that `require('node:sqlite')` works in Electron 45 main and utility processes (and with FTS5 compiled in): not found; a five-minute test.
- A consolidated, authoritative count of 2026 npm incidents; figures above are per-vendor reports.

## 9. The central tension: "full Word/Excel/PowerPoint" versus "small and fast"

### Takeaway
A two-tier design is credible and is what the numbers point to: the light tier (text, code, Markdown, CSV, PDF) costs a few MB and can meet strict latency budgets in one renderer, while credible Office-format *editing* has no small implementation — the smallest full-parity web engine measured is ≈60–100 MB compressed and hundreds of MB of RAM, so it should be an on-demand pack in an isolated frame.

### Cited Findings
- [M] Light tier engine sizes: CodeMirror 6 with six languages 0.22 MB gzip; PDF.js complete ≈2.6 MB gzip or PDFium ≈2.1 MB gzip; SQLite WASM 0.39 MB gzip; tree-sitter runtime 0.08 MB gzip + ≈0.1 MB compressed per typical grammar. — [npm: codemirror](https://www.npmjs.com/package/codemirror); [npm: pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist); [npm: @embedpdf/pdfium](https://www.npmjs.com/package/@embedpdf/pdfium)
- [M] Heavy tier: one office editor's minimum load set is roughly its sdkjs (20–22 MB raw) + shared `sdkjs/common` (≈48 MB raw without x2t; 84 MB with) + its web-apps UI (≈20–31 MB raw `main`) — i.e. on the order of 90–135 MB of JS/WASM/assets on disk per editor family member before fonts, and 363 MB for all editors unpruned. — [npm: sdkjs-common](https://www.npmjs.com/package/@kreijstal/eurooffice-sdkjs-common); [web-apps-2](https://www.npmjs.com/package/@kreijstal/eurooffice-web-apps-2)
- [M] The server-based alternative is far heavier: Document Server image ≈900 MB compressed. — [Docker Hub: onlyoffice/documentserver](https://hub.docker.com/r/onlyoffice/documentserver/tags)
- [K] Alternatives at the heavy end are no smaller: LibreOffice ≈300–600 MB installed; ZetaOffice WASM ≈47 MB download. — [SFSCON 2024 slides](https://sfscon.it/wp-content/uploads/2024/11/17307577791742024-11-08-Moritz-Duge-Allotropia-LibreOffice-JavaScript-WebWidget-SFSCON-2024.pdf)
- [M] Format conversion as a lighter route to "viewer level" is not free either: pandoc.wasm is 55.9 MB raw / 12.2 MB brotli. — [npm: pandoc-wasm](https://www.npmjs.com/package/pandoc-wasm)

### Inferences
- Smallest credible footprint by level (compressed download; estimates built from the measured parts above and from sibling notes on lightweight libraries, so treat the viewer/everyday rows as planning ranges, not measurements):

  | Family | (a) Viewer | (b) Everyday editing | (c) Full parity |
  |---|---|---|---|
  | Text / code / Markdown / CSV | <0.5 MB | 0.2–1 MB (CodeMirror + grammars) | 5–6 MB (Monaco + workers) plus language servers 3–100 MB each |
  | PDF | 2–3 MB (PDF.js or PDFium) | 3–6 MB (PDFium + annotation/forms layer, or PDF.js + pdf-lib) | no small option; full editing = office-class engine |
  | .docx | ≈1–2 MB (HTML-conversion viewers; lossy) | no credible small engine with round-trip fidelity | ≈35–45 MB pruned ONLYOFFICE word + common + x2t, plus fonts |
  | .xlsx | ≈1–3 MB (grid + parser; lossy) | 3–10 MB grid engines, with fidelity/licensing caveats (see spreadsheet notes) | same pack as above, +≈11 MB for cell |
  | .pptx | ≈2–5 MB (render-only; lossy) | none credible | same pack, +≈9 MB for slide |

- The honest statement for the owner: "small and fast" and "full Office parity" cannot both hold for the *same bytes*. They can both hold for the *same app* if (1) the office engine is not in the base install or the startup path, (2) it runs in its own frame so its memory and jank cannot affect light tabs, (3) at most 2–3 office tabs are live at once, and (4) the first open of an office file is allowed a visible multi-second load.
- A cheap, fast "preview first" path is worth considering for office files: show a quick read-only rendering (or the last cached PDF/thumbnail) immediately, and swap in the full editor when it finishes loading. This protects the "instant" feel without pretending the engine is light.

### Gaps
- Real memory use and time-to-interactive of the ONLYOFFICE editors in each webview: not found; this is the single most important missing measurement.
- Sizes of lightweight docx/xlsx/pptx viewer libraries were not measured in this pass (covered qualitatively in sibling notes).

## 10. Bottom line: shell choice by scenario, and the spikes needed

### Takeaway
On the evidence found, Windows-only favours Tauri v2 on WebView2 (Chromium engine, no bundled runtime, base app in the low tens of MB); cross-platform including Linux favours staying on Electron (identical engine everywhere, working print-to-PDF, bundled Node); macOS-only is a genuine toss-up that only a WKWebView spike of the office engine can settle. In every scenario the office engine should be an on-demand pack, which matters more for size and speed than the shell choice does.

### Cited Findings
- [S] WebView2 is part of Windows 11 and present on nearly all Windows 10; binaries are hard-linked with Edge. — [WebView2 distribution](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution); [Evergreen vs fixed](https://learn.microsoft.com/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)
- [R] Tauri/Wry has no merged print-to-PDF API (draft PRs only, since 2024). — [wry PR #1317](https://github.com/tauri-apps/wry/pull/1317)
- [S] Tauri documents silent slow-path canvas/WebGL and blank-window failures on WebKitGTK, mainly with NVIDIA. — [Tauri: Linux graphics issues](https://v2.tauri.app/develop/debug/linux-graphics/)
- [R] Empty-app release numbers: Tauri 3–5 MB vs Electron 268–373 MB on disk; Electron starts faster (195/431/191 ms vs 650/1933 ms on Windows/macOS); Tauri uses less memory on macOS/Linux (≈95 MB vs ≈370–596 MB) but not on Windows (≈312 vs ≈279 MB). — [Elanis comparison](https://github.com/Elanis/web-to-desktop-framework-comparison)
- [S] Electrobun's size claim collapsed in an independent test when Chromium had to be bundled (418 MB); Wails v3 only reached beta in August 2026. — [Better Stack comparison](https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/); [Wails changelog](https://docs-preview.wails.io/changelog/)
- [M] Office engine ≈93–103 MB compressed / 363 MB on disk unpruned; base editing engines ≈3–6 MB compressed. — [npm: @kreijstal/eurooffice](https://www.npmjs.com/package/@kreijstal/eurooffice); [npm: pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist)

### Inferences
- Scenario recommendations:

  | Scenario | Recommended shell | Why | Main risk to retire |
  |---|---|---|---|
  | Windows-only | Tauri v2 (WebView2) | Chromium-equivalent engine already on the machine; base installer ≈10–15 MB instead of ≈100 MB+; lowest dependency weight in the shipped product | No built-in print-to-PDF (call WebView2 `PrintToPdf` via custom Rust, or export via the engines); Node-based language servers need a separate runtime; Rust becomes a required skill; Elanis shows no memory win on Windows |
  | macOS-only | Undecided: Tauri v2 (WKWebView) if the office spike passes, otherwise Electron | Tauri gives ≈5 MB shell and ≈4x lower empty-app memory; but ONLYOFFICE on WKWebView is unproven and the vendor ships Chromium | ONLYOFFICE rendering/IME/clipboard/fonts in WKWebView; WASM compile caching; cross-origin isolation under a custom scheme; WebKit version tied to macOS version |
  | Cross-platform incl. Linux | Electron (current major, 45) | One engine everywhere; avoids WebKitGTK; `webContents.printToPDF`; built-in Node for sidecars and `node:sqlite` (to confirm) | ≈270–370 MB on disk and ≈280–600 MB empty-app memory; must hold the line on startup discipline |

- If the OS decision stays open, a reasonable hedge is to keep the shell thin and web-standard (all engines loaded as static assets over an app protocol, all native calls behind one small IPC interface with about a dozen commands) so the shell can be swapped between Electron and Tauri later with limited rework.
- "Does not drag in huge dependencies" is best satisfied by packaging, not by the shell: with Electron the fixed cost is one ≈100 MB-class runtime; with either shell the office pack is the largest item and is optional.

- Spike measurements needed before committing (each is small and decisive):
  1. **Office engine in each candidate webview**: load the pruned sdkjs/web-apps + x2t build in Electron 45, Tauri/WebView2, Tauri/WKWebView (and WebKitGTK if Linux is in scope). Record time from tab open to editable for a 1-page and a 100-page .docx, a 50k-cell .xlsx and a 40-slide .pptx; private memory of the frame's process after load and after 5 minutes of editing; typing latency; save (x2t) time. Check IME, clipboard, fonts, printing.
  2. **Cold start**: empty shell to first paint and to "active text tab editable", 10 runs each after reboot and warm, per shell, on the owner's actual machine (not CI).
  3. **Per-tab memory**: incremental memory for 1/5/20 text tabs (single renderer), 1/5 PDF tabs, 1/2/3 office frames; and the baseline cost of one extra empty isolated frame/process.
  4. **WASM caching**: x2t and PDFium instantiate time cold vs warm in each webview; confirm whether compiled code is cached across app restarts; compare raw vs brotli-on-disk load.
  5. **Hibernate/restore**: time to destroy and restore an office tab with unsaved changes preserved; decide the live-tab cap.
  6. **Pack pipeline**: build the pruned office pack, record raw/compressed sizes with and without fonts; test first-use download, checksum verification, and fully offline start afterwards.
  7. **Print/PDF export** in the chosen shell (WebView2 `PrintToPdf` from Rust, or engine-side export).
  8. **`node:sqlite` in Electron 45** (main and utility process, FTS5 available) versus SQLite WASM in a worker: open time and query latency on a realistic index.
  9. **Typing latency** with Typometer in the text editor and the office editor, compared with a native baseline editor on the same machine.

### Gaps
- No evidence found of anyone shipping ONLYOFFICE sdkjs inside WKWebView or WebKitGTK in production; the macOS and Linux Tauri recommendations therefore rest on spikes, not precedent.
- Electron installer size for the current major and VS Code / ONLYOFFICE Desktop / Zed / Obsidian installer sizes remain unverified this session (hosts blocked); they should be filled in from the release pages before the budget table is finalised.
- The target OS is undecided; the recommendation flips on that single decision.
