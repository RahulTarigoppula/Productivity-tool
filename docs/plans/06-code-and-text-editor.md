# 06 — Code and text editor (VS Code-level)

Status: draft for review · Last updated: 2026-11-21

This replaces the narrower "Markdown and plain text" section in `02-format-engines.md`. The text side of the app is a general-purpose editor: any text-based file, any language, with the editing depth people expect from VS Code.

## What "VS Code-level" means here

VS Code is two things: a superb **editor** (the part you type in) and a **workbench** around it (explorer, search, terminal, git, debugger, extensions, remote development). The plan is to match the editor fully and to adopt the workbench selectively.

- **Match fully:** everything that happens inside a file.
- **Adopt in a lighter form:** finding files, searching a folder, language intelligence, a terminal, basic git.
- **Leave out on purpose:** debugger, test runner, task system, a full extension marketplace, remote development, notebook execution. Each of these is a product in its own right, and for those rare sessions VS Code itself is still on the machine.

Projects that tried to be all of VS Code with a small team did not finish: Fleet was discontinued in December 2025, Lapce and CodeEdit are still pre-release. Zed got there with a funded team and years of work. Scope discipline is the lesson.

## Engine decision

The app must run on phones as well as desktops (`12-platforms-and-mobile.md`), and that decides this.

| Option | What it gives | Cost | Verdict |
|---|---|---|---|
| **CodeMirror 6** | Designed for touch and on-screen keyboards; about 0.4 MB; very good with huge files; multi-cursor, regex find and replace, folding, bracket matching; official language-server client and merge/diff packages; the best base for Typora-style live preview | More assembly than Monaco to reach the VS Code feel; minimap only as a stale third-party package | **Chosen as the one text engine on every platform** |
| Monaco (the editor component inside VS Code) | The VS Code feel out of the box: minimap, sticky scroll, diff editor, built-in TypeScript/JSON/CSS/HTML intelligence, a language-server client since 0.55 | Its own documentation says it does not support mobile; six times larger; packaging changed in several recent releases | **Optional desktop-only provider**, added later only if CodeMirror falls short in daily desktop use |
| Monaco + `monaco-vscode-api` (real VS Code services) | TextMate grammars, VS Code themes, settings and keybindings JSON, even an extension host | A breaking major roughly every month, one-time global initialisation that cannot be unloaded, exact version pinning across dozens of packages | **Not planned** |
| Embed whole VS Code (code-server) or build on Theia | Everything | A second application inside the app, or re-platforming the entire project as an IDE; no access to Microsoft's marketplace either way | **Rejected** |

**Why this reverses the earlier choice of Monaco.** With only a desktop in view, Monaco was the shortest route to a VS Code-like editor. With Android and iOS in the plan, Monaco would mean one editor on desktop and a different one on phones: two sets of behaviours, shortcuts and bugs. One engine everywhere is worth more than a minimap.

**What CodeMirror 6 needs built or assembled to reach the target:** a minimap, sticky scroll, a command set matching VS Code's default shortcuts, and language intelligence for web languages (which Monaco bundles and CodeMirror gets through language services and servers). These are listed in the tiers below.

**A bonus:** CodeMirror is the right base for in-place Markdown rendering in the style of Typora and Obsidian, so Markdown gets both a live-preview mode and a side-by-side preview without a second engine. Spike S10 confirms the choice.

## Scope by tier

### v1 — a complete single-file editor for anything

**Core editing (CodeMirror 6 plus our additions):**
- Multi-cursor and column selection, find and replace with regex, folding, bracket matching and colouring, auto-indent and indentation detection, word wrap, go to line, go to symbol in file, comment toggling, move and duplicate lines.
- Built by us on top: minimap and sticky scroll (desktop sizes only), and VS Code's default shortcut set.
- Side-by-side diff of two files or of a file against its last saved version.
- Split editors.

**Any language, highlighted:**
- CodeMirror's own grammars for the most common languages (fast, incremental), with TextMate grammars through Shiki as the fallback for everything else: about 260 languages, the same grammars VS Code uses.
- VS Code colour themes imported as-is.
- Language detection by file name, extension and shebang (using the Linguist language list, about 850 entries), with a manual override in the status bar.
- Plain-text fallback for anything unrecognised.

**Built-in intelligence with no external tools:**
- JSON, CSS, HTML, YAML, TOML, Markdown: completion, hover, diagnostics and formatting from in-process language services (the same libraries VS Code uses), running in a worker on every platform including phones.
- TypeScript and JavaScript: the TypeScript language service in a worker on desktop; highlighting and basic completion on phones.
- Schema-aware editing of config files (`package.json`, GitHub workflows, `tsconfig`, Docker Compose, …) using a vendored offline snapshot of SchemaStore's 1,600 schemas.
- Emmet for HTML and CSS; snippets in VS Code's snippet format.

**Formatting:** Prettier and EditorConfig, format on save as a setting.

**File reliability:**
- Encoding, byte-order mark and line-ending detection, shown in the status bar and switchable.
- Hot exit: unsaved buffers, including untitled ones, survive quitting and crashes.
- External-change detection.
- Large-file mode that turns off expensive features above a size threshold.
- Binary files open in a read-only hex view instead of as garbled text.

