# 00 — Vision and scope

Status: draft for review · Last updated: 2026-11-21

## The problem

Editing a `.txt`, `.md`, `.docx`, `.xlsx`, `.pptx` or `.pdf` today means a different app for each one, each with its own window, shortcuts and habits. The goal is one fast, local, distraction-free app, for personal use, that opens every one of them in tabs and leaves nothing out.

## The key finding that shapes everything

Research (see `../research/`) is unambiguous on one point: **nobody, solo or otherwise, re-implements Word, Excel and PowerPoint.** Those formats are thousands of pages of specification, and every "build your own editor" library found loses data on save — charts, pivot tables, masters, tracked changes, animations — because it converts the file to its own model and writes a new file from that.

"All the features, nothing left out" is therefore only achievable by **embedding an existing full office engine** and spending our own effort on what makes the app *ours*: the shell around it.

Two more facts follow:

- **A tabbed all-in-one app already exists.** ONLYOFFICE Desktop Editors opens docx, xlsx, pptx and pdf in tabs today. This project does not beat it on office fidelity; it uses the same engine.
- **What this project adds** is the part ONLYOFFICE does not do: first-class Markdown and plain text, a single keyboard-first command palette across every format, one consistent minimal look, a proper PDF page-tools workflow, cross-format export, and safety nets (auto-save, snapshots, recovery) that we control.

Before the build starts, it is worth using ONLYOFFICE Desktop Editors for a few days. If it already feels good enough, that is a cheap and valid outcome. If the jarring part is still there (md/txt elsewhere, no palette, separate PDF tool), this project is justified and the gaps you notice become the priority list.

## Goals

1. One window, many tabs: any supported file opens in the same workspace.
2. Full-depth editing for office formats by embedding a real office engine, not a lookalike.
3. Markdown and plain text that feel like a dedicated writing app, and never reformat the file.
4. PDF viewing, annotation, signing and page tools.
5. Open, New (from templates), Auto-save, Save As, and export across formats.
6. Command palette (`Ctrl/Cmd+K`) for files, tabs, search and commands in every format.
7. No corruption: a file saved by this app opens cleanly in Word, Excel, PowerPoint, Acrobat and Preview, with nothing lost that the user did not touch.
8. Fully offline. No server, no account, no telemetry.

## Non-goals

- Real-time collaboration, cloud sync, sharing, accounts.
- Mobile or web versions.
- Writing our own docx, xlsx or pptx engine.
- Distributing the app to other people (this keeps licensing simple; see `05-risks-and-open-questions.md`).
- Macros/VBA execution, Power Query, mail merge to external data — whatever the embedded engine supports comes for free, nothing more is promised.
- True reflowing text edits inside PDFs in the first version.

## Supported formats

| Family | Formats (v1) | Likely later |
|---|---|---|
| Text | `.txt`, `.md` | `.json`, `.yaml`, code files |
| Documents | `.docx` | `.odt`, `.rtf`, `.doc` (import) |
| Spreadsheets | `.xlsx`, `.csv` | `.tsv`, `.ods`, `.xls` (import) |
| Presentations | `.pptx` | `.odp`, `.ppt` (import) |
| PDF | `.pdf` | — |

## What "done" looks like for v1

- All seven formats open in tabs, edit, save and reopen without loss.
- The verification suite in `04-verification.md` passes on the sample corpus and on a personal corpus of real files.
- Daily work for one week happens only in this app, with no need to open Word, Excel, PowerPoint, a Markdown editor or a PDF tool.
