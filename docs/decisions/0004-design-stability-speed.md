# 0004 — Design pass, stability and speed

Date: 2026-11-22 · Status: accepted

## Design

A screenshot review of every main screen, in light and dark, found these problems. All are fixed.

| Screen | Before | Now |
|---|---|---|
| Home | Plain title, five tiles with one orphan, "New" and "Open" mixed, an unfinished-looking empty list | Greeting and app mark; search with a Ctrl K hint; **Create** cards with coloured chips (Word, Excel and PowerPoint when the Office pack is installed); **Open a file** and **Open a folder** buttons; recent files in a card; a real empty state |
| Export | Two rows both called "PDF", repeated and contradictory notes, very tall | One row per format with a coloured badge, one clear line, a quality label; Print is its own row |
| Settings | Native drop-downs and checkboxes, one flat list | Grouped (Appearance, Saving, Editor); switches and segmented controls |
| Dialogs | Backdrop so faint the page looked active | Stronger backdrop; dialogs fade and rise in (off with reduced motion) |
| Tooltips | Native, slow, unstyled | Fast, styled, with the shortcut as a key hint; accessible names kept |
| Tabs | Close button on every tab | Close on hover and on the active tab; thin accent line on the active tab |
| Markdown | Tables shown as pipes and dashes; ``` fences visible | Tables render as tables until clicked; code blocks have rounded edges and a language label |
| Office preview banner | Two actions duplicating the toolbar, misaligned icons | One action, clear wording |
| Start-up | White flash in dark mode; light title bar on a dark app | Correct background from the first frame; the Windows title bar follows the theme |
| Phones and tablets | Keyboard hints and "drop files here" shown on touch screens | Hidden on touch-only devices |

## Stability

| Risk | Change |
|---|---|
| A bug in any panel blanked the whole window | Each part (tab bar, toolbar, sidebar, side panel, status bar, home, palette, dialogs, menus) has its own error boundary with Retry; the window has a last-resort page; unsaved work is kept by crash recovery |
| Uncaught errors went unnoticed | Logged and shown as one calm toast (rate-limited) |
| No record of problems | Local log `logs/app.log` in the app's data folder (rotated at 1 MB; never sent anywhere); core panics are written there first |
| A Rust panic closed the app (`panic = "abort"`) | Release builds unwind: a panic fails one command; locks recover instead of staying poisoned |
| PDF page operations started during a reload were silently dropped | They queue and run in order |

## Speed

Measured in Chromium with the built app:

| Case | Before | After |
|---|---|---|
| Typing in a 20 MB log file | ~350 ms per key (word count recomputed over the whole file) | ~8 ms per key |
| Opening a 20 MB log file | 0.9 s | 0.6 s |
| Opening a 100,000-row CSV | 0.35 s | unchanged |
| Editing a cell / sorting / saving that CSV | — | ~24 ms / 0.6 s / 26 ms |

Flow P-1 in the end-to-end tests fails the build if a 20 MB file takes more than 4 s to open or typing exceeds 40 ms a key. Unchanged background Office and PDF tabs release their memory (tab hibernation) and reload from their file when shown.

## Not done yet

- Native Mica title bar and Snap Layouts flyout.
- Lazy-loading the palette and dialogs to trim the start-up bundle (start-up is already ~0.4 s on Windows).

## Three rounds of review (2026-11-22, later)

| Round | Reviews | Found and fixed |
|---|---|---|
| 1 | Correctness, security, user journeys (independent, each with reproductions) | 6 data-loss bugs (overlapping saves, recovery moving the saved baseline, PDF annotation edits after save, lossy CSV encoding, stale Office saves, recovery ordering); links climbing out of network shares; unbounded and device reads; freezes from crafted tables and wide CSVs; Android self-test reachable by other apps; 12 groups of journey issues (list cursor, PDF highlight, dialog focus, dead-end commands, hidden active tab, error tabs, CSV gaps, wording) |
| 2 | Review of the fixes, and a re-walk of every journey | A saved state wrong after undo; stacked dialogs sharing Tab and Escape; new CSV not taking typing; overlapping phone toolbar; task boxes missing from previews; Close others ignoring Cancel; wide-CSV polish |
| 3 | Simplicity, familiarity, visual quality, originality | Developer terms in the status bar and commands; text contrast below WCAG AA; icon-only toolbars; conflict banner on phones; badges and product names in Export; inconsistent Office previews; Settings trimmed; Create dialog matching the home screen |
| 4 (2026-11-26) | Independent review of Word/Excel export, column rename, PDF highlight of a selection, headings | Excel export turning 12-15 digit IDs and barcodes into numbers Excel shows as 4.00638E+12, and "1.10"/"-0" into 1.1/0; sheet names Excel refuses (apostrophes, "History", split emoji); cells over Excel's 32,767-character limit; Word runs with properties out of schema order (bold code, code links); numbered lists ignoring their start number; an item's number after its code block; entities and HTML comments left in text; a delayed highlight firing after another tool was chosen or in another tab; double-clicking a column border opening rename (it now fits the column); IME Enter committing early; headings over nested quotes or dividers; export and grid disagreeing on the header row. Found while testing: Escape in a table cell kept the typed value. |
| 5 (2026-11-26) | Five independent reviews at once: visual design (150 screenshots), accessibility (axe-core, keyboard only, high contrast, touch), crash testing with malformed and huge files, performance profiling (CDP, 4x CPU slowdown), and four everyday personas doing real tasks | Word headings drawn in a symbol font (font table); Office editors looking like another company's product; damaged files shown as raw bytes; Export burying Excel and Word; insert row overwriting data; leaving a list gluing the next paragraph; no undo on phones; no screen-reader table, keyboard menus or tab keys; toasts vanishing while focused; contrast and high-contrast gaps; 4 data-loss bugs (UTF-8 mark + Windows-1252 saved as UTF-16, export over the source, sorted open-quote row, sheet names colliding); out-of-memory crashes from crafted Office files and huge pictures; freezes (1M-row CSV open, unmatched Markdown marks, Markdown→Word, JSON→CSV); leaks (closed PDF tabs 75 MB each, closed documents kept by old renders); big-note exports writing a placeholder. Also added: older and OpenDocument Office files, audio/video, ZIP archives, real Word→Markdown, Excel number formats. |

Every confirmed finding has an end-to-end flow (D-*, U-1..U-14, A-1..A-15, P-1..P-11, R-*) or unit test so it cannot come back unnoticed. Generated Word and Excel files were also opened in LibreOffice and two independent readers.

Originality: the design, name and mark are original; Word, Excel and PowerPoint are named only as file types. The Office editors are Euro-Office, based on ONLYOFFICE (AGPL-3.0): their notices ship with the app and the About box credits them; their names and logos are not used to brand this app.
