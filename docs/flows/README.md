# User flow maps

Status: draft for review · Last updated: 2026-11-21

These maps describe what the user does and what the app does in response, for every important task. They are written as Mermaid diagrams, which GitHub renders directly, so the maps live beside the code and change with it.

They are **design proposals**, not records of a built product. Each one is checked against a clickable prototype before the matching feature is built.

## How to read them

- **Rounded box:** something the user does.
- **Rectangle:** something the app shows or does.
- **Diamond:** a decision or condition.
- Each flow has an ID (`F-15`). End-to-end tests carry the same ID in their name, and a script reports any flow without a test.
- Where phone and desktop differ, the map says so. "Compact" means a phone-width window; "large" means desktop.
- Each flow lists a **step target**: the number of user actions for the common path, to be compared with the same task in the incumbent apps.

## The maps

| File | Flows |
|---|---|
| [00-app-map.md](00-app-map.md) | The things in the app and the screens, and how they connect |
| [01-start-and-open.md](01-start-and-open.md) | F-01 first launch · F-02 home · F-03 new · F-04 open · F-05 quick open · F-07 open from another app |
| [02-tabs-save-history.md](02-tabs-save-history.md) | F-08 switch tab · F-09 split · F-11 save · F-12 version history · F-14 changed on disk · F-39 crash recovery |
| [03-export-and-share.md](03-export-and-share.md) | F-15 export · F-16 batch export · F-17 share · F-30 print |
| [04-search-and-links.md](04-search-and-links.md) | F-18 find in file · F-19 search everywhere · F-20 command palette · F-21 link and backlinks · F-25 insert from another file |
| [05-pdf.md](05-pdf.md) | F-22 annotate · F-23 fill and sign · F-24 reorganise pages |
| [06-slides.md](06-slides.md) | F-27 present · F-28 presenter view · F-29 phone as remote |
| [07-across-devices.md](07-across-devices.md) | F-13 sync conflict · F-31 quick capture · F-32 continue on another device |
| [08-errors-and-limits.md](08-errors-and-limits.md) | F-35 unreadable file · F-36 lossy save · F-37 missing engine pack · F-38 permissions · F-41 switch view on phones |

## Full inventory

P1 flows are mapped first and built first. P3 flows are described in one line until their phase arrives.

| ID | Flow | Priority |
|---|---|---|
| F-01 | First launch | P1 |
| F-02 | Home | P1 |
| F-03 | New document, blank or from template | P1 |
| F-04 | Open with the file picker | P1 |
| F-05 | Open recent / quick open | P1 |
| F-06 | Open by drag and drop | P2 |
| F-07 | Open from another app ("Open with", share) | P1 |
| F-08 | Switch tab | P1 |
| F-09 | Arrange tabs, split view, new window | P2 |
| F-10 | Close tab, reopen closed tab | P2 |
| F-11 | Save, auto-save, Save As, rename, move | P1 |
| F-12 | Version history and restore | P2 |
| F-13 | Sync conflict | P2 |
| F-14 | File changed outside the app | P2 |
| F-15 | Export one file | P1 |
| F-16 | Batch export | P3 |
| F-17 | Share | P2 |
| F-18 | Find and replace in a file | P1 |
| F-19 | Search across files | P2 |
| F-20 | Command palette | P1 |
| F-21 | Link two documents, follow a link, backlinks | P2 |
| F-22 | PDF: highlight, note, draw | P1 |
| F-23 | PDF: fill a form and sign | P1 |
| F-24 | PDF: reorder, rotate, delete, extract, merge pages | P2 |
| F-25 | Insert content from another file | P2 |
| F-26 | Insert image, photo or scan | P2 |
| F-27 | Present slides on one screen | P1 |
| F-28 | Presenter view on two screens | P2 |
| F-29 | Phone as a remote | P3 |
| F-30 | Print | P2 |
| F-31 | Quick capture on the phone | P2 |
| F-32 | Continue on another device | P3 |
| F-33 | Settings | P2 |
| F-34 | Theme, appearance, text size | P2 |
| F-35 | Error: file cannot be read | P1 |
| F-36 | Warning: unsupported feature or lossy save | P1 |
| F-37 | Missing engine pack, low storage, offline | P2 |
| F-38 | Permission prompts on phones | P1 |
| F-39 | Recovery after a crash | P1 |
| F-40 | Update the app or an engine | P3 |
| F-41 | Switch view on phones (page / reflow, grid / cards) | P1 on mobile |
| F-42 | Undo and redo, including file-level actions | P1 |

## Rules every flow follows

1. **No dead ends.** Every error offers at least one way forward.
2. **No surprise loss.** Anything that could lose content says what, before it happens.
3. **No needless questions.** Naming and location are asked at first save, not at creation. Quitting never asks about saving.
4. **Same verb, same place.** Open, Find, Export, Share and Undo work the same in every format.
5. **Everything undoable.** Including page deletes, renames, moves and restores.
6. **Keyboard and touch both complete.** Every flow can be finished without a mouse, and without a keyboard.
