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

| Option | What it gives | Cost | Verdict |
|---|---|---|---|
| **Monaco** (the editor component inside VS Code) | Multi-cursor, minimap, find and replace with regex, folding, diff editor, sticky scroll, bracket colouring, built-in intelligence for TypeScript/JavaScript/JSON/CSS/HTML, and since 0.55 a built-in language-server client | Larger than CodeMirror; packaging changed in several recent releases; no TextMate grammars, themes or workbench included | **Chosen for all text and code** |
| CodeMirror 6 | Smaller, very good with huge files, best for Typora-style live preview; official language-server client since 2025 | Minimap only as a stale third-party package; more assembly to reach VS Code feel | **Fallback**, and candidate for an optional "writing mode" |
| Monaco + `monaco-vscode-api` (real VS Code services) | TextMate grammars, VS Code themes, settings and keybindings JSON, even an extension host | A breaking major roughly every month, one-time global initialisation that cannot be unloaded, exact version pinning across dozens of packages | **Not in the base app.** Possible later, isolated in its own view |
| Embed whole VS Code (code-server) or build on Theia | Everything | A second application inside the app, or re-platforming the entire project as an IDE; no access to Microsoft's marketplace or its proprietary extensions either way | **Rejected** as the base; code-server remains an escape hatch |

**One text engine, not two.** The research suggested Monaco for code plus CodeMirror for Markdown prose. This plan starts with Monaco alone, because a second engine means more to load, two sets of shortcuts and two behaviours for the same keystroke. Markdown gets a rendered preview beside the source, as in VS Code. A Typora-style live-preview "writing mode" on CodeMirror is deferred and only added if the side-by-side preview proves unsatisfying in daily use. Phase 0 spike S10 tests this choice.

## Scope by tier

### v1 — a complete single-file editor for anything

**Core editing (from Monaco):**
- Multi-cursor and column selection, find and replace with regex, folding, bracket matching and colouring, auto-indent and indentation detection, word wrap, minimap, sticky scroll, go to line, go to symbol in file, comment toggling, move and duplicate lines.
- Side-by-side diff of two files or of a file against its last saved version.
- Split editors.

**Any language, highlighted:**
- TextMate grammars through Shiki and its Monaco adapter: about 260 languages, the same grammars VS Code uses.
- VS Code colour themes imported as-is.
- Language detection by file name, extension and shebang (using the Linguist language list, about 850 entries), with a manual override in the status bar.
- Plain-text fallback for anything unrecognised.

**Built-in intelligence with no external tools:**
- TypeScript, JavaScript, JSON, CSS, HTML: completion, hover, diagnostics, formatting, from Monaco's bundled language services.
- YAML, TOML, Markdown: in-process language services.
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
- Markdown: GitHub-flavoured, with math and Mermaid diagrams, scroll-synced.
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
- **Integrated terminal** (xterm.js and node-pty) as a bottom panel, loaded on first use.
- **Minimal git** by calling the installed `git`: changed-line markers in the gutter, a list of changed files, diff, stage, commit. No merge tooling.
- **Replace across files.**
- **More viewers:** CSV as a table (shared with the spreadsheet side), live HTML preview, Jupyter notebooks read-only, log tailing.
- **Vim keybindings** (via `monaco-vim`).

### Later — opt-in extras

- A language-server installer built on the mason-registry catalogue, always with explicit consent.
- Import of the declarative parts of VS Code extensions (themes, grammars, snippets) from `.vsix` files, without running any extension code.
- Tree-sitter for faster, structure-aware highlighting and selection.
- A chunked viewer for multi-gigabyte logs.
- Optional AI completion or chat through an endpoint the user supplies. Off by default; the app stays fully offline without it.
- "Writing mode" for Markdown on CodeMirror 6.

### Never

Debugger, test explorer, task runner, a running extension host or marketplace, remote development, notebook execution, three-way merge editor, forking VS Code.

## Folders and workspaces

The app stays file-first: opening a single file needs no project. A folder can be opened as a workspace, which adds:

- A file tree in the sidebar (virtualised, respecting `.gitignore`, watched with `@parcel/watcher`).
- Folder-scoped search and file finding.
- Per-folder settings.

The tree shows **every file type**. Clicking a `.docx` or `.pdf` in the tree opens it in its own engine in a tab, exactly like a code file. This is where the all-in-one idea pays off: a project folder with notes, spreadsheets, PDFs and code is one workspace.

## How it fits the architecture

- `packages/engine-text` wraps Monaco behind the same `EditorProvider` contract as every other engine. It claims every file that is not claimed by another provider and is not binary.
- Monaco loads once and is shared by all text tabs; each tab is a lightweight model, so text tabs are cheap.
- Language services run in web workers; language servers, ripgrep, git and the terminal run outside the renderer and talk over IPC.
- Monaco's own command palette and menus are disabled. Its actions are registered in the shell's command registry so there is one palette.
- Highlighting grammars, language services, previews, terminal and git are each separate lazy chunks. A user who only edits Markdown never loads the terminal.

## Risks specific to this area

| Risk | Response |
|---|---|
| Monaco's packaging has changed in four consecutive releases | Pin the version; upgrade deliberately; keep the adapter thin |
| Monaco normalises mixed line endings in a file | Detect mixed endings on open, warn, and cover it in the byte-equality tests |
| Monaco's built-in language-server client is new and its completeness is unverified | Spike S11; fallback is a small client on `vscode-jsonrpc` |
| Monaco's web workers do not start from `file://` | Serve everything from the app's custom protocol (already planned) |
| Very large files | Large-file mode; later a chunked viewer; CodeMirror as fallback engine |
| `node-pty` is a native module with no Linux prebuilds | Terminal is v2 and lazily loaded; use a prebuilt fork or build in CI |
| Open VSX has had repeated supply-chain incidents | No extension code is ever executed; only declarative assets may be imported |
| Scope creep toward a full IDE | The "Never" list above |
| YAML language service fetches schemas over the network by default | Vendored SchemaStore snapshot; network access disabled |

## Additional Phase 0 spikes

| # | Question | Experiment |
|---|---|---|
| S10 | Is one text engine enough? | Monaco with a side-by-side Markdown preview for a few days of real note-taking. Measure load time and size against a CodeMirror 6 equivalent |
| S11 | Does Monaco's built-in language-server client work with a real server? | Connect it to rust-analyzer or basedpyright spawned from the main process |
| S12 | Does Shiki highlighting in Monaco stay fast? | Open a 20,000-line file in several languages with an imported VS Code theme |
