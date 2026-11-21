# Code/Text Editor Feature Set and Supporting Infrastructure ("VS Code-level" editor inside an Electron all-in-one app)

Research date: 2026-11-21. Scope: everything *around* the core editor component (Monaco vs CodeMirror vs embedded VS Code is covered by another track).

**Evidence tags used on every finding**

- **[R]** = read directly in this session (npm registry metadata via `npm view`, files on raw.githubusercontent.com, or a fetched page). Version numbers tagged [R] were read on 2026-11-21.
- **[S]** = search-result summary only (the page itself was not opened; treat as secondhand).
- **[B]** = background knowledge from training (cutoff mid-2026), not re-verified in this session; URL given is where the claim can be checked.

**Access limitations in this session (affects confidence):** `microsoft.github.io` (LSP/DAP spec sites), `newsroom.eclipse.org`, `mason-registry.dev`, `open-vsx.org` and the GitHub API were not reachable from the research sandbox. LSP/DAP facts were instead read from the spec repos' raw source files. `code.visualstudio.com` docs were not fetched; the VS Code feature inventory is therefore mostly [B] with doc URLs for verification.

---

## 1. Feature inventory of VS Code, tiered, and what people use daily vs rarely

### Takeaway
VS Code is three products stacked: a text editor (Monaco), a language-intelligence layer (TextMate/tree-sitter + LSP-style providers supplied by extensions), and a workbench (explorer, search, SCM, terminal, debug, extensions, remote, AI). Almost everything users touch *daily* sits in the first layer plus five workbench pieces (explorer, quick open, search-in-files, terminal, basic Git); the long tail (debugger UI, testing, tasks, remote, notebooks, profiles, extension host) is where most of VS Code's engineering cost lives. I found no reliable quantitative telemetry on per-feature usage; the daily/rare split below is an inference.

### Cited Findings

