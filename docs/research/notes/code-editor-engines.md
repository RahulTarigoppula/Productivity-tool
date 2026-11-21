# Code/Text Editor Engine for a "VS Code-level" Editing Experience (state as of 2026-11-21)

Claim tags used throughout:
- **[READ]** = I fetched the primary page/registry record on 2026-11-21 and read it.
- **[SEARCH]** = seen only in a search-result summary; not opened. Treat as unverified.
- **[BG]** = background knowledge (training data up to mid-2026), not re-verified in this session. URL given is where to verify.

Access caveat: `codemirror.net`, `theia-ide.org`, `sourcegraph.com` and `cdn.vsassets.io` are outside this session's network allowlist, and the GitHub API was not available (GitHub HTML pages were). So CodeMirror reference docs, Theia docs, the Sourcegraph migration post and the Marketplace Terms PDF could NOT be read directly; claims depending on them are tagged [BG] or [SEARCH]. Version numbers and dates come from the npm registry JSON (`https://registry.npmjs.org/<pkg>`), read directly.

Version snapshot (all [READ] from npm registry, 2026-11-21):

| Package | Latest | Published | Licence | Notes |
|---|---|---|---|---|
| monaco-editor | 0.57.0 | 2026-09-24 | MIT | `next` = 0.58.0-rc.2; npm unpacked size 101.7 MB (all builds, not bundle size) |
| @codemirror/view | 6.43.15 | 2026-10-19 | MIT | 6 patch releases Aug-Oct 2026 |
| @codemirror/state | 6.7.6 | 2026-09-22 | MIT | |
| @codemirror/lsp-client | 6.3.1 | 2026-11-16 | MIT | first published 2025-07-02 |
| @codemirror/merge | 6.12.3 | 2026-10-19 | MIT | |
| @codemirror/search | 6.7.2 | 2026-08-31 | MIT | |
| @codemirror/language-data | 6.5.2 | 2025-10-23 | MIT | |
| @codemirror/legacy-modes | 6.5.5 | 2026-10-07 | MIT | |
| @replit/codemirror-minimap | 0.5.2 | 2023-12-12 | MIT | no release in ~3 years |
| @codingame/monaco-vscode-api | 40.0.0 | 2026-11-20 | MIT | unpacked 58.6 MB; first published 2022-06-03 |
| monaco-languageclient | 11.0.3 | 2026-10-15 | MIT | |
| @typefox/monaco-editor-react | 8.0.3 | 2026-10-15 | MIT | |
| vscode-languageclient | 11.0.0 | 2026-10-22 | MIT | |
| @theia/core | 1.77.0 | 2026-11-05 | EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0 | `next` 1.78.0-next.36 |
| code-server | 4.146.0 | 2026-11-20 | MIT | unpacked 216 MB |
| @vscode/test-web | 0.0.81 | 2026-06-23 | MIT | |
| ace-builds | 1.45.2 | 2026-10-21 | BSD-3-Clause | |
| @shikijs/monaco | 4.6.0 | 2026-11-02 | MIT | TextMate-grammar highlighting for plain Monaco |

---

## 1. Monaco Editor (microsoft/monaco-editor)

### Takeaway
Monaco is the actual VS Code text-editor core (MIT), at 0.57.0 (2026-09-24) with 0.58 in RC; it gives VS Code's editing surface (multi-cursor, minimap, find/replace, folding, diff, in-editor command palette, TS/JS/JSON/CSS/HTML language workers) out of the box, and since 0.55/0.56 it also ships a native LSP client API. It still does NOT give TextMate grammars, VS Code themes, extensions, or any workbench (explorer, cross-file search, terminal, git, settings UI) - those are the gap that monaco-vscode-api or your own code must fill.

