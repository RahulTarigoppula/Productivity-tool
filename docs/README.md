# All-in-one productivity tool — plans and research

Last updated: 2026-11-21 · Stage: research and planning complete, no application code yet

One local, single-window, multi-tab app for personal use that opens, creates, edits, converts and saves office documents, spreadsheets, presentations, PDFs, Markdown, and any text or code file.

## The plan in eight lines

1. **Do not rebuild Word, Excel or PowerPoint.** Embed a real office engine and put our effort into the shell around it.
2. **Two tiers.** A small, fast base app for text, code, Markdown, CSV and PDF; the office engine (about 100 MB) is a separate pack that loads only when an office file is opened.
3. **Text and code:** Monaco, the editor inside VS Code, for any text-based file in any language. VS Code-level editing; deliberately not a full IDE.
4. **docx / xlsx / pptx:** the ONLYOFFICE editors running fully offline with their converter compiled to WebAssembly.
5. **pdf:** PDF.js for viewing, annotating and signing; a maintained pdf-lib fork for page tools.
6. **Interface:** four things always visible (tabs, one contextual toolbar, the document, a thin status bar); everything else on demand; one `Ctrl/Cmd+K` palette that lists every action.
7. **Shell:** chosen by operating system. Tauri on Windows for a far smaller app; Electron for Linux or cross-platform; macOS decided by test.
8. **Prove it first:** seventeen short experiments and a clickable design prototype before any real build, then text and code → PDF → office → light workbench, with fidelity, speed and size budgets enforced automatically.

## Reading order

| Doc | What it answers |
|---|---|
| [plans/00-vision-and-scope.md](plans/00-vision-and-scope.md) | What we are building, what we are not, and what "done" means |
| [plans/01-architecture.md](plans/01-architecture.md) | Stack, process model, editor-provider contract, file pipeline, directory layout |
| [plans/02-format-engines.md](plans/02-format-engines.md) | Per format: what it demands, engine chosen, alternatives, what we build ourselves |
| [plans/06-code-and-text-editor.md](plans/06-code-and-text-editor.md) | The VS Code-level editor: engine, feature tiers, language servers, what is left out |
| [plans/07-ux-ui-design.md](plans/07-ux-ui-design.md) | Design principles, window layout, toolbars, palette, shortcuts, save model, design process |
| [plans/08-performance-and-footprint.md](plans/08-performance-and-footprint.md) | Measured sizes, two-tier packaging, shell choice, speed and size budgets |
| [plans/03-roadmap.md](plans/03-roadmap.md) | Phase 0 spikes, the decision gate, and the build phases with exit checks |
| [plans/04-verification.md](plans/04-verification.md) | How open → edit → save → reload is proven lossless |
| [plans/05-risks-and-open-questions.md](plans/05-risks-and-open-questions.md) | Decisions needed from you, risks, licences, and what research could not confirm |
| [research/](research/) | The research report and the ten sets of source notes behind these plans |

## Where to start next session

1. Answer the questions at the top of `plans/05-risks-and-open-questions.md`. The first one, your operating system, decides the shell.
2. Try ONLYOFFICE Desktop Editors for a few days and note what still feels wrong.
3. Run the Phase 0 spikes in `plans/03-roadmap.md`, starting with S13, and build the design prototype alongside.