**Current state of VS Code itself**
- VS Code `main` is at version 1.148.0; it has moved to weekly stable releases in 2026 (1.142 on 14 Oct, 1.143 on 21 Oct, 1.144 on 28 Oct 2026), and recent release notes are dominated by agent/chat/MCP features rather than editor features. [R for version: [microsoft/vscode package.json](https://raw.githubusercontent.com/microsoft/vscode/main/package.json)]; [S for cadence/content: [VS Code updates](https://code.visualstudio.com/updates/v1_144), [VS Code blog](https://devblogs.microsoft.com/vscode-blog/page/1)]
- VS Code's own runtime dependency list is effectively the reference bill of materials for this project: `@parcel/watcher`, `@vscode/ripgrep-universal`, `@vscode/tree-sitter-wasm`, `@vscode/vscode-languagedetection`, `vscode-textmate`, `vscode-oniguruma`, `@xterm/xterm` + addons (clipboard, image, ligatures, progress, search, serialize, unicode11, webgl) + `@xterm/headless`, `node-pty`, `jschardet`, `@vscode/iconv-lite-umd`, `@vscode/sqlite3`, `@vscode/spdlog`. All are MIT-licensed npm packages usable outside VS Code. [R: [microsoft/vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]

**Tier A — core editing (all [B]; verify at the linked docs)**
- Multi-cursor (Alt+Click, Ctrl+D add-next-occurrence, Ctrl+Shift+L select-all-occurrences), column/box selection, find/replace with regex + case/whole-word + preserve-case + find-in-selection, code folding (indent-based, syntax-based, `#region` markers), bracket matching and bracket-pair colourisation/guides, auto-closing/surrounding pairs, indentation detection (tabs vs spaces, size) with status-bar switcher, word wrap, minimap, sticky scroll, breadcrumbs, Go to Line (Ctrl+G), Go to Symbol in file (Ctrl+Shift+O), rulers, render whitespace, line move/duplicate, comment toggle, transform case, sort lines, trim trailing whitespace, insert final newline. — [Basic editing](https://code.visualstudio.com/docs/editor/codebasics), [User interface](https://code.visualstudio.com/docs/getstarted/userinterface), [Code navigation](https://code.visualstudio.com/docs/editor/editingevolved)
- Split editors/editor groups (grid layout), preview tabs, pinned tabs, diff editor (side-by-side and inline, with moved-code detection), 3-way merge editor, "Compare with Saved/Clipboard/Selected". — [User interface](https://code.visualstudio.com/docs/getstarted/userinterface), [Source control](https://code.visualstudio.com/docs/sourcecontrol/overview)
- File handling: encoding switcher ("Reopen/Save with Encoding", `files.autoGuessEncoding`), line-ending switcher (LF/CRLF), Auto Save (off/afterDelay/onFocusChange/onWindowChange), Hot Exit (unsaved buffers restored on restart via backups), undo history preserved across save, Local History / Timeline, large-file optimisations (`editor.largeFileOptimizations`; tokenisation, wrapping and folding disabled above thresholds; a size limit beyond which the file is opened read-only-ish or refused), binary files not opened as text by default; hex view is **not** built in — it is the separate Microsoft `vscode-hexeditor` extension. — [Basic editing](https://code.visualstudio.com/docs/editor/codebasics), [Hex Editor extension](https://github.com/microsoft/vscode-hexeditor)

**Tier B — language intelligence (all [B])**
- Syntax highlighting (TextMate grammars; semantic tokens overlay from language servers), IntelliSense completion, parameter hints/signature help, hover, diagnostics (squiggles + Problems panel), go to definition/declaration/type definition/implementation, peek, find all references, rename symbol, code actions/quick fixes/refactorings, format document/selection/on save/on type, inlay hints, CodeLens, document/workspace symbols, call & type hierarchy, linked editing, colour decorators, snippets (TextMate-style with tabstops/placeholders/variables), Emmet (built in for HTML/CSS/JSX). — [IntelliSense](https://code.visualstudio.com/docs/editor/intellisense), [Programmatic language features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features), [Snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets), [Emmet](https://code.visualstudio.com/docs/editor/emmet)
- Out of the box, VS Code ships rich language *services* only for JS/TS, HTML, CSS/SCSS/Less, JSON and Markdown; everything else (Python, Rust, Go, C/C++, Java, C#…) is highlighting-only until an extension is installed. — [Languages overview](https://code.visualstudio.com/docs/languages/overview)

**Tier C — workbench (all [B])**
- File explorer (tree, drag/drop, file nesting, outline, timeline, open editors), Quick Open (Ctrl+P fuzzy file finder) and Command Palette, search/replace across files (ripgrep-backed, include/exclude globs, regex, search editor), Source Control view (staging, diff, commit, branches, gutter change indicators, blame via extensions/built-in in recent versions, merge editor), integrated terminal (xterm.js + node-pty, shell integration, profiles, splits, links), Problems, Output, Debug Console, Tasks (`tasks.json`, problem matchers), Debugger (DAP; breakpoints, call stack, variables, watch, launch configs), Testing view, Settings editor (GUI + JSON), Keyboard Shortcuts editor, Extensions view/Marketplace, Profiles, Workspaces incl. multi-root (`.code-workspace`), Workspace Trust, Remote Development (SSH/WSL/Containers/Tunnels — the server component and some extensions are proprietary), Notebooks (Jupyter via extension), Settings Sync, Accessibility features, Chat/agents/MCP (Copilot). — [Docs index](https://code.visualstudio.com/docs), [Workspace Trust](https://code.visualstudio.com/docs/editor/workspace-trust), [Multi-root](https://code.visualstudio.com/docs/editor/multi-root-workspaces), [Remote](https://code.visualstudio.com/docs/remote/remote-overview)

### Inferences
- **Daily (expected by anyone who says "VS Code-level")**: tabs + split view; multi-cursor; find/replace with regex; syntax highlighting for every file type; folding; bracket matching; indentation detection; word wrap toggle; minimap (polarising but expected); go to line; Quick Open fuzzy file finder; command palette; file explorer; search across files; auto-save + hot exit; encoding/EOL in status bar; diff view; format on save; completion + diagnostics + go-to-definition for the user's main 1–3 languages; integrated terminal; Git gutter + stage/commit/diff; themes; keybinding customisation.
- **Weekly/occasional**: column selection; sticky scroll; breadcrumbs; rename symbol; find references; code actions; snippets; Emmet; outline; Problems panel; Markdown preview; compare two files; multi-root; settings GUI.
- **Rare for a personal all-in-one tool (and expensive)**: debugger; testing view; tasks/problem matchers; remote development; notebooks; profiles; settings sync; workspace trust; extension marketplace; 3-way merge editor; call/type hierarchy.
- For a tool that is *also* an office and PDF suite, the editor's realistic job is "open and edit anything pleasantly, be competent for light coding", not "replace the user's IDE". That makes Tier A + highlighting + a thin slice of Tier B/C the product, and puts the heavy Tier C items out of scope.

### Gaps
- No trustworthy public per-feature usage telemetry for VS Code was found; the daily/rare split is judgement, not data.
- VS Code docs pages were not fetched in this session; exact setting names and thresholds (e.g. large-file size limits) should be checked against the linked docs before being quoted in a plan.

---

## 2. Syntax highlighting and language detection

### Takeaway
Two mature, permissively licensed routes cover "any language": TextMate grammars (the VS Code/Shiki ecosystem, roughly 260 bundled grammars, identical output to VS Code and able to reuse VS Code themes) and tree-sitter via WASM (roughly 300–340 grammars, incremental and structural, but each grammar is a separate WASM binary plus hand-written highlight queries of uneven quality). A pragmatic stack is: whatever the chosen editor natively supports → TextMate/Shiki grammar as the broad fallback → plain text. Detection is a cheap pipeline: filename/extension table from Linguist data → shebang → modeline → optional ML content guess.

### Cited Findings

**TextMate route**
- `vscode-textmate` 9.3.2 (MIT, modified 2026-07) and `vscode-oniguruma` 2.0.1 (MIT) are the tokeniser and WASM regex engine VS Code itself uses; VS Code `main` currently pins `vscode-textmate ^9.3.2` and `vscode-oniguruma 1.7.0`. — [R: npm [vscode-textmate](https://www.npmjs.com/package/vscode-textmate), [vscode-oniguruma](https://www.npmjs.com/package/vscode-oniguruma), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- Shiki is at 4.6.0 (MIT, published 2026-11-02; v4.0.0 shipped 2026-02-27). Grammars and themes are distributed as `@shikijs/langs` / `@shikijs/themes` 4.6.0, sourced from the `tm-grammars` (1.32.22) and `tm-themes` (1.12.12) packages. — [R: npm [shiki](https://www.npmjs.com/package/shiki), [tm-grammars](https://www.npmjs.com/package/tm-grammars), [tm-themes](https://www.npmjs.com/package/tm-themes)]
- The `tm-grammars` README table lists about 260 grammars (my line count of the table rows on 2026-11-21; approximate). — [R: [tm-grammars README](https://raw.githubusercontent.com/shikijs/textmate-grammars-themes/main/packages/tm-grammars/README.md)]
- `@shikijs/monaco` 4.6.0 (MIT) is an official adapter that replaces Monaco's Monarch tokenisers with Shiki/TextMate highlighting and VS Code themes. — [R: npm [@shikijs/monaco](https://www.npmjs.com/package/@shikijs/monaco)]
- Shiki offers a pure-JavaScript regex engine as an alternative to the Oniguruma WASM engine (smaller, no WASM, not 100% grammar-compatible), and its grammars are lazy-loadable per language. — [B: [Shiki regex engines](https://shiki.style/guide/regex-engines)]
- Shiki is designed as a static highlighter (string → tokens/HTML); it has a line-by-line grammar-state API but is not an incremental editor highlighter by itself — editor use relies on the adapter (Monaco) or on calling `vscode-textmate` directly with per-line state caching. — [B: [Shiki grammar state](https://shiki.style/guide/grammar-state)]

**Tree-sitter route**
- tree-sitter core is at 0.28.0 on `master`; the WASM binding `web-tree-sitter` is 0.27.2 on npm (MIT, 2026-11-07). — [R: [tree-sitter Cargo.toml](https://raw.githubusercontent.com/tree-sitter/tree-sitter/master/Cargo.toml), npm [web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter)]
- Prebuilt WASM grammar bundles exist on npm: `tree-sitter-wasms` 0.1.13 (Unlicense, last modified 2025-10, i.e. about a year stale) and Microsoft's `@vscode/tree-sitter-wasm` 0.3.1 (MIT, 2026-04), which VS Code itself depends on. — [R: npm [tree-sitter-wasms](https://www.npmjs.com/package/tree-sitter-wasms), [@vscode/tree-sitter-wasm](https://www.npmjs.com/package/@vscode/tree-sitter-wasm), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- Helix's `languages.toml` defines 342 languages and 303 tree-sitter grammars (counted 2026-11-21). nvim-treesitter's supported-languages list has roughly 340 parser entries (approximate line count). — [R: [helix languages.toml](https://raw.githubusercontent.com/helix-editor/helix/master/languages.toml), [nvim-treesitter SUPPORTED_LANGUAGES.md](https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/main/SUPPORTED_LANGUAGES.md)]
- Zed uses tree-sitter for all built-in language features; language extensions register a grammar by Git repository + revision and supply tree-sitter query files (highlights, brackets, outline, indents, injections…). — [R: [Zed language extensions doc](https://raw.githubusercontent.com/zed-industries/zed/main/docs/src/extensions/languages.md)]
- Neovim and Helix use tree-sitter highlighting; GitHub uses tree-sitter for code navigation and (for many languages) highlighting on github.com. — [B: [tree-sitter site](https://tree-sitter.github.io/tree-sitter/)]
- Highlight queries (`highlights.scm`) are **not** standardised across editors: Neovim, Helix and Zed each maintain their own query sets with different capture names, so "grammar available" does not mean "good highlighting available for my editor". — [B: [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter), [Helix adding languages](https://docs.helix-editor.com/guides/adding_languages.html)]

**Lezer**
- Lezer (`@lezer/common` 1.5.6, MIT, updated 2026-11-20) is CodeMirror 6's incremental parser system; first-party grammars cover a few dozen mainstream languages, with CodeMirror's `legacy-modes` (ported CM5 stream parsers) covering roughly 100 more at lower fidelity. — [R for version: npm [@lezer/common](https://www.npmjs.com/package/@lezer/common)]; [B for coverage: [Lezer](https://lezer.codemirror.net/), [codemirror/legacy-modes](https://github.com/codemirror/legacy-modes)]

**Language detection**
- GitHub Linguist's `languages.yml` contains 849 language entries (counted 2026-11-21) with extensions, filenames, interpreters (shebang) and aliases; it is MIT licensed. The npm package `linguist-languages` 9.5.0 (MIT, 2026-08) republishes this data as JS/JSON. — [R: [linguist languages.yml](https://raw.githubusercontent.com/github-linguist/linguist/main/lib/linguist/languages.yml), npm [linguist-languages](https://www.npmjs.com/package/linguist-languages)]
- `@vscode/vscode-languagedetection` 1.0.23 (MIT, republished 2026-06) is the ML content-based detector VS Code uses for untitled files; it is "powered by guesslang's model" and runs in JS. VS Code still pins exactly this version. — [R: [vscode-languagedetection README](https://raw.githubusercontent.com/microsoft/vscode-languagedetection/main/README.md), npm [@vscode/vscode-languagedetection](https://www.npmjs.com/package/@vscode/vscode-languagedetection), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- The upstream guesslang Python project covers about 54 languages and has been effectively unmaintained for years (its README was not found at the expected path in this session). — [B: [yoeo/guesslang](https://github.com/yoeo/guesslang)]

### Inferences
- "Any language" realistically means about 250–350 languages with real grammars plus graceful plain-text fallback. Either ecosystem reaches that; TextMate/Shiki is cheaper to adopt wholesale in a JS app because grammars + themes come as one maintained npm bundle and match VS Code's look, which lets users bring any VS Code theme.
- Tree-sitter earns its cost only if structural features are wanted without LSP (syntax-aware selection, outline, folding, sticky scroll, bracket matching in languages with no server). It could be added later for the top 20–30 languages only.
- Detection order to implement: user override → exact filename (`Dockerfile`, `Makefile`, `.gitignore`) → extension → shebang → Emacs/Vim modeline → content model (only for extensionless/untitled) → plain text. Linguist data covers the first four.
- The ML detector is small and offline, but its model is old and frozen; treat it as a hint and never override an extension match.

### Gaps
- Exact Shiki bundled language/theme counts for v4.6 were not confirmed from shiki.style (site not fetched); 260 is my count of the grammar README rows.
- No benchmark was gathered comparing vscode-textmate vs web-tree-sitter throughput on very large files.

---

## 3. Language Server Protocol and server management

### Takeaway
LSP 3.18 is the current published spec (3.19 is marked upcoming). In Electron the standard design is: spawn each server as a child process over stdio from the main (or a utility) process, speak JSON-RPC with `vscode-jsonrpc`, and bridge to the editor in the renderer. The hard part is not the protocol but distribution — servers come in at least five runtime flavours (Node, native binary, Python wheel, JVM, .NET) — and every successful non-VS-Code editor has converged on "download on demand from a catalogue" rather than bundling. mason-registry is the most reusable open catalogue.

### Cited Findings

**Protocol and client libraries**
- The LSP site's own index lists 3.18 as "Current", 3.19 as "Upcoming" and 3.17 as "Previous"; base protocol 0.9 is "Upcoming". — [R: [language-server-protocol specifications.yml](https://raw.githubusercontent.com/microsoft/language-server-protocol/gh-pages/_data/specifications.yml)]; spec at [LSP 3.18](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification)
- `vscode-jsonrpc` 10.0.0, `vscode-languageserver-protocol` 3.18.5 and `vscode-languageclient` 11.0.0 (all MIT) were published 2026-10-22. — [R: npm [vscode-jsonrpc](https://www.npmjs.com/package/vscode-jsonrpc), [vscode-languageserver-protocol](https://www.npmjs.com/package/vscode-languageserver-protocol), [vscode-languageclient](https://www.npmjs.com/package/vscode-languageclient)]
- `vscode-languageclient` depends on the `vscode` extension API and therefore only runs inside a VS Code extension host (or a shim of it); outside VS Code the usable pieces are `vscode-jsonrpc` (transport: stdio, IPC, sockets, MessagePort/web-worker) and `vscode-languageserver-protocol` (typed request/notification definitions). — [B: [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node)]
- `monaco-languageclient` 11.0.3 (MIT, 2026-10) wires LSP into Monaco by pulling in `@codingame/monaco-vscode-api` 40.0.0 (MIT), which re-packages large parts of the VS Code workbench/services as a library. CodeMirror 6 has an official `@codemirror/lsp-client` package. — [R for versions: npm [monaco-languageclient](https://www.npmjs.com/package/monaco-languageclient), [@codingame/monaco-vscode-api](https://www.npmjs.com/package/@codingame/monaco-vscode-api)]; [B: [codemirror/lsp-client](https://github.com/codemirror/lsp-client)]

**Servers: version, licence, runtime** (versions read 2026-11-21)

| Language(s) | Server | Version | Licence | Runtime / distribution | Tag |
|---|---|---|---|---|---|
| TS/JS | typescript-language-server | 6.1.0 | Apache-2.0 | Node; wraps `tsserver` | [R: [npm](https://www.npmjs.com/package/typescript-language-server)] |
| TS/JS | vtsls (`@vtsls/language-server`) | 0.3.0 (last publish 2025-12) | MIT | Node; wraps VS Code's TS extension | [R: [npm](https://www.npmjs.com/package/@vtsls/language-server)] |
| TS/JS | TypeScript 7 (Go-native compiler with built-in LSP) | `typescript` 7.0.2 (2026-07-08) | Apache-2.0 | native binary via npm | [R: [npm](https://www.npmjs.com/package/typescript)] |
| Python | pyright | 1.1.414 | MIT | Node | [R: [npm](https://www.npmjs.com/package/pyright)] |
| Python | basedpyright | 1.40.2 | MIT | Node (also PyPI wheel bundling Node) | [R: [npm](https://www.npmjs.com/package/basedpyright)] |
| Python lint/format | ruff (`ruff server`) | 0.17.6 | MIT | single native binary | [R: [ruff pyproject](https://raw.githubusercontent.com/astral-sh/ruff/main/pyproject.toml), [LICENSE](https://raw.githubusercontent.com/astral-sh/ruff/main/LICENSE)] |
| Python types | ty (Astral) | 0.0.107 (still 0.0.x) | MIT | single native binary | [R: [ty pyproject](https://raw.githubusercontent.com/astral-sh/ty/main/pyproject.toml)] |
| Rust | rust-analyzer | rolling weekly | MIT OR Apache-2.0 | native binary; needs Rust toolchain | [R: [Cargo.toml](https://raw.githubusercontent.com/rust-lang/rust-analyzer/master/Cargo.toml)] |
| Go | gopls | (version not read) | BSD-3-Clause | native binary; needs Go toolchain | [B: [gopls](https://github.com/golang/tools/tree/master/gopls)] |
| C/C++ | clangd | LLVM trunk is 24.x | Apache-2.0 WITH LLVM-exception | native binary | [R for trunk major: [LLVMVersion.cmake](https://raw.githubusercontent.com/llvm/llvm-project/main/cmake/Modules/LLVMVersion.cmake)]; [B licence] |
| Lua | lua-language-server | 3.19.2 | MIT | native binary | [R: [changelog](https://raw.githubusercontent.com/LuaLS/lua-language-server/master/changelog.md), [LICENSE](https://raw.githubusercontent.com/LuaLS/lua-language-server/master/LICENSE)] |
| HTML/CSS/JSON/ESLint | vscode-langservers-extracted | 4.10.0 (**last publish 2024-05**) | MIT | Node | [R: [npm](https://www.npmjs.com/package/vscode-langservers-extracted), [README](https://raw.githubusercontent.com/hrsh7th/vscode-langservers-extracted/master/README.md)] |
| HTML/CSS/JSON (in-process libs) | vscode-html-languageservice 5.6.2, vscode-css-languageservice 6.3.10, vscode-json-languageservice 6.0.0-next.3 | — | MIT | plain JS libraries, can run in a web worker with no child process | [R: npm [html](https://www.npmjs.com/package/vscode-html-languageservice), [css](https://www.npmjs.com/package/vscode-css-languageservice), [json](https://www.npmjs.com/package/vscode-json-languageservice)] |
| YAML | yaml-language-server | 2.0.0 (2026-11-11) | MIT | Node | [R: [npm](https://www.npmjs.com/package/yaml-language-server)] |
| TOML | taplo | CLI 0.10.0; `@taplo/lsp` npm 0.8.0 last published 2024-02 | MIT | native binary or WASM | [R: [taplo Cargo.toml](https://raw.githubusercontent.com/tamasfe/taplo/master/crates/taplo-cli/Cargo.toml), [npm](https://www.npmjs.com/package/@taplo/lsp)] |
| TOML | tombi (newer alternative) | git-tag versioned | MIT | native binary | [R existence: [tombi Cargo.toml](https://raw.githubusercontent.com/tombi-toml/tombi/main/Cargo.toml)]; [B licence] |
| Markdown | marksman | (version not read) | MIT | native (.NET single-file) binary | [R licence: [LICENSE](https://raw.githubusercontent.com/artempyanykh/marksman/main/LICENSE)] |
| Markdown | markdown-oxide | 0.25.12 | Apache-2.0 | native binary | [R: [Cargo.toml](https://raw.githubusercontent.com/Feel-ix-343/markdown-oxide/main/Cargo.toml), [LICENSE](https://raw.githubusercontent.com/Feel-ix-343/markdown-oxide/main/LICENSE)] |
| Markdown (lib) | vscode-markdown-languageservice | 0.5.0 | MIT | JS library | [R: [npm](https://www.npmjs.com/package/vscode-markdown-languageservice)] |
| Bash | bash-language-server | 5.8.1 | MIT | Node (uses tree-sitter-bash; shellcheck optional) | [R: [npm](https://www.npmjs.com/package/bash-language-server)] |
| XML | lemminx | 0.31.x | EPL-2.0 | JVM jar or GraalVM native binary | [R: [pom.xml](https://raw.githubusercontent.com/eclipse-lemminx/lemminx/main/pom.xml), [LICENSE](https://raw.githubusercontent.com/eclipse-lemminx/lemminx/main/LICENSE)] |

- Proprietary and therefore **not** reusable: Pylance (Microsoft's Python server; licence restricts use to Microsoft's VS Code builds), C# Dev Kit (tied to Visual Studio licensing), and the Remote-SSH/WSL/Containers extensions. Microsoft's C/C++ extension (`cpptools`) binaries are likewise licensed only for Microsoft's products. Open alternatives: pyright/basedpyright for Python, clangd for C/C++, `csharp-ls` or Roslyn LS for C#. — [B: [Pylance licence](https://marketplace.visualstudio.com/items/ms-python.vscode-pylance/license), [VS Code FAQ on licensing](https://code.visualstudio.com/docs/supporting/faq), [VSCodium docs on proprietary extensions](https://github.com/VSCodium/vscodium/blob/master/docs/index.md)]

**How other editors distribute servers**
- Zed: "When you open a file with a matching file type, Zed automatically downloads the appropriate language server… Zed keeps your language servers up-to-date", and "Language servers are automatically downloaded or launched if found in your path"; an explicit binary path can be set in settings. — [R: [Zed configuring-languages.md](https://raw.githubusercontent.com/zed-industries/zed/main/docs/src/configuring-languages.md)]
- Zed 1.0 shipped 29 April 2026; reviewers flagged concern that Zed downloads and runs packages including Node.js without explicit user consent. — [S: [The Register](https://www.theregister.com/2026/04/30/zed_team_releases_version_10/), [Zed blog](https://zed.dev/blog/zed-1-0)]
- Helix never downloads servers: "To use Language Server features, you must first configure the appropriate Language Server"; it only ships default command names in `languages.toml` and `hx --health` reports what is found on PATH. — [R: [Helix lang-support.md](https://raw.githubusercontent.com/helix-editor/helix/master/book/src/lang-support.md)]
- Neovim: core ships an LSP client but no installer; the community `mason.nvim` plugin installs LSP servers, DAP adapters, linters and formatters into a private directory, driven by `mason-registry`, whose "compiled registry contents are available via releases" (a single downloadable JSON registry). Package specs are YAML with a purl-style source (npm, pypi, cargo, GitHub release asset per platform, etc.). — [R for registry description: [mason-registry README](https://raw.githubusercontent.com/mason-org/mason-registry/main/README.md)]; [B for spec format: [mason-registry CONTRIBUTING](https://github.com/mason-org/mason-registry/blob/main/CONTRIBUTING.md)]
- Lapce uses WASI plugins ("Volts") that download/launch language servers; its changelog still shows 0.4.6 as the latest numbered release with an "Unreleased" section on top. — [R: [Lapce CHANGELOG](https://raw.githubusercontent.com/lapce/lapce/master/CHANGELOG.md)]; [B for plugin model: [Lapce docs](https://docs.lapce.dev/)]

### Inferences
- A three-level policy minimises effort and risk: (1) **in-process, zero-install** for JSON/CSS/HTML/Markdown using the `vscode-*-languageservice` libraries in a worker (same code VS Code uses, no child processes, works offline from day one); (2) **PATH discovery** Helix-style for everything else ("found `rust-analyzer` on PATH, use it"); (3) **opt-in download** via a mason-registry-derived catalogue later. This avoids Zed's "silently downloads Node" criticism, which matters for an offline-first personal tool.
- Node-based servers (pyright, yaml-ls, bash-ls, typescript-language-server) can run on Electron's own Node via `utilityProcess`/`ELECTRON_RUN_AS_NODE`, so no separate Node install is needed; native-binary servers (ruff, rust-analyzer, clangd, taplo, lua-ls, marksman) need per-platform downloads; lemminx is the awkward one (JVM or large native image) — XML can instead get schema-less well-formedness checking cheaply.
- `vscode-langservers-extracted` not having been published since May 2024 is a maintenance signal; the underlying Microsoft service libraries are current, so prefer those directly.
- TypeScript 7 being a native binary with its own LSP changes the JS/TS story: `typescript-language-server`/vtsls (tsserver wrappers) may become legacy. Which server to target for TS should be re-checked at build time.
- An LSP client written directly on `vscode-jsonrpc` needs roughly: lifecycle (initialize/shutdown/restart-on-crash), document sync (incremental), and per-feature adapters. The v1-worthy subset is diagnostics, completion (+resolve), hover, signature help, definition, formatting; references/rename/code actions/semantic tokens/inlay hints are each incremental additions.

### Gaps
- mason-registry's current package count could not be read (site and GitHub API unreachable); background recollection is "several hundred packages" — verify at [mason-registry.dev](https://mason-registry.dev/registry/list).
- gopls and marksman current version numbers were not read.
- Whether TypeScript 7's built-in LSP is feature-complete relative to tsserver as of Nov 2026 was not verified.
- mason-registry's licence (Apache-2.0 from memory) and its terms for third-party consumption of the compiled registry were not re-verified.

---

## 4. Formatters and linters offline; EditorConfig

### Takeaway
Everything needed for offline formatting is MIT-or-similar and either pure JS or a single binary; Prettier alone covers most "any text format" needs in-process, and EditorConfig is a tiny pure-JS dependency.

### Cited Findings
- Prettier 3.10.1 (MIT, 2026-11-12): pure JS, runs in-process or in a worker; built-in support for JS/TS/JSX, CSS/SCSS/Less, HTML/Vue, JSON, Markdown/MDX, YAML, GraphQL; plugins for others. — [R version: npm [prettier](https://www.npmjs.com/package/prettier)]; [B language list: [prettier.io](https://prettier.io/docs/)]
- Biome 2.6.8 (MIT OR Apache-2.0, 2026-11-15; v2.0.0 was 2025-06-17): single native binary (also WASM), formatter + linter + LSP for JS/TS/JSON/CSS and more. — [R: npm [@biomejs/biome](https://www.npmjs.com/package/@biomejs/biome)]
- dprint 0.65.0 (MIT, 2026-11-16): native CLI with WASM formatter plugins (TS, JSON, Markdown, TOML, Dockerfile…); plugins are fetched by URL but can be vendored. — [R version: npm [dprint](https://www.npmjs.com/package/dprint)]; [B: [dprint.dev](https://dprint.dev/)]
- Ruff 0.17.6 (MIT): Python linter + formatter + language server in one binary. — [R: [ruff pyproject](https://raw.githubusercontent.com/astral-sh/ruff/main/pyproject.toml)]
- ESLint 10.15.0 (MIT; v10.0.0 on 2026-02-06): JS; normally resolved from the *project's* `node_modules`, not bundled by the editor. oxlint 1.94.0 (MIT) is the fast native alternative. — [R: npm [eslint](https://www.npmjs.com/package/eslint), [oxlint](https://www.npmjs.com/package/oxlint)]
- `editorconfig` 4.0.1 (MIT, 2026-11-14) is the reference JS core for parsing `.editorconfig` (indent_style, indent_size, end_of_line, charset, trim_trailing_whitespace, insert_final_newline, max_line_length). — [R version: npm [editorconfig](https://www.npmjs.com/package/editorconfig)]; [B properties: [editorconfig.org](https://editorconfig.org/)]
- markdownlint 0.42.2 (MIT) provides in-process Markdown linting. — [R: npm [markdownlint](https://www.npmjs.com/package/markdownlint)]

### Inferences
- v1: bundle Prettier (covers JSON/YAML/Markdown/HTML/CSS/JS/TS) + `editorconfig`; add `taplo`/`smol-toml`-based TOML formatting and ruff as optional binaries later. Linters beyond what language servers already emit as diagnostics are low value for this product.
- Respect project-local tools first (project's own Prettier/ESLint/Biome config) only if/when "folder as workspace" exists; for loose files, bundled defaults are enough.

### Gaps
- Bundle-size impact of shipping Prettier with all built-in parsers was not measured.

---

## 5. Schema-driven config editing (JSON Schema Store)

### Takeaway
SchemaStore gives validation, completion and hover docs for well over a thousand config-file formats essentially for free, across JSON, YAML and TOML, and can be snapshotted for offline use.

### Cited Findings
- The SchemaStore catalogue (`catalog.json`) listed 1,608 schemas on 2026-11-21, each with `fileMatch` globs and a schema URL. — [R: [schemastore catalog API](https://www.schemastore.org/api/json/catalog.json)]
- yaml-language-server uses it by default: `yaml.schemaStore.enable` defaults to `true` and `yaml.schemaStore.url` defaults to `https://www.schemastore.org/api/json/catalog.json` (i.e. a network fetch unless overridden). — [R: [yaml-language-server README](https://raw.githubusercontent.com/redhat-developer/yaml-language-server/main/README.md)]
- SchemaStore's repository is Apache-2.0; individual schemas are contributed under that licence, though some catalogue entries point at schemas hosted externally by their projects. — [B: [SchemaStore/schemastore](https://github.com/SchemaStore/schemastore)]
- `vscode-json-languageservice` (MIT) accepts schemas programmatically via a custom `schemaRequestService`, so a local on-disk schema cache can be substituted for HTTP; taplo supports JSON-Schema-driven TOML validation/completion and SchemaStore associations. — [B: [vscode-json-languageservice](https://github.com/microsoft/vscode-json-languageservice), [taplo docs](https://taplo.tamasfe.dev/)]
- Supporting libraries: `ajv` 8.20.0 (MIT) for standalone validation, `jsonc-parser` 3.3.1 (MIT) for JSON-with-comments editing, `yaml` 2.9.1 (ISC), `smol-toml` 1.9.1 (BSD-3-Clause). — [R: npm [ajv](https://www.npmjs.com/package/ajv), [jsonc-parser](https://www.npmjs.com/package/jsonc-parser), [yaml](https://www.npmjs.com/package/yaml), [smol-toml](https://www.npmjs.com/package/smol-toml)]

### Inferences
- For offline-first: vendor `catalog.json` plus the top ~50–100 schemas (package.json, tsconfig, GitHub workflows, docker-compose, Cargo.toml, pyproject.toml, etc.) at build time, lazily fetch and cache the rest when online, and make the network fetch a visible setting. This is one of the highest value-per-effort features for a "edit any config file" tool.
- The same JSON-schema machinery should drive the app's own settings.json editing (VS Code does exactly this).

### Gaps
- Total size of a full SchemaStore snapshot was not measured.

---

## 6. Debugging (Debug Adapter Protocol)

### Takeaway
DAP itself is small and stable, but a usable debugger is a large UI and per-language configuration project; it is reasonable — and consistent with what small-team editors did — to exclude it.

### Cited Findings
- The DAP changelog's newest entry is 1.71.x (integer ranges, `outputPresentation` on `StartDebuggingRequestArguments`, clarifications); 1.68–1.70 were similarly incremental. — [R: [DAP changelog](https://raw.githubusercontent.com/microsoft/debug-adapter-protocol/main/changelog.md)]; spec at [DAP overview](https://microsoft.github.io/debug-adapter-protocol/overview)
- `@vscode/debugadapter` 1.68.0 (MIT) is the adapter-side SDK; there is no official standalone *client* library — VS Code's client lives inside the workbench. — [R version: npm [@vscode/debugadapter](https://www.npmjs.com/package/@vscode/debugadapter)]; [B]
- A DAP client needs: adapter process management, launch/attach configuration schema per adapter, breakpoints (line/conditional/logpoint/exception) with gutter UI, threads/call stack/scopes/variables trees with lazy expansion, watch expressions, debug console/REPL with evaluation, stepping toolbar, inline values, `runInTerminal` reverse requests (which requires an integrated terminal), and source mapping. — [B: [DAP specification](https://microsoft.github.io/debug-adapter-protocol/specification)]
- Debug adapters are distributed separately per language (debugpy, codelldb, delve, js-debug…), several only as VS Code extensions; mason-registry catalogues DAP adapters alongside LSP servers. — [B: [mason-registry](https://github.com/mason-org/mason-registry)]
- Zed shipped a debugger only in 2025, years after launch and with a funded team; Helix's DAP support has remained labelled experimental. — [B: [Zed debugger blog](https://zed.dev/blog/debugger), [Helix docs](https://docs.helix-editor.com/)]

### Inferences
- Exclude from v1 and v2. The integrated terminal covers "run my script"; anyone who needs breakpoints already has an IDE. Revisit only if the tool's audience shifts toward developers.

### Gaps
- No effort estimate from a primary source (person-months for a DAP client) was found; the "large" judgement rests on the feature list above and on how late Zed/Helix delivered it.

---

## 7. Search across files, fuzzy file finder, symbol search

### Takeaway
Ship ripgrep as a sidecar binary exactly as VS Code does; it provides search-in-files, the file list for the fuzzy finder (`rg --files` honours `.gitignore`), and binary/encoding handling. Replace-across-files and fuzzy ranking are app-side code.

### Cited Findings
- ripgrep is at 15.2.0 on `master` (dual MIT/Unlicense). — [R version: [ripgrep Cargo.toml](https://raw.githubusercontent.com/BurntSushi/ripgrep/master/Cargo.toml)]; [B licence: [ripgrep](https://github.com/BurntSushi/ripgrep)]
- `@vscode/ripgrep` 1.18.0 (MIT, 2026-06) downloads a prebuilt rg binary at install time and exports `rgPath`; VS Code itself now depends on `@vscode/ripgrep-universal ^1.18.0`. — [R: npm [@vscode/ripgrep](https://www.npmjs.com/package/@vscode/ripgrep), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- ripgrep features relevant to an editor: `--json` streaming output with byte offsets and submatches, `.gitignore`/`.ignore`/`.rgignore` handling, glob include/exclude, automatic binary-file skipping, `-E/--encoding` plus BOM sniffing for UTF-16, PCRE2 mode (`-P`) for lookaround/backreferences, multiline (`-U`), `--files` to list candidate files. rg does not write files — replace must be done by the host. — [B: [ripgrep GUIDE](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)]
- When packaging with Electron the rg binary must be unpacked from the asar archive (e.g. `asarUnpack`) and the path adjusted to `app.asar.unpacked`. — [B: [vscode-ripgrep README](https://github.com/microsoft/vscode-ripgrep)]
- Fuzzy finding: `fd` 10.5.2 (MIT/Apache-2.0) is an optional alternative lister; JS scorers include `fzf` (fzf-for-js) 0.5.2 (BSD-3-Clause, last published 2023-04 — stale) and `fuzzysort` 4.0.2 (MIT, 2026-08). — [R: [fd Cargo.toml](https://raw.githubusercontent.com/sharkdp/fd/master/Cargo.toml), npm [fzf](https://www.npmjs.com/package/fzf), [fuzzysort](https://www.npmjs.com/package/fuzzysort)]
- Symbol search: in-file symbols come from LSP `textDocument/documentSymbol` (or tree-sitter/TextMate heuristics, or Markdown headings); workspace-wide symbols come from LSP `workspace/symbol` and only exist where a server is running. — [B: [LSP 3.18 spec](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification)]

### Inferences
- v1: rg sidecar + results tree + regex/case/word toggles + include/exclude globs; Quick Open backed by `rg --files` cached and refreshed by the file watcher, scored with `fuzzysort` or a ported VS Code/fzf scorer.
- Replace-across-files should apply through the editor's buffer model for open files and direct file writes for the rest, with a preview diff and a single undo step — this is where bugs hide (encodings, EOLs, files changed since search).
- `fd` is unnecessary if rg is already shipped.

### Gaps
- Whether `@vscode/ripgrep-universal` (the package VS Code now uses) supersedes `@vscode/ripgrep` for third parties was not investigated.

---

## 8. File explorer, watching, workspaces, trust

### Takeaway
Use `@parcel/watcher` (what VS Code uses) for recursive watching and a virtualised tree with lazy directory loading; multi-root and workspace trust are complexity multipliers that a personal tool can defer or drop.

### Cited Findings
- `@parcel/watcher` 2.6.0 (MIT, 2026-07) is a native C++ module with backends for FSEvents (macOS), inotify (Linux), ReadDirectoryChangesW (Windows), kqueue (FreeBSD) and Watchman if installed; it supports ignore globs and `writeSnapshot`/`getEventsSince` to query changes that happened while the app was closed. VS Code depends on `@parcel/watcher ^2.5.6`. — [R: [parcel watcher README](https://raw.githubusercontent.com/parcel-bundler/watcher/master/README.md), npm [@parcel/watcher](https://www.npmjs.com/package/@parcel/watcher), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- chokidar's current major is v6 (Oct 2026): "complete rewrite; new fs.watch(recursive) backend on macos + windows; requires Node.js 22+"; v5 (Nov 2025) became ESM-only; v4 (Sep 2024) removed glob support and the fsevents dependency. It is pure JS (no native build). — [R: [chokidar README](https://raw.githubusercontent.com/paulmillr/chokidar/main/README.md), npm [chokidar](https://www.npmjs.com/package/chokidar)]
- Linux inotify has a per-user watch limit (`fs.inotify.max_user_watches`); VS Code documents the "unable to watch for file changes in this large workspace" (ENOSPC) error and the sysctl fix, and uses `files.watcherExclude` to skip `node_modules`, `.git/objects`, etc. — [B: [VS Code Linux FAQ](https://code.visualstudio.com/docs/setup/linux#_visual-studio-code-is-unable-to-watch-for-file-changes-in-this-large-workspace-error-enospc)]
- `.gitignore` handling in JS: `ignore` 7.0.16 (MIT) implements gitignore pattern semantics. — [R: npm [ignore](https://www.npmjs.com/package/ignore)]
- Multi-root workspaces in VS Code are `.code-workspace` JSON files listing folders plus workspace-scoped settings; Workspace Trust ("Restricted Mode") disables tasks, debugging, workspace settings that execute code, and extensions that have not opted in. — [B: [Multi-root workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces), [Workspace Trust](https://code.visualstudio.com/docs/editor/workspace-trust)]

### Inferences
- `@parcel/watcher` is a native module (needs Electron-compatible prebuilds, which it publishes per platform); chokidar v6 is the no-native-build alternative now that it uses `fs.watch({recursive})`, though Linux still needs per-directory watches. For a tool that mostly opens single files and modest folders, either works; parcel's snapshot feature is useful for "what changed since last launch".
- Minimal explorer: lazy-loaded virtualised tree, new/rename/delete/move (to OS trash), reveal in OS file manager, dimming of git-ignored files, default excludes. Watching single open files for external modification ("file changed on disk — reload?") is mandatory from v1 even without a folder tree.
- Workspace trust becomes necessary only once the app auto-executes anything from a folder (tasks, project-local formatters/linters, language servers that run build scripts such as rust-analyzer's proc-macros/build.rs). A simpler rule — never auto-run project-supplied code without a per-folder prompt — covers it.
- Multi-root: defer; a single "open folder" plus loose files covers personal use.

### Gaps
- No current benchmark comparing chokidar v6 vs @parcel/watcher on very large trees was found.
- Tree virtualisation library choice depends on the UI framework chosen by the app-shell track; not evaluated here.

---

## 9. Integrated terminal

### Takeaway
xterm.js 6 + node-pty is the only mainstream choice for Electron and is what VS Code ships; the cost is one native module that must match Electron's ABI on three operating systems.

### Cited Findings
- `@xterm/xterm` 6.0.0 was published 2025-12-22 (MIT). 6.0 removed the canvas renderer addon ("recommends the DOM renderer or WebGL"), reworked the viewport/scroll bar, added synchronized output (DEC mode 2026), OSC 52 clipboard support, ESM builds, a progress addon, and shadow-DOM support for WebGL. — [R: [xterm.js releases](https://github.com/xtermjs/xterm.js/releases), npm [@xterm/xterm](https://www.npmjs.com/package/@xterm/xterm)]
- Current addon versions (all MIT): webgl 0.19.0, fit 0.11.0, search 0.16.0, serialize 0.14.0, web-links 0.12.0, unicode-graphemes 0.4.0, image 0.9.0, ligatures 0.10.0, clipboard 0.2.0; `@xterm/headless` 6.0.0. VS Code tracks 6.1.0 betas. — [R: npm [@xterm/addon-webgl](https://www.npmjs.com/package/@xterm/addon-webgl), [@xterm/addon-fit](https://www.npmjs.com/package/@xterm/addon-fit), [@xterm/addon-search](https://www.npmjs.com/package/@xterm/addon-search), [@xterm/addon-serialize](https://www.npmjs.com/package/@xterm/addon-serialize), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- node-pty 1.1.0 (MIT, published 2025-12-22): winpty support removed — "Windows 10 version 1809 (build 18309) or later is now required" (ConPTY only). It uses `node-addon-api` (Node-API), and its install script is `node scripts/prebuild.js || node-gyp rebuild`; the 1.1.0 tarball's `prebuilds/` directory contains exactly four platforms — darwin-arm64, darwin-x64, win32-arm64, win32-x64 (including bundled `conpty.dll`/`OpenConsole.exe`) — and **no Linux prebuild**, so Linux installs fall through to `node-gyp rebuild`. — [R: [node-pty README](https://raw.githubusercontent.com/microsoft/node-pty/main/README.md), npm [node-pty](https://www.npmjs.com/package/node-pty) (tarball inspected)]
- Prebuilt forks: `@lydell/node-pty` 1.2.0-beta.18 (MIT, 2026-10) and `@homebridge/node-pty-prebuilt-multiarch` 0.15.0 (MIT, 2026-10). VS Code itself uses `node-pty ^1.2.0-beta.18`. — [R: npm [@lydell/node-pty](https://www.npmjs.com/package/@lydell/node-pty), [@homebridge/node-pty-prebuilt-multiarch](https://www.npmjs.com/package/@homebridge/node-pty-prebuilt-multiarch), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- `@electron/rebuild` 4.2.1 (MIT) rebuilds native modules against Electron's headers; Electron is at 45.4.1. — [R: npm [@electron/rebuild](https://www.npmjs.com/package/@electron/rebuild), [electron](https://www.npmjs.com/package/electron)]
- VS Code shell integration works by injecting shell scripts (bash/zsh/fish/pwsh) that emit OSC 633 sequences marking prompt start, command start/end, exit code and cwd, enabling command decorations, command navigation, "run recent command" and sticky scroll; the terminal host runs in a separate "pty host" process so a terminal crash cannot take down the window. — [B: [Terminal shell integration](https://code.visualstudio.com/docs/terminal/shell-integration)]
- Alternative: `ghostty-web` 0.4.0 (MIT) exposes Ghostty's terminal core via WASM with an xterm.js-like API; it is young (0.x). — [R version: npm [ghostty-web](https://www.npmjs.com/package/ghostty-web)]; [B description]

### Inferences
- Because node-pty is Node-API based and now ships prebuilds for macOS and Windows, the historical "rebuild for every Electron bump" pain is much reduced; Linux has no prebuild in the official package and compiles from source at install time (or use a prebuilt fork such as `@lydell/node-pty` / `@homebridge/node-pty-prebuilt-multiarch`), so CI needs a C++ toolchain on Linux and packaging must unpack the `.node` files and helper executables from asar and code-sign them on macOS/Windows.
- Run node-pty in a utility process, not the renderer; stream data over a MessagePort; keep an `@xterm/headless` + serialize mirror if terminal session restore is wanted.
- Minimum viable terminal: one panel, tabs, default shell detection, cwd = current folder/file dir, fit + webgl + web-links + search addons, copy/paste, theme sync. Shell integration is a v2+ nicety.
- For an office-oriented all-in-one tool a terminal is optional; it becomes important only if the editor is positioned for developers. It is the single largest native-dependency risk in this track.

### Gaps
- Whether the prebuilt forks' binaries load cleanly under the Electron version the app will pin was not tested.
- node-pty's interaction with the Electron version the app will pin (sandbox, hardened runtime entitlements) needs a spike.

---

## 10. Git / source control

### Takeaway
Shelling out to the user's installed `git` (what VS Code does) is the lowest-risk approach; a minimal useful SCM is gutter change bars + changed-files list + diff + stage/commit, and even that is optional for this product.

### Cited Findings
- VS Code's built-in Git extension requires a system Git install and drives it as a child process; it does not embed a Git library. — [B: [VS Code source control docs](https://code.visualstudio.com/docs/sourcecontrol/overview)]
- `simple-git` 4.1.0 (MIT, 2026-11) is a typed wrapper around the git CLI. — [R: npm [simple-git](https://www.npmjs.com/package/simple-git)]
- `dugite` 3.3.3 (MIT, 2026-11) is GitHub Desktop's wrapper that bundles its own Git binaries, removing the "user must install git" requirement at the cost of tens of MB per platform (Git itself is GPL-2.0, shipped as a separate executable). — [R version: npm [dugite](https://www.npmjs.com/package/dugite)]; [B: [desktop/dugite](https://github.com/desktop/dugite)]
- `isomorphic-git` 1.44.17 (MIT, 2026-11-18) is a pure-JS Git implementation; its command list now includes `merge`, `abortMerge`, `findMergeBase` and `stash`. — [R: npm [isomorphic-git](https://www.npmjs.com/package/isomorphic-git), [README](https://raw.githubusercontent.com/isomorphic-git/isomorphic-git/main/README.md)]
- isomorphic-git limitations: slower than native git on large repos, no SSH transport (HTTP(S) only), incomplete coverage of advanced features (rebase, submodules, hooks, some config/attributes behaviour). — [B: [isomorphic-git docs](https://isomorphic-git.org/docs/en/faq)]
- `nodegit` (libgit2 bindings) is 0.27.0 — the same version number it has had for years — and is a native module; libgit2 is GPL-2.0 with a linking exception. — [R version: npm [nodegit](https://www.npmjs.com/package/nodegit)]; [B licence: [libgit2](https://github.com/libgit2/libgit2)]
- Text diff libraries for gutters and diff views: `diff` (jsdiff) 9.0.0 (BSD-3-Clause), `node-diff3` 4.0.0 (MIT) for three-way merge. Monaco ships a diff editor; CodeMirror has `@codemirror/merge`. — [R: npm [diff](https://www.npmjs.com/package/diff), [node-diff3](https://www.npmjs.com/package/node-diff3)]; [B: [codemirror/merge](https://github.com/codemirror/merge)]

### Inferences
- Recommended ladder: (v1) no SCM, but "compare with saved" and "compare two files" diff views, which reuse the same diff component; (v2) if a folder is a Git repo and `git` is on PATH: gutter indicators (diff buffer vs `git show HEAD:path`), branch name in status bar, changed-files list, per-file diff, stage/unstage/commit/discard; (later) branch switching, pull/push with credential helper passthrough, blame, history. Never: interactive rebase UI, 3-way merge editor, PR integrations.
- isomorphic-git is attractive only if "works without Git installed" is a hard requirement and operations stay local and simple; behavioural drift from real git on a user's real repositories is the risk. nodegit should be avoided (native build burden, slow release cadence).

### Gaps
- No measurements of isomorphic-git performance on large repos were gathered in this session.

---

## 11. Extensions ecosystem and Open VSX

### Takeaway
Running VS Code extensions means implementing (or embedding) VS Code's extension host and its very large `vscode` API — in practice only VS Code forks and Theia-class projects do this. Open VSX is the only legal registry for non-Microsoft products; it is large and Eclipse-governed but has had repeated supply-chain incidents in 2025–2026. A solo-developer tool should not run third-party VS Code extensions, but can freely reuse the *declarative* assets inside them (grammars, themes, snippets, language configurations).

### Cited Findings
- Open VSX is "a vendor-neutral open-source alternative to the Visual Studio Marketplace" run as an Eclipse project (EPL-2.0); the server repo moved from `eclipse/openvsx` to `eclipse-openvsx/openvsx`. The `ovsx` CLI is 1.4.0 (EPL-2.0). — [R: [openvsx README](https://raw.githubusercontent.com/eclipse/openvsx/master/README.md), npm [ovsx](https://www.npmjs.com/package/ovsx)]
- The Open VSX Working Group was formed in June 2023 under the Eclipse Foundation. — [S: [Eclipse working group page](https://projects.eclipse.org/working-group/open-vsx), [SD Times](https://sdtimes.com/softwaredev/eclipse-foundation-announces-open-vsx-registry/)]
- On 3 March 2026 the Eclipse Foundation said the registry surpassed 300 million downloads per month and introduced a pre-publication verification framework. — [S: [Eclipse newsroom](https://newsroom.eclipse.org/node/43620)]
- Wikipedia's summary: by 2026, more than 50 million requests per day and over 10,000 extensions from thousands of publishers (secondary source; unverified). — [S: [Wikipedia: Open VSX](https://en.wikipedia.org/wiki/Open_VSX)]
- In April 2026 the Eclipse Foundation launched a paid "Open VSX Managed Registry"; AWS, Google and Cursor were reported as first enterprise customers. — [S: [Eclipse newsroom](https://newsroom.eclipse.org/node/43804), [GCN](https://gcn.com/?p=20563)]
- Security incidents: the GlassWorm campaign (from Oct 2025) infected Open VSX extensions; on 30 Jan 2026 an attacker used a compromised publisher account to poison four established extensions (22,000+ prior downloads); Socket reported at least 72 further malicious extensions between 31 Jan and 13 Mar 2026; SecurityWeek reported 70+ suspected sleeper extensions published in April 2026. Open VSX stated GlassWorm was contained and disputed the "self-replicating worm" characterisation. — [S: [Eclipse security update Oct 2025](https://blogs.eclipse.org/post/mikaël-barbero/open-vsx-security-update-october-2025), [The Hacker News Feb 2026](https://thehackernews.com/2026/02/open-vsx-supply-chain-attack-used.html), [SecurityWeek](https://www.securityweek.com/dozens-of-open-vsx-extension-clones-linked-to-glassworm-malware/amp/), [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-glassworm-open-vsx-transitive-dependency-a/)]
- Microsoft's Marketplace terms restrict use of the marketplace and of Microsoft-published extensions to "in-scope" Microsoft products (VS Code, Visual Studio, etc.); forks therefore use Open VSX and lose Microsoft's proprietary extensions — notably Pylance, C/C++ (cpptools), C# Dev Kit, Remote-SSH/WSL/Dev Containers and Live Share; in 2025 Microsoft began enforcing this against Cursor for the C/C++ extension. — [B: [VS Marketplace terms](https://cdn.vsassets.io/v/M190_20210811.1/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf), [VSCodium docs](https://github.com/VSCodium/vscodium/blob/master/docs/index.md), [The Register, Apr 2025](https://www.theregister.com/2025/04/24/microsoft_vs_code_subtracts_cc_extension/)]
- Running extensions requires an extension host: a separate Node process (plus optional web-worker host) exposing the `vscode` API namespace over RPC to the workbench, with activation events, contribution points (`package.json` `contributes`), webviews, custom editors, etc. Projects that provide this outside VS Code: Eclipse Theia (re-implements the API), `@codingame/monaco-vscode-api` 40.0.0 (repackages VS Code's own services), OpenSumi, code-server/openvscode-server (ship VS Code itself). — [B: [Extension host](https://code.visualstudio.com/api/advanced-topics/extension-host), [Theia](https://theia-ide.org/docs/authoring_vscode_extensions/), [monaco-vscode-api](https://github.com/CodinGame/monaco-vscode-api)]
- Declarative contributions inside a `.vsix` (a zip): `contributes.grammars` (TextMate JSON/plist), `contributes.themes` (colour theme JSON), `contributes.snippets`, `contributes.languages` + `language-configuration.json` (comments, brackets, auto-closing pairs, indentation rules, folding markers), `contributes.iconThemes`. These can be consumed without an extension host. — [B: [Contribution points](https://code.visualstudio.com/api/references/contribution-points), [Language configuration guide](https://code.visualstudio.com/api/language-extensions/language-configuration-guide)]

### Inferences
- "Never" for a full extension host; "v2/later" for an *import* feature: install a `.vsix` (from disk or Open VSX) and use only its grammar/theme/snippet/language-configuration contributions. That yields most of the user-visible benefit of the ecosystem (any theme, any language's highlighting) with no arbitrary code execution — which also sidesteps the GlassWorm class of risk entirely.
- Each extension's own licence still applies to the reused assets; most popular theme/grammar extensions are MIT but that must be checked per item if any are bundled rather than user-installed.
- What users lose without Microsoft's marketplace only matters if extensions are run at all; for this tool the relevant loss is nil, since Pylance etc. could never be used legally anyway.

### Gaps
- Open VSX's exact current extension/publisher counts could not be read directly (open-vsx.org and the Eclipse newsroom were unreachable); the "10,000+" figure is a Wikipedia summary and looks low/unclear — verify at [open-vsx.org](https://open-vsx.org/).
- Open VSX API rate limits and terms for third-party desktop clients were not checked.

---

## 12. Special-format viewers and previews

### Takeaway
Most "edit anything pleasantly" wins are cheap because they are a renderer pane beside a text buffer and the libraries are mature and MIT-licensed; Markdown preview, JSON tree, CSV table, image/SVG preview and two-file diff are all small; notebooks and a true hex *editor* are not.

### Cited Findings
- Markdown preview: `markdown-it` 15.0.3 (MIT) is the CommonMark/GFM-tables parser VS Code's preview uses; maths via `katex` 0.19.1 (MIT) with `@vscode/markdown-it-katex` 1.1.2 (MIT); diagrams via `mermaid` 12.3.0 (MIT). — [R: npm [markdown-it](https://www.npmjs.com/package/markdown-it), [katex](https://www.npmjs.com/package/katex), [@vscode/markdown-it-katex](https://www.npmjs.com/package/@vscode/markdown-it-katex), [mermaid](https://www.npmjs.com/package/mermaid)]
- Code blocks inside the preview can be highlighted with the same Shiki instance (4.6.0, MIT) used by the editor. — [R version: npm [shiki](https://www.npmjs.com/package/shiki)]; [B]
- CSV/TSV: `papaparse` 5.7.1 (MIT) does streaming parse with delimiter detection. — [R: npm [papaparse](https://www.npmjs.com/package/papaparse)]
- JSON: `jsonc-parser` 3.3.1 (MIT) gives a fault-tolerant AST with offsets (so tree nodes map back to text positions). — [R: npm [jsonc-parser](https://www.npmjs.com/package/jsonc-parser)]
- Hex: Microsoft's `vscode-hexeditor` is an MIT extension implemented as a custom editor (virtualised rows, data inspector, in-place edits); it is not a reusable standalone component, but is a reference implementation. — [B: [microsoft/vscode-hexeditor](https://github.com/microsoft/vscode-hexeditor)]
- Notebooks: `.ipynb` is a documented JSON format (nbformat 4); rendering saved outputs is straightforward, but executing cells requires a Jupyter kernel (Python environment, ZeroMQ/WebSocket kernel protocol). `@nteract/notebook-preview` exists but its latest npm version is an alpha (11.0.4-alpha.0, BSD-3-Clause). — [R version: npm [@nteract/notebook-preview](https://www.npmjs.com/package/@nteract/notebook-preview)]; [B: [nbformat](https://nbformat.readthedocs.io/)]
- VS Code built-ins for comparison: Markdown preview (scroll-synced), image preview (zoom/pan), "Compare Selected" diff, JSON outline/breadcrumbs; CSV tables, HTML live preview, log highlighting and hex editing all come from extensions. — [B: [Markdown in VS Code](https://code.visualstudio.com/docs/languages/markdown)]

### Inferences
Cost ranking for this project:
- **Cheap (days each):** Markdown preview with GFM + KaTeX + Mermaid + scroll sync; image preview (Chromium renders PNG/JPEG/GIF/WebP/AVIF/SVG natively); SVG split view (text + sandboxed preview); JSON tree/outline; two-file diff (reuses editor diff component); read-only `.ipynb` rendering; log syntax highlighting (a TextMate "log" grammar) + follow-tail toggle.
- **Moderate (a week or two each):** CSV/TSV table view with virtualised grid, sorting/filtering and round-trip edit (the spreadsheet track may already own this — delegate to it); HTML live preview in a sandboxed `<webview>`/iframe with reload-on-save; read-only hex viewer for files detected as binary (virtualised, reads by range).
- **Expensive:** hex *editing* of large files; notebook execution; live multi-GB log tailing with filtering.
- Security note: Markdown/HTML/SVG previews must be sandboxed (no Node integration, strict CSP, scripts off by default for Markdown and SVG) because they render untrusted file content inside a privileged Electron app.
- Since the host app already has Markdown/DOCX and spreadsheet editors, the routing rule "which editor opens `.md` / `.csv` by default, and 'Open as text'" matters more than building duplicate viewers.

### Gaps
- No standalone, maintained, embeddable hex-editor web component was identified in this session.
- Mermaid's bundle size and lazy-loading cost were not measured.

---

## 13. Settings model, keybindings, themes, snippets, Vim/Emacs modes

### Takeaway
VS Code's configuration formats are simple, documented JSON and are worth copying nearly verbatim: doing so gives free compatibility with existing themes and snippets and lets users paste settings from the web.

### Cited Findings (all [B] unless marked; verify at the linked docs)
- Settings are layered JSONC with precedence default → user → (remote) → workspace → workspace-folder, with language-specific overrides via `"[markdown]": { … }` blocks applying at each layer, and policy settings on top; every setting is declared with a JSON Schema fragment (type, default, description, scope), which drives both the Settings GUI and completion/validation in `settings.json`. — [Settings docs](https://code.visualstudio.com/docs/getstarted/settings), [Configuration contribution point](https://code.visualstudio.com/api/references/contribution-points#contributes.configuration)
- Keybindings are an ordered JSON array of `{ key, command, when, args }`; later rules win; `-command` removes a default; chords (`ctrl+k ctrl+s`) are supported; `when` is a boolean expression over context keys (`editorTextFocus && !editorReadonly`, `resourceExtname == .md`, etc.). — [Keybindings docs](https://code.visualstudio.com/docs/getstarted/keybindings), [When-clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts)
- Colour themes are JSON with `colors` (workbench colour IDs such as `editor.background`), `tokenColors` (TextMate scope selectors → foreground/fontStyle) and optional `semanticTokenColors`; legacy `.tmTheme` plist is also accepted. — [Color theme guide](https://code.visualstudio.com/api/extension-guides/color-theme), [Theme color reference](https://code.visualstudio.com/api/references/theme-color)
- `tm-themes` 1.12.12 on npm redistributes a curated set of VS Code themes as JSON (each under its original licence). — [R version: npm [tm-themes](https://www.npmjs.com/package/tm-themes)]
- Snippets are JSON maps of `{ prefix, body, description, scope }` using TextMate snippet syntax (`$1`, `${1:placeholder}`, `${1|a,b|}`, variables like `$TM_FILENAME`, regex transforms). — [Snippets docs](https://code.visualstudio.com/docs/editor/userdefinedsnippets)
- Emmet: `emmet` 2.4.11 (MIT, last published 2024-09) is the core expander; `@vscode/emmet-helper` 2.11.0 (MIT) is VS Code's LSP-shaped wrapper. — [R: npm [emmet](https://www.npmjs.com/package/emmet), [@vscode/emmet-helper](https://www.npmjs.com/package/@vscode/emmet-helper)]
- Vim/Emacs modes exist as add-ons for both mainstream web editor cores: `monaco-vim` 0.4.4 (MIT, last published 2025-11) for Monaco, `@replit/codemirror-vim` 6.4.0 (MIT, 2026-11) for CodeMirror 6 (plus `@replit/codemirror-emacs`). VS Code itself has no built-in Vim mode (it is the VSCodeVim extension). — [R: npm [monaco-vim](https://www.npmjs.com/package/monaco-vim), [@replit/codemirror-vim](https://www.npmjs.com/package/@replit/codemirror-vim)]

### Inferences
- Because the app is multi-editor (office, PDF, text), a single app-wide command registry + keybinding resolver with `when` contexts (e.g. `activeEditorKind == 'text'`) is infrastructure the whole shell needs, not just the text editor; build it once at shell level using VS Code's JSON shape.
- v1 settings: default + user layers with language overrides, edited as JSON with schema completion (reuses the JSON language service); a GUI settings page and workspace layer can follow.
- Theme compatibility requires TextMate-scope-based tokenisation (another argument for the TextMate/Shiki highlighter) and a mapping from VS Code workbench colour IDs to the app's own UI tokens — only a subset (editor, gutter, selection, tabs, sidebar, status bar, terminal ANSI) needs mapping.
- Vim mode quality differs by editor core (the CodeMirror one is more actively maintained as of the dates above); this is an input to the core-editor decision owned by the other track.

### Gaps
- VS Code docs were not re-read in this session; precedence details (e.g. where "remote" and "policy" layers sit) should be confirmed before copying.

---

## 14. Large and unusual files

### Takeaway
Encoding detection and conversion are solved by the same two small libraries VS Code uses; multi-GB files and very long lines are not solved by any web editor core and need an explicit "large file mode" policy (thresholds, feature shedding, and a separate chunked read-only viewer).

### Cited Findings
- VS Code pins `jschardet` 3.1.4 for encoding guessing and `@vscode/iconv-lite-umd` 0.7.1 for decoding/encoding. Current upstream versions: `jschardet` 4.1.0 (0BSD), `chardet` 2.2.0 (MIT), `iconv-lite` 0.7.3 (MIT). — [R: [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json), npm [jschardet](https://www.npmjs.com/package/jschardet), [chardet](https://www.npmjs.com/package/chardet), [iconv-lite](https://www.npmjs.com/package/iconv-lite)]
- VS Code's approach: BOM detection first (UTF-8/UTF-16 LE/BE), then optional statistical guessing (`files.autoGuessEncoding`, off by default because guesses are unreliable on short/ASCII-heavy text), else `files.encoding` default (UTF-8); binary detection by scanning the first chunk for NUL bytes; "Reopen with Encoding"/"Save with Encoding" in the status bar. — [B: [VS Code file encoding docs](https://code.visualstudio.com/docs/editor/codebasics#_file-encoding-support)]
- VS Code large-file behaviour: a piece-tree text buffer; `editor.largeFileOptimizations` disables tokenisation, wrapping, folding and some features for big files; `editor.maxTokenizationLineLength` (default 20,000) stops highlighting on very long lines; `editor.stopRenderingLineAfter` (default 10,000) truncates rendering of long lines; files above a size limit prompt before opening and the whole file is still loaded into memory (no paging). — [B: [Text buffer reimplementation blog](https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation), [Default settings reference](https://code.visualstudio.com/docs/getstarted/settings#_default-settings)]
- Unicode safety/bidi: VS Code highlights invisible and ambiguous (homoglyph) characters and bidirectional control characters by default (`editor.unicodeHighlight.*`, `editor.renderControlCharacters`), added after the 2021 "Trojan Source" disclosure. — [B: [VS Code 1.63 release notes](https://code.visualstudio.com/updates/v1_63#_unicode-highlighting), [trojansource.codes](https://trojansource.codes/)]
- Terminal-side CJK/emoji width handling uses xterm's unicode addons (`@xterm/addon-unicode-graphemes` 0.4.0; VS Code uses `addon-unicode11`). — [R: npm [@xterm/addon-unicode-graphemes](https://www.npmjs.com/package/@xterm/addon-unicode-graphemes), [vscode remote/package.json](https://raw.githubusercontent.com/microsoft/vscode/main/remote/package.json)]
- ripgrep handles the search side for large/odd files: automatic binary detection, UTF-16 BOM sniffing, explicit `--encoding`. — [B: [ripgrep GUIDE](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)]

### Inferences
- Suggested policy tiers: under ~5 MB full features; ~5–50 MB "large file mode" (no wrap, no minimap, no folding, highlighting limited or off, no LSP sync); ~50 MB up to a hard cap (a few hundred MB, bounded by V8 string and memory limits) plain editing only with a warning; above that, a **separate chunked read-only viewer** (virtualised line index built by streaming, search delegated to ripgrep, follow-tail) rather than the editor. Exact thresholds need measurement on the chosen editor core.
- Minified single-line files: detect "any line > N kB" at open and force wrap-off, tokenisation-off, and offer "Format/pretty-print into a new tab".
- Encoding: detect BOM → strict UTF-8 validation → statistical guess only as a suggestion; always show encoding + EOL in the status bar and preserve the original BOM/EOL/final-newline on save. Mixed line endings should be preserved or normalised only on explicit request.
- CJK/IME and bidi correctness are primarily properties of the editor core (owned by the other track); the infrastructure-side obligations are fonts with CJK fallback, grapheme-aware cursor movement, and invisible/bidi control character highlighting.

### Gaps
- No tested numbers for the maximum practical file size in Monaco vs CodeMirror 6 inside current Electron were gathered here.
- No maintained off-the-shelf "multi-GB log viewer" web component was identified; this would be custom work.

---

## 15. AI assistance (optional)

### Takeaway
By late 2026 editor AI has standardised around three integration shapes — inline (ghost-text) completion, a chat/agent side panel, and external agents connected by protocol (ACP for agents, MCP for tools). All can be designed as off-by-default plug points with no bundled model, which fits an offline personal tool.

### Cited Findings
- VS Code's 2026 releases are dominated by agent features (agent windows/canvases, MCP configuration, chat automations). — [S: [VS Code 1.143–1.145 notes](https://code.visualstudio.com/updates/v1_144), [tech-insider on 1.142](https://tech-insider.org/vscode-1-142-agent-canvases-update-2026/)]
- The Agent Client Protocol (ACP) was created by Zed in August 2025 as an open JSON-RPC protocol between editors and coding agents; JetBrains joined in October 2025; an ACP Registry of installable agents launched in January 2026. — [S: [zed.dev/acp](https://zed.dev/acp), [JetBrains blog](https://blog.jetbrains.com/ai/2025/10/jetbrains-zed-open-interoperability-for-ai-coding-agents-in-your-ide/), [Zed: ACP Registry](https://zed.dev/blog/acp-registry)]
- npm packages: `@agentclientprotocol/sdk` 2.8.0 (Apache-2.0), `@modelcontextprotocol/sdk` 1.32.2 (MIT). — [R: npm [@agentclientprotocol/sdk](https://www.npmjs.com/package/@agentclientprotocol/sdk), [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)]
- Void — the open-source "Cursor alternative" VS Code fork — is now deprecated: "Void is deprecated and no longer accepting contributions." — [R: [Void README](https://raw.githubusercontent.com/voideditor/void/main/README.md)]
- JetBrains discontinued Fleet (distribution ended 22 Dec 2025) and redirected effort to an agentic tool (Air). — [S: [devclass](https://www.devclass.com/ai-ml/2025/12/09/jetbrains-abandons-fleet-ide-pins-hopes-on-forthcoming-air-agentic-development-tool/1728894), [JetBrains Fleet blog](https://blog.jetbrains.com/ja/fleet/2025/12/the-future-of-fleet)]
- Local, offline inference is commonly done by pointing an OpenAI-compatible client at a local runtime (Ollama, llama.cpp server, LM Studio); fill-in-the-middle completion uses small code models. — [B: [Ollama OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/openai.md)]

### Inferences
- Design-only in v1: keep an "inline completion provider" interface and a side-panel slot in the architecture; ship nothing. Later options, cheapest first: (a) user-configured OpenAI-compatible endpoint (local Ollama or a cloud key) for chat-with-selection and ghost text; (b) ACP client so the user can attach whichever agent they already use. Never bundle model weights or require an account.
- AI-first editor products are a volatile market (Void deprecated, Fleet killed and repurposed); a solo personal tool should not compete there.

### Gaps
- No primary-source survey of how many developers use inline completion vs chat vs agents daily in 2026 was retrieved.
- ACP's stability/versioning guarantees were not examined.

---

## 16. Prior art: scoped "lightweight VS Code-like" editors and lessons about scope

### Takeaway
Every independent editor that survived either had a funded team (Zed), a deliberately tiny scope (Lite XL, Helix), or inherited a codebase (Pulsar, VS Code forks). Well-resourced attempts to rebuild "all of VS Code" (Fleet) or sustain a fork (Void) were abandoned. The consistent lesson is to do the text-editor core well, lean on LSP + tree-sitter/TextMate + ripgrep, and refuse the workbench long tail.

### Cited Findings
- **Zed** — Rust + custom GPU UI; reached 1.0 on 29 April 2026 after about five years of funded development; `main` is at 1.31.0 in November 2026; source ships under GPL (editor) and Apache-2.0 (some crates) licence files. Uses tree-sitter + auto-downloaded LSP servers; extensions are WASM. — [S: [Zed 1.0 blog](https://zed.dev/blog/zed-1-0), [The Register](https://www.theregister.com/2026/04/30/zed_team_releases_version_10/)]; [R: [zed Cargo.toml](https://raw.githubusercontent.com/zed-industries/zed/main/crates/zed/Cargo.toml), licence files present at [LICENSE-GPL](https://raw.githubusercontent.com/zed-industries/zed/main/LICENSE-GPL) and [LICENSE-APACHE](https://raw.githubusercontent.com/zed-industries/zed/main/LICENSE-APACHE)]
- Reviewers of Zed 1.0 still cited immature extensions/language support as a common complaint. — [S: [devclass](https://www.devclass.com/software/2026/05/07/zed-team-releases-version-10-of-rust-built-editor/5234770)]
- **Lapce** — Rust editor, largely one lead developer plus contributors; changelog's latest numbered release remains 0.4.6 with an "Unreleased" section (adding e.g. LSP document highlight and basic file-explorer keybinds), i.e. still pre-1.0 after 4+ years. — [R: [Lapce CHANGELOG](https://raw.githubusercontent.com/lapce/lapce/master/CHANGELOG.md)]
- **Helix** — terminal modal editor; no plugin system shipped for years, no built-in file tree for a long time, never auto-installs servers; ships 342 language definitions by leaning entirely on tree-sitter + LSP. — [R: [helix languages.toml](https://raw.githubusercontent.com/helix-editor/helix/master/languages.toml), [lang-support.md](https://raw.githubusercontent.com/helix-editor/helix/master/book/src/lang-support.md)]
- **Lite XL** — C + Lua, tiny core with everything else as plugins; latest changelog entry is 2.1.7 dated 2024-12-05 (slow cadence). — [R: [lite-xl changelog](https://raw.githubusercontent.com/lite-xl/lite-xl/master/changelog.md)]
- **Pulsar** — community continuation of Atom (Electron); `master` is at 1.133.1-dev, i.e. still shipping regular releases. — [R: [pulsar package.json](https://raw.githubusercontent.com/pulsar-edit/pulsar/master/package.json)]
- **CodeEdit** — native macOS editor by volunteers; README still says it "is currently in development and not yet recommended for production use". — [R: [CodeEdit README](https://raw.githubusercontent.com/CodeEditApp/CodeEdit/main/README.md)]
- **Fleet** — JetBrains concluded that rebuilding the capabilities of its IntelliJ IDEs in a new lightweight editor did not create enough value and stopped distribution on 22 Dec 2025. — [S: [devclass](https://www.devclass.com/ai-ml/2025/12/09/jetbrains-abandons-fleet-ide-pins-hopes-on-forthcoming-air-agentic-development-tool/1728894), [heise](https://heise.de/-11107960)]
- **Void** — VS Code fork; deprecated. Its README notes that "VS Code's build pipeline is private, so [packaging, signing, auto-update] is normally very hard" — a concrete cost of forking. — [R: [Void README](https://raw.githubusercontent.com/voideditor/void/main/README.md)]
- **Nova** (Panic) — commercial native macOS editor by a small company, with its own extension API and built-in LSP client. — [B: [nova.app](https://nova.app/)]

### Inferences
- Lessons for a solo developer: (1) the editor component is the cheap part — Monaco or CodeMirror delivers Tier A nearly complete; (2) the expensive parts are distribution of language tooling, cross-platform native modules, and the workbench long tail; (3) parity-chasing kills projects — Fleet had JetBrains' resources and still stopped; (4) forks inherit maintenance of a codebase that moves weekly (VS Code is now on weekly releases), so "embed/fork VS Code to get everything" trades build effort for permanent merge effort; (5) users forgive missing debugger/extensions in a secondary editor but not data loss, slow typing, broken encodings or lost unsaved work — reliability features (hot exit, external-change detection, atomic saves) outrank intelligence features.
- For an all-in-one app, the competitor is not VS Code but "double-clicking a `.json` and getting Notepad"; the bar is a very good general text editor with light IDE touches.

### Gaps
- Current team size/funding for Lapce and CodeEdit and Lapce's last tagged release date were not confirmed.
- No post-mortem from an individual developer who built an Electron code editor in 2025–2026 was retrieved in this session.

---

## 17. Bottom line: recommended tiering for a solo developer

### Takeaway
v1 should be "an excellent universal text editor": full Tier A editing, highlighting for ~250+ languages with VS Code theme compatibility, reliability features, in-process intelligence for JSON/YAML/TOML/Markdown/HTML/CSS with SchemaStore, Prettier formatting, ripgrep search and a fuzzy finder. v2 adds a generic LSP client with PATH-discovered servers, a terminal, minimal Git and previews. Debugging, extension host, remote, notebook execution and marketplace are "never".

### Cited Findings
(Recommendations below rest on the findings in sections 1–16; the building-block versions/licences are restated for convenience and were all read on 2026-11-21 unless tagged otherwise.)

- Highlighting stack: `shiki` 4.6.0 / `vscode-textmate` 9.3.2 / `vscode-oniguruma` 2.0.1, all MIT. — [R: npm [shiki](https://www.npmjs.com/package/shiki), [vscode-textmate](https://www.npmjs.com/package/vscode-textmate)]
- In-process language services: `vscode-json-languageservice`, `vscode-css-languageservice`, `vscode-html-languageservice`, `vscode-markdown-languageservice`, all MIT. — [R: npm [vscode-json-languageservice](https://www.npmjs.com/package/vscode-json-languageservice)]
- Schemas: SchemaStore catalogue, 1,608 entries. — [R: [catalog.json](https://www.schemastore.org/api/json/catalog.json)]
- Search: ripgrep 15.2.0 via `@vscode/ripgrep` 1.18.0 (MIT). — [R: npm [@vscode/ripgrep](https://www.npmjs.com/package/@vscode/ripgrep)]
- LSP plumbing: `vscode-jsonrpc` 10.0.0 + `vscode-languageserver-protocol` 3.18.5 (MIT); LSP 3.18 current. — [R: npm [vscode-jsonrpc](https://www.npmjs.com/package/vscode-jsonrpc), [specifications.yml](https://raw.githubusercontent.com/microsoft/language-server-protocol/gh-pages/_data/specifications.yml)]
- Terminal: `@xterm/xterm` 6.0.0 + `node-pty` 1.1.0 (MIT). — [R: npm [@xterm/xterm](https://www.npmjs.com/package/@xterm/xterm), [node-pty](https://www.npmjs.com/package/node-pty)]
- Watching: `@parcel/watcher` 2.6.0 or `chokidar` 6.0.0 (MIT). — [R: npm [@parcel/watcher](https://www.npmjs.com/package/@parcel/watcher), [chokidar](https://www.npmjs.com/package/chokidar)]

### Inferences

**v1 — "open and edit anything, never lose work"**

| Capability | Building blocks |
|---|---|
| Core editing (multi-cursor, column select, regex find/replace, folding, bracket matching, indent detection, wrap, minimap, go to line, split view, diff of two files / compare with saved) | The chosen editor core (other track) provides nearly all of this natively |
| Syntax highlighting for ~250+ languages + VS Code theme import | Shiki / vscode-textmate + oniguruma; `tm-grammars`, `tm-themes`; plain-text fallback |
| Language detection | Linguist data (`linguist-languages`) for filename/extension/shebang; modeline parser; optional `@vscode/vscode-languagedetection` for untitled buffers |
| Reliability: hot exit, auto-save, atomic save, external-change detection, undo across saves | App code + file watcher on open files |
| Encoding + EOL detection/switching, BOM preservation, binary detection | `jschardet`/`chardet` + `iconv-lite`; NUL-byte sniff |
| Large-file mode and long-line guard (feature shedding, warning thresholds) | App policy on top of editor core |
| JSON/JSONC, YAML, TOML, Markdown, HTML, CSS intelligence (validation, completion, hover, outline, formatting) | `vscode-*-languageservice` libs in a worker; `yaml-language-server` (Node, run on Electron's Node); taplo (WASM/binary) or defer TOML; vendored SchemaStore snapshot |
| Formatting + EditorConfig | Prettier in a worker; `editorconfig` |
| Quick Open, command palette, keybindings JSON with `when` clauses, settings JSON (default + user + per-language) | Shell-level command registry; `fuzzysort`; `jsonc-parser`; settings validated by own JSON Schema |
| Search in files (when a folder is open) and simple file tree | ripgrep sidecar; virtualised tree; `ignore` |
| Cheap viewers: Markdown preview (GFM + KaTeX + Mermaid), image/SVG preview, JSON outline | `markdown-it`, `katex`, `mermaid`; sandboxed preview pane |
| Snippets + Emmet | VS Code snippet JSON format; `emmet` |

**v2 — "competent for light coding"**

| Capability | Building blocks |
|---|---|
| Generic LSP client: diagnostics, completion, hover, signature help, definition, references, rename, formatting, code actions, document symbols | `vscode-jsonrpc` + `vscode-languageserver-protocol`; servers spawned over stdio from a utility process |
| Server discovery: PATH first; Node-based servers runnable on Electron's Node; per-language settings to point at a binary | Helix-style defaults table; pyright/basedpyright, typescript LSP, bash-language-server; ruff, rust-analyzer, gopls, clangd, lua-ls, marksman if installed |
| Integrated terminal | `@xterm/xterm` 6 + fit/webgl/search/web-links addons; `node-pty` in a utility process |
| Minimal Git (if `git` on PATH): gutter bars, branch in status bar, changed files, diff, stage/commit/discard | git CLI via `simple-git` or direct spawn; `diff` |
| Replace across files with preview; search editor | App code over ripgrep results |
| CSV/TSV table view (or hand off to spreadsheet module), HTML live preview, read-only hex viewer, read-only `.ipynb` render, log highlighting + tail | `papaparse`; sandboxed webview; custom virtualised hex/log views |
| Settings GUI, workspace settings layer, breadcrumbs/sticky scroll/outline polish, Vim mode | Editor-core add-ons (`monaco-vim` / `@replit/codemirror-vim`) |

**Later (only on demonstrated need)**
- Opt-in language-server downloader driven by a mason-registry-derived catalogue (with explicit consent and checksum verification).
- Import of `.vsix` declarative assets (themes, grammars, snippets, language configurations) from disk or Open VSX — no code execution.
- Tree-sitter for structural selection/outline in the top languages (`web-tree-sitter` + `@vscode/tree-sitter-wasm`).
- Semantic tokens, inlay hints, workspace symbols, call hierarchy; blame/history; multi-root workspaces; shell integration; terminal session restore.
- Optional AI: user-supplied OpenAI-compatible endpoint (local or cloud) and/or ACP client; off by default.
- Chunked multi-GB file viewer.

**Never (for a solo, personal, local-first all-in-one tool)**
- Debugger/DAP UI, testing view, tasks/problem matchers.
- Full VS Code extension host / marketplace client; running third-party extension code.
- Remote development (SSH/containers/tunnels), settings sync service, profiles.
- Notebook kernel execution; 3-way merge editor; interactive rebase; PR integrations.
- Forking or embedding the whole VS Code workbench solely to obtain the above (weekly upstream cadence, private build pipeline, Marketplace licence restrictions).

**Licence obligations summary**
- Everything in the v1/v2 tables is MIT, ISC, BSD, 0BSD or Apache-2.0 (attribution/notice only; Apache-2.0 additionally requires carrying NOTICE files and stating changes). Exceptions to watch: lemminx is EPL-2.0 (weak copyleft; fine as a separate downloaded process), Git is GPL-2.0 (fine as a separate user-installed executable; bundling via dugite means shipping GPL binaries with source-offer obligations), ripgrep is MIT/Unlicense, clangd is Apache-2.0 with LLVM exception, Zed's editor code is GPL-licensed (with some Apache-2.0 crates) and must not be copied into a permissively licensed app, and bundled themes/grammars each carry their own (mostly MIT) licences that must be reproduced in an attributions file.
- Microsoft's proprietary extensions and the VS Code Marketplace itself must not be used.

### Gaps
- Effort estimates are qualitative; no calibrated person-week data was found.
- The v1/v2 split assumes the core-editor track selects a component that supplies Tier A natively and has an LSP bridge; if it recommends embedding a VS Code-derived workbench (e.g. via `monaco-vscode-api` or Theia), much of this tiering changes (more comes "free", at the cost of bundle size, upstream churn and loss of control) and should be revisited.
- Several hosts were unreachable in this session (`microsoft.github.io`, `newsroom.eclipse.org`, `mason-registry.dev`, `open-vsx.org`, `code.visualstudio.com` was not attempted); findings tagged [B] and [S] should be spot-checked before being presented as verified.
