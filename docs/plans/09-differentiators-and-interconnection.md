# 09 — What makes it better, and how documents connect

Status: draft for review · Last updated: 2026-11-21

The ambition is an app "much better than the current offerings". This document turns that into specific, checkable things, and is equally specific about where the incumbents will stay ahead.

## Where the current offerings leave room

Findings from research. All of it came from search summaries and background knowledge because primary sources were unreachable; treat specifics as indicative until checked.

| Complaint | Evidence found |
|---|---|
| Forced AI, price rises, upsell | Microsoft bundled Copilot into consumer plans with a price rise in January 2025. Apple made Pages, Numbers and Keynote freemium in January 2026, and their Mac App Store ratings reportedly fell sharply. Adobe's own forum has threads asking for a "bare bones Acrobat" |
| Ads and tracking | WPS's privacy policy confirms ad-interaction tracking |
| Accounts and cloud by default | Most suites push sign-in and cloud storage before you can work |
| One app per format | Microsoft's all-in-one mobile app stopped editing in late 2025 and now only previews Word, Excel and PowerPoint files; editing went back to separate apps |
| Files do not know about each other | Office's "paste link" between Excel and Word breaks because it stores absolute file paths |
| Weak phone editing | Word's mobile view drops ink and shapes; Excel's card view only works on formal tables |

One finding matters most: **no product found combines all three of these**:

1. Real editing of Office and PDF files.
2. Plain files on your own disk, with no account.
3. A notes-style layer of links, backlinks and search across everything.

WPS and ONLYOFFICE have the first two. Obsidian has the last two. That gap is this project's position.

## Honest positioning

> A calm, fast, single app that opens every kind of document you own, treats them as ordinary files you control, and lets them link to, search and convert into one another. It uses a proven engine for Office formats instead of pretending to out-build Microsoft, and puts its own effort into everything around the documents.

**Where this app will not win, and should not try:**

- Real-time collaboration and co-authoring.
- AI assistants at the scale of Copilot or Gemini.
- Pixel-exact rendering of Microsoft's own formats in every edge case.
- Phone editing polish that large teams have spent a decade on.
- Enterprise compliance and administration.

Saying this plainly protects the project from chasing parity in places where parity is not available to one person.

## The differentiators

Ranked by value against effort. The ranking is judgement, not user research.

| # | Differentiator | Pain it answers | Nearest existing thing | Feasibility |
|---|---|---|---|---|
| 1 | **One calm shell.** Every format in tabs; no account, no ads, no subscription, no forced AI | App switching, bloat, upsell | ONLYOFFICE Desktop, WPS (without the calm) | High — it is the base plan |
| 2 | **Universal search** across every format, landing on the exact page, cell, slide or line | "Which file was that in?" | Windows Search, Spotlight (file-level only) | High — a local index over text each engine extracts |
| 3 | **Links and backlinks across formats** | Files that do not know about each other | Obsidian (Markdown only) | Medium–high — see below |
| 4 | **PDF highlights linked to notes** | Reading and note-taking live in different apps | Zotero, Obsidian PDF++ | Medium–high |
| 5 | **Automatic local version history with visual compare** | Fear of overwriting; "what changed?" | Google Docs history (cloud only) | Medium — snapshots are planned; compare is per format |
| 6 | **Linked copies that refresh.** A chart or range from a spreadsheet placed in a document or deck, updated with one click | Copy-paste goes stale; Office links break | Google's linked charts with an Update button | Medium–low — the highest technical risk |
| 7 | **Export anything to anything**, with honest quality labels | Format lock-in, hunting for converters | Online converters (upload required) | High — see `10-universal-export.md` |
| 8 | **Keyboard-first everything.** One palette for every action in every format | Ribbon hunting | VS Code, Linear (not office suites) | High |
| 9 | **Batch actions on files.** Convert, merge, rename, find and replace across many files and formats | Repetitive manual work | Scattered utilities | Medium |
| 10 | **Two formats side by side**, with drag between them | Window juggling | OS window snapping | Medium |
| 11 | **Quick capture** from the phone into an inbox that is waiting on the desktop | Ideas lost between devices | Notes apps | Medium — depends on sync |
| 12 | **The same app on every device** | A different app and habit per device | Microsoft, Google (as separate apps) | Low–medium — never promise full parity on phones |

## How documents connect — on ordinary files

The rule: **nothing that matters is locked inside this app.** Links and tags are stored in the files themselves using each format's standard features, so they still work in Word, Excel, Acrobat or a file manager. The app's own database is only an index that can be deleted and rebuilt.

### Where things are stored

