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
