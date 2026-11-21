# 07 — UX and UI design

Status: draft for review · Last updated: 2026-11-21

The design problem: one calm, simple interface for editors that each have hundreds of features, some of them third-party engines with their own toolbars. No precedent was found for a single shell unifying an office engine, a code editor, Markdown and PDF, so this plan leans on patterns that are proven separately and on early prototyping.

## Design principles

1. **The document is the interface.** By default the window shows the file and almost nothing else.
2. **One of everything.** One tab row, one toolbar row, one status bar, one palette, one way to save, one way to export. Formats change the contents of these, never their position.
3. **Two levels of disclosure, no more.** Common actions are visible; everything else is one step away (the "More" menu, the palette or the menu bar). Usage is heavily skewed: in Microsoft's own data the top five Word commands were about a third of all use.
4. **Conventional beats clever.** Figma reversed its floating-panel redesign because it slowed people down, and the Arc browser's successor returned to familiar tabs. Tabs on top, toolbar under them, status at the bottom.
5. **The palette is the index, not the only door.** Every action is in the palette, and every action is also reachable by mouse through a toolbar, a context menu or the menu bar. Editors that rely on the palette alone are criticised for it.
6. **Respect muscle memory per format.** Inside a spreadsheet, keys behave like Excel; inside code, like VS Code; inside a document, like Word. Only a short list of shell shortcuts is the same everywhere.
7. **Never lose work, rarely ask.** Saving is automatic and visible. Dialogs appear only when something could be lost.
8. **Fast is a feature.** Anything that takes time shows the real content progressively, never a spinner over a blank window. Budgets are in `08-performance-and-footprint.md`.
9. **Calm visuals.** Low-contrast chrome, soft borders, one accent colour, no decoration. The document carries the contrast.
10. **Accessible by default.** Full keyboard operation and WCAG 2.2 AA contrast in everything we build ourselves.