### Cited Findings
- **Version and cadence.** [READ] Stable releases: 0.53.0 (2025-09-08), 0.54.0 (2025-10-06), 0.55.0 and 0.55.1 (2025-11-20), 0.56.0 (2026-07-20), 0.57.0 (2026-09-24); dist-tag `next` = 0.58.0-rc.2. So there was a monthly burst in autumn 2025, then an 8-month gap, then releases roughly every two months. Cadence is irregular. - [npm registry](https://registry.npmjs.org/monaco-editor)
- [READ] "Its version is not tied to VS Code's version"; Monaco is "generated from VS Code's sources" with shims for services needed outside VS Code. Repo shows ~47.0k stars. - [microsoft/monaco-editor README](https://github.com/microsoft/monaco-editor)
- **ESM / bundler status.** [READ] 0.53.0: "This release deprecates the AMD build"; AMD still ships but "we don't offer support for it anymore. Please migrate to the ESM build"; the plain browser-script scenario no longer works and "the ESM build should be used with a bundler, such as vite or webpack". - [CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md)
- [READ] 0.56.0 (breaking): "Reorganizes the exported ESM modules to provide supported, tree-shakeable entry points"; `monaco-editor/editor` is the base import and features/languages are opted into via paths such as `monaco-editor/features/register.all`. - [CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md)
- [READ] 0.55.0 (breaking): nested namespaces (`languages.css`, `languages.html`, `languages.json`, `languages.typescript`) moved to top level. 0.55.1 fixed missing language exports caused by a wrong "types" path. So 0.53-0.56 was a run of breaking packaging changes. - [CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md)
- **LSP client NOW ships (changes the earlier assumption).** [READ] 0.55.0: "Adds native LSP support (see new `lsp` namespace)." 0.56.0: "Exposes typed native LSP client and transport APIs" and "Treats Markdown returned by language servers as untrusted". - [CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md)
- **Other recent features.** [READ] 0.53: Next Edit Suggestion support, Edit Context support; 0.56: `advanced-external` and `advanced-wasm` diff algorithms; 0.57: `editor.wordWrapIndicator`, `editor.fullwidthCharacterWidth`, core moved to a newer VS Code commit; 0.58 (RC): markdown in hovers no longer loads remote images by default (`markdownImages.allowedOrigins`), bundles the `@vscode/diff` backend, fixes memory leaks in word highlighter and colour picker. - [CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md)
- **What does NOT ship.** [READ] VS Code extensions "won't work in a browser" with Monaco, except possibly a fully LSP-based extension whose server is JavaScript. TextMate grammars are not supported directly; README points to `bolinfest/monaco-tm` (monaco-editor + vscode-oniguruma + vscode-textmate). - [README FAQ](https://github.com/microsoft/monaco-editor)
- [READ] Mobile: "not supported in mobile browsers or mobile web app frameworks" (irrelevant for an Electron desktop app). - [README](https://github.com/microsoft/monaco-editor)
- [READ] Language services use web workers and will not start from `file://` pages; must be served over http(s) (in Electron: use a custom protocol or local dev server, not `file://`). - [README](https://github.com/microsoft/monaco-editor)
- [READ] Licence MIT. - [README](https://github.com/microsoft/monaco-editor)
- **Built-in editing features.** [BG] Multi-cursor and column selection, minimap, find/replace with regex and preserve-case, folding, bracket-pair colourisation, sticky scroll, inlay hints, code lens, side-by-side and inline diff editor, an in-editor F1 "command palette" (editor actions only, not app commands), IntelliSense for TypeScript/JavaScript, JSON (with schema), CSS/SCSS/LESS and HTML via bundled web workers, and Monarch tokenisers for ~80 "basic languages" (colourisation only, no semantic features). - [Monaco site/playground](https://microsoft.github.io/monaco-editor/)
- **Not shipped (workbench).** [BG] No file explorer, tabs, search-across-files, terminal, SCM/git, settings UI, keybinding editor, extension host, or VS Code theme loader (themes are a simplified `defineTheme` rule list). - [Monaco docs](https://microsoft.github.io/monaco-editor/docs.html)
- **TextMate without the full VS Code stack.** [READ] `@shikijs/monaco` 4.6.0 (2026-11-02, MIT) exists and is actively released; [BG] it lets Shiki (TextMate grammars + VS Code themes) drive Monaco tokenisation without monaco-vscode-api. - [npm registry](https://registry.npmjs.org/@shikijs/monaco)
- **Bundle size.** [SEARCH] Replit reported monaco-editor and related libraries contributing "51.17 MB to our bundle size (5.01 MB when parsed + gzipped)"; other aggregator posts quote "~5MB" or "~1MB" - figures disagree and depend on which languages/workers are included. - [Replit, "Betting on CodeMirror"](https://replit.com/blog/codemirror) (search summary); [pkgpulse guide](https://www.pkgpulse.com/guides/monaco-editor-vs-codemirror-6-vs-sandpack-in-browser-2026) (search summary)
- **Large files.** [BG] Monaco uses VS Code's piece-tree text buffer and viewport-only rendering; models above ~20 MB or ~300k lines get "large file optimizations" (tokenisation, folding, wrapping etc. disabled) and VS Code itself refuses/warns above its `workbench.editorLargeFileConfirmation` threshold. I could not confirm these thresholds from a primary source in this session. - [VS Code text buffer blog](https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation)
- **Accessibility.** [BG] Monaco inherits VS Code's screen-reader mode, accessible diff viewer and high-contrast themes; this is its main advantage over hand-built editors. - [VS Code accessibility docs](https://code.visualstudio.com/docs/editor/accessibility)

### Inferences
- The 2025-2026 changelog shows Microsoft investing again in standalone Monaco (ESM tree-shaking, native LSP, Vite-friendly packaging). For a Vite-built Electron renderer, 0.56+ is the first line where plain Monaco is a clean ESM dependency; pin a version and expect breaking packaging changes between minors (0.x semantics).
- "Monaco has no LSP client" is no longer true as of 0.55 (Nov 2025). How complete the native `lsp` namespace is versus `vscode-languageclient` is unverified (see Gaps).
- For an Electron app, bundle size is a disk/startup concern, not a network one; the 5 MB gzipped figure is tolerable. The real cost of Monaco is not size but that it is a monolith: hard to restyle deeply, global singletons (services, themes, keybindings shared across all editor instances in the page).
- Plain Monaco delivers "VS Code-level" feel for editing but NOT VS Code's language breadth: Monarch grammars are coarser than TextMate, and only 4 language families get real IntelliSense without adding LSP servers.

### Gaps
- Exact capability list of Monaco's native `lsp` namespace (which LSP features are wired) - not read; check the 0.55/0.56 release notes and playground samples.
- Authoritative, current bundle-size measurements for Monaco 0.57 with tree-shaken ESM entry points - none found; must be measured in a spike.
- Monaco large-file thresholds were not verified against source.

---

## 2. CodeMirror 6

### Takeaway
CodeMirror 6 is healthy and fast-moving (core packages patched every few weeks through Oct-Nov 2026), now has an official MIT LSP client (`@codemirror/lsp-client` 6.3.1, 2026-11-16), an official merge/diff package, and built-in multi-cursor; but it is a toolkit, not a product: minimap is third-party and stale, there is no built-in command palette or IntelliSense for any language, and development has moved off GitHub to the author's own forge.

### Cited Findings
- **Current state.** [READ] `@codemirror/view` 6.43.15 (2026-10-19), with releases on 2026-08-31, 09-03, 09-15, 09-22, 10-07, 10-19; `@codemirror/state` 6.7.6 (2026-09-22). All MIT. - [npm @codemirror/view](https://registry.npmjs.org/@codemirror/view); [npm @codemirror/state](https://registry.npmjs.org/@codemirror/state)
- **Repo moved off GitHub.** [READ] The GitHub repo `codemirror/lsp-client` is archived/read-only and its README says it "has moved to" `code.haverbeke.berlin/codemirror/lsp-client`. - [github.com/codemirror/lsp-client](https://github.com/codemirror/lsp-client). [BG] The whole CodeMirror/Lezer/ProseMirror family moved to Marijn Haverbeke's self-hosted forge; issues/PR workflows differ from GitHub. - [code.haverbeke.berlin](https://code.haverbeke.berlin/codemirror)
- **Official LSP client.** [READ] `@codemirror/lsp-client`: first published 2025-07-02; releases 6.2.2 (2026-03-02), 6.2.3 (04-15), 6.2.4 (05-15), 6.2.5 (06-09), 6.3.0 (09-17), 6.3.1 (11-16). MIT. - [npm registry](https://registry.npmjs.org/@codemirror/lsp-client)
- [READ] README: "a language server protocol (LSP) client for the CodeMirror code editor"; API is `LSPClient` (takes `extensions`, has `connect(transport)` and `plugin(uri)`), `languageServerExtensions()`, and a `Transport` interface with `send(message)`, `subscribe(handler)`, `unsubscribe(handler)`. The server can run server-side proxied over WebSocket, or in the client if written in JS / compiled to WASM. Connection and reconnect handling is the transport author's responsibility. - [codemirror/lsp-client README](https://github.com/codemirror/lsp-client)
- [BG] `languageServerExtensions()` bundles: completion, hover tooltips, signature help, diagnostics, go-to-definition/declaration/type/implementation, find references, rename, format document; there is a `Workspace` abstraction for mapping files to editors that you subclass for multi-file projects. Not provided: code actions/quick-fix UI, semantic tokens, inlay hints, code lens, workspace symbols, call hierarchy (must be hand-built). Could not re-verify because codemirror.net is blocked. - [reference docs](https://codemirror.net/docs/ref/#lsp-client)
- **Merge/diff.** [READ] `@codemirror/merge` 6.12.3 (2026-10-19), regularly released (6.12.0 Feb 2026 to 6.12.3 Oct 2026). [BG] Provides side-by-side `MergeView` and `unifiedMergeView` with accept/reject chunks. - [npm registry](https://registry.npmjs.org/@codemirror/merge)
- **Search.** [READ] `@codemirror/search` 6.7.2 (2026-08-31), with minors 6.6.0 (Jan 2026) and 6.7.0 (Apr 2026). [BG] Search panel with regex, case, whole-word, replace/replace-all, select-next-occurrence. - [npm registry](https://registry.npmjs.org/@codemirror/search)
- **Multi-cursor.** [BG] Core supports multiple selections (`EditorState.allowMultipleSelections`), `rectangularSelection()`, `crosshairCursor()`, and select-next-occurrence (Mod-d) in the default keymaps. - [reference docs](https://codemirror.net/docs/ref/)
- **Minimap.** [READ] `@replit/codemirror-minimap` latest 0.5.2, published 2023-12-12 - no release for almost three years. No official minimap package exists. - [npm registry](https://registry.npmjs.org/@replit/codemirror-minimap)
- **Language coverage.** [READ] `@codemirror/language-data` 6.5.2 (2025-10-23) is the language-metadata/lazy-loading index; `@codemirror/legacy-modes` 6.5.5 (2026-10-07) holds ported CodeMirror 5 stream modes (1.96 MB unpacked). - [npm language-data](https://registry.npmjs.org/@codemirror/language-data); [npm legacy-modes](https://registry.npmjs.org/@codemirror/legacy-modes)
- [BG] First-class Lezer grammar packages (`@codemirror/lang-*`): JavaScript/TypeScript/JSX, HTML, CSS, JSON, Markdown, Python, Rust, C++, Java, PHP, SQL, XML, YAML, Go, Sass, Less, Vue, Angular, Liquid, WAST, Jinja. Roughly 100 further languages (TOML, INI/properties, shell, Dockerfile, Ruby, C#, Kotlin, Swift, Lua, Perl, PowerShell, diff, nginx, etc.) are covered only by the regex-style legacy stream modes: highlighting works, but no syntax tree, so folding/indent/structural selection are weaker. - [codemirror.net](https://codemirror.net/)
- **Large files.** [SEARCH] The official "huge document" example loads "a document of a few million lines"; "highlighting stops at some point if you scroll down far enough". Forum threads note background parsing of big documents is deliberately paused/limited. - [codemirror.net/examples/million](https://codemirror.net/examples/million/) (search summary); [discuss.codemirror.net](https://discuss.codemirror.net/t/syntax-highlighting-disappears-if-large-documents-are-scrolled-fast/5569) (search summary)
- **Monaco-to-CM6 migrations.** [SEARCH] Sourcegraph ("Migrating from Monaco Editor to CodeMirror") and Replit ("Betting on CodeMirror") both moved from Monaco to CM6, citing bundle size, customisability and performance. - [Sourcegraph](https://sourcegraph.com/blog/migrating-monaco-codemirror) (blocked; search summary only); [Replit](https://replit.com/blog/codemirror) (search summary). [BG] Both posts date from 2022, and both products are web apps where download size and mobile mattered - conditions that do not apply to a local Electron app.
- **Who uses it.** [BG] Obsidian (editor core), Replit, Chrome DevTools and Firefox DevTools, Sourcegraph, Overleaf, JupyterLab 4. - [codemirror.net](https://codemirror.net/)
- **Licence.** [READ] MIT for every @codemirror package checked. - [npm registry](https://registry.npmjs.org/@codemirror/view)

### Inferences
- CM6 covers Markdown and prose far better than Monaco (decorations, widgets, live-preview à la Obsidian, soft-wrap quality, line-height variance), which is why the earlier plan picked it. For "VS Code-level" code editing it reaches maybe 70-80% of the in-editor feel, and each remaining item (minimap, command palette, code-action lightbulb, peek view, sticky scroll, breadcrumbs, semantic highlighting, inlay hints) is separate build work.
- The official LSP client removes the biggest historic gap; in Electron the transport is trivial (IPC/MessagePort from renderer to a main/utility process that spawns the server over stdio).
- Single-maintainer bus factor is the main structural risk; mitigated by MIT licence, wide adoption and a very stable API (6.x since 2022 with no breaking major).
- TextMate grammars can be bridged to CM6 highlighting by community packages, but I found no evidence in this session of an official or clearly maintained one.

### Gaps
- Could not read codemirror.net reference to confirm the exact export list of `@codemirror/lsp-client` 6.3.x (what 6.3.0 added) - blocked host.
- No trustworthy 2025-2026 head-to-head benchmark of CM6 vs Monaco on large files was found; the available comparisons are aggregator blogs with inconsistent numbers.
- Maintenance state of community CM6 minimap alternatives and TextMate/Shiki bridges not checked.

---

## 3. "Monaco + real VS Code services": @codingame/monaco-vscode-api and monaco-languageclient

### Takeaway
monaco-vscode-api (MIT, v40.0.0 released 2026-11-20, tracking VS Code 1.145.x) re-packages VS Code's real service layer as ~60 opt-in npm "service overrides", up to and including the full workbench, a web-worker extension host, and a remote (Node) extension host via a matching VS Code server. It is actively maintained and the only way to get TextMate grammars, real themes, settings/keybindings JSON and real extensions without embedding VS Code whole - but it ships a new breaking major roughly monthly, has global one-shot initialisation that cannot be undone, and is carried largely by one company.

### Cited Findings
- **What it is.** [READ] "VSCode public API plugged on the monaco editor"; it "allows to integrate full VSCode functionality into your `monaco-editor`". Monaco normally uses simplified "standalone" services; this library lets you override them with the full VS Code ones. It originated to make monaco-languageclient more robust. - [README](https://github.com/CodinGame/monaco-vscode-api)
- [READ] Install by aliasing: `npm install monaco-editor@npm:@codingame/monaco-vscode-editor-api` (it "provides the same api as the official `monaco-editor`"); the extension API package is aliased to `vscode`. - [README](https://github.com/CodinGame/monaco-vscode-api)
- **Version cadence.** [READ] npm: 39.0.1-39.0.3 (2026-11-06), 39.0.4 (11-09), 39.0.5 (11-18), 40.0.0 (11-20). Release notes: v39.0.0 = "update to vscode 1.145" (breaking), v39.0.1 = VS Code 1.145.2; v40.0.0 breaking: `getServiceOverride` in viewCommon/views/workbench now takes an options object. - [npm](https://registry.npmjs.org/@codingame/monaco-vscode-api); [GitHub releases](https://github.com/CodinGame/monaco-vscode-api/releases)
- [READ] The project went from first publish (2022-06-03) to major version 40 by Nov 2026: i.e. roughly one breaking major per VS Code monthly release. - [npm](https://registry.npmjs.org/@codingame/monaco-vscode-api)
- **Service overrides (what you can pull in).** [READ] Included by default: Base, Host, Extensions, Files (overlay filesystem for `file://`), QuickAccess (command palette F1/Ctrl+Shift+P and quick-open). Optional: Configuration (user settings file with JSON schema), Keybindings (platform keybindings + user keybindings file), Languages, Textmate (depends on Themes; disables Monarch), Themes (real VS Code themes), TreeSitter (experimental, TypeScript only), Snippets, Language-detection worker, Model, Editor, Views, Workbench, Notifications, Dialogs, Preferences (settings UI), Storage, Lifecycle, Accessibility, Output, Terminal, Search (Ctrl+P file search and Ctrl+Shift+F panel), Markers (Problems), SCM, Testing, Debug, Task, Outline, Timeline, Notebook, Chat/inline chat, AI, Workspace trust, User data profile, Secret storage, Extension Gallery, Remote agent, plus Comments, Emmet, Multi-diff editor, Update, etc. - [Wiki: List of service overrides](https://github.com/CodinGame/monaco-vscode-api/wiki/List-of-service-overrides)
- [READ] Three mutually exclusive UI levels: **Editor** override (just editors; "can't be combined with Views or Workbench"), **Views** (VS Code view parts you place in your own layout), **Workbench** (renders the full VS Code workbench layout). - [Wiki](https://github.com/CodinGame/monaco-vscode-api/wiki/List-of-service-overrides)
- [READ] Explorer is not listed as a separate package on the wiki page as summarised; [BG] the file explorer has historically been part of a combined "explorer"/views-related override. Verify the current package name. - [Wiki](https://github.com/CodinGame/monaco-vscode-api/wiki/List-of-service-overrides)
- **Extensions.** [READ] Default VS Code built-in extensions (language grammars etc.) are published as separate packages, e.g. `@codingame/monaco-vscode-javascript-default-extension`; `.vsix` files can be imported at build time with `@codingame/monaco-vscode-rollup-vsix-plugin`. With a worker config, "the webworker extension host will be available, allowing to run extensions in a worker which runs in an iframe". - [README](https://github.com/CodinGame/monaco-vscode-api)
- [READ] Extension Gallery override "installs extensions from the VSCode marketplace" per the wiki; Open VSX is not named on that page. [BG] The gallery URL is supplied via product configuration, and the demo is configured against Open VSX; pointing it at Microsoft's Marketplace would violate the Marketplace terms (section 4). - [Wiki](https://github.com/CodinGame/monaco-vscode-api/wiki/List-of-service-overrides)
- **Node extension host (the Electron question).** [READ] The Remote agent override "connects to a remote VSCode agent for remote files, file search, terminals, and extensions" (i.e. non-web extensions run on the server). Setup: download the VS Code server build matching the exact commit in monaco-vscode-api's `package.json` (`config.vscode.commit`) from `update.code.visualstudio.com/commit:<sha>/server-<platform>-<arch>/stable`, or a VSCodium `reh` archive; set `commit` and `webEndpointUrlTemplate` in `product.json`; run `./bin/code-server --port --host --without-connection-token --accept-server-license-terms`; client sets `remoteAuthority` and opens `vscode-remote://` folders. "The client and server must share the same commit and product quality to connect." - [Wiki: VSCode server](https://github.com/CodinGame/monaco-vscode-api/wiki/How-to-install-and-use-VSCode-server-with-monaco%E2%80%90vscode%E2%80%90api)
- [READ] Microsoft's own server build requires `--accept-server-license-terms`, and per the VS Code wiki the "Visual Studio Code Server" uses "a license that restricts their use to the Visual Studio family of products". So a non-Microsoft app should use the VSCodium REH build (MIT build of Code-OSS server), not Microsoft's binary. - [VS Code wiki](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code)
- [READ] The README does not mention Electron at all; a code sample references `ExtensionHostKind.LocalProcess` without explanation. No documented in-renderer Node extension host. - [README](https://github.com/CodinGame/monaco-vscode-api)
- **Known pain points.** [READ] `initialize` "can only be called once" and must run before the first editor is created; workbench options and remote authority cannot be changed afterwards; services cannot be unloaded - "which is why sandbox mode exists". Sandbox mode (beta) runs VS Code code in an iframe that renders into the main page; shadow-DOM support is beta because "VSCode itself doesn't support shadow dom". Building the library itself is Linux/Mac only. - [README](https://github.com/CodinGame/monaco-vscode-api)
- [READ] "It is VERY important that only a single version of ALL the packages is installed, otherwise weird things can happen." Vite needs `@codingame/esbuild-import-meta-url-plugin` and `optimizeDeps.include` entries for `vscode-textmate`, `vscode-oniguruma`, `@vscode/vscode-languagedetection`. `monaco-editor-webpack-plugin` cannot be used. Monarch languages only work if textmate+theme overrides are NOT configured. - [Wiki: Troubleshooting](https://github.com/CodinGame/monaco-vscode-api/wiki/Troubleshooting)
- [READ] The TypeScript extension in the web extension host needs `SharedArrayBuffer`, so the page must be `crossOriginIsolated` (COOP `same-origin` + COEP `require-corp`/`credentialless` on the main page, the extension-host iframe HTML and worker); otherwise only per-file IntelliSense. COEP affects every other iframe in the same page. - [Wiki: Troubleshooting](https://github.com/CodinGame/monaco-vscode-api/wiki/Troubleshooting)
- [READ] User data sync override "currently depends on a closed-source Microsoft backend and can't really be used". - [Wiki](https://github.com/CodinGame/monaco-vscode-api/wiki/List-of-service-overrides)
- **Bundle size.** [READ] npm unpacked size of the core package alone is 58.6 MB (v40.0.0); each override and each default extension is an additional package. No bundled-size figure is published. - [npm](https://registry.npmjs.org/@codingame/monaco-vscode-api)
- **monaco-languageclient (TypeFox).** [READ] v11.0.3 (2026-10-15), MIT; "A toolbox for building web applications with editors utilizing language servers"; packages: `monaco-languageclient`, `vscode-ws-jsonrpc` 4.0.3, `@typefox/monaco-editor-react` 8.0.3. Compatibility row: monaco-languageclient 11.0.3 -> @codingame/monaco-vscode-api 37.6.0 -> VS Code 1.138.0 -> monaco-editor 0.57.0. Language servers connect over WebSocket (Node/Express relay) or run in a web worker (e.g. clangd compiled to WASM, Langium). Angular builds unsupported. Docs and migration guides exist since v10. - [TypeFox/monaco-languageclient](https://github.com/TypeFox/monaco-languageclient)
- [READ] Release rhythm of monaco-languageclient: 10.6.0 (2026-01-14), 10.7.0 (2026-02-04), then 11.0.0 only on 2026-09-23 - it lags monaco-vscode-api (stuck at 37.6.0 while upstream is at 40.0.0). - [npm](https://registry.npmjs.org/monaco-languageclient)

### Inferences
- monaco-vscode-api is "VS Code as a library": Path B's ceiling is essentially VS Code minus proprietary Microsoft pieces. But you adopt VS Code's whole service container as a page-global singleton. In a multi-tab shell that also hosts office iframes and PDF.js, that means: (a) one VS Code "instance" per renderer page, shared by all code tabs; (b) VS Code's own keybinding service, command palette, context keys, dialogs and notifications now coexist (and compete) with the shell's; (c) COEP/COOP requirements for the TS extension leak onto sibling iframes unless the code editor lives in its own WebContentsView/iframe.
- Using only the lightweight overrides (Editor + Textmate + Themes + Languages + Configuration + Keybindings + default-extension grammar packages), without Views/Workbench/extension gallery, is a meaningful middle tier: real VS Code highlighting and themes for ~every language, with the shell keeping ownership of tabs, palette and save. This is the lowest-risk slice of Path B.
- Version treadmill: staying current means absorbing a breaking major about monthly; pinning for 6-12 months is viable for a personal app but extension compatibility (engine version) ages.
- Node-based extensions in Electron require running a separate, commit-matched Code-OSS server process (VSCodium REH) as a sidecar - at which point you are operationally close to Path C (openvscode-server/code-server) anyway, just with your own front-end.
- With Monaco 0.55+ shipping native LSP, monaco-languageclient is no longer the only route to LSP on Monaco; its value now is the full `vscode-languageclient` semantics on top of monaco-vscode-api.

### Gaps
- No documented, supported recipe for monaco-vscode-api inside an Electron renderer with a local Node extension host was found; needs a spike.
- Actual bundled size and cold-start/memory of minimal vs full-workbench configurations - not published; measure.
- Bus factor / contributor concentration of CodinGame/monaco-vscode-api could not be measured (GitHub API unavailable).
- Whether the Extension Gallery override ships with Open VSX configured by default - not confirmed from a primary page.

---

## 4. Embedding all of VS Code: Code-OSS, VS Code Web, openvscode-server, code-server, Theia; marketplace restrictions; Open VSX

### Takeaway
Embedding a whole VS Code-compatible IDE is the cheapest way to a 100% feature ceiling, and the open-source pieces (Code-OSS MIT, code-server MIT, Theia EPL-2.0) are legal to ship; but none may use Microsoft's Marketplace or Microsoft's proprietary extensions (Pylance, C/C++, C# Dev Kit, Remote-*, Live Share), so the ecosystem is Open VSX only. code-server is the actively maintained sidecar option (4.146.0, 2026-11-20); openvscode-server appears stalled (last release 1.109.5, 20 Feb). Theia (1.77.0, 2026-11-05) is the only option designed as a framework for custom tools and could be the app shell, at the price of adopting its whole architecture.

### Cited Findings
- **Code-OSS vs VS Code.** [READ] "The source code in this repository is available to everyone under a standard MIT license"; Visual Studio Code "is a distribution of the Code - OSS repository with Microsoft specific customizations" released "under a traditional Microsoft product license". "Most customizations are done through the customization of product.json" (marketplace URLs, proposed-API extension allowlist, update URL, telemetry keys). - [VS Code wiki: Differences](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code)
- **Marketplace restriction.** [READ] "Access to the Marketplace is governed by the Marketplace Terms of Use"; "The Marketplace is not a general purpose store designed to support any distribution or a subset of distributions." - [VS Code wiki](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code)
- [READ] code-server FAQ quotes the terms: "Marketplace Offerings are intended for use only with Visual Studio Products and Services", which is why code-server defaults to Open VSX. - [code-server FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)
- [SEARCH] In-scope products per Microsoft's terms: Visual Studio, VS Code, GitHub Codespaces, Azure DevOps and Azure DevOps Server. - [Marketplace/NuGet Terms](https://www-1.nuget.org/policies/Terms) (search summary; the canonical PDF host was blocked)
- **Proprietary extensions.** [READ] Certain Microsoft extensions and the VS Code Server use "a license that restricts their use to the Visual Studio family of products"; Remote Development: "Parts of the code to negotiate a connection to the Visual Studio Code server are proprietary." - [VS Code wiki](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code)
- [READ] code-server: Live Share and Remote Extensions (SSH, Containers, WSL) are closed-source and unavailable. - [code-server FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)
- [SEARCH] April 2025: Microsoft's C/C++ extension began refusing to run in forks (VSCodium, Cursor); C# Dev Kit shows a message that it may be used only with Microsoft VS Code, vscode.dev, GitHub Codespaces; Pylance has enforced the same for years. - [The Register, 2025-04-24](https://www.theregister.com/2025/04/24/microsoft_vs_code_subtracts_cc_extension/) (search summary); [DevClass, 2025-04-08](https://www.devclass.com/development/2025/04/08/vs-code-extension-marketplace-wars-cursor-users-hit-roadblocks/1629343) (search summary); [C# Dev Kit licence](https://marketplace.visualstudio.com/items/ms-dotnettools.csdevkit/license) (search summary)
- [BG] GitHub Copilot: the Copilot Chat extension was open-sourced (MIT) in 2025 and merged toward VS Code core, but the Copilot service requires a GitHub account/subscription and its use from non-Microsoft clients is governed by GitHub's terms; not an offline feature and not relevant to a local-first personal tool. - [VS Code blog](https://code.visualstudio.com/blogs/2025/05/19/openSourceAIEditor)
- [BG] Open alternatives on Open VSX commonly substituted: basedpyright / Pyright (for Pylance), clangd (for MS C/C++), the open `ms-dotnettools.csharp` Roslyn LSP parts or OmniSharp, Open Remote-SSH. - [open-vsx.org](https://open-vsx.org/)
- **Open VSX in 2026.** [SEARCH] Eclipse Foundation reported the registry passed 300 million monthly downloads (March 2026); launched the paid "Open VSX Managed Registry" on 2026-04-21 for enterprises embedding it at production scale (first customers AWS, Google, Cursor); the public registry at open-vsx.org "remains freely accessible"; rate limiting is being phased in, with a cited free-tier figure of up to 3 requests/second (10,800/hour) for individual developers. A Japanese report says Open VSX reached v1.0.0 on 2026-06-17 (single source). - [Eclipse newsroom, 300M](https://newsroom.eclipse.org/node/43620); [Managed Registry launch](https://newsroom.eclipse.org/node/43804); [Rate limiting blog](https://blogs.eclipse.org/node/8762); [vmblog Q&A](https://vmblog.com/qa/why-the-eclipse-foundation-introduced-the-open-vsx-managed-registry-vmblog-qa/); [Impress Watch](https://forest.watch.impress.co.jp/docs/news/2118403.html) (all search summaries)
- **code-server (Coder).** [READ] npm 4.146.0 (2026-11-20), MIT; releases 4.144.0 (10-29), 4.145.0 (11-04), 4.145.2 (11-07): tracks upstream VS Code within about a release. Unpacked 216 MB. It "pulls VS Code in as a submodule and applies patch files"; Open VSX by default; web views need a secure context (service workers); supports hosting at sub-paths. - [npm](https://registry.npmjs.org/code-server); [FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)
- [READ] Official alternative: `code serve-web` (VS Code's own web server mode) "is the better choice if you need the official Microsoft marketplace" - but that is Microsoft's licensed product on the user's machine, not something to redistribute. - [code-server FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)
- **openvscode-server (Gitpod).** [READ] Latest release tags: v1.109.5 (marked Latest) and v1.108.2 both dated 20 Feb; v1.106.3 on 02 Dec; v1.105.1 on 23 Oct. No year shown; given VS Code numbering these are Feb 2026 / late 2025, meaning no release for ~9 months while VS Code is at ~1.145-1.146. Not shown as archived (128 open issues). - [releases](https://github.com/gitpod-io/openvscode-server/releases). [SEARCH] Docker Hub `latest` last pushed "about 5 months" before the crawl. - [Docker Hub](https://hub.docker.com/r/gitpod/openvscode-server/tags)
- **VS Code for the Web static build / @vscode/test-web.** [READ] `@vscode/test-web` 0.0.81 (2026-06-23), MIT, releases every 1-5 months. - [npm](https://registry.npmjs.org/@vscode/test-web). [BG] It downloads a VS Code web build and serves it locally for testing web extensions; a pure static `vscode-web` build has only a browser (web-worker) extension host: no Node extensions, no terminal, no ripgrep search, filesystem only via FileSystemProvider extensions. Microsoft does not publish vscode-web as a supported embeddable product; you build it yourself from Code-OSS (`yarn gulp vscode-web`). - [VS Code web extensions docs](https://code.visualstudio.com/api/extension-guides/web-extensions)
- **Code-OSS desktop embedded in Electron.** [BG] Code-OSS desktop is itself an Electron app that owns its main process, window lifecycle and protocol handlers; there is no supported way to mount its desktop workbench inside another Electron app's renderer. Realistic embeddings are the web workbench + server (what code-server/openvscode-server package) shown in an iframe/WebContentsView. - [microsoft/vscode](https://github.com/microsoft/vscode)
- **Eclipse Theia.** [READ] `@theia/core` 1.77.0 (2026-11-05); monthly releases: 1.73.0 (06-25), 1.74.0 (07-31), 1.75.0 (08-27), 1.76.0 (09-24), 1.77.0 (11-05), with a patched community line 1.74.1-1.74.3 (latest 10-23; Electron 42.11.16). v1.77.0 lists 38 contributors. - [npm](https://registry.npmjs.org/@theia/core); [releases](https://github.com/eclipse-theia/theia/releases)
- [READ] Theia is an "extensible framework to develop full-fledged multi-language Cloud & Desktop IDEs", with "a highly flexible architecture for adopters", supports the "VS Code Extension protocol", browser and Electron desktop targets (packaging guide), ~21.8k stars. Includes Theia AI ("vendor-neutral AI harness platform") and "powers the AI-native Theia IDE". Licence EPL-2.0, secondary GPL-2.0 with Classpath Exception. - [eclipse-theia/theia](https://github.com/eclipse-theia/theia)
- [READ] Theia "is a separate editor that shares Monaco and the extension API with VS Code, and it uses Open VSX. It doesn't let you reuse your existing VS Code config." - [code-server FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)
- [BG] Theia architecture: frontend (browser/Electron renderer) + Node backend, InversifyJS dependency injection, Lumino (PhosphorJS successor) dock-panel shell, Monaco for editors (it consumes Monaco via its own `@theia/monaco-editor-core` build); custom "Theia extensions" compile into the app and can add arbitrary widgets/views/editors (via `OpenHandler`/`WidgetOpenHandler`), menus, commands; VS Code extensions run in a separate plugin host. It publishes a VS Code API compatibility report and typically trails the newest VS Code API by some versions. - [Theia docs](https://theia-ide.org/docs/) (blocked this session)
- [BG] EPL-2.0 is weak (file-level) copyleft: modifications to Theia's own files must be published under EPL when distributed; your own separate modules/extensions can carry any licence. For a personal, undistributed app there is effectively no obligation; if distributed, ship notices and source for any modified Theia files. - [EPL-2.0 FAQ](https://www.eclipse.org/legal/epl-2.0/faq.php)

### Inferences
- **Could Theia be the SHELL?** Technically yes: it is the one option built for exactly "custom tool with IDE-grade editor + your own views". Office editors (iframes) and PDF.js could be registered as custom editor widgets opened by `OpenHandler`s; Theia already provides tabs/docking, command palette, keybindings, settings, file explorer, search, terminal, git, and the VS Code extension host. Costs: (1) the whole app must adopt Theia's DI/Lumino/contribution architecture and its Electron main process and build system (historically webpack-based with native-module rebuilds); (2) the app will look and behave like an IDE unless substantially restyled - a poor fit for an "all-in-one productivity tool" where code is one of several equal modes; (3) monthly releases with breaking-change lists; (4) the existing custom Electron shell and its shell-owned palette/save pipeline would be discarded or re-implemented as Theia contributions. For a solo developer who already has a custom shell, this is a rewrite, not an integration.
- **Sidecar (code-server) in a tab** gives the full ceiling in days of work, but as an opaque island: its own tabs-within-a-tab, own command palette, own keybindings, own file dialogs and dirty-state/save logic, own settings and theme. The shell cannot easily own save, cannot merge commands into a shell palette, and Ctrl+P / Ctrl+Shift+P / Ctrl+S / Ctrl+W conflicts must be resolved by focus. Partial bridges are possible with a small companion VS Code extension (expose commands, report dirty state, open file on request over a local socket) plus URL params (`?folder=`) - workable for "open this folder as a project" but awkward for "open this one .json in a shell tab".
- Memory: the sidecar path adds a Node server process + extension host process(es) + file watcher + a full workbench renderer; expect several hundred MB over a plain editor (unmeasured here - see Gaps). Unpacked install adds ~216 MB (code-server).
- openvscode-server should be ruled out on maintenance evidence; code-server or VSCodium REH + self-built web workbench are the live options.
- Extension ecosystem reality outside official VS Code: fine for linters/formatters/most language servers and themes via Open VSX; not available: Pylance, MS C/C++, C# Dev Kit, Remote-SSH/Containers/WSL, Live Share. Offline-first use also means extensions must be pre-installed/sideloaded (.vsix), since Open VSX is a network service with rate limits.

### Gaps
- Theia docs (theia-ide.org) were unreachable: current VS Code API compatibility level for 1.77, current bundler (webpack vs other), and any 2026 "custom product" guidance are unverified.
- The Marketplace Terms of Use PDF itself was not read (blocked host); wording is via code-server's quotation and search summaries.
- Year of the openvscode-server "20 Feb" release was inferred, not displayed.
- No measured memory figures for code-server/Theia vs Monaco/CM6 were found.
- Whether VSCodium still publishes `reh`/`reh-web` builds per release in late 2026 was not checked.

---

## 5. Other engines (rule in / rule out)

### Takeaway
None of the other engines is a credible primary choice for an Electron app: Ace is a maintained but older-generation web component (fallback only), and Zed, Lapce, Helix, Neovim, Lite XL and Sublime are native applications that are not embeddable web components; Fleet is discontinued.

### Cited Findings
- **Ace.** [READ] `ace-builds` 1.45.2 (2026-10-21), BSD-3-Clause, still releasing (1.44.0 May 2026, 1.45.0 Oct 2026). - [npm](https://registry.npmjs.org/ace-builds). [BG] ~150+ language modes (TextMate-derived), multi-cursor, folding, search; LSP via the separate `ace-linters` project; no minimap, no diff built in; smaller ecosystem momentum than Monaco/CM6. [SEARCH] One comparison lists Ace handling ~4M lines. - [varrockbank comparison](https://varrockbank.github.io/buffee/web/comparison.html) (search summary, single unverified source)
- **Zed.** [SEARCH] Reached 1.0 in 2026 (reported June 2026); editor is GPL-3.0-or-later, GPUI framework Apache-2.0; server components historically AGPL, with one report that AGPL was dropped in favour of GPL. - [Wikipedia](https://en.wikipedia.org/wiki/Zed_(text_editor)); [heise](https://heise.de/-11278661); [atmarkit](https://atmarkit.itmedia.co.jp/ait/articles/2606/08/news061.html); [alphasignal](https://alphasignal.ai/news/zed-drops-agpl-to-unblock-enterprise-developers-banned-from-using-it) (all search summaries). [BG] Zed is a native Rust/GPUI GPU-rendered app, not a web component; it cannot render inside an Electron renderer, and GPL would bind any app linking its editor crates. Rule out as an engine; fine as an external "Open in Zed" hand-off.
- **JetBrains Fleet.** [SEARCH] Discontinued: JetBrains ceased updates and distribution effective 2025-12-22. Proprietary in any case. - [heise](https://heise.de/-11107960); [gamefromscratch](https://gamefromscratch.com/jetbrains-fleet-is-dead/) (search summaries)
- **Lapce.** [BG] Rust/Floem native editor, Apache-2.0, WASI plugins; native app, not embeddable in Electron; pre-1.0 with slow release pace as of my knowledge. Search returned nothing on its 2026 status. - [lapce/lapce](https://github.com/lapce/lapce)
- **Neovim / Helix as backend.** [BG] Neovim (Apache-2.0/Vim licence) can run headless with an RPC UI protocol (`nvim --embed`), which is how vscode-neovim and Neovide work; you would still need a full grid renderer in the renderer process and would inherit modal editing as the UX - wrong fit for "VS Code-level for everyone". Helix (MPL-2.0) is a terminal app with no embedding API. Realistic use: optional Vim keybindings via `@replit/codemirror-vim` or `monaco-vim`, not Neovim as engine. - [Neovim UI docs](https://neovim.io/doc/user/ui.html)
- **Lite XL.** [BG] Lua/C SDL-based native editor (MIT); not a web component. Rule out. - [lite-xl](https://github.com/lite-xl/lite-xl)
- **Sublime Text.** [BG] Proprietary native app; no embedding. Rule out. - [sublimetext.com](https://www.sublimetext.com/)
- **Shiki bridges.** [READ] `@shikijs/monaco` 4.6.0 (2026-11-02) - a small, actively released adjunct that gives plain Monaco TextMate-quality highlighting; relevant as a "Path B-lite". - [npm](https://registry.npmjs.org/@shikijs/monaco)

### Inferences
- The realistic field is exactly three engines/families: CodeMirror 6, Monaco (plain or with monaco-vscode-api), and whole-IDE embeds (code-server / Theia).
- Ace offers nothing that CM6 does not do better in 2026 except possibly raw huge-file tolerance; not worth a third engine.

### Gaps
- No 2025-2026 newcomer embeddable web editor component with VS Code-level ambition was identified by the searches run; this was a shallow sweep (one query), so absence is weak evidence.
- Lapce 2026 status unknown.

---

## 6. Trade-off summary for the three realistic paths

### Takeaway
(A) CM6 keeps the shell fully in control at the cost of building every workbench feature; (B) Monaco gives VS Code's editor instantly and, via monaco-vscode-api, a dial from "just grammars/themes" up to "full workbench", with coupling and upgrade burden rising with each notch; (C) whole-IDE embedding gives the maximum ceiling for minimum code but fights the "one shell, one palette, one save pipeline" requirement. The sources support a tiered design rather than a single pick.

### Cited Findings
(Facts underlying the table are cited in sections 1-4; this section is mostly synthesis.)
- CM6 has official LSP client, merge view, search and multi-selection, but minimap is a stale third-party package. - [npm lsp-client](https://registry.npmjs.org/@codemirror/lsp-client); [npm minimap](https://registry.npmjs.org/@replit/codemirror-minimap)
- Monaco 0.56+ is tree-shakeable ESM with native LSP APIs. - [Monaco CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md)
- monaco-vscode-api: global one-time `initialize`, services cannot be unloaded, Editor/Views/Workbench modes mutually exclusive, single-version constraint, roughly monthly breaking majors. - [README](https://github.com/CodinGame/monaco-vscode-api); [Troubleshooting](https://github.com/CodinGame/monaco-vscode-api/wiki/Troubleshooting); [releases](https://github.com/CodinGame/monaco-vscode-api/releases)
- Whole-IDE options cannot use Microsoft Marketplace or proprietary Microsoft extensions. - [VS Code wiki](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code); [code-server FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)

### Inferences

| Dimension | (A) CodeMirror 6 + LSP client + own workbench | (B) Monaco (+ monaco-vscode-api, own shell) | (C) Embed full IDE (code-server tab / Theia as shell) |
|---|---|---|---|
| Solo-dev effort to first usable | Low for editor; **high and open-ended** for VS Code parity (minimap, palette, code actions, peek, breadcrumbs, settings UI, explorer, search panel all hand-built) | **Low** with plain Monaco (days). Medium with grammar/theme/config overrides (1-2 weeks incl. Vite wiring). High with Views/Workbench + extension host + server sidecar | code-server in a tab: **very low** (days) to show; high to integrate well. Theia as shell: **very high** (re-platform the whole app) |
| Feature ceiling | Whatever you build; language smarts via LSP only; no VS Code extensions ever | Plain: VS Code editor core + 4 built-in language services + LSP. With overrides: up to near-full VS Code incl. Open VSX extensions | 100% of Code-OSS (minus Microsoft-proprietary extensions and Marketplace) |
| Language breadth, highlighting | ~20 Lezer grammars + ~100 legacy stream modes; good enough, uneven depth | Plain: ~80 Monarch grammars. With Textmate override or `@shikijs/monaco`: same grammars/themes as VS Code | Same as VS Code |
| Coexistence with office iframes / PDF.js in one tabbed window | **Best**: an ordinary DOM component per tab, no globals | Plain Monaco: good (page-global themes/keybindings but manageable). With monaco-vscode-api: one global VS Code service container per page; COOP/COEP for TS extension affects sibling iframes -> isolate in its own WebContentsView/iframe | Tab-in-a-tab island (code-server) or the IDE *is* the window (Theia). Weakest fit unless Theia is the shell |
| Shell-owned command palette | Natural: editor commands are plain functions you register in the shell palette | Plain Monaco: feasible (enumerate editor actions via `getSupportedActions()` and run them; hide Monaco's F1). With QuickAccess/Workbench overrides: VS Code brings its own palette -> two palettes or cede ownership | IDE owns its palette; shell can at best forward a few commands through a companion extension |
| Shell-owned file save pipeline | Natural: document is a string/Text you read and write | Plain Monaco: natural (models are yours). With Files/working-copy services: VS Code owns dirty state and save; you integrate by implementing a FileSystemProvider that calls the shell | IDE owns files, dirty state, hot-exit, watchers; shell pipeline bypassed |
| Memory / footprint | Smallest (hundreds of KB of JS per editor; no workers required) | Plain: a few MB JS + language workers. Full overrides: tens of MB JS, extension-host worker/iframe, optional server process | Largest: server + extension host + watcher + workbench renderer; +~216 MB on disk for code-server |
| Large files / logs | Viewport-rendered; documented multi-million-line demo; highlighting tapers off | Piece-tree buffer; VS Code-style large-file degradations | Same as VS Code |
| Markdown / prose editing quality | **Best** (decorations, widgets, live preview) | Adequate source editing; poor for WYSIWYG-ish Markdown | VS Code's Markdown preview, as-is |
| Upgrade burden | Low: 6.x API stable for years, small patch releases | Plain Monaco: moderate (0.x; breaking packaging changes in 0.53-0.56). monaco-vscode-api: **high** (new breaking major ~monthly; all packages must match exactly; server commit must match) | code-server: low if treated as a black box (swap binary). Theia: moderate-high (monthly, breaking-change lists, Electron bumps) |
| Lock-in | Low; your features are yours | Plain: moderate (Monaco API). Overrides: high (VS Code internals via a third-party repackaging) | code-server: low code lock-in, high UX dependence. Theia as shell: **total** architectural lock-in |
| Key risk | Never-ending parity work; single maintainer; off-GitHub forge | CodinGame bus factor; singleton model vs multi-engine shell; treadmill | Ecosystem gaps (no Pylance etc.); "app inside an app" UX; openvscode-server stagnation shows sidecars can stall |
| Licence | MIT | MIT (Monaco, monaco-vscode-api, languageclient); VSCodium REH server MIT; do NOT ship Microsoft's server binary | MIT (Code-OSS, code-server); EPL-2.0 (Theia; file-level copyleft) |

- Paths are not mutually exclusive. Because both CM6 and plain Monaco are ordinary per-tab components behind an editor-adapter interface, a combination (CM6 for Markdown/prose + Monaco for code/config) is cheap; the cost is two keymap/theme/search-UI integrations to keep visually consistent.
- "VS Code-level" has two separable meanings: (1) the in-editor feel (multi-cursor, minimap, find widget, folding, diff, IntelliSense) and (2) the workbench + extension ecosystem. Plain Monaco delivers (1) on day one; only monaco-vscode-api-with-workbench or path C deliver (2).

### Gaps
- All effort estimates are judgement, not sourced measurements.
- No sourced memory numbers for any path.

---

## 7. Bottom-line recommendation, risks, and confirming spikes

### Takeaway
Recommended: **Monaco as the code/structured-text engine in shell-owned tabs (Path B, starting at the lightest tier), keeping CodeMirror 6 for Markdown/prose; add TextMate grammars + VS Code themes as the second step (via `@shikijs/monaco` first, or monaco-vscode-api's Textmate/Themes/Languages overrides if settings/keybindings JSON are also wanted); use LSP servers spawned by the Electron main/utility process for language intelligence; and treat a full IDE (code-server-style sidecar in a dedicated "Project/IDE" tab) as an optional later escape hatch rather than the foundation.** Do not make Theia the shell unless the product is redefined as an IDE.

### Cited Findings
- Plain Monaco provides the VS Code editing core, MIT, with tree-shakeable ESM and a native LSP namespace as of 0.55-0.56. - [Monaco CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md)
- monaco-vscode-api lets the same Monaco be upgraded in place (it "provides the same api as the official `monaco-editor`" via npm alias), so starting on plain Monaco does not foreclose the heavier tiers. - [monaco-vscode-api README](https://github.com/CodinGame/monaco-vscode-api)
- The heavier tiers carry documented constraints: single global `initialize`, no unloading, mutually exclusive Editor/Views/Workbench, strict single-version rule, cross-origin isolation for full TS IntelliSense, commit-matched server for Node extensions. - [README](https://github.com/CodinGame/monaco-vscode-api); [Troubleshooting](https://github.com/CodinGame/monaco-vscode-api/wiki/Troubleshooting); [VSCode server wiki](https://github.com/CodinGame/monaco-vscode-api/wiki/How-to-install-and-use-VSCode-server-with-monaco%E2%80%90vscode%E2%80%90api)
- CM6 remains actively maintained with official LSP and merge packages, supporting its continued use for Markdown. - [npm @codemirror/view](https://registry.npmjs.org/@codemirror/view); [npm lsp-client](https://registry.npmjs.org/@codemirror/lsp-client)
- Whole-IDE embeds are legally limited to Open VSX and exclude Microsoft's proprietary extensions. - [VS Code wiki](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code)

### Inferences
**Why this recommendation**
- The stated requirement ("VS Code depth for any text file") is mostly meaning (1) - editor feel - plus broad highlighting. Monaco gives that for free; CM6 would require building minimap, code-action UI, peek, sticky scroll, etc. by hand, which is the worst use of a solo developer's time.
- The shell requirements (shell-owned palette, shell-owned save, coexistence with office/PDF iframes) are satisfied by plain Monaco and by the "Editor"-level overrides, but are violated increasingly by Views -> Workbench -> full IDE. Stopping at the lowest tier that meets the need preserves them.
- Honest alternative: **all-CM6 (Path A)** is defensible if the user values one engine, smallest footprint and best Markdown above minimap/IntelliSense polish, and accepts LSP-only language features. It is the lower-risk choice on maintenance treadmill; it is the higher-effort choice for parity. If the spike shows two engines create visible inconsistency (find widget, keybindings, themes), collapsing to CM6-only is the fallback, not collapsing to Monaco-only (Monaco is weak for Markdown live preview).

**Suggested tiering**
1. Tier 0: Monaco 0.57 plain ESM in Vite; shell adapter exposing `open(path, text)`, `getValue`, dirty events, `runAction(id)`, list of actions for the shell palette; built-in TS/JS/JSON/CSS/HTML workers; diff editor for compare.
2. Tier 1: TextMate-quality highlighting and VS Code themes (`@shikijs/monaco`), JSON-schema store for JSON/YAML/TOML config files, LSP for a handful of languages via Monaco native `lsp` (or monaco-languageclient) with servers as child processes over stdio, bridged by MessagePort.
3. Tier 2 (only if demanded): monaco-vscode-api with Editor + Textmate + Themes + Languages + Configuration + Keybindings (+ web-worker extension host for web extensions from sideloaded .vsix). Isolate in its own WebContentsView so its globals and COOP/COEP do not touch office/PDF tabs.
4. Tier 3 (escape hatch): "Open folder in IDE tab" using a code-server/VSCodium-REH sidecar, explicitly an island.

**Risks**
- Two-engine inconsistency (CM6 + Monaco): different find UI, multi-cursor keybindings, theming models. Mitigate with a shared theme token source and a keymap table.
- Monaco page-global state: all Monaco instances in one renderer share themes, keybinding registry and language registrations; conflicts with shell shortcuts (Ctrl+P, F1, Ctrl+S) need explicit unbinding.
- Monaco 0.x packaging churn (0.53-0.56 all breaking); pin exact versions.
- monaco-vscode-api treadmill and single-vendor dependence if Tier 2 is adopted; monaco-languageclient lags it by several majors.
- Workers under Electron: Monaco workers do not start from `file://`; need a custom `app://` protocol with correct MIME types and CSP.
- Monaco native LSP completeness is unverified.
- Extension expectations: users who equate "VS Code-level" with Pylance/Copilot/Remote-SSH cannot be satisfied by any redistributable path.

**Spike experiments to confirm (each 0.5-2 days)**
1. *Monaco-in-shell*: Vite + Electron + Monaco 0.57 tree-shaken entry points under the app's custom protocol; measure bundle size, cold open time, renderer memory with 1/10/30 editor tabs (models retained, editors disposed).
2. *Shell ownership test*: route Ctrl+S, Ctrl+P, Ctrl+Shift+P, Ctrl+W to the shell; surface Monaco actions in the shell palette; verify no double palettes; verify save through the shell pipeline with encoding/EOL preserved (BOM, CRLF, UTF-16).
3. *Large-file test*: open 5 MB JSON, 50 MB and 500 MB logs, a 1-line 10 MB minified file in Monaco, CM6 and (control) Ace; record open time, scroll FPS, memory, search time; decide a size threshold above which a read-only/CM6 "big file mode" is used.
4. *Grammar tier*: `@shikijs/monaco` vs monaco-vscode-api Textmate+Themes overrides: wiring effort under Vite, startup cost, fidelity on 15 file types (TOML, INI, YAML, Dockerfile, shell, Rust, Go, C#, Python, SQL, XML, log, diff, Markdown, PowerShell).
5. *LSP tier*: one server (e.g. pyright or rust-analyzer) spawned in a utility process, connected to (a) Monaco native `lsp` namespace, (b) monaco-languageclient, (c) `@codemirror/lsp-client`; compare feature coverage (code actions, rename, semantic tokens, inlay hints, multi-file workspace) and code size.
6. *Coexistence*: Monaco tab + office iframe tab + PDF.js tab in one window; check focus/keyboard leakage, theme switching, memory when switching; if Tier 2, check COOP/COEP impact on the office iframes.
7. *Tier 2 feasibility*: monaco-vscode-api minimal config in a separate WebContentsView; install one web extension from a .vsix; time an upgrade across two majors (e.g. 38 -> 40) to quantify the treadmill.
8. *Escape hatch*: code-server sidecar bound to 127.0.0.1 with a token, in a WebContentsView; measure RSS of all processes, startup time, and how cleanly a companion extension can report dirty state and accept "open file" from the shell.
9. *Markdown decision*: confirm CM6 stays for Markdown by prototyping the same README in both engines (live preview, soft wrap, tables).

### Gaps
- The recommendation rests on unmeasured assumptions about memory, bundle size and the completeness of Monaco's native LSP client; spikes 1, 3 and 5 exist to close these.
- Blocked hosts (codemirror.net, theia-ide.org, sourcegraph.com, cdn.vsassets.io) should be re-checked if the network allowlist is widened, specifically: CM6 lsp-client reference, Theia's current VS Code API compatibility level, and the literal Marketplace Terms text.