**Previews (each a side pane, loaded on demand):**
- Markdown: in-place live preview (headings, emphasis, links, images, tables, task lists, math and Mermaid diagrams render where you type and reveal their syntax under the cursor), plus an optional scroll-synced side-by-side preview.
- JSON tree, image and SVG viewer.

**Across files:**
- Fuzzy file finder in the palette.
- Search across a folder using ripgrep.
- Optional folder sidebar (see below).

**Customisation:** settings and keybindings as JSON files plus a simple settings screen; keybindings support VS Code-style `when` conditions.

### v2 — language servers and the light workbench

- **Generic language-server client.** Any installed language server works: Python (basedpyright, ruff), Rust (rust-analyzer), Go (gopls), C/C++ (clangd), Lua, Bash, XML and so on. Go to definition, find references, rename, code actions, semantic highlighting, inlay hints.
  - Servers are **discovered on the system PATH**, never bundled and never downloaded silently. This keeps the app small and avoids the criticism Zed received for downloading binaries without asking.
  - Servers run as child processes of a utility process and are started only when a file of that language is open.
- **Integrated terminal** (xterm.js) as a bottom panel, loaded on first use. Desktop only.
- **Minimal git** by calling the installed `git`: changed-line markers in the gutter, a list of changed files, diff, stage, commit. No merge tooling.
- **Replace across files.**
- **More viewers:** CSV as a table (shared with the spreadsheet side), live HTML preview, Jupyter notebooks read-only, log tailing.
- **Vim keybindings** (CodeMirror's Vim package).

### Later — opt-in extras

- A language-server installer built on the mason-registry catalogue, always with explicit consent.
- Import of the declarative parts of VS Code extensions (themes, grammars, snippets) from `.vsix` files, without running any extension code.
- Tree-sitter for faster, structure-aware highlighting and selection.
- A chunked viewer for multi-gigabyte logs.
- Optional AI completion or chat through an endpoint the user supplies. Off by default; the app stays fully offline without it.
- Monaco as an alternative desktop provider, if wanted.

### Never

Debugger, test explorer, task runner, a running extension host or marketplace, remote development, notebook execution, three-way merge editor, forking VS Code.

## Folders and workspaces

The app stays file-first: opening a single file needs no project. A folder can be opened as a workspace, which adds:

- A file tree in the sidebar (virtualised, respecting `.gitignore`, watched with `@parcel/watcher`).
- Folder-scoped search and file finding.
- Per-folder settings.

The tree shows **every file type**. Clicking a `.docx` or `.pdf` in the tree opens it in its own engine in a tab, exactly like a code file. This is where the all-in-one idea pays off: a project folder with notes, spreadsheets, PDFs and code is one workspace.

## How it fits the architecture

- `packages/engine-text` wraps CodeMirror 6 behind the same `EditorProvider` contract as every other engine. It claims every file that is not claimed by another provider and is not binary.
- The editor core loads once; each text tab is a lightweight document state, so text tabs are cheap.
- Language services run in web workers on every platform. Language servers, git and the terminal are helper programs and exist on desktop only. Folder search runs inside the Rust core, so it works on phones too.
- Editor actions are registered in the shell's command registry so there is one palette.
- Highlighting grammars, language services, previews, terminal and git are each separate lazy chunks. A user who only edits Markdown never loads the terminal.

## Risks specific to this area

| Risk | Response |
|---|---|
| CodeMirror needs more assembly to feel like VS Code | A defined list (minimap, sticky scroll, shortcut set); spike S10; Monaco remains an optional desktop provider |
| CodeMirror's development moved off GitHub to its author's own server | It is actively maintained and MIT-licensed; pin versions |
| Mixed line endings or unusual encodings altered on save | Detect on open, preserve, and cover in the byte-equality tests |
| The language-server client is young | Spike S11; fallback is a small client on `vscode-jsonrpc` |
| Very large files | Large-file mode; later a chunked viewer |
| The terminal needs a native module | Terminal is v2, desktop-only and lazily loaded |
| Language servers, terminal and git do not exist on phones | Stated plainly in the interface; in-process language services cover config and web formats everywhere |
| Open VSX has had repeated supply-chain incidents | No extension code is ever executed; only declarative assets may be imported |
| Scope creep toward a full IDE | The "Never" list above |
| YAML language service fetches schemas over the network by default | Vendored SchemaStore snapshot; network access disabled |

## Additional Phase 0 spikes

| # | Question | Experiment |
|---|---|---|
| S10 | Does CodeMirror 6 reach the VS Code feel? | A few days of real coding and note-taking with multi-cursor, the VS Code shortcut set and a prototype minimap; the same on a phone. Compare against Monaco on desktop |
| S11 | Does CodeMirror's language-server client work with a real server? | Connect it to rust-analyzer or basedpyright started by the shell |
| S12 | Does highlighting stay fast? | Open a 20,000-line file in several languages, with both grammar systems and an imported VS Code theme |