## The window

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ●●●  ▤ │ 📄 Report.docx  │ 📊 Budget.xlsx ● │ 📝 notes.md │ +        ⌕  ⋯    │  title + tab row
├──────────────────────────────────────────────────────────────────────────────┤
│  B  I  U   H▾   ≡  ☰   ⊞ Table   🖼 Image   🔗       …More        Export ▾   │  one contextual toolbar
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                                                                              │
│                              the document                                    │
│                                                                              │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Saved ✓   Page 3 of 12   1,204 words                      English   100 %    │  thin status bar
└──────────────────────────────────────────────────────────────────────────────┘
```

**Always visible (four things):**

| Element | Contents | Same in every format? |
|---|---|---|
| Title and tab row | Window controls, sidebar toggle, tabs with a format icon and unsaved dot, new-tab button, search/palette button, app menu | Yes |
| Contextual toolbar | The ten or so most-used actions for the current format, a "More" overflow, and Export | Position yes, contents per format |
| Document area | The file | — |
| Status bar | Save state on the left; format-specific facts in the middle; language, encoding and zoom on the right | Layout yes, facts per format |

**On demand (hidden until asked for):**

| Surface | Opens with | Holds |
|---|---|---|
| Command palette | `Ctrl/Cmd+K` | Everything |
| Left sidebar | Toggle or shortcut | Files in the open folder, document outline, PDF page thumbnails, slide navigator, search results |
| Right panel | Toggle, or automatically when relevant | Format inspector, comments, annotations, Markdown preview |
| Bottom panel | Shortcut | Terminal, problems (code only) |
| Menu bar | Native on macOS; `Alt` or the ⋯ button elsewhere | The complete, conventional menu tree |
| Context menu | Right-click | Actions for the thing under the pointer |
| Selection toolbar | Selecting text | Bold, italic, link, comment, highlight |

**Focus mode** hides everything except the document; chrome reappears when the pointer reaches an edge.

## Navigation

- **Home screen** when no file is open: recent files, a "New" row with one tile per format and its templates, and a drop target. No dashboard, no feed.
- **Tabs:** drag to reorder, drag to the side for a split view, pin, reopen closed tab, middle-click to close. Each format has an icon and a quiet colour so tabs are scannable.
- **Many tabs:** the strip scrolls, and `Ctrl/Cmd+K` lists open tabs first. Vertical tabs in the sidebar are a setting.
- **Folders are optional.** The app works on loose files. Opening a folder adds a file tree that lists every file type together.

## Toolbar strategy

The toolbar is where the formats differ most, and where embedded engines resist control.

| Format | Who draws the toolbar | Notes |
|---|---|---|
| Text, code, Markdown | The shell | Markdown shows formatting actions; code shows almost nothing (language, format document, split, preview) |
| PDF | The shell | Tools: select, highlight, note, text, draw, sign; page tools live in the thumbnail sidebar |
| docx, xlsx, pptx | **The engine**, in its compact single-row mode, themed to match | See below |

**The ONLYOFFICE constraint.** Its free configuration allows a compact header, compact toolbar, a choice of tab style, hiding the right panel and rulers, and theme selection. Hiding the toolbar or individual tabs outright is documented as a paid white-label feature. So for v1:

- The shell owns tabs, file actions, save state, export, the palette and the theme.
- The engine keeps one compact, themed toolbar row that sits exactly where the shell toolbar sits for other formats.
- The engine's own file menu, header and branding are suppressed as far as the free options allow, so there is no duplicate "File" or second title bar.
- Engine settings that users can toggle inside the editor are stored separately and can drift from the shell; the adapter re-applies ours on every load.

Replacing the engine toolbar with a shell-drawn one, so that all formats look identical, is a later project. Because the editors run from source on the user's own machine, a private patch is possible; spike S4 measures how much effort that is.

## Command palette

- **One palette, several entry points.** `Ctrl/Cmd+K` opens it in "everything" mode. `Ctrl/Cmd+Shift+P` opens it on commands. `Ctrl/Cmd+P` opens it on files in text and code tabs (in office and PDF tabs that shortcut stays Print).
- **Prefixes** narrow the mode: `>` commands, `@` headings or symbols in the current file, `:` go to line/page/cell/slide, `#` search inside files, `?` help.
- **Ranking:** open tabs and recent files first when empty; then by match quality weighted by how recently and how often you used the item.
- **Every row shows its shortcut**, so the palette teaches the keyboard.
- **Commands with parameters** continue in the palette ("Export as…" → format → location) instead of opening a dialog.
- **Empty state** shows suggestions for the current format, so the palette is useful to someone who does not know what to type.
- **Format-aware:** commands that do not apply to the current tab are hidden, not greyed.

## Keyboard

**Reserved everywhere** (the engine never sees these):

