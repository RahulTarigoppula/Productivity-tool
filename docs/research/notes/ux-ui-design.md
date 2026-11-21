# UI/UX design for a calm, keyboard-first, single-window multi-format editor (state as of 21 Nov 2026)

**How to read the evidence tags.** Every finding carries one of:
- **[fetched]** — I read the page content this session (only github.com-hosted mirrors were reachable).
- **[search]** — taken from a search-engine summary/snippet this session; wording may be paraphrased, verify before quoting.
- **[background]** — my prior knowledge (training data to mid-2026), not re-verified this session; the URL is the canonical place to check.

**Access limitation.** Direct fetches of nngroup.com, code.visualstudio.com, api.onlyoffice.com, figma.com and blog.superhuman.com failed (hosts outside this session's network allowlist). Their content below is therefore [search] or [background], except where a GitHub mirror of the same document was fetched. Sibling notes already cover the technical side (cmdk, dockview, `before-input-event`, engine embedding): see `app-shell-ux-testing.md` sections 5–7 and `office-suite-engines.md` section 5. This file covers design only and does not repeat them.

---

## 1. How multi-format / multi-mode apps keep one coherent shell: what is shared, what changes per mode

### Takeaway
Every successful multi-mode product keeps a fixed outer frame (navigation, tabs, title, search/palette, status, settings) and swaps only the content area plus one contextual command surface. The two proven shapes for that contextual surface are (a) a shared top toolbar/menu grammar whose contents change by mode (Google Workspace, Microsoft 365, WPS, ONLYOFFICE) and (b) a shared right-hand inspector whose contents change by selection (Apple iWork, Figma). Apps that feel calm (Linear, iA Writer, Zed, Obsidian) additionally make the frame visually recede.

### Cited Findings
**VS Code (the closest architectural model for "any file type in one shell")**
- [fetched] The UI is divided into "containers and items". Containers: Activity Bar, Primary Sidebar, Secondary Sidebar, Editor (holds Editor Groups, which can show Custom Editors or Webviews), Panel, Status Bar. Items: Views, View Toolbar actions, Sidebar Toolbar actions, Editor Toolbar actions, Panel Toolbar actions, Status Bar Items. — [vscode-docs: ux-guidelines/overview.md](https://github.com/microsoft/vscode-docs/blob/main/api/ux-guidelines/overview.md) (same content as [code.visualstudio.com/api/ux-guidelines/overview](https://code.visualstudio.com/api/ux-guidelines/overview))
- [search] Status bar convention: left group is scoped to the whole workspace, right group to the active file. Editor actions are icon buttons in the editor toolbar at the top-right of the editor group. — [VS Code UX guidelines: status bar / overview](https://code.visualstudio.com/api/ux-guidelines/overview)
- [search] "The Command Palette is where all Commands are found"; command names should be clearly labelled and grouped with a category prefix. — [VS Code UX guidelines: command palette](https://code.visualstudio.com/api/ux-guidelines/command-palette)
- [background] Custom editors (image preview, hex editor, notebook, Markdown preview, settings UI) all live in the same tab strip with the same tab, title, dirty-dot, split and close behaviour; only the content and the small editor-toolbar change. The shell does not restyle for binary/visual editors. — [VS Code custom editor guide](https://code.visualstudio.com/api/extension-guides/custom-editors)

**Apple iWork (shared inspector across three formats)**
- [search] Keynote: the right sidebar shows the Format, Animate or Document inspector; the Format inspector "shows formatting controls for whatever is selected". Numbers: sidebar shows Format or Organize; clicking the active Format button closes the sidebar. Pages: right sidebar shows Format or Document. — [Keynote User Guide: sidebars](https://support.apple.com/guide/keynote/aside/tane0a9ddb35/mac); [Numbers User Guide: sidebars](https://support.apple.com/en-kz/guide/numbers/aside/tan99bfdf6ea/mac)
- [background] iWork's top toolbar is short (about 10–14 buttons: View, Zoom, Add Page/Slide/Sheet, Insert, Table, Chart, Text, Shape, Media, Comment, Share, Format, Document/Organize/Animate), user-customisable, and almost identical across the three apps. All dense formatting lives in the selection-sensitive inspector; the complete command set lives in the menu bar. — [Pages User Guide](https://support.apple.com/guide/pages/welcome/mac)
- [search] Apple HIG toolbars: leading edge holds back/sidebar toggle then title; trailing edge holds inspector buttons, optional search, and a More menu; a document menu next to the title can offer Duplicate, Rename, Move, Export; let people customise the toolbar in feature-heavy apps. In macOS 26 (Liquid Glass) sidebars float as glass panes and inspectors sit edge-to-edge beside content. — [Apple HIG: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars); [WWDC25 session 310](https://developer.apple.com/videos/play/wwdc2025/310/)

**Google Workspace (shared menu/toolbar grammar)**
- [background] Docs, Sheets and Slides share the same menu order (File, Edit, View, Insert, Format, …, Help), the same single-row toolbar starting with Undo/Redo/Print/Paint format/Zoom, the same title+star+move header and the same right-side comment/share cluster; only the middle of the toolbar and one or two menus (Data in Sheets; Slide, Arrange in Slides) differ. — [Google Docs Editors Help](https://support.google.com/docs)
- [search] A "tool finder" (search the menus) sits at the top-left of the toolbar in Docs, Sheets, Slides and Vids; shortcut Alt+/ (Option+/ on Mac); it shows recommended/recent actions when empty and shows keyboard shortcuts beside results. — [Google Help: Tool finder](https://support.google.com/docs/answer/13466905); [9to5Google, Apr 2023](https://9to5google.com/2023/04/25/google-docs-search-bar/)

**Microsoft 365 (ribbon, simplified ribbon, search)**
- [search] The 2018 redesign collapsed the three-row ribbon into a single-line "simplified ribbon" that can be expanded back to the classic one; less-used commands move to overflow menus; Outlook lets users pin/unpin buttons. It launched first in Word for the web. Search was promoted to the title bar ("Microsoft Search", previously "Tell me"), reachable with Alt+Q, with "zero-query" suggestions when focused. — [Microsoft Support: Use the Simplified Ribbon](https://support.microsoft.com/en-us/outlook/use-the-simplified-ribbon); [Engadget, June 2018](https://www.engadget.com/2018/06/13/microsoft-office-ui-redesign-simpler-ribbon/); [Windows Blog: three UX updates](https://blogs.windows.com/windowsexperience/?p=162816)
- [search] Jensen Harris (Office 2007 UX lead): the top five Word 2003 commands — Paste, Save, Copy, Undo, Bold — were about 32% of all command use, Paste alone over 11%; the ribbon's stated goal was to make features easier to find, not to surface the most-used commands. A Microsoft post summarising his talk says most feature requests for Office were for features that already existed. — [No Distaste for Paste (Why the UI, Part 7)](https://learn.microsoft.com/en-us/archive/blogs/jensenh/no-distaste-for-paste-why-the-ui-part-7); [So that's why Office 2007 looks different](https://learn.microsoft.com/vi-vn/archive/blogs/cbortlik/so-thats-why-office-2007-looks-different)
- [search] Contextual tabs (Table Tools, Picture Tools) were designed to combine "the discoverability advantages of context" with the ribbon; Harris reports lab results improved after iteration. Vendor claim, not independent. — [It's All About Context](https://learn.microsoft.com/en-nz/archive/blogs/jensenh/its-all-about-context)

**Tabbed all-in-one office apps**
- [search] WPS Office has two window modes, "All-in-One Mode" (documents, spreadsheets, PDFs and slides as tabs in one window, Ctrl+Tab to switch) and "Multi-Component Mode" (separate windows per component), switched in Global Settings. — [WPS Help Center: tabbed viewing](https://help.wps.com/articles/wps-office-tabbed-viewing-feature/); [WPS Academy](https://www.wps.com/academy/switch-between-multi-component-window-management-mode-and-all-in-one-mode-quick-tutorials-1861788/)
- [background, from sibling notes] ONLYOFFICE Desktop Editors 10 (Oct 2026) keeps one tab strip over docx/xlsx/pptx/pdf with a redesigned start window; each tab hosts the full web editor with its own ribbon, so the per-format chrome is not unified, only themed alike. — [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2026/10/onlyoffice-desktop-editors-10)

**Figma UI3 (a cautionary redesign)**
- [search] UI3 (2024) moved the toolbar to the bottom of the canvas and made side panels float. For general release Figma reversed the panels to fixed (still resizable); its blog says learning that floating panels "slowed people down" was decisive. Forum reaction to floating panels was strongly negative (wasted space, distraction); the bottom toolbar stayed. — [Figma: Our approach to designing UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/); [Figma forum: fixed panels are back](https://forum.figma.com/suggest-a-feature-11/launched-fixed-panels-are-back-23789)
- [background] UI3 also kept the right-hand properties panel as the single home of all per-selection properties, regrouped with labels, and added "Minimize UI" (Shift+\\) to hide all chrome. — [Figma blog](https://www.figma.com/blog/our-approach-to-designing-ui3/)

**Linear, Obsidian, Zed, Arc/Dia, Raycast, Notion, AFFiNE**
- [search] Linear's 12 March 2026 UI refresh aimed at "a calmer, more consistent interface": the navigation sidebar was dimmed so content stands out, tab bars compacted, borders softened, icon use reduced. Linear's command menu (2019) prioritises command groups by the current view. — [Linear changelog 2026-03-12](https://linear.app/changelog/2026-03-12-ui-refresh); [Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh); [Linear changelog: new command menu](https://linear.app/changelog/2019-12-18-new-command-menu)
- [search] Obsidian: browser-like tabs; right-click a tab to split (creates a tab group) or pin; links from a pinned tab open in a new tab; stacked tabs as an alternative view; left "ribbon" of icon actions that can be reordered or hidden entirely; left and right sidebars toggled by commands; a Workspaces plugin saves/restores layouts. — [Obsidian Help: Tabs](https://obsidian.md/help/tabs); [Sidebar](https://obsidian.md/help/sidebar); [Ribbon](https://obsidian.md/help/User+interface/Ribbon)
- [search] Zed: file finder on Cmd/Ctrl+P, command palette on Cmd/Ctrl+Shift+P described as "the main way to access actions", palette contents depend on what is focused; three docks (left, right, bottom). A third-party critique says palette-only access hurts discoverability. — [Zed docs: finding & navigating](https://zed.dev/docs/finding-navigating); [Zed docs: command palette](https://zed.dev/docs/command-palette); [DEV critique](https://dev.to/1ce/zed-the-editor-i-wish-i-liked-2jn2)
- [search] Arc: tabs in a sidebar; Cmd+T opens a Spotlight-style command bar that opens URLs, switches to open tabs, switches Spaces and runs actions; pinned tabs persist while unpinned tabs auto-archive (default 12 h); Spaces are per-context tab sets with their own colour; Split View shows up to four tabs. The Browser Company stopped adding features to Arc; its successor Dia was designed to be conventional (the "Tuesday morning" test: anyone can switch at 10 am on a Tuesday) and later re-added vertical tabs, pinned tabs and a Focus Mode that hides sidebar/top tabs until hover. — [How-To Geek on Arc](https://www.howtogeek.com/888738/ways-arc-transforms-your-web-browser-experience/); [The strategy behind Dia's design](https://browsercompany.substack.com/p/the-strategy-behind-dias-design); [TechCrunch, Nov 2025](https://techcrunch.com/2025/11/03/dias-ai-browser-starts-adding-arcs-greatest-hits-to-its-feature-set); [Dia changelog](https://www.diabrowser.com/changelog)
- [search] Raycast: one root search; Cmd/Ctrl+K opens the Action Panel listing every action for the selected item; results ranked by frecency (frequency + recency) with a per-command "Reset Ranking"; aliases give exact-match top ranking; v2.9 (22 Oct 2026) prioritised whole-word matches in the Action Panel. — [Raycast Manual: Action Panel](https://manual.raycast.com/action-panel); [Search Bar](https://manual.raycast.com/search-bar); [Aliases & Hotkeys](https://manual.raycast.com/command-aliases-and-hotkeys); [Raycast changelog](https://www.raycast.com/changelog/macos)
- [search] Notion: Cmd/Ctrl+P and Cmd/Ctrl+K both open search/recent pages; with text selected Cmd/Ctrl+K inserts a link instead; Cmd/Ctrl+T opens a new tab in the desktop app; Cmd/Ctrl+/ acts on selected blocks. — [Notion Help: keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts)
- [search] AFFiNE: each doc has two modes, Page (linear) and Edgeless (canvas), switched by one button at the top-right or a shortcut; the frame stays identical. — [AFFiNE docs: page mode](https://docs.affine.pro/core-concepts/elements-of-affine/page-mode); [AFFiNE blog](https://affine.pro/blog/why-you-should-try-affine-whiteboard-edgeless-mode)

### Inferences
- **Shared across modes in every good example:** window frame and title, tab behaviour, file actions (new/open/save/export/rename), find, zoom, undo/redo, palette/search, status bar position, theme, settings, shortcut for "show more controls". **Changes per mode:** canvas, one contextual command surface, one or two status-bar items, a handful of mode-specific menu groups.
- iWork's "short toolbar + selection inspector + full menus" is the calmest proven pattern for rich formats; Google's "one toolbar row + search-the-menus" is the simplest. Both avoid multi-row ribbons. For this app a one-row contextual toolbar plus an optional right inspector plus the palette as the complete index is the natural hybrid.
- Figma UI3 and Dia are evidence that novelty in shell layout is punished: fixed panels and conventional tabs won. Keep layout conventional; spend novelty on calmness and the palette.
- Zed's critique and the Office "requests for features that already exist" finding point the same way: a palette alone is not enough; depth must also be reachable by visible, browsable means (menus or a labelled "More" surface).

### Gaps
- No independent usability study comparing ribbon vs inspector vs single toolbar was found; evidence is vendor narrative plus reception.
- Craft and Anytype were searched but returned nothing usable; no claims made about them.
- Microsoft's research behind the simplified ribbon was not found (only stated goals).
- Apple's macOS 26 HIG pages for sidebars/inspectors were not read directly.

---

## 2. Feature-dense tools with simple surfaces: progressive disclosure, contextual UI, search-the-menus

### Takeaway
The evidence-backed recipe is two levels of disclosure at most: a small always-visible primary set chosen by frequency, an obvious single route to everything else, and context-triggered controls for selection-specific actions. Search over commands (Alt+/, Alt+Q, macOS Help search, a palette) is the safety net that makes hiding features acceptable, but it must not be the only route.

### Cited Findings
- [search] NN/g (Nielsen, 2006): progressive disclosure defers advanced or rarely used features to a secondary screen so the primary one is easier to learn and less error-prone. Two things must be right: the split between initial and secondary features, and an obvious path from primary to secondary. More than two levels typically has low usability because users get lost. Staged disclosure (wizards) is a separate variant and is problematic when steps are interdependent. — [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [search] NN/g contextual menus: reserve them for secondary, non-critical actions because they are easily missed; kebab/meatball icons are recognised as "more options" on desktop and mobile if prominent enough and placed near their object; group only actions that belong to the same object, since mixing unrelated options "reduces clarity, decreases findability, hinders spatial memorability, and increases cognitive load". — [NN/g: Contextual Menus Guidelines](https://www.nngroup.com/articles/contextual-menus-guidelines/)
- [search] Command frequency is extremely skewed: five commands were ~32% of Word 2003 usage. — [Jensen Harris, Why the UI Part 7](https://learn.microsoft.com/en-us/archive/blogs/jensenh/no-distaste-for-paste-why-the-ui-part-7)
- [search] Search-the-menus implementations: Google tool finder (Alt+/, shows recent actions and shortcuts); Microsoft Search/Tell me (Alt+Q, zero-query suggestions). — [Google Help](https://support.google.com/docs/answer/13466905); [Microsoft Support: keyboard and the ribbon](https://support.microsoft.com/en-US/Accessibility/windows/use-the-keyboard-to-work-with-the-ribbon)
- [background] macOS Help-menu search (Cmd+Shift+/) filters all menu items of the frontmost app and points an arrow at the item's location in the menus, so search also teaches where the command lives. This only works if the app has a real, complete native menu bar. — [Apple HIG: The menu bar](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar)
- [background] Floating selection toolbars ("bubble" toolbar: Medium, Notion, Word's Mini Toolbar since 2007) put the 6–10 most common formatting commands next to the selection, cutting pointer travel (Fitts's law: time grows with distance and shrinks with target size). Slash menus (Notion, Google Docs "@", Craft) insert blocks from the keyboard at the caret. — [Jensen Harris archive (Mini Toolbar)](https://learn.microsoft.com/en-us/archive/blogs/jensenh/); [Laws of UX: Fitts's Law](https://lawsofux.com/fittss-law/)
- [background] Hick's law: decision time rises with the logarithm of the number of choices, which argues for few visible choices at each step, but applies to equally probable, unfamiliar choices; well-organised long lists that users scan or search are not governed by it. — [Laws of UX: Hick's Law](https://lawsofux.com/hicks-law/)
- [search] Figma reversed floating panels because they slowed people down: stable, fixed positions support spatial memory. — [Figma blog](https://www.figma.com/blog/our-approach-to-designing-ui3/)

### Inferences
- **Three tiers, not more:** (1) always visible: about 8–14 controls per format in a one-row toolbar; (2) one step away: a "More"/overflow menu, the inspector, right-click context menus, the full menu bar; (3) searchable: everything, through the palette. Tier 2 and tier 3 expose the same commands; tier 3 is not a deeper level, it is a shortcut.
- Choose tier 1 by measured or well-known frequency per format (undo/redo, style or heading, bold/italic, lists, alignment, link, insert table/image, comment for documents; number format, sum, fill colour, borders, freeze, sort/filter for sheets; new slide, layout, text box, shape, image, present for slides; page nav, zoom, highlight, annotate, search for PDF).
- Keep positions fixed. A contextual toolbar may change its middle section by format, but global controls (tabs, palette trigger, save state, zoom, find) must never move. Avoid adaptive menus that reorder by usage; apply recency only inside the palette.
- A bubble toolbar suits the app's own editors (Markdown, text, possibly PDF annotations). Inside an embedded engine it would have to be the engine's own.
- Provide a real native menu bar on macOS (free Help search, expected by the platform) and an Alt-revealed or hamburger menu on Windows/Linux that mirrors the same command registry.

### Gaps
- The NN/g articles were not read in full; quotes above come from search summaries.
- No NN/g article specifically on ribbons or command palettes was located; Wikipedia mentions a 2008 NN/g GUI showcase report that I could not access.
- No quantitative data on bubble toolbar vs fixed toolbar task time was found.

---

## 3. Tabs and navigation at scale; home screen; quick open vs command palette

### Takeaway
For a personal tool with typically 3–15 open files, a conventional horizontal tab strip with a per-format icon, pinned tabs, reopen-closed-tab and an optional two-pane split is sufficient; a collapsible sidebar (recents/folder) and a home tab that doubles as the empty state cover the rest. Merge quick-open and commands into one palette with prefixes, since the two major conventions (Ctrl+P/Ctrl+Shift+P and Ctrl+K) both have large followings.

### Cited Findings
- [search] Obsidian: tabs behave like browser tabs; split by right-click or by dragging a tab to an edge; pin via right-click; stacked tabs as an alternative. — [Obsidian Help: Tabs](https://obsidian.md/help/tabs)
- [search] Arc: vertical tab sidebar, pinned vs temporary tabs with auto-archive, Spaces, Split View up to four panes; Dia returned to a familiar top-tab design and added vertical tabs as an option. — [How-To Geek](https://www.howtogeek.com/888738/ways-arc-transforms-your-web-browser-experience/); [Dia design strategy](https://browsercompany.substack.com/p/the-strategy-behind-dias-design)
- [search] WPS tabbed mode mixes document types in one strip, Ctrl+Tab to cycle. — [WPS Help Center](https://help.wps.com/articles/wps-office-tabbed-viewing-feature/)
- [search] Windows title-bar guidance: standard height 32 px; with a global search box centred in the title bar, height 48 px; in tabbed apps keep caption buttons anchored right; empty title-bar space must stay draggable; blend the title bar with the window. — [Microsoft Learn: title bar design](https://learn.microsoft.com/windows/apps/design/basics/titlebar-design)
- [search] Conventions for the two launchers: VS Code and Zed use Ctrl/Cmd+P for files and Ctrl/Cmd+Shift+P for commands; Notion binds both Cmd+P and Cmd+K to the same search; Linear, Superhuman, Raycast (Action Panel) use Cmd+K; Arc uses Cmd+T. — [Zed docs](https://zed.dev/docs/finding-navigating); [Notion Help](https://www.notion.com/help/keyboard-shortcuts); [Raycast Manual](https://manual.raycast.com/action-panel); [Superhuman blog](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [background] VS Code's Quick Open is one input with prefixes: none = files, `>` = commands, `@` = symbols in file, `:` = go to line, `#` = workspace symbols, `?` = list the modes. Tabs opened by single click are "preview" tabs (italic title) that get replaced until edited or double-clicked. Ctrl+Tab cycles in most-recently-used order; Ctrl+Shift+T reopens a closed editor. — [VS Code docs: User interface](https://code.visualstudio.com/docs/getstarted/userinterface)
- [background] Start screens: Office and iWork open on a recents + templates gallery; VS Code's Welcome tab shows Start (New File, Open), Recent, and Walkthroughs and can be disabled; ONLYOFFICE Desktop's start page lists recent files, templates and create-new by type. — [VS Code UX guidelines: walkthroughs](https://code.visualstudio.com/api/ux-guidelines/walkthroughs); [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2026/10/onlyoffice-desktop-editors-10)

### Inferences
- **Tab strip (recommended default):** top, in the title bar row to save a row of height (macOS traffic lights left; Windows/Linux caption buttons right). Each tab: format icon (shape-distinct, lightly tinted: document, sheet, slides, PDF, Markdown, code), file name, dirty dot that turns into the close button on hover, tooltip with full path. Middle-click closes. Overflow: shrink to a minimum width, then scroll, plus a "list all tabs" chevron. Pinned tabs collapse to icon-only at the left.
- Colour coding should be restrained: tint only the small icon (the familiar blue/green/orange/red cue), never the whole tab; colour is then a secondary cue alongside icon shape (WCAG 1.4.1).
- **Vertical tabs:** offer later as an option; they scale better beyond about 15 tabs and with long file names, but cost horizontal space that spreadsheets and slides need.
- **Sidebar:** hidden by default; one toggle (Ctrl/Cmd+B, the VS Code/Zed convention). Two sections only: Recent/Pinned files, and an optional opened folder tree. Do not force a "workspace/vault" concept; the app opens loose files from anywhere.
- **Home tab = empty state:** shown when no tabs are open and reachable as a pinned first tab. Contents: a search field that is the palette, "New" row (Document, Spreadsheet, Presentation, Markdown, Text) with shortcuts shown, Open file/folder, recent files with format icon, path and last-opened time, and a drop target ("Drop files here"). No templates gallery in v1 beyond one blank per type.
- **One palette, several doors:** Ctrl/Cmd+K opens it in "everything" mode (files and commands mixed, files first when the query looks like a name); Ctrl/Cmd+P opens the same palette pre-filtered to files; Ctrl/Cmd+Shift+P (and F1) opens it pre-filtered to commands with `>` already typed. Prefixes: `>` commands, `:` go to line/cell/page/slide, `@` headings/sheets/slides outline, `?` help and shortcuts. This respects VS Code muscle memory and the Ctrl+K convention at once.
- **Split view:** limit to two panes side by side in v1 ("Open to the side", drag a tab to the right edge). Arbitrary grids add complexity that a single-user document tool rarely needs.
- **Recently closed:** Ctrl/Cmd+Shift+T reopens the last closed tab, with the list also in the palette.

### Gaps
- No empirical study comparing horizontal and vertical tabs for document work was found.
- Tab-group designs (Chrome/Edge) were not researched; probably unnecessary at this scale.

---

## 4. Command palette best practices

### Takeaway
A good palette is reachable from everywhere with one toggle shortcut, contains every command, matches forgivingly (typos, synonyms), ranks by context then frecency, shows each command's shortcut so it teaches, supports argument steps without leaving the keyboard, and has a useful empty state. It complements visible UI rather than replacing it.

### Cited Findings
- [search] Superhuman's guide: one shortcut (Cmd+K) both opens and closes the palette; "you can instantly do any action — and also learn the shortcut for next time"; the palette can host features that would never warrant a button; matching must be flexible (the article's rule 4: "opn" or "oepn" should match "Open"), with a score threshold and synonyms; the last visible row is deliberately cut off to signal that the list scrolls; in the compose editor the first Cmd+K opens the link UI and a second press opens the palette. — [Superhuman: How to build a remarkable command palette](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [search] VS Code: the palette is where all commands are found; name commands clearly with a category prefix (for example "Markdown: Open Preview"). Quick Picks handle single selection, multi-selection and free-text input, which is how multi-step commands collect arguments. — [VS Code UX guidelines: command palette](https://code.visualstudio.com/api/ux-guidelines/command-palette); [quick picks](https://code.visualstudio.com/api/ux-guidelines/quick-picks)
- [search] Raycast ranks by frecency, lets users reset ranking per command, gives aliases exact-match priority, and in Oct 2026 tuned ranking to prefer complete-word matches. — [Raycast Manual: Search Bar](https://manual.raycast.com/search-bar); [Raycast changelog v2.9](https://www.raycast.com/changelog/macos)
- [search] Linear's command menu orders groups according to the current view (context first). — [Linear changelog 2019-12-18](https://linear.app/changelog/2019-12-18-new-command-menu)
- [search] Retool added a pinned "Top result" section so the best match stays visible regardless of category. Design-system guidance: show the typed term in the no-results state; decide explicitly whether the palette finds destinations, commands or both; visually separate them. Vercel Geist describes a global keyboard-first menu for resources and actions. — [Retool: designing the command palette](https://retool.com/blog/designing-the-command-palette); [Cognite Aura: command](https://docs.cognite.com/aura-design-system/primitives/command); [Vercel Geist: command menu](https://vercel.com/geist/command-menu)
- [search] Google's tool finder and Microsoft Search both show suggestions/recent actions before typing (zero-query state). — [Google Help](https://support.google.com/docs/answer/13466905); [Windows Blog](https://blogs.windows.com/windowsexperience/?p=162816)
- [search] Critique: a palette reachable only by shortcut is undiscoverable for new users (said of Zed). — [DEV: Zed, the editor I wish I liked](https://dev.to/1ce/zed-the-editor-i-wish-i-liked-2jn2)

### Inferences
- **Structure:** input at top; results grouped under small headers (Top result, Open tabs, Recent files, Commands for this file type, App commands); each row = icon, title, dim secondary text (path or category), right-aligned shortcut keycaps. Maximum about 8–10 rows visible; width about 600–680 px; appears top-centre, not screen-centre, so it never covers the caret region in the lower two-thirds.
- **Ranking order:** exact alias > prefix match on title > whole-word match > fuzzy; then boost by context (commands valid for the active format and selection), then frecency. Commands that do not apply to the active editor are hidden by default, or shown dimmed with the reason when the query matches them exactly ("Freeze panes — spreadsheets only").
- **Synonyms:** each command carries keywords so that "strikeout", "cross out" and "strikethrough" all work; add Office and VS Code names for the same action ("Find and Replace"/"Replace", "Export"/"Save as PDF"/"Download as").
- **Parameters:** second-step pick lists inside the same palette (Export → pick format; Go to line → type number; Insert table → "3x4"), with Backspace on empty input returning to the previous step and Esc closing.
- **Empty state:** recently used commands (about 5), open tabs, and a one-line hint of prefixes (`>` commands, `:` go to, `@` outline, `?` help).
- **Discoverability for non-power users:** a visible search field or pill in the title bar ("Search files and commands — Ctrl K") that opens the palette on click; the same entry in the Help menu.
- **The Ctrl/Cmd+K conflict with "insert link"** is real in Word, Excel, Google Docs and Notion. Two workable options: (a) Superhuman/Notion rule: with a text selection, or inside an embedded office editor, the first press inserts a link and a second press opens the palette; (b) the palette always wins and "Insert link" becomes the top suggestion when text is selected. Option (b) is more predictable and easier to implement across embedded engines; whichever is chosen must be identical in every format. Keep Ctrl/Cmd+Shift+P as a conflict-free alias.
- **Accessibility:** implement as an ARIA combobox with a listbox popup, `aria-activedescendant` for the highlighted row, results-count announcement, focus returned to the previous element on close.

### Gaps
- The Superhuman article's full rule list was not readable; only the rules surfaced by search are cited.
- No published study of palette use by non-technical users was found.

---

## 5. Consistency across formats: shared action vocabulary, shortcut scheme, unified status/find/zoom/save/export

### Takeaway
Define one canonical vocabulary of roughly 40–60 actions with fixed names, icons and positions, map each onto every format where it makes sense, and reserve a small set of shell shortcuts that are identical everywhere. Inside the content area let each format keep its native muscle memory (Excel keys in sheets, VS Code keys in code, Word keys in documents), because the conflicts between them cannot be reconciled.

### Cited Findings
- [search] VS Code defaults: Ctrl+D = add selection to next find match; Ctrl+K = chord prefix (e.g. Ctrl+K Ctrl+S opens Keyboard Shortcuts); F2 = rename symbol; Ctrl+Shift+L = select all occurrences of selection; Ctrl+F2 = select all occurrences of word. — [VS Code default keybindings](https://code.visualstudio.com/docs/reference/default-keybindings)
- [background] Excel: Ctrl+D = fill down; Ctrl+K = insert hyperlink; F2 = edit active cell; Ctrl+Shift+L = toggle AutoFilter; Ctrl+; = insert date; F4 = repeat/toggle absolute reference. Word: Ctrl+D = Font dialog; Ctrl+K = insert hyperlink; F2 = move text. — [Excel keyboard shortcuts](https://support.microsoft.com/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f); [Word keyboard shortcuts](https://support.microsoft.com/office/keyboard-shortcuts-in-word-95ef89dd-7142-4b50-afb2-f762f663ceb2)
- [search] Notion resolves Ctrl/Cmd+K by context: search normally, insert link when text is selected. — [Notion Help](https://www.notion.com/help/keyboard-shortcuts)
- [search] GNOME HIG: standard shortcut list; F10 opens the primary menu; Ctrl+? opens the keyboard-shortcuts window; header bars should contain few controls; the primary menu ends with Preferences, Keyboard Shortcuts, Help, About and omits Close/Quit. — [GNOME HIG: Standard keyboard shortcuts](https://developer.gnome.org/hig/reference/keyboard.html); [Header bars](https://developer.gnome.org/hig/patterns/containers/header-bars.html); [Menus](https://developer.gnome.org/hig/patterns/controls/menus.html)
- [search] VS Code status bar: workspace-scoped items left, file-scoped items right. — [VS Code UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
- [background] Platform rules: macOS uses Cmd as the primary modifier, Cmd+, for Settings, Cmd+Q quit, Cmd+W close, Cmd+` cycle windows, Ctrl+Cmd+F full screen, and requires a full menu bar; Windows uses Ctrl, F11 full screen, Alt for menu access keys, Ctrl+F4/Ctrl+W close tab. — [Apple HIG: Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards); [Microsoft Learn: keyboard accelerators](https://learn.microsoft.com/windows/apps/design/input/keyboard-accelerators)

### Inferences
- **Canonical vocabulary (name → per-format meaning):**

| Action | Document | Spreadsheet | Presentation | PDF | Markdown / text / code |
|---|---|---|---|---|---|
| Bold / Italic / Underline | run format | cell format | text format | n/a (annotation text only) | Markdown syntax / n/a |
| Insert table | table | (is a table) | table | n/a | Markdown table |
| Insert image / link / comment | yes | yes | yes | annotation, link, note | syntax / comment line |
| Find / Replace | text | values + formulas | text across slides | find only | text, regex |
| Go to (`:`) | page / heading | cell or range | slide number | page | line |
| Outline (`@`) | headings | sheets, named ranges | slides | bookmarks, pages | headings / symbols |
| Zoom | page zoom | grid zoom | slide zoom | page zoom / fit | font-size zoom |
| Export | PDF, docx, md, html | xlsx, csv, PDF | pptx, PDF, images | PDF, images, text | PDF, html, docx |
| Present / Read | reading view | n/a | slideshow | reading view | preview |

- **Reserved shell shortcuts (identical in every tab, intercepted before the editor):** palette Ctrl/Cmd+K (+ Ctrl/Cmd+Shift+P, F1); quick open Ctrl/Cmd+P; new Ctrl/Cmd+N; open Ctrl/Cmd+O; save Ctrl/Cmd+S; save as/export Ctrl/Cmd+Shift+S and Ctrl/Cmd+Shift+E; close tab Ctrl/Cmd+W; reopen Ctrl/Cmd+Shift+T; next/previous tab Ctrl+Tab / Ctrl+Shift+Tab and Ctrl/Cmd+1..9; sidebar Ctrl/Cmd+B is NOT safe (Bold) so use Ctrl/Cmd+\\ or Ctrl/Cmd+Shift+B; inspector Ctrl/Cmd+Alt+I; focus mode Ctrl/Cmd+. or F11 variants; settings Ctrl/Cmd+,; shortcut sheet Ctrl/Cmd+/ (collides with "toggle comment" in code, so use Ctrl+? / F1-help there or scope it); zoom Ctrl/Cmd+ = / - / 0; find Ctrl/Cmd+F; replace Ctrl/Cmd+H (Cmd+Alt+F on macOS).
- **Known collisions to decide explicitly:** Ctrl+P (print in every office engine; make Print Ctrl/Cmd+Alt+P or palette-only, or keep Ctrl+P = print and use only Ctrl+K for files); Ctrl+K (link); Ctrl+B (bold vs sidebar); Ctrl+/ (comment toggle vs help); Ctrl+D, F2, Ctrl+Shift+L, Ctrl+H, F4 (leave to the active format).
- **Rule of thumb:** shell owns chords about files, tabs, windows, palette and view; the focused editor owns every chord about content. Show the effective binding in tooltips and the palette so differences are learnable, and list per-format differences in the shortcut sheet.
- **Unified status bar (one thin row, about 24 px, dim):** left = save state and file location; centre/left = format-specific position readout (Ln/Col for text, Page x of y for docs/PDF, selected range with Sum/Average/Count for sheets, Slide x of y); right = word count or selection stats, language/encoding/line-ending for text, zoom control (same widget everywhere), and a notifications dot. Hide the embedded engine's own status bar if licensing permits; otherwise accept the engine's and keep the shell's minimal to avoid two stacked bars.
- **Unified find:** same shortcut, same position (top-right overlay of the content area), same options order (match case, whole word, regex where supported), same Enter/Shift+Enter/Esc behaviour. Where the engine's own find bar must be used, style and position it as close as possible and trigger it from the same shell command.
- **Unified export dialog:** one dialog for all formats: target format list filtered by source type, page range/options section, destination, and a plain-language fidelity note when the target is lossy.

### Gaps
- Excel/Word shortcut meanings are from background knowledge (search returned only the VS Code side).
- Whether each embedded engine lets the host remap or suppress its shortcuts is an engine question (see sibling notes).

---

## 6. Embedded third-party editor chrome (ONLYOFFICE and others)

### Takeaway
With stock ONLYOFFICE, free configuration lets you compact and theme the chrome but not remove the toolbar: the `layout` object that hides toolbar, tabs, status bar and side menus is documented as available only with the extended white-label licence of ONLYOFFICE Docs Developer. The pragmatic design is therefore hybrid: the shell owns tabs, file actions, title, save state, palette and theme; the engine keeps one compact, tab-less-looking toolbar themed to match; a native-toolbar-over-API approach is only realistic on a self-maintained fork or with engines that are UI libraries.

### Cited Findings
**Standard branding parameters (free), `editorConfig.customization`** — [fetched] [customization-standard-branding.md](https://github.com/ONLYOFFICE/api.onlyoffice.com/blob/master/site/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding.md) (mirror of [api.onlyoffice.com standard branding](https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding/))
- `compactHeader` (bool, default false): moves header buttons into the toolbar for a more compact header.
- `compactToolbar` (bool, default false; true in view mode): compact single-row toolbar. [search] A user's own toggle in the editor is stored in browser local storage and overrides the config value; added in 4.2. — [ONLYOFFICE FAQ: customizing](https://api.onlyoffice.com/docs/docs-api/more-information/faq/customizing/)
- `toolbarHideFileName` (bool, default false): hides the document title in the toolbar; used with `compactHeader`.
- `toolbarNoTabs`: deprecated since 8.2; replacement is `features.tabStyle` = `"line"` (vs default `"fill"`) and `features.tabBackground` = `"toolbar"` (vs default `"header"`), each also accepting `{mode, change}` to control whether the user can change it in Advanced settings.
- `hideRightMenu` (bool): listed default true (right panel hidden on first load). [search] The changelog says the default became true in 8.1, while some SDK docs list false or "unset"; check the version in use. — [ONLYOFFICE changelog](https://api.onlyoffice.com/docs/docs-api/more-information/changelog)
- `hideRulers` (default false for documents, true for presentations); `hideNotes` (presentations).
- `uiTheme` (string): a theme id or `default-dark` / `default-light`.
- `zoom` (int, default 100; -1 fit page, -2 fit width); `unit` (cm/pt/inch).
- `help`, `feedback`, `plugins`, `comments`, `macros`/`macrosMode`, `autosave`, `forcesave`, `close` (`visible`, `text`; needs `onRequestClose`), `goback`, `integrationMode: "embed"`, `review.*`, `features.spellcheck`, `features.featuresTips` (first-load feature tips, default true), `showHorizontalScroll`/`showVerticalScroll` (spreadsheets), `slidePlayerBackground`, `wordHeadingsColor`, `compatibleFeatures` (limit to OOXML-compatible features).
- `logo` and `customer` are marked "available only for ONLYOFFICE Docs Developer".

**White-label parameters (paid)** — [fetched] [customization-white-label.md](https://github.com/ONLYOFFICE/api.onlyoffice.com/blob/master/site/docs/docs-api/usage-api/config/editor/customization/customization-white-label.md)
- Page states: "The parameters on this page are available only for the extended white label license of ONLYOFFICE Docs Developer."
- `layout`: hides interface elements without disabling their features (still reachable via context menu or hotkeys). `layout.toolbar` (false hides the whole toolbar; or per tab: `file` {close, info, save, settings}, `home` (cannot be hidden), `insert`, `layout`, `references`, `collaboration`, `draw`, `protect`, `plugins`, `view`, `save`), `layout.header` {editMode, save, user, users}, `layout.leftMenu` {mode, navigation, spellcheck}, `layout.rightMenu` {mode}, `layout.statusBar` {actionStatus, docLang, textLang}.
- Also white-label only: `font` {name, size} for the interface font, `about`, `loaderLogo`, `loaderName`. Old top-level `leftMenu`/`rightMenu`/`statusBar`/`toolbar` deprecated since 7.1.

**Themes**
- [search] Built-in UI themes: Light, Classic Light, Dark, Dark Contrast; with a dark theme a separate "Dark document" mode can be toggled in the View tab. Custom themes can be defined and selected by passing the id in `uiTheme`. — [ONLYOFFICE blog: change interface theme](https://onlyoffice.com/blog/2022/10/change-interface-theme); [ONLYOFFICE API: customizing themes](https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/customizing-themes/)

**What integrators do**
- [search] Nextcloud's ONLYOFFICE connector (7.4.0, 2022) exposes a theme choice (Light, Classic Light, Dark) in settings; no evidence it changes the toolbar layout. — [ONLYOFFICE blog: Nextcloud connector 7.4.0](https://www.onlyoffice.com/blog/2022/06/nextcloud-connector_7_4_0)
- [search] CryptPad wraps the ONLYOFFICE editors inside its own frame (own top bar with title, share, access, file menu), keeps the ONLYOFFICE toolbar inside, maintains its own fork of `web-apps`, and applies CryptPad's own light/dark setting; a forum answer says custom fonts cannot be added to its integration. — [cryptpad/web-apps](https://github.com/cryptpad/web-apps); [CryptPad 4.12.0 release notes](https://github.com/cryptpad/cryptpad/releases/tag/4.12.0); [CryptPad forum: custom fonts](https://forum.cryptpad.org/d/2394-adding-custom-fonts/1)
- [background, sibling notes] Collabora Online lets a host hide/show individual menu items and buttons via postMessage and set `ui_defaults` (for example compact "classic" vs tabbed "notebookbar" mode) and CSS variables: a more permissive chrome API than stock ONLYOFFICE. — [Collabora Online SDK](https://sdk.collaboraonline.com/)

**Screen readers and the canvas**
- [search] ONLYOFFICE lists JAWS and NVDA (Windows), Orca (Linux) and VoiceOver (macOS) and says screen-reader support is switched on in each editor's settings; it launched as beta in 7.5 (2023) and 2026 company posts still call it an active area of development. — [ONLYOFFICE Help: screen reader](https://helpcenter.onlyoffice.com/docs/userguides/accessibility/screen-reader.aspx); [ONLYOFFICE blog, Apr 2026](https://onlyoffice.com/blog/2026/04/onlyoffice-for-every-user); [ONLYOFFICE blog, Oct 2026: accessibility conformance](https://www.onlyoffice.com/blog/2026/10/accessibility-conformance)

### Inferences
- **Option A — accept engine toolbar, compact + themed (recommended baseline).** Config: `compactHeader: true`, `toolbarHideFileName: true`, `compactToolbar: true` (or full toolbar with `features.tabStyle: "line"` + `tabBackground: "toolbar"`), `hideRightMenu: true`, `hideRulers: true`, `help: false`, `feedback: false`, `uiTheme` synced to shell theme, `features.featuresTips: false`, `zoom: -2`. The shell adds no second formatting toolbar above it. Result: one shell row (tabs/title) + one engine row. Cost: fonts, icon style, focus rings and menus inside the frame remain ONLYOFFICE's.
- **Option B — hide engine chrome, drive from a native shell toolbar.** Needs `layout.toolbar: false` (white-label licence on official builds) or a fork of `web-apps` (AGPL; CryptPad and the WASM community builds already fork it). Then every button needs an API path into sdkjs, plus state readback (is Bold active, current font, enabled/disabled) to render correct toggle states. The sibling engine notes judge this "feasible but sparsely documented". High maintenance on every engine update. Not for v1.
- **Option C — hybrid (recommended target).** Shell toolbar holds only the cross-format essentials that the shell can perform safely without readback (undo, redo, save state, find, zoom, export, comment panel, focus mode) and the engine's compact toolbar handles formatting. The palette lists shell commands plus a curated set of engine commands executed through the engine's API or by synthesising its documented hotkeys.
- Whether the open-source/community WASM builds honour `layout.*` is unknown from documentation; in the source the extended branding flags are tied to licence checks (background knowledge, unverified), so test it empirically before designing around it.
- **Visual-consistency pitfalls and mitigations:**
  - *Double chrome:* never show the engine's file name/header/logo next to the shell's tab title; turn off its File tab items that duplicate shell actions where possible, and route Ctrl+S to the shell.
  - *Dark-mode mismatch:* switch `uiTheme` together with the shell; decide the document-canvas policy once (white page in dark UI by default, optional dark page) and apply it to every format; avoid a white flash by keeping the frame hidden behind a themed skeleton until the engine reports ready.
  - *Fonts:* the engine UI font cannot be changed without white-label `font`; choose a shell UI font visually close to it (system UI font or Inter at 12–13 px) rather than fighting it.
  - *Focus rings and scrollbars:* differ inside the frame; standardise the shell's own and accept the difference; make the frame border-less so the seam is invisible.
  - *Local-storage overrides:* user toggles inside the engine (compact toolbar, theme) persist in local storage and override config, so state can drift from the shell's settings; either expose those settings only in the shell and clear the engine keys on load, or accept the engine as source of truth for them.
  - *Menus and dialogs clipped by the frame:* engine dropdowns cannot overflow the iframe; keep the frame as large as possible (full content area) and never put shell UI where engine popups need to open.
  - *Keyboard focus:* clicking shell chrome steals focus from the frame; every shell command must return focus to the editor.
  - *Zoom and scale:* app-level zoom (Ctrl +/-) must map to document zoom inside the engine, not to browser zoom of the frame.
- Engines that are UI libraries or the app's own code (CodeMirror/Monaco for text, a Markdown editor, PDF.js viewer, Univer if used) should use fully native shell toolbars from day one; that makes Markdown/text/PDF the place where the app's design language is purest and sets the visual target the embedded suites are themed toward.

### Gaps
- api.onlyoffice.com was unreachable; parameters come from the GitHub source of the same docs (current master, late 2026).
- Not verified: behaviour of `layout.*` in community/WASM builds; exact theme-token list for custom `uiTheme`; whether a host can inject CSS into the editor frame in the embedding route chosen.
- CryptPad and Nextcloud visual details are thinly sourced (search snippets plus background); no design write-up by either was found.

---

## 7. Distraction-free and focus design; calm colour, type, density, motion

### Takeaway
Calm comes from removing duplicated chrome, dimming navigation relative to content, a restrained neutral palette with one accent, and a focus mode that hides everything but the document. Typewriter/sentence focus belong to the writing formats only.

### Cited Findings
- [search] iA Writer Focus Mode has three settings: Sentence, Paragraph (surrounding text dimmed) and Typewriter (caret line stays vertically fixed, nothing dimmed); toggled from the menu, a title-bar button or Cmd+D; iA advises focus mode for drafting and switching it off for editing; the app deliberately withholds font/colour choices. — [iA Writer: Focus Mode](https://ia.net/writer/support/editor/focus-mode)
- [search] Typora: Focus Mode fades all but the current line/block; Typewriter Mode keeps the caret vertically fixed; both in the View menu. — [Typora: Focus and Typewriter Mode](https://support.typora.io/Focus-and-Typewriter-Mode)
- [search] Linear (Mar 2026): dimmed sidebar, compact tab bars, softened borders, fewer icons; the team notes that warming the palette risked looking "muddy" and needed iteration. — [Linear: Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)
- [search] Dia's Focus Mode hides the sidebar or top tabs and reveals controls on hover, compatible with split view. Figma UI3 has Minimize UI. — [Dia changelog](https://www.diabrowser.com/changelog); [Figma blog](https://www.figma.com/blog/our-approach-to-designing-ui3/)
- [search] GNOME HIG: header bars should hold only a small number of controls. — [GNOME HIG: Header bars](https://developer.gnome.org/hig/patterns/containers/header-bars.html)
- [background] VS Code Zen Mode (Ctrl+K Z) hides activity bar, status bar, sidebar and optionally tabs and centres the editor; Esc Esc exits. Bear and Things use generous whitespace, a single accent colour and near-monochrome icons. — [VS Code docs: Zen Mode](https://code.visualstudio.com/docs/getstarted/userinterface#_zen-mode)
- [background] WCAG 2.3.3 (AAA) and common practice: honour `prefers-reduced-motion`; keep UI transitions short (roughly 100–200 ms) and functional. — [W3C: Understanding 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html); [MDN: prefers-reduced-motion](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion)

### Inferences
- **Focus mode (one shortcut, all formats):** hides tab strip, sidebar, inspector and status bar; keeps only the document and, for embedded engines, their compact toolbar (or hides it too if licensing/fork allows). Chrome reappears when the pointer reaches the top edge or on Esc. Show a brief, non-modal "Press Esc to exit" hint the first few times.
- **Writing extras for Markdown/text only:** typewriter scrolling, sentence/paragraph dimming, centred column with a 60–80 character measure, optional line numbers off.
- **Reading mode** for documents and PDFs: no caret, no toolbar, page/continuous toggle.
- **Colour:** neutral greys with low-contrast separators; chrome one step dimmer than content; one accent used only for focus, selection and primary action; format tints confined to tab icons. Light, dark and "follow system" themes; in dark mode the page stays white by default with an opt-in dark page.
- **Type:** one UI family at two or three sizes (about 12, 13, 15 px), medium weight for emphasis rather than colour; tabular numerals in status bar and grids.
- **Density:** a single "Comfortable / Compact" setting affecting row heights and toolbar padding; default comfortable (targets of at least 28–32 px, which also clears WCAG 2.5.8).
- **Motion:** no decorative animation; palette and panels appear in under about 150 ms; with reduced-motion on, use instant show/hide.
- Hover-revealed chrome is acceptable only for secondary controls and only if everything it reveals is also keyboard-reachable; do not hide primary navigation behind hover outside focus mode.

### Gaps
- No controlled evidence that focus/typewriter modes improve writing output was found; this is craft convention.
- Things, Bear and Craft design write-ups were not retrieved.

---

## 8. Save-state and safety UX

### Takeaway
Use the modern document model: automatic saving with a quiet, always-visible state label, automatic local versions, hot-exit recovery of unsaved work, and loud, specific warnings only for the three genuinely dangerous cases: lossy format save, external change conflict, and failed save.

### Cited Findings
- [search] VS Code: `files.autoSave` values off (default), `afterDelay` (default 1000 ms), `onFocusChange`, `onWindowChange`. Hot exit backs up unsaved changes and restores them after quit or crash (`files.hotExit`). — [VS Code docs: Basic editing](https://code.visualstudio.com/docs/editing/codebasics); [VS Code blog: hot exit](https://code.visualstudio.com/blogs/2016/11/30/hot-exit-in-insiders)
- [search] macOS: a version is saved automatically every hour (more often during heavy editing) and on open, save, duplicate, lock, rename or revert; File > Revert To > Browse All Versions opens a timeline; older versions are read-only but text can be copied from them; "Ask to keep changes when closing documents" is a system setting. Apps with their own autosave (Microsoft Office) do not use Versions. — [Apple: View and restore past versions of documents](https://support.apple.com/guide/mac-help/mh40710); [Eclectic Light: Preview's saving grace](https://eclecticlight.co/2025/09/03/previews-saving-grace-and-how-to-use-it/)
- [search] Microsoft 365: the AutoSave toggle works only for files on OneDrive/SharePoint; AutoRecover is separate and still protects local files in a crash; after a crash a Document Recovery pane lists recovered versions; "Keep the last AutoRecovered version if I close without saving" is an option; Version History opens from the file name in the title bar. — [Microsoft: What is AutoSave?](https://support.microsoft.com/office/collab-files/what-is-autosave); [Help protect your files in case of a crash](https://support.microsoft.com/en-us/office/collab-files/help-protect-your-files-in-case-of-a-crash); [Recover an earlier version of an Office file](https://support.microsoft.com/en-US/Office/collab-files/recover-an-earlier-version-of-an-office-file)
- [background] Google Docs shows "Saving…" then "Saved to Drive" (a cloud icon) beside the title and has no Save command; "Last edit was…" opens version history. Excel warns "Some features in your workbook might be lost if you save it as CSV" with Keep format / Save as choices. VS Code on external change: silently reloads a clean file; for a dirty file, save fails with "The content of the file is newer" and offers Compare / Overwrite. — [Google Docs Help: version history](https://support.google.com/docs/answer/190843); [Microsoft: save a workbook in another format](https://support.microsoft.com/office/save-a-workbook-in-another-file-format-6a16c862-4a36-48f9-a300-c2ca0065286e); [VS Code docs: Basic editing](https://code.visualstudio.com/docs/editing/codebasics)
- [background] macOS HIG document model: a dot in the window close button and "— Edited" in the title mark unsaved changes; the title-bar document menu offers rename, move, tags, lock. — [Apple HIG: Windows](https://developer.apple.com/design/human-interface-guidelines/windows)

### Inferences
- **Bad patterns to avoid:** Office's split model (AutoSave only in the cloud, so local files silently rely on a 10-minute AutoRecover that users mistake for saving); modal "Do you want to save?" on every close; recovery panes that present several near-identical versions with no guidance; lossy-save warnings that do not say what will be lost.
- **Recommended model:**
  - Autosave on by default to the original file (debounced a few seconds after the last edit and on tab switch/blur/close) for formats where saving is lossless and cheap (Markdown, text, CSV-as-text). For office formats, where each save is a full conversion and may be lossy, autosave continuously to a local recovery snapshot and write to the real file on explicit save or on a longer idle interval; make the policy a per-format setting, shown plainly.
  - State label in the status bar and tab: "Saved", "Saving…", "Edited" (dot on tab), "Saved locally — not yet written to file" (if snapshot-only), "Read-only", "Save failed" (red, persistent, with Retry). Clicking the label opens version history.
  - Keep Ctrl/Cmd+S working always, with a brief "Saved" confirmation; people press it out of habit and it must never produce an error or a dialog for an already-saved file.
  - Version history: automatic local snapshots (on first edit of a session, periodically, and before any destructive operation such as format conversion or overwrite after conflict), browsable as a list with timestamps and "Restore" / "Open copy". Read-only previews.
  - Hot exit: quitting never asks; untitled and unsaved documents are restored exactly on next launch. After a crash, reopen the previous tabs with one non-modal banner per recovered file ("Recovered unsaved changes from 14:32 — Keep / Discard / Compare").
  - External change: if the tab is clean, reload silently with a small "Reloaded from disk" note; if dirty, a non-modal bar in that tab: "This file changed on disk. Keep mine / Load theirs / Save mine as copy" (plus Compare for text). Never auto-overwrite.
  - Lossy save: before the first save that drops content (xlsx → csv, docx features the engine cannot write, flattened PDF annotations), one dialog naming what is lost in plain words, defaulting to "Save a copy in new format"; remember the choice per file.
  - Untitled files: usable without naming; first Ctrl/Cmd+S asks for name and place; they persist via hot exit meanwhile.

### Gaps
- No user research comparing autosave-to-file vs snapshot-then-explicit-save for local office documents was found; the per-format policy is my inference from engine cost and fidelity risk (see sibling notes on x2t conversion cost).
- VS Code's dirty-indicator and conflict wording are from background knowledge.

---

## 9. Onboarding and learnability for hidden depth

### Takeaway
Skip tours. Use a useful home/empty state, shortcut-bearing tooltips, the palette as a teacher, a searchable shortcut sheet, and a few contextual tips triggered by the user's own behaviour.

### Cited Findings
- [search] NN/g distinguishes "push revelations" (help shown out of context, with no sign the user needs it) from "pull revelations" (help triggered by a signal that the user would benefit right now, such as tooltips or coach marks tied to an action). NN/g's research on deck-of-cards tutorials found they did not improve task performance, and users commonly skip them. — [NN/g: Onboarding tutorials vs contextual help](https://www.nngroup.com/articles/onboarding-tutorials/); [NN/g: Mobile-app onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/)
- [search] Apple's onboarding guidance favours context-specific tips over a single up-front flow. — [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
- [search] Superhuman's palette shows the shortcut beside each command so that using the palette teaches the shortcut. Google's tool finder does the same. — [Superhuman blog](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/); [Google Help](https://support.google.com/docs/answer/13466905)
- [search] GNOME standard: Ctrl+? opens a keyboard-shortcuts window, and the primary menu has a Keyboard Shortcuts item. — [GNOME HIG: keyboard](https://developer.gnome.org/hig/reference/keyboard.html)
- [search] ONLYOFFICE shows its own first-load feature tips unless `features.featuresTips` is false. — [ONLYOFFICE standard branding docs (GitHub)](https://github.com/ONLYOFFICE/api.onlyoffice.com/blob/master/site/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding.md)
- [background] VS Code's Welcome page uses opt-in checklists ("walkthroughs") rather than a forced tour. — [VS Code UX guidelines: walkthroughs](https://code.visualstudio.com/api/ux-guidelines/walkthroughs)

### Inferences
- First run opens the Home tab: New buttons per type, Open, drag-and-drop hint, and one line: "Press Ctrl K to find any file or command". No modal, no account, no tour.
- Every tooltip = action name + shortcut keycaps, appearing after about 500 ms; every menu and palette row shows the shortcut.
- Shortcut sheet: one overlay, searchable, grouped (Everywhere / Documents / Sheets / Slides / PDF / Text), reachable from Help, the palette (`?`) and a shortcut; shows where formats differ.
- Contextual tips, at most one at a time, dismissible forever, each tied to a trigger: opening a third tab ("Ctrl Tab switches tabs"), using a toolbar button three times ("Tip: Ctrl B"), first xlsx → csv save, first external change. Keep a "Tips" list in Help to replay them.
- Empty states say what to do next in one sentence plus one primary action (empty sidebar: "Open a folder to browse files here"; empty palette result: "No command or file matches 'x'. Search file contents instead?").
- Turn off the embedded engine's own tips and help buttons so two onboarding voices do not compete.

### Gaps
- NN/g empty-state guidance was not retrieved.
- No evidence specific to single-owner tools (where the "user" is also the designer); onboarding matters mainly for returning after long gaps and for features used rarely.

---

## 10. Accessibility baseline for a desktop Electron app

### Takeaway
Aim for WCAG 2.2 AA in the shell, where it is fully controllable: full keyboard operation, visible focus that is never hidden, 4.5:1 text contrast, 24 px targets, zoom, reduced motion and system high-contrast support. The hard parts are focus hand-off across frames and the limited screen-reader support of canvas-based engines, which should be documented honestly rather than promised.

### Cited Findings
- [search] WCAG 2.2 added nine criteria; at A/AA: 2.4.11 Focus Not Obscured (Minimum) (AA), 2.5.7 Dragging Movements (AA: provide a single-pointer alternative), 2.5.8 Target Size (Minimum) (AA: 24×24 CSS px with exceptions), 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A), 3.3.8 Accessible Authentication (Minimum) (AA). 2.4.13 Focus Appearance and 2.4.12 Focus Not Obscured (Enhanced) are AAA. 4.1.1 Parsing was removed. — [W3C: What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/); [WebAIM WCAG 2.2 checklist](https://webaim.org/standards/wcag/wcag22)
- [background] Long-standing AA essentials: 1.4.3 contrast 4.5:1 for text (3:1 large), 1.4.11 non-text contrast 3:1 for UI components and focus indicators, 2.1.1 keyboard, 2.1.2 no keyboard trap, 2.4.3 focus order, 2.4.7 focus visible, 1.4.4 resize text to 200%, 1.4.10 reflow, 1.4.13 content on hover or focus (tooltips dismissible, hoverable, persistent), 1.4.1 use of colour, 4.1.2 name/role/value, 2.1.4 character key shortcuts (single-key shortcuts must be remappable or off). — [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [search] Electron enables Chromium's accessibility tree automatically when assistive technology is detected (JAWS, VoiceOver); `app.setAccessibilitySupportEnabled(true)` forces it; on macOS third-party AT can set `AXManualAccessibility`. — [Electron docs: Accessibility](https://www.electronjs.org/docs/latest/tutorial/accessibility)
- [search] ONLYOFFICE screen-reader support exists (JAWS, NVDA, Orca, VoiceOver; enabled in editor settings) but began as beta in 2023 and is still described by the vendor in 2026 as in development. — [ONLYOFFICE Help: screen reader](https://helpcenter.onlyoffice.com/docs/userguides/accessibility/screen-reader.aspx); [ONLYOFFICE blog, Apr 2026](https://onlyoffice.com/blog/2026/04/onlyoffice-for-every-user)
- [background] Useful ARIA patterns: Tabs (roving tabindex, arrow keys, Delete to close), Toolbar (single tab stop, arrow keys inside), Combobox + Listbox (palette), Menu/Menubar, Dialog (focus trap, return focus), Tree view (sidebar). F6 / Shift+F6 to cycle between panes is the Windows and VS Code convention. Windows high-contrast maps to the CSS `forced-colors` media query; macOS "Increase contrast" to `prefers-contrast: more`. — [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/); [MDN: forced-colors](https://developer.mozilla.org/docs/Web/CSS/@media/forced-colors)

### Inferences
- **Focus architecture:** treat the window as regions (tab strip, toolbar, sidebar, editor, inspector, status bar). Tab moves within a region; F6/Shift+F6 moves between regions; Esc from any shell region returns focus to the editor; closing the palette or a dialog restores the previously focused element, including when that element is inside an iframe (store "editor had focus" and call the frame's focus method rather than a DOM element reference).
- **Frames:** keyboard events inside an embedded frame do not bubble to the shell, so reserved shell chords must be captured before the frame (main-process `before-input-event` or a capture bridge inside same-origin frames; see sibling notes). Give each frame a `title` naming the document and editor type. Ensure there is always a keyboard way out of the editor (reserved chords plus F6), satisfying 2.1.2.
- **Canvas engines:** documents, sheets and slides rendered to canvas expose little to assistive technology unless the engine's screen-reader mode is on. Add a shell setting "Screen reader support" that calls `app.setAccessibilitySupportEnabled(true)` and turns on each engine's own mode; state the limits in Help. The app's own editors (CodeMirror 6 / Monaco, Markdown, PDF.js text layer) are DOM/ARIA-based and far more accessible; keep them that way.
- **Contrast in a calm theme:** "dimmed" chrome must still meet 4.5:1 for text and 3:1 for icons/borders that convey state; pick the dim grey from the contrast floor upward. Focus ring: 2 px, accent colour, at least 3:1 against adjacent colours, never removed.
- **Zoom:** separate "interface scale" (affects shell, 80–200%) from "document zoom" (per tab). Honour OS text scale. Test the shell at 200% without loss of function.
- **Targets and drag:** toolbar buttons at least 28 px with 24 px minimum spacing-inclusive target; tab reordering and split-by-drag need non-drag alternatives (context menu "Move left/right", "Open to the side").
- **System settings:** honour `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`; offer a built-in high-contrast theme.
- **Self-test:** keyboard-only pass over every flow; NVDA (Windows) and VoiceOver (macOS) smoke test of shell + text editor; axe-core in Playwright for shell views; contrast check of tokens in both themes.

### Gaps
- No source describing focus management between an Electron shell and embedded office-engine frames specifically; the approach is inferred from general practice.
- Real-world quality of ONLYOFFICE's screen-reader mode in the WASM/community builds is unknown.
- The EAA/legal dimension is irrelevant for a personal tool and was not researched.

---

## 11. Design system and tooling for a solo developer

### Takeaway
Keep the system tiny: a three-layer token file (CSS variables), a headless component library styled once (Base UI or Radix under shadcn/ui, with cmdk for the palette), one icon set (Lucide, with Codicons-style file icons if needed), system UI fonts, and native window chrome integration per OS. Process: principles doc → low-fidelity wireframes of five screens → clickable prototype of the shell with fake editors → self-test checklists.

### Cited Findings
- [search] Base UI 1.0 (from the MUI/Radix/Floating UI authors) shipped 11 Dec 2025 with 35 accessible unstyled components, package `@base-ui/react`; releases continued through 2026 (1.8.0 reported Sept 2026). shadcn/ui added Base UI support in Jan 2026 and made it the default on 2 Jul 2026, while stating Radix remains fully supported; one secondary source describes Radix primitives maintenance as slower. — [Base UI v1.0.0 release notes](https://base-ui.com/react/overview/releases/v1-0-0); [InfoQ, Feb 2026](https://www.infoq.com/news/2026/02/baseui-v1-accessible); [shadcn/ui changelog 2026-07](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default); [shadcn/ui changelog 2026-01](https://ui.shadcn.com/docs/changelog/2026-01-base-ui)
- [search] Lucide reached 1.0 in 2026: more than 1,600 icons, ISC licence (with MIT portions from Feather), brand icons removed in 1.0. — [InfoQ: Lucide v1](https://infoq.com/news/2026/06/lucide-v1-icons); [lucide-icons/lucide](https://github.com/lucide-icons/lucide)
- [background] Other icon sets: Phosphor (six weights: thin, light, regular, bold, fill, duotone; MIT), Fluent UI System Icons (regular + filled, many sizes; MIT), VS Code Codicons (dense 16 px editor-oriented set; icons CC BY 4.0, code MIT), Tabler (MIT). — [Phosphor](https://phosphoricons.com/); [fluentui-system-icons](https://github.com/microsoft/fluentui-system-icons); [vscode-codicons](https://github.com/microsoft/vscode-codicons)
- [background] Other component options: Ark UI (headless, Zag state machines, multi-framework), React Aria Components (Adobe; strongest accessibility and keyboard behaviour), Fluent UI React v9 (complete but brings Microsoft's look). — [Ark UI](https://ark-ui.com/); [React Aria](https://react-spectrum.adobe.com/react-aria/); [Fluent UI React](https://react.fluentui.dev/)
- [search] Windows title-bar guidance: 32 px standard, 48 px with a search box, draggable empty areas, caption buttons right. — [Microsoft Learn: title bar](https://learn.microsoft.com/windows/apps/design/basics/titlebar-design)
- [background] Electron window chrome: `titleBarStyle: 'hiddenInset'` (macOS traffic lights inset over custom content, position adjustable with `trafficLightPosition`); `titleBarStyle: 'hidden'` + `titleBarOverlay` (Windows/Linux Window Controls Overlay: native caption buttons drawn over web content with configurable colour/height, keeping Windows 11 snap layouts); CSS `app-region: drag` / `no-drag` for the draggable area; `Menu.setApplicationMenu` for the native menu bar and `Menu.popup` for native context menus; `nativeTheme` for system theme. — [Electron: Custom title bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar); [Electron: BaseWindow options](https://www.electronjs.org/docs/latest/api/base-window)
- [background] System font stacks give native feel at zero cost: `system-ui` resolves to SF Pro (macOS), Segoe UI Variable (Windows 11), and the desktop font on Linux (Adwaita Sans on GNOME 48+, previously Cantarell). Inter is the common cross-platform alternative when identical rendering is wanted; it is SIL OFL. — [MDN: font-family system-ui](https://developer.mozilla.org/docs/Web/CSS/font-family); [Inter](https://rsms.me/inter/)
- [background] Design Tokens Community Group format reached a first stable version in late 2025; for a solo project plain CSS custom properties are sufficient. — [Design Tokens Community Group](https://www.designtokens.org/)

### Inferences
- **Tokens (three layers):** primitives (grey scale of about 12 steps, one accent scale, red/amber/green), semantic (`--bg`, `--bg-chrome`, `--bg-hover`, `--text`, `--text-dim`, `--border`, `--accent`, `--focus-ring`, `--danger`), component (`--tab-height`, `--toolbar-height`, `--radius`, `--density`). Light and dark are two sets of semantic values. Space on a 4 px grid; radii 4–6 px; one shadow for overlays.
- **Components actually needed (about 20):** Button, IconButton, Toggle, Tooltip, Menu, ContextMenu, Menubar (Windows/Linux), Tabs, Toolbar, Select, Popover, Dialog, Toast/Banner, Combobox (palette), Tree, Splitter, ScrollArea, Switch, Slider (zoom), Kbd. A headless library supplies behaviour and accessibility for nearly all of them.
- **Library choice:** shadcn/ui on Base UI is the 2026 default path and gives owned, editable component source; Radix-based shadcn remains fine. Strip shadcn's default look down (smaller radii, 13 px text, 28 px controls) to get a desktop rather than web-app feel. React Aria is the alternative if accessibility rigour outranks ecosystem momentum.
- **Icons:** Lucide at 16 px, 1.5 px stroke, for all shell UI; a small custom or Codicon/Fluent-derived set for the six file-type icons so they are distinct by shape. Do not mix stroke weights.
- **Fonts:** system UI stack for the shell (free native feel and close to embedded engines' defaults); a bundled monospace (JetBrains Mono or system mono) for code; documents use their own fonts, so bundle metric-compatible open fonts (Carlito, Liberation/Arimo/Tinos) to keep layouts stable when Calibri/Arial/Times are absent.
- **Native feel per OS:** macOS: hiddenInset title bar with tabs beside the traffic lights, full native menu bar, Cmd shortcuts, native context menus, Settings in the app menu. Windows: Window Controls Overlay, 32–40 px title/tab row, menu via Alt or a hamburger, snap layouts preserved. Linux: same as Windows layout with client-side decorations; follow GNOME ordering for the primary menu. Use native file dialogs, native context menus where content is not custom, and OS accent colour only if it does not fight the calm palette.
- **Lightweight process:** (1) one-page design principles; (2) paper or Excalidraw/tldraw wireframes of Home, document tab, sheet tab, palette, focus mode; (3) a clickable shell prototype in the real stack with placeholder editors, since palette feel, focus hand-off and tab behaviour cannot be judged in static mock-ups; (4) a screenshot-based "chrome budget" check (count rows and controls above the document); (5) self-testing checklists: keyboard-only run of ten core tasks, the same ten tasks per format for consistency, a first-click test with one outside person, a two-week dog-food log of every moment of friction, and a quarterly "return after absence" test.

### Gaps
- Electron title-bar API details are from background knowledge (electronjs.org was not fetched).
- No 2026 comparison of headless libraries specifically for desktop-density UIs was found.
- Radix's long-term maintenance outlook is unclear (one secondary source).

---

## 12. Bottom line: design principles, default layout, on-demand surfaces, risks

### Takeaway
Build a conventional, quiet shell: one title/tab row, one contextual toolbar row, the document, one thin status bar. Everything else (sidebar, inspector, find, palette, version history, settings) appears on demand, and the palette indexes all of it. Accept the embedded office engines' compact toolbar rather than rebuilding it, and put the design effort into consistency of the shell, shortcuts, save safety and focus hand-off.

### Cited Findings
(Principles below are synthesised from the sources already cited in sections 1–11; the load-bearing ones are repeated here.)
- [search] Limit disclosure to two levels with an obvious route to the second. — [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [search] A handful of commands dominate use (top five ≈ 32% in Word 2003). — [Jensen Harris](https://learn.microsoft.com/en-us/archive/blogs/jensenh/no-distaste-for-paste-why-the-ui-part-7)
- [search] Floating, movable chrome slowed users; fixed panels were restored. — [Figma UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/)
- [search] Conventional layout eases switching (Dia's "Tuesday morning" test). — [The Browser Company](https://browsercompany.substack.com/p/the-strategy-behind-dias-design)
- [search] Calm = navigation recedes, content leads. — [Linear design refresh](https://linear.app/now/behind-the-latest-design-refresh)
- [search] The palette holds every command and teaches shortcuts. — [VS Code UX guidelines](https://code.visualstudio.com/api/ux-guidelines/command-palette); [Superhuman](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [fetched] Hiding ONLYOFFICE's toolbar/status bar/menus via `layout` requires the extended white-label licence; compact header/toolbar, tab style and theme are free. — [ONLYOFFICE white-label docs](https://github.com/ONLYOFFICE/api.onlyoffice.com/blob/master/site/docs/docs-api/usage-api/config/editor/customization/customization-white-label.md); [standard branding docs](https://github.com/ONLYOFFICE/api.onlyoffice.com/blob/master/site/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding.md)
- [search] Pull-style contextual help beats up-front tutorials. — [NN/g](https://www.nngroup.com/articles/onboarding-tutorials/)

### Inferences
**Ten design principles**
1. **Content first.** At most two rows of chrome above the document and one below. Chrome is dimmer than content.
2. **One frame, many editors.** Tabs, title, save state, find, zoom, export, palette and status bar look and behave the same for every file type.
3. **Everything is in the palette.** If a command exists, Ctrl/Cmd+K finds it by any reasonable name, shows its shortcut, and runs it.
4. **Two levels, never three.** Visible essentials, then one obvious "more" surface (overflow, inspector, context menu, menu bar).
5. **Things stay put.** No floating panels, no adaptive reordering outside the palette.
6. **Same word, same key, same place.** One vocabulary; shell shortcuts are global; content shortcuts follow each format's own tradition.
7. **Never lose work, rarely ask.** Autosave, local versions, hot exit; dialogs only for lossy saves, conflicts and failures.
8. **Keyboard complete, mouse obvious.** Every action reachable by keyboard; every visible control has a label or tooltip with its shortcut.
9. **Borrow the platform.** Native title bar controls, menus, dialogs and conventions on each OS; conventional layout over novelty.
10. **Honest seams.** Where an embedded engine differs, theme it, compact it and do not duplicate it; do not pretend to control what the shell cannot.

**Default window (what is always there)**
- Row 1, about 36–40 px: [macOS traffic lights] · sidebar toggle · tab strip (format icon, name, dirty dot) · "+" new tab menu · flexible drag area · search pill "Search files and commands  ⌘K" · [Windows/Linux caption buttons].
- Row 2, about 36–40 px: contextual toolbar. For native editors (Markdown, text/code, PDF, CSV) a shell toolbar of roughly 8–14 controls plus "More". For embedded office editors, the engine's compact toolbar occupies this row and the shell draws none of its own.
- Content area: the editor, edge to edge, no inner borders.
- Status bar, about 24 px: save state · position readout · selection stats · zoom.
- Nothing else by default: no sidebar, no inspector, no ruler, no second toolbar, no activity bar.

**On demand**
- Sidebar (recent/pinned files, folder tree) via toggle; Outline (headings/sheets/slides/pages) as a sidebar section.
- Inspector/right panel (format properties, comments, version history) via toggle or automatically when a command needs it; for embedded engines this is the engine's own right panel.
- Palette (Ctrl/Cmd+K, Ctrl/Cmd+P, Ctrl/Cmd+Shift+P); find bar (Ctrl/Cmd+F); export dialog; shortcut sheet; settings as a tab, not a modal window.
- Home tab when no file is open.
- Focus mode: hides rows 1 and status bar (and row 2 where possible) until the pointer touches the top edge or Esc.
- Split view: two panes maximum.
- Bubble toolbar on text selection in native editors; context menus everywhere.
- Banners inside a tab for conflicts, recovery and read-only state; toasts only for transient confirmations.

**Main risks and mitigations**
- *Two design languages on screen* (shell vs engine toolbar). Mitigation: compact + themed engine chrome, no duplicate controls, shell font/metrics chosen to sit close to the engine's; revisit a fork-based native toolbar only after v1.
- *Licensing limits on hiding engine chrome* (`layout.*` is white-label). Mitigation: design assuming the engine toolbar and status bar stay; verify behaviour on the chosen build early.
- *Shortcut collisions* (Ctrl+K link, Ctrl+P print, Ctrl+B bold, Ctrl+/). Mitigation: short reserved list, written policy, per-format differences shown in tooltips and the shortcut sheet, rebindable palette key with Ctrl/Cmd+Shift+P alias.
- *Palette incompleteness for embedded engines* undermines principle 3. Mitigation: curate per-engine command lists tied to verified API paths; label gaps honestly ("available in the toolbar").
- *Focus loss between shell and frames* makes keyboard-first feel broken. Mitigation: a single focus manager, automatic return of focus to the editor, tested on every command.
- *Over-minimalism* (Zed critique; Office feature-request finding): hidden features read as missing. Mitigation: full menu bar, "More" overflow, search pill visible, shortcut sheet.
- *Autosave vs lossy formats*: silent degradation of a docx/xlsx. Mitigation: snapshot-first policy for office formats, pre-conversion versions, explicit lossy-save dialog.
- *Accessibility of canvas editors* is outside the shell's control. Mitigation: accessible shell and native editors, opt-in screen-reader mode, documented limits.
- *Scope creep in the design system.* Mitigation: about 20 components, one icon set, one density toggle, two themes.
- *Solo-developer blind spots* (designer = only user). Mitigation: principles doc as the tie-breaker, dog-food friction log, occasional outside first-click test.

### Gaps
- No direct precedent was found for a single shell that unifies embedded office engines, a code editor, Markdown and PDF under one palette and toolbar grammar; the recommendations combine patterns proven separately, and the combination itself is untested.
- Several primary sources could not be opened this session (nngroup.com, code.visualstudio.com, api.onlyoffice.com, figma.com, blog.superhuman.com); items tagged [search] or [background] should be spot-checked before being quoted in a final plan. Allowing those hosts in the session's network settings would let them be verified.
- Not researched: Craft, Anytype, Things and Bear in any depth; Material 3 guidance beyond Google Workspace's use of it; Fluent 2 command-bar guidance; tablet/touch input.
