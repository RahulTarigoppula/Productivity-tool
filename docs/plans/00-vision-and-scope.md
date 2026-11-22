# 00 — Vision and scope

Status: draft for review · Last updated: 2026-11-21

## The problem

Editing a `.txt`, `.md`, `.docx`, `.xlsx`, `.pptx` or `.pdf` today means a different app for each one, each with its own window, shortcuts and habits. The goal is one fast, light, plain and simple local app, for personal use, that opens every one of them in tabs, leaves nothing out, and is the same app on every device: Windows first, then Android, then Mac and iPhone/iPad.

## The key finding that shapes everything

Research (see `../research/`) is unambiguous on one point: **nobody, solo or otherwise, re-implements Word, Excel and PowerPoint.** Those formats are thousands of pages of specification, and every "build your own editor" library found loses data on save — charts, pivot tables, masters, tracked changes, animations — because it converts the file to its own model and writes a new file from that.

"All the features, nothing left out" is therefore only achievable by **embedding an existing full office engine** and spending our own effort on what makes the app *ours*: the shell around it.

Two more facts follow:

- **A tabbed all-in-one app already exists.** ONLYOFFICE Desktop Editors opens docx, xlsx, pptx and pdf in tabs today. This project does not beat it on office fidelity; it uses the same engine.
- **What this project adds** is the part ONLYOFFICE does not do: a real text and code editor, a single keyboard-first command palette across every format, one consistent minimal look, a proper PDF page-tools workflow, documents that link to and search across one another, export from anything to anything, the same app on every device, and safety nets (auto-save, snapshots, recovery) that we control. No product found combines real Office and PDF editing, plain files with no account, and a notes-style layer of links and search (`09-differentiators-and-interconnection.md`).

Before the build starts, it is worth using ONLYOFFICE Desktop Editors for a few days. If it already feels good enough, that is a cheap and valid outcome. If the jarring part is still there (md/txt elsewhere, no palette, separate PDF tool), this project is justified and the gaps you notice become the priority list.

## Goals

1. One window, many tabs: any supported file opens in the same workspace.
2. Full-depth editing for office formats by embedding a real office engine, not a lookalike.
3. A general text and code editor at VS Code's editing level: any text-based file, any language, and never reformats the file (see `06-code-and-text-editor.md`).
4. PDF viewing, annotation, signing and page tools.
5. Open, New (from templates), Auto-save, Save As, and export across formats.
6. Command palette (`Ctrl/Cmd+K`) for files, tabs, search and commands in every format.
7. No corruption: a file saved by this app opens cleanly in Word, Excel, PowerPoint, Acrobat and Preview, with nothing lost that the user did not touch.
8. Fully offline. No server, no account, no telemetry.
9. Plain and simple to use: one consistent interface across every format (see `07-ux-ui-design.md`).
10. Fast and light: instant launch and tab switching, a small base app, and heavy engines loaded only when needed (see `08-performance-and-footprint.md`).
11. Connected: links, backlinks, tags and universal search across every format, stored in the files themselves (see `09-differentiators-and-interconnection.md`).
12. Export anything to anything, with an honest quality label (see `10-universal-export.md`).
13. Every device: Windows, then Android, then macOS and iOS/iPadOS, from one codebase (`12-platforms-and-mobile.md`). Files and working state moving between devices is the final release (`11-sync-and-continuity.md`).

## Non-goals

- Real-time collaboration with other people, sharing, accounts.
- Running our own sync server. Files move between devices through a synced folder or a connector to a cloud you already use.
- A web version.
- Full office editing on phones in the first mobile release. Phones get viewing, commenting and light edits for office files; tablets and desktops get the full editor.
- Writing our own docx, xlsx or pptx engine.
- Becoming a full IDE: no debugger, test runner, extension marketplace or remote development.
- Distributing the app to other people (this keeps licensing simple; see `05-risks-and-open-questions.md`).
- Macros/VBA execution, Power Query, mail merge to external data — whatever the embedded engine supports comes for free, nothing more is promised.
- True reflowing text edits inside PDFs in the first version.

## Supported formats

| Family | Formats (v1) | Likely later |
|---|---|---|
| Text and code | `.txt`, `.md`, and any text-based file: config (`.json`, `.yaml`, `.toml`, `.xml`, `.ini`), logs, HTML/CSS, source code in any language | Notebooks (read-only), multi-gigabyte logs |
| Documents | `.docx` | `.odt`, `.rtf`, `.doc` (import) |
| Spreadsheets | `.xlsx`, `.csv` | `.tsv`, `.ods`, `.xls` (import) |
| Presentations | `.pptx` | `.odp`, `.ppt` (import) |
| PDF | `.pdf` | — |

## What "done" looks like for v1

- All formats above open in tabs, edit, save and reopen without loss.
- The verification suite in `04-verification.md` passes on the sample corpus and on a personal corpus of real files.
- Daily work for one week happens only in this app, with no need to open Word, Excel, PowerPoint, a text or code editor, or a PDF tool.
- The speed and size budgets in `08-performance-and-footprint.md` are met on your own machine.

That is "done" for the Windows release. Android and then Apple devices follow as their own releases, each with the same test.