| Thing | Markdown / text | docx / xlsx / pptx | PDF |
|---|---|---|---|
| Tags and properties | Front matter | The file's standard document properties | The file's standard metadata (XMP) |
| Link to another file | Normal Markdown or wiki-style link | Normal hyperlink | Normal link annotation |
| Link to a place inside a file | Heading anchor | Bookmark, named range, slide number | Page or named destination |
| Annotation | — | Comment | Standard annotation |

Avoided on purpose: extended file attributes and NTFS streams, because OneDrive and Google Drive do not preserve them.

### One link format for everything

A single address scheme identifies any place in any file:

```
file path  +  optional location

notes/plan.md#timeline              a heading
budget.xlsx#Summary!B4:D12          a sheet range
deck.pptx#slide=7                   a slide
paper.pdf#page=14                   a page (optionally a highlighted region)
report.docx#bookmark=Findings       a bookmark
src/main.rs#L120                    a line
```

- Paths are **relative** to the linking file or the workspace root, never absolute. This is exactly what Office's paste-link gets wrong.
- Each file also gets a stable identifier stored in its own properties, so a link can be repaired when a file is renamed or moved.
- The same address works as an app deep link, which is also what cross-device "continue here" uses.

### What the index provides

Built locally from the files, in the background, and safe to throw away:

- **Backlinks:** "what links here" for any file, heading, sheet or page, shown in the right panel.
- **Universal search** with results grouped by file and a snippet per hit.
- **Tags and properties** across every format, with table views over a folder (in the manner of Obsidian Bases).
- **Broken-link detection**, with repair suggestions using the stable identifiers.
- **Unlinked mentions:** files that mention this file's name without linking to it.

### Linking features, in order of delivery

| Stage | Feature | Notes |
|---|---|---|
| 1 | Insert link to any file or location, with file search; follow link; hover preview | Works in every format through its normal hyperlink feature |
| 1 | Backlinks panel and universal search | From the index |
| 2 | PDF highlight → note. Selecting text in a PDF creates a quote in a Markdown note with a link back to the exact page and region | The Zotero and PDF++ pattern |
| 2 | Tags and properties across formats; folder table views | |
| 3 | Embedded previews in Markdown: a sheet range, a chart, a PDF page or a slide shown inline, rendered live from the source file | Read-only previews are cheap in Markdown |
| 3 | **Linked copies** in office files: insert a range or chart from a spreadsheet into a document or deck with a visible source chip and an **Update** button | Stored as a normal table or image plus the source address in the object's description, so the file stays valid everywhere. Never auto-updates silently |
| 4 | Version compare per format | Text diff for text; redline for docx (Docxodus is an MIT library that does this in WebAssembly); cell diff for xlsx; side-by-side pages for pptx and PDF |
| Later | Canvas or graph view of connected files | Only if the links prove useful in daily use |

**The hard one is linked copies.** It depends on how much the office engine exposes for inserting and replacing objects from outside. It is listed as a spike and is not promised for the first release.

## Workflow actions that set it apart

Small, concrete actions that office suites lack and that the shell can provide once for every format:

- **Open as…** another representation: a CSV as a table or as text, Markdown as slides, a document as an outline, any file as raw text.
- **Insert from file:** pick another file, pick the object (chart, range, page, slide), see a preview, insert it with its source recorded.
- **Find and replace across files** of mixed formats, with a preview of every change before it is applied.
- **Batch** convert, merge, rename and extract from the home screen or a folder.
- **Drag between panes:** a table from a spreadsheet into a document, a PDF page into a deck.
- **Templates with variables** (date, title, project) for every format.
- **Quick note** from a global shortcut on the desktop and a share target on the phone.
- **Undo for file-level actions:** page deletes, renames, restores and moves, not only typing.

## How "better" is measured

"Better design" is otherwise unfalsifiable. Three measures make it concrete:

1. **Fewer steps for the top tasks.** For twenty everyday tasks, count keystrokes and clicks here and in the incumbent (the keystroke-level method), and record both. Targets and results live in the flow maps.
2. **Speed.** The budgets in `08-performance-and-footprint.md`, measured on your own devices.
3. **Nothing lost, nothing hidden.** The fidelity suite in `04-verification.md`, plus the rule that every lossy action says what will be lost before it happens.

## Additional spikes

| # | Question | Experiment |
|---|---|---|
| S18 | Can links, bookmarks and document properties be read and written in docx, xlsx and pptx through the office engine, or must the app edit the file package directly? | Insert and read back a hyperlink to a named range, a bookmark and a custom property in each format |
| S19 | Can a linked copy be inserted and refreshed from outside the engine? | Place a range from an xlsx into a docx as a table with a source address, change the source, refresh |
| S20 | Can each engine yield text with locations for the search index? | Extract text with page, cell, slide and line positions from one file of each format; time it on a large file |
