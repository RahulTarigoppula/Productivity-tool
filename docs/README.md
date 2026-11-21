# All-in-one productivity tool — plans and research

Last updated: 2026-11-21 · Stage: research and planning complete, no application code yet

One local, single-window, multi-tab app for personal use that opens, creates, edits, converts and saves `.docx`, `.md`, `.txt`, `.xlsx`, `.csv`, `.pptx` and `.pdf`.

## The plan in six lines

1. **Do not rebuild Word, Excel or PowerPoint.** Embed a real office engine and put our effort into the shell around it.
2. **Shell:** Electron + TypeScript + React, with tabs, a file pipeline with auto-save and snapshots, and a `Ctrl/Cmd+K` command palette.
3. **docx / xlsx / pptx / csv:** the ONLYOFFICE editors running fully offline with their converter compiled to WebAssembly.
4. **md / txt:** CodeMirror 6 with live preview that never rewrites the file.
5. **pdf:** PDF.js for viewing, annotating and signing; a maintained pdf-lib fork for page tools.
6. **Prove it first:** nine short experiments before any real build, then build text → PDF → office, with an automated round-trip fidelity suite guarding every save.

## Reading order

| Doc | What it answers |
|---|---|
| [plans/00-vision-and-scope.md](plans/00-vision-and-scope.md) | What we are building, what we are not, and what "done" means |
| [plans/01-architecture.md](plans/01-architecture.md) | Stack, process model, editor-provider contract, file pipeline, directory layout |
| [plans/02-format-engines.md](plans/02-format-engines.md) | Per format: what it demands, engine chosen, alternatives, what we build ourselves |
| [plans/03-roadmap.md](plans/03-roadmap.md) | Phase 0 spikes, the decision gate, and the build phases with exit checks |
| [plans/04-verification.md](plans/04-verification.md) | How open → edit → save → reload is proven lossless |
| [plans/05-risks-and-open-questions.md](plans/05-risks-and-open-questions.md) | Decisions needed from you, risks, licences, and what research could not confirm |
| [research/](research/) | The full research report and the six sets of source notes behind these plans |

## Where to start next session

1. Answer the questions at the top of `plans/05-risks-and-open-questions.md`.
2. Try ONLYOFFICE Desktop Editors for a few days and note what still feels wrong.
3. Run the Phase 0 spikes in `plans/03-roadmap.md`, starting with S1.