| Action | Shortcut |
|---|---|
| Command palette | `Ctrl/Cmd+K` |
| New, Open, Save, Save As | `Ctrl/Cmd+N`, `O`, `S`, `Shift+S` |
| Close tab, reopen closed tab | `Ctrl/Cmd+W`, `Ctrl/Cmd+Shift+T` |
| Next/previous tab, jump to tab | `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl/Cmd+1…9` |
| Toggle sidebar, focus mode | `Ctrl/Cmd+\`, `F11` (or `Ctrl+Cmd+F`) |
| Zoom | `Ctrl/Cmd +`, `−`, `0` |
| Settings | `Ctrl/Cmd+,` |

Everything else belongs to the focused format. Known casualties: `Ctrl+K` is "insert link" in Word and a chord prefix in VS Code; link insertion moves to the toolbar, the palette and `Ctrl/Cmd+Shift+K`. All shortcuts are editable, and a cheat sheet opens from the palette's `?` mode.

## A shared vocabulary

The same word means the same thing in every format, and lives in the same place.

| Action | Document | Spreadsheet | Slides | PDF | Text/code |
|---|---|---|---|---|---|
| Find | in text | in cells | in slides | in pages | in file |
| Insert → Table / Image / Link | ✓ | ✓ | ✓ | image, link | Markdown syntax |
| Comment | ✓ | ✓ | ✓ | sticky note | — |
| Export | PDF, md, html | PDF, csv | PDF, images | pages, images | PDF, docx, html |
| Go to | page, heading | cell, sheet | slide | page | line, symbol |
| Zoom | ✓ | ✓ | ✓ | ✓ | font size |

## Save and safety, as the user sees it

- **Status bar, left corner:** `Saved ✓`, `Saving…`, `Edited` or `Recovered`. Clicking it opens version history.
- **Text formats** save to the file automatically. **Office and PDF** keep continuous recovery snapshots and write the real file on save (see `01-architecture.md`); the indicator makes the difference visible.
- **Quitting never asks** "save changes?". Unsaved work is restored on next launch.
- **Dialogs only for three things:** a save that would lose content (for example formatting in a CSV), a file changed by another program while edited here, and a failed save.
- **Version history** is a simple list of earlier snapshots with a preview and a restore button.

## Learning the app

- No tutorial, no tour. The home screen and empty states explain themselves.
- Tooltips on every control include the shortcut.
- The palette's empty state and the cheat sheet are the manual.
- The first time a heavy engine loads, a single line says what is loading and why.

## Visual system

- **Tokens first:** colour, spacing, radius, type scale and motion defined once as CSS variables; light, dark and follow-system themes; a high-contrast variant.
- **Type:** the operating system's UI font for chrome; a single monospaced font for code; documents use their own fonts.
- **Components:** shadcn/ui on Base UI (its default since mid-2026) for menus, dialogs, tooltips and popovers; `cmdk` for the palette. Only the components actually used are included.
- **Icons:** Lucide for the shell, one consistent weight.
- **Native feel:** native window controls and title-bar behaviour on each platform, native menus on macOS, native context menus where possible.
- **Motion:** under 150 ms, none if the system asks for reduced motion.
- **Density:** comfortable by default, with a compact setting.

## Accessibility

- Everything in the shell, text editor and PDF viewer is keyboard-operable with visible focus, meets WCAG 2.2 AA contrast, and scales with zoom.
- Focus moves predictably between the shell and embedded frames (`F6` cycles regions).
- Limits to state honestly: canvas-based office editing has weak screen-reader support, which ONLYOFFICE itself describes as still in development.

## Design process

Design is done before the corresponding build phase, not during it.

1. **Principles and inventory** (this document), agreed.
2. **Wireframes** for the eight key screens: home, each of the five format views, palette, version history.
3. **Clickable prototype** of the shell in the browser with fake documents: tabs, palette, toolbar switching, sidebar, focus mode. This is cheap and answers most layout questions before any engine is integrated.
4. **Self-test script** run after every phase: twelve everyday tasks (open a file, find a word, add a table, export to PDF, sign a PDF, …) timed and counted in keystrokes and clicks, on the keyboard only and on the mouse only.
5. **Consistency review** per format against the shared-vocabulary table and the reserved shortcuts.

## Risks

| Risk | Response |
|---|---|
| Office tabs look and feel different from the rest | Compact themed engine toolbar in the same position; shell owns everything outside it; custom toolbar later |
| Shortcut conflicts confuse | Short reserved list, per-format conventions, editable bindings, shortcuts shown in palette and tooltips |
| Simplicity hides features people need | Complete menu bar and "More" overflow; palette lists everything |
| Too many surfaces creep in | The four-always-visible rule; a new permanent element needs to replace an old one |
| Dark mode mismatch inside embedded engines | Map shell theme to the engine's theme on load; test both themes per format |
| No precedent for this combination | Prototype first; the self-test script after every phase |

Most of the supporting evidence came from search summaries, because several primary sources were unreachable during research; the notes in `../research/notes/ux-ui-design.md` mark each claim.
