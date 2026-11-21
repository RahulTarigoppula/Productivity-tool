# Competitive landscape and the "interconnected documents" feature space

Research date: 2026-11-21. Scope: a personal, single-user, tabbed app that edits real files (.docx, .xlsx, .pptx, .pdf, Markdown, CSV, text, code) by embedding existing engines; Windows first, then Android, then macOS/iOS.

**Evidence tags used on every finding**

- `[S]` = search-summary only: taken from a web-search result summary in this session; the page itself was not opened.
- `[B]` = background knowledge: from the researcher's training knowledge (cutoff mid-2026); the URL is the canonical place to verify it but was NOT opened in this session. Deep `[B]` URLs are recalled from memory and may have moved; if one 404s, search the vendor site for the named page.
- `[R]` = read directly. **No finding in this file carries `[R]`.** Every direct page fetch attempted in this session failed because the hosts were outside the session's network allowlist (techcommunity.microsoft.com, stephango.com, support.google.com). The report writer should treat exact figures (prices, star ratings, dates) as needing a click-through check before publication.

Related notes that already cover adjacent ground (not repeated here): `ux-ui-design.md` (shell, command palette, focus mode, design system), `app-shell-ux-testing.md` §7 (prior-art all-in-one apps), `pdf-stack.md` §10 (PDF UX benchmarks).

---

## 1. Current offerings: 2025-2026 state, strengths, and where users are frustrated

### Takeaway
The incumbents are strongest exactly where a solo app is weakest (fidelity, collaboration, AI at scale), but 2025-2026 produced a well-documented wave of resentment about four things: forced AI bundled with price rises, freemium/upsell creeping into previously free suites, bloat, and the *un*-bundling of all-in-one editing on mobile. The plain-file, no-account, one-app-for-every-format niche is real and currently served only by WPS (ads, trust issues) and ONLYOFFICE (no notes/linking layer).

### Cited Findings

**Microsoft 365 (desktop, Copilot app, mobile, Loop)**
- `[S]` In January 2025 Microsoft bundled Copilot into Microsoft 365 Personal and Family and raised the price by USD 3/month; users objected to the lack of clear notice and to how hard the opt-out ("Classic" plan) was to find — [The Register](https://www.theregister.com/2025/02/07/microsoft_365_price_rises/), [PCWorld](https://www.pcworld.com/article/2581179/microsoft-follows-google-with-price-bump-forced-ai-365-bundles.html), [TechSpot](https://www.techspot.com/news/106503-microsoft-365-copilot-rollout-sparks-backlash-over-price.html), [Slashdot/ZDNet "total disaster"](https://tech.slashdot.org/story/25/01/25/1735212/)
- `[S]` Australia's ACCC alleges personal/family subscribers were misleadingly told they had to pay more for Copilot — [ITPro](https://www.itpro.com/software/microsoft-365-price-hikes-have-landed-the-tech-giant-in-hot-water)
- `[S]` A commercial price reset effective 1 July 2026 raised list prices by 5-43% across Business/Enterprise/Frontline suites while folding baseline Copilot Chat into base plans — [The Register](https://www.theregister.com/2025/12/05/microsoft_365_prices_up_2026), [TechRadar](https://www.techradar.com/pro/microsoft-365-is-hiking-prices-for-businesses-heres-how-much-it-will-cost-you)
- `[S]` **Microsoft dismantled its own all-in-one mobile app.** From 15 September 2025 on iOS (and from mid-November 2025 on Android) the Microsoft 365 Copilot app can only *preview* Word/Excel/PowerPoint files; editing and creating moved to the standalone apps, "Make available offline" was removed, and file browsing moved to OneDrive. Microsoft's support page was last updated February 2026 — [Microsoft Support](https://support.microsoft.com/en-us/microsoft-365-copilot/understand-changes-to-microsoft-365-copilot-mobile-app), [AppleInsider](https://appleinsider.com/articles/25/08/21/microsoft-kills-editing-in-365-copilot-app-for-iphone-ipad), [Thurrott](https://www.thurrott.com/cloud/326739/microsoft-365-copilot-app-for-ios-is-losing-the-ability-to-edit-office-files), [Windows Latest "becomes a Copilot wrapper"](https://www.windowslatest.com/2025/08/21/youll-need-standalone-word-powerpoint-excel-apps-on-ios-to-edit-microsoft-365-becomes-a-copilot-wrapper)
- `[S]` The former "Microsoft 365 (Office)" app is now branded the Microsoft (365) Copilot app across web, mobile and Windows — [Microsoft Support](https://support.microsoft.com/microsoft-365-copilot/the-microsoft-365-app-transition-to-the-microsoft-365-copilot-app)
- `[S]` Loop is being narrowed rather than expanded: Loop components in OneNote for the web were retired by mid-September 2026 (existing ones become links); Copilot Pages (built on Loop) are positioned as the successor for AI-generated content; Microsoft now documents three overlapping products (Loop, Copilot Pages, Copilot Notebooks) — [Message Center MC1454385](https://mc.merill.net/message/MC1454385), [Microsoft Support comparison](https://support.microsoft.com/en-US/Microsoft-365-Copilot/compare-microsoft-loop-copilot-pages-and-copilot-notebooks)
- `[B]` Strengths that remain unmatched: native rendering of its own formats, co-authoring, Excel's calculation engine/Power Query/pivots, PowerPoint Designer/Morph, enterprise compliance. Desktop Office already has a searchable command box ("Tell Me"/Microsoft Search, Alt+Q) — [Microsoft Support (search "Find what you need with Microsoft Search in Office")](https://support.microsoft.com/office)

**Google Workspace**
- `[S]` Google preceded Microsoft in bundling AI (Gemini) into Workspace plans with a price bump — [PCWorld](https://www.pcworld.com/article/2581179/microsoft-follows-google-with-price-bump-forced-ai-365-bundles.html)
- `[B]` Strength: best-in-class real-time collaboration and cross-app linking (see §2). Structural limit for this project's niche: files are cloud objects, not files on disk; Office files are edited in a compatibility mode; offline is opt-in per browser/device — [Google Docs Editors Help](https://support.google.com/docs/answer/6388102)

**Apple iWork / Creator Studio**
- `[S]` Apple Creator Studio launched 28 January 2026 at USD 12.99/month or USD 129/year, bundling Final Cut Pro, Logic Pro, Pixelmator Pro, Motion, Compressor and MainStage plus "premium content and intelligent features" in Keynote, Pages and Numbers; Freeform to follow — [Apple Newsroom](https://www.apple.com/newsroom/2026/01/introducing-apple-creator-studio-an-inspiring-collection-of-creative-apps/)
- `[S]` Pages/Numbers/Keynote 15 became freemium: core create/edit/collaborate stays free; premium templates/themes and AI features (e.g. Keynote "Draft Presentation") need the subscription. Keynote shows a persistent Creator Studio promotion in the format sidebar — [TidBITS](https://tidbits.com/2026/02/06/pages-keynote-and-numbers-15-go-freemium/), [Six Colors](https://sixcolors.com/post/2026/01/apples-pro-bundle-makes-sense-but-making-iwork-freemium-doesnt/), [The Register](https://www.theregister.com/2026/02/11/apple_ads_creator_studio/)
- `[S]` Mac App Store ratings reportedly fell after the update: Pages 4.6 to 2.5, Keynote 4.7 to 2.1, Numbers 4.6 to 2.1 (TidBITS notes this reflects the most engaged users) — [TidBITS](https://tidbits.com/2026/02/06/pages-keynote-and-numbers-15-go-freemium/), [TechIssuesToday](https://techissuestoday.com/macos-users-review-bomb-keynote-pages-numbers-creator-studio-ads)
- `[S]` The old iWork apps (ending at 14.5) were retired around April 2026; commentators see the "iWork" brand disappearing — [AppleInsider](https://appleinsider.com/articles/26/04/13/old-iwork-apps-are-now-gone-creator-studio-iwork-apps-are-still-free), [TechRadar](https://www.techradar.com/pro/farewell-apple-iwork-iconic-brand-appears-to-be-disappearing-in-favor-of-creator-studio)

**WPS Office**
- `[B]` WPS is the closest existing product to the owner's concept: one window, tabs mixing Writer/Spreadsheet/Presentation/PDF, on Windows/Android/iOS/macOS/Linux — [WPS](https://www.wps.com/)
- `[S]` WPS's own privacy policy says it collects information about ads served/viewed/clicked; ads fund the free tier and removing them on mobile requires Premium — [WPS privacy policy](https://www.wps.com/privacy-policy-new/)
- `[S]` An AI-training clause in WPS's terms drew a backlash and was later removed (date not confirmed in the source); a 2022 incident saw a user's document locked for "prohibited content" — [That's Shanghai](https://www.thatsmags.com/shanghai/post/36775/wps-office-faces-backlash-over-ai-training-privacy-concerns)
- `[S]` After a 2026 backlash over fee increases and reduced free features, Kingsoft stated basic functions would stay free permanently (secondary, German-language source) — [BornCity](https://borncity.com/news/wps-office-kingsoft-verspricht-kostenlose-basisfunktionen-dauerhaft/)

**ONLYOFFICE**
- `[S]` Desktop Editors 9.0 (June 2025) brought a redesigned interface and start window, a Diagram (Visio) viewer and AI tools; PDF editor gained page reorder/duplicate — [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2025/06/meet-onlyoffice-desktop-editors-v9-0), [OMG Ubuntu](https://www.omgubuntu.co.uk/2025/06/onlyoffice-9-0-desktop-new-features-ai/amp)
- `[S]` 9.1 (October 2025) added PDF redaction and crash recovery of unsaved documents; 9.3 (February 2026) added editing of password-protected PDFs, multi-page view and macro recording in the PDF editor — [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2025/10/meet-onlyoffice-desktop-editors-9-1), [OMG Ubuntu](https://www.omgubuntu.co.uk/2026/02/onlyoffice-9-3-desktop-editors-released)
- `[B]` ONLYOFFICE Desktop is already a tabbed docx/xlsx/pptx/pdf editor on plain local files with no account; it has no Markdown-notes layer, no cross-file links/backlinks, no vault search — [ONLYOFFICE Desktop](https://www.onlyoffice.com/desktop.aspx)

**LibreOffice / Collabora**
- `[S]` Collabora launched a new standalone offline "Collabora Office" desktop app (Linux/Windows/macOS) in November 2025 using the Collabora Online web front-end (JS/CSS/Canvas/WebGL) instead of LibreOffice's VCL UI; the older product became "Collabora Office Classic". It drops Base, can run but not edit macros, and removes the Java dependency — [Collabora press release](https://www.collaboraonline.com/blog/press-release-bringing-collabora-online-to-the-desktop/), [It's FOSS](https://itsfoss.com/news/collabora-launches-desktop-office-suite/), [Linuxiac](https://linuxiac.com/collabora-office-brings-its-online-ui-to-the-desktop-on-linux-windows-and-macos/)
- `[S]` The standing complaint about LibreOffice is a dated UI: a Fedora thread proposed replacing it with Collabora Office because of its "very ancient" UI; defenders prefer classic menus to ribbons; an HN commenter called Collabora's web-UI lag "unacceptable" — [Fedora Discussion](https://discussion.fedoraproject.org/t/suggestion-retire-libreoffice-ship-collabora-as-the-default-office-suite-out-of-the-box/202428), [Phoronix](https://www.phoronix.com/news/fedora-discuss-collabora-office), [HN mirror](https://alt-hn.vercel.app/item/46899591)

**Notion, Obsidian, and the notes/"workspace" tools**
- `[S]` Notion shipped offline mode around August 2025, but pages must be marked for offline per device; forum users report lost blocks on offline/online transitions and mobile battery/crash issues — [Android Authority](https://www.androidauthority.com/notion-offline-mode-vs-obsidian-3590238), [Latenode community](https://community.latenode.com/t/notion-just-released-offline-functionality-whats-everyone-thinking/39156)
- `[S]` Recurring Notion complaints: slow loads on large databases and lock-in (proprietary database structure exports poorly; export limited to CSV/Markdown/PDF) — [G2 Learn](https://learn.g2.com/obsidian-vs-notion), [Dave Rupert, "Notion to Obsidian"](https://daverupert.com/2025/05/notion-to-obsidian/), [Thurrott "Quest for a Notion replacement"](https://www.thurrott.com/?p=336474)
- `[S]` Obsidian added **Bases** as a core plugin in v1.9.0 (21 May 2025): database-style views over notes with data kept in local Markdown + YAML properties and a new `.base` file; later 2025 releases added `file.backlinks`, grouping, a Bases API, list view, summaries and a Maps plugin; Properties became enabled by default in v1.10.3 (11 November 2025) — [Obsidian changelog 1.9.0](https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0), [1.10.0](https://obsidian.md/changelog/2025-10-01-desktop-v1.10.0/), [1.10.3](https://obsidian.md/changelog/2025-11-11-desktop-v1.10.3/)
- `[B]` Obsidian treats .docx/.xlsx/.pptx as opaque attachments (opened in the OS default app); it cannot edit them — this is the precise hole the planned app fills from the notes side — [Obsidian Help: accepted file formats](https://help.obsidian.md/file-formats)
- `[B]` Anytype, AFFiNE and AppFlowy are local-first/open-source Notion alternatives, but all keep content in their own object stores (not ordinary user-visible files); Craft, Coda, Tana, Capacities are cloud-first with proprietary models — [Anytype](https://anytype.io/), [AFFiNE](https://affine.pro/), [AppFlowy](https://appflowy.com/), [Craft](https://www.craft.do/), [Coda](https://coda.io/), [Tana](https://tana.inc/), [Capacities](https://capacities.io/)

**Proton, Zoho**
- `[S]` Proton Sheets launched 4 December 2025 (Proton Docs: July 2024): end-to-end-encrypted, web-based (and inside the Proton Drive app), imports CSV/XLS(X), real-time collaboration; reviewers note missing advanced features and anecdotal conditional-formatting/mobile-loading problems on import — [MacRumors](https://www.macrumors.com/2025/12/04/proton-sheets-launches-encrypted-spreadsheet/), [Engadget](https://www.engadget.com/apps/proton-sheets-joins-the-companys-productivity-suite-110000344.html), [devproblems review](https://www.devproblems.com/proton-sheets-review/)
- `[B]` Zoho Workplace (Writer/Sheet/Show) is a capable cloud suite with a free personal tier; like Google it is cloud-document-first rather than file-first — [Zoho Workplace](https://www.zoho.com/workplace/)

**PDF tools**
- `[S]` Acrobat users on Adobe's own forum and G2 cite the AI Assistant as "the final straw", installer growth (offline installer reported at almost 700 MB, +400 MB in a year), subscription cost, cancellation fees and lag on large files; threads literally request "a bare bones Acrobat" — [Adobe Community](https://community.adobe.com/questions-12/can-we-have-a-bare-bones-acrobat-please-dump-the-bloat-and-ai-junk-1506799), [Adobe Community 2](https://community.adobe.com/questions-9/bloated-inefficient-product-cancelling-subscription-1300380), [G2 reviews](https://g2.com/products/adobe-acrobat/reviews?page=2)
- `[S]` Free/alternative tools reviewers recommend: PDFgear (free editing/OCR/conversion; OCR outputs plain text rather than a rebuilt editable PDF), Stirling-PDF (open-source, self-hosted), PDF24, SumatraPDF (light reader) — [Lifehacker Japan](https://www.lifehacker.jp/article/2608-adobes-pdf-features-powerful-but-mostonly-need-whats-already-free/), [roundup (blog, unverified methodology)](https://gauravtiwari.org/adobe-acrobat-alternatives/)
- `[B]` PDF Expert (Apple platforms), Foxit and UPDF are paid/subscription editors; UPDF markets heavily on AI — [PDF Expert](https://pdfexpert.com/), [Foxit](https://www.foxit.com/), [UPDF](https://updf.com/)

### Inferences
- The owner's pain list checks out against 2025-2026 evidence for: subscriptions (M365, Creator Studio, Acrobat), forced AI (M365, Acrobat, Workspace), ads/upsell (WPS, Keynote sidebar), bloat (Acrobat), poor/fragmented mobile editing (Copilot app losing editing), format/data lock-in (Notion). "Ribbon complexity" is contested: a vocal group *prefers* ribbons, another prefers classic menus; the defensible claim is "fewer visible controls plus a command palette", not "ribbons are bad".
- Microsoft's removal of in-app editing from its unified mobile app is the single strongest piece of evidence that "one app, every format, on the phone" is an *abandoned* position rather than a crowded one. It is also a warning: Microsoft, with unlimited resources, decided unified mobile editing was not worth maintaining.
- No surveyed product combines (a) real Office/PDF file editing, (b) plain files on disk with no account, and (c) a notes-style link/backlink/search layer. WPS and ONLYOFFICE have (a)+(b); Obsidian has (b)+(c).
- Apple's freemium turn weakens the old "iWork is the free, beautiful, no-nag suite" benchmark and makes "no upsell, ever" a claim users currently notice.

### Gaps
- No Reddit threads were retrieved (search returned press/forum coverage instead), so r/Office365, r/ObsidianMD, r/Notion, r/libreoffice sentiment is unverified here.
- A Microsoft blog titled "Introducing Office in the new Microsoft Copilot app" (2026) appeared in results but could not be opened; it may change the mobile-editing picture — [Tech Community](https://techcommunity.microsoft.com/blog/microsoft-copilot-blog/introducing-office-in-the-new-microsoft-copilot-app/4561230). Verify before asserting the Copilot app still cannot edit.
- No published survey data (percentages of users citing each pain) was found; all pain themes are qualitative.
- No usable evidence found for: ONLYOFFICE/Collabora mobile app review themes, Craft/Coda/Anytype/AFFiNE/AppFlowy 2026 state, Foxit/UPDF/PDF Expert complaints, startup-time benchmarks, mobile "all document reader" apps (background impression only: ad-heavy viewers; unverified).
- Creator Studio terms are from January-April 2026 sources; November 2026 state unconfirmed.

---

## 2. "Interconnected" features in the market: how each works and how users value it

### Takeaway
There are two distinct families: *notes-world* linking (wikilinks, backlinks, transclusion, properties, graph), which works well on plain files, and *office-world* linking (OLE/paste-link, Loop components, Google linked objects), which either breaks when files move or only works inside one vendor's cloud. Nobody bridges the two across ordinary docx/xlsx/pptx/pdf files.

### Cited Findings

**Notes-world**
- `[B]` Obsidian: `[[wikilinks]]`, links to headings (`[[note#Heading]]`) and blocks (`[[note#^id]]`), embeds/transclusion with `![[...]]` including `![[file.pdf#page=3]]`, an automatic backlinks pane with unlinked mentions, graph view; all derived from plain Markdown text by a local index — [Obsidian Help: internal links](https://help.obsidian.md/links), [embeds](https://help.obsidian.md/embeds), [backlinks](https://help.obsidian.md/plugins/backlinks)
- `[B]` Roam Research and Logseq popularised block-level references and bidirectional links; Logseq keeps Markdown/Org files (its newer DB version moves to SQLite) — [Logseq](https://logseq.com/), [Roam](https://roamresearch.com/)
- `[S]` Obsidian Bases show the "database over files" pattern: views/filters/formulas computed from YAML properties, including a `file.backlinks` property — [Obsidian changelog](https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0)
- `[B]` Notion/Coda/Anytype relations, rollups and typed objects (Tana supertags, Capacities object types) are valued for structured cross-referencing but depend on a proprietary object store — [Notion relations](https://www.notion.com/help/relations-and-rollups), [Tana](https://tana.inc/), [Capacities](https://capacities.io/)
- `[B]` Canvas tools (Heptabase, Scrintal, Kosmik, Obsidian Canvas, Apple Freeform) place cards/files spatially; Obsidian's JSON Canvas is an open file format — [JSON Canvas](https://jsoncanvas.org/), [Heptabase](https://heptabase.com/), [Kosmik](https://www.kosmik.app/)
- `[B]` Graph view is widely regarded as more attractive than useful; backlinks and unlinked mentions are the features users report relying on (qualitative community consensus, not measured) — [Obsidian Help: graph view](https://help.obsidian.md/plugins/graph)

**PDF-centric linking**
- `[S]` Obsidian PDF++ turns backlinks to a PDF into highlights: linking to a text selection *is* annotating; the backlinks pane can filter to the current page; hovering a backlink highlights the passage; it can optionally write real annotations into the PDF so they show in other readers. The author warns it relies on private Obsidian APIs and may break — [GitHub: obsidian-pdf-plus](https://www.github.com/RyotaUshio/obsidian-pdf-plus), [Obsidian community plugins](https://community.obsidian.md/plugins/pdf-plus)
- `[S]` A long-running Obsidian forum request asks for PDF highlighting/annotation as a core feature — [Obsidian Forum](https://forum.obsidian.md/t/highlighting-annotation-of-pdfs-as-a-core-feature-of-obsidian-annotate/31015?page=5)
- `[S]` Zotero deep links take the form `zotero://open-pdf/library/items/<KEY>?page=9&annotation=<KEY>`; dragging a highlight into a note produces a link back to the exact annotation, but behaviour is inconsistent for note-type annotations and users report links doing nothing on some Windows setups — [Zotero Forums](https://forums.zotero.org/discussion/91778/pdf-reader-new-note-editor-automatically-generate-zotero-url-to-currently-selected-annotation), [Zotero Forums 2](https://forums.zotero.org/discussion/91335/beta-pdf-reader-bug-was-uri-for-location-in-pdf)
- `[B]` LiquidText and MarginNote pull excerpts into a workspace/mind-map where each excerpt stays linked to its source location; both keep the links in proprietary project files — [LiquidText](https://www.liquidtext.net/), [MarginNote](https://www.marginnote.com/)

**Office-world**
- `[S]` Word/PowerPoint "Paste Link" (OLE LINK fields) stores an **absolute path** to the Excel file: the Word file can move but the workbook cannot; renaming/moving the source breaks the link — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5073368/linking-excel-to-word-my-excel-link-source-name-ke), [Microsoft Support: update or remove a broken link](https://support.microsoft.com/en-us/powerpoint/update-or-remove-a-broken-link-to-an-external-file)
- `[S]` Users report that OneDrive/SharePoint storage rewrites link paths into GUID-like https addresses that then fail, and that mapped-drive differences break links (user reports, not an official statement) — [Tech Community thread](https://techcommunity.microsoft.com/discussions/microsoft-365/links-between-excel-and-powerpoint-dont-work-anymore/4387002), [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5164910/word-breaks-excel-links-on-save)
- `[B]` Loop components are Fluid Framework containers stored as `.loop` files in OneDrive/SharePoint and rendered live inside Teams, Outlook, Word for the web, etc.; they require Microsoft 365 accounts and cloud storage. Fluid Framework itself is open source — [Fluid Framework](https://fluidframework.com/), [Microsoft Learn: Loop storage](https://learn.microsoft.com/microsoft-365/loop/loop-compliance-summary)
- `[S]` Google "linked objects": charts/tables from Sheets (and slides) pasted into Docs/Slides keep a link; a Linked objects sidebar shows an Update button per object plus "Update all" — i.e. refresh is manual and explicit — [9to5Google (2020 rollout coverage)](https://9to5google.com/?p=291886), [Google Docs Editors Help](https://support.google.com/docs/answer/7009814)
- `[S]` Google smart chips (people, files, dates, places, finance, dropdowns, timers, third-party) give hover previews of linked Drive files without switching apps — [Google blog](https://blog.google/products/workspace/google-workspace-features/), [Workspace Updates](https://workspaceupdates.googleblog.com/2021/05/smartchips-for-files-and-meetings-checklists-in-docs.html)

**Finding things**
- `[B]` Universal search/launcher tools (Raycast, Spotlight, Windows Search, Everything) find files by name and some content; Windows Recall and the Rewind/Limitless lineage index screen history instead of files. Open-source content search across formats exists: ripgrep-all (`rga`) searches PDFs/Office docs via adapters; DocFetcher and Recoll index Office/PDF content — [ripgrep-all](https://github.com/phiresky/ripgrep-all), [DocFetcher](https://docfetcher.sourceforge.io/), [Recoll](https://www.recoll.org/), [Raycast](https://www.raycast.com/), [Microsoft: Recall](https://support.microsoft.com/windows/retrace-your-steps-with-recall-aa03f8a0-a78b-4b3e-b0a1-2eb8ac48701c)
- `[B]` PARA (Tiago Forte) and Johnny.Decimal are folder-naming conventions, not software; both work on any file system and suggest users want lightweight structure over files rather than a database — [PARA](https://fortelabs.com/blog/para/), [Johnny.Decimal](https://johnnydecimal.com/)

**Philosophy**
- `[B]` Steph Ango's "File over app" (2023) argues durable digital artefacts must be files the user controls in easily readable formats, because apps are ephemeral — [stephango.com](https://stephango.com/file-over-app)
- `[B]` Ink & Switch: "Local-first software" (2019) sets seven ideals (fast, multi-device, offline, collaboration, longevity, privacy, user control); "Potluck" (2022) shows gradually enriching plain text notes with live computations; "Embark" (2023) embeds live data views in an outline; "Malleable software" (2025) argues for user-reshapeable tools — [Local-first](https://www.inkandswitch.com/local-first/), [Potluck](https://www.inkandswitch.com/potluck/), [Embark](https://www.inkandswitch.com/embark/), [Malleable software](https://www.inkandswitch.com/essay/malleable-software/)

### Inferences
- OLE's failure mode is specific and fixable: absolute paths plus no index. A link that stores a *relative path + stable anchor (named range / bookmark / chart name) + a cached snapshot* and is repaired by an index when files move would be strictly better for a single user.
- Google's model (explicit "Update" button, never silent auto-refresh) is the right UX precedent: users see when a pasted chart is stale and choose to refresh.
- PDF++ proves the "backlink = highlight" idea is loved and technically viable on pdf.js, and that depending on another app's private APIs is its main weakness — an app that owns its PDF viewer avoids that.
- Loop/Fluid-style live components are a collaboration feature; for a single-user app the equivalent is "linked copy with refresh", which needs no CRDT.

### Gaps
- LiquidText/MarginNote/Heptabase/Scrintal/Kosmik/Tana/Capacities details are background only; no 2026 reviews retrieved.
- No quantitative evidence of how much users value backlinks vs graph view.
- Current (2026) Google linked-object limits and smart-chip changes not confirmed (help page blocked).
- Raycast for Windows status and Recall's 2026 state not verified in this session.

---

## 3. Which interconnection features can live on top of ORDINARY FILES

### Takeaway
Almost all of it can, using a three-layer design: (1) standard in-file constructs wherever the format has one, so links/tags survive in other apps; (2) a rebuildable local index (SQLite) for backlinks and search; (3) small sidecar files only for things no format can hold. Extended attributes / NTFS streams are the one mechanism to avoid — they do not survive cloud sync.

### Cited Findings

**In-file, standards-based anchors (portable, visible to other apps)**
- `[B]` DOCX: bookmarks (`w:bookmarkStart`) are link targets; hyperlinks can point to `file.docx#BookmarkName`; headings are addressable — [ECMA-376 / Office Open XML](https://ecma-international.org/publications-and-standards/standards/ecma-376/), [Microsoft Support (search "Add hyperlinks to a location within the same document")](https://support.microsoft.com/word)
- `[B]` XLSX: defined names (named ranges) and tables are stable anchors that survive row/column insertion; hyperlinks accept `Book.xlsx#Sheet1!A1` or `#MyRange` — [Microsoft Support: HYPERLINK function](https://support.microsoft.com/office/hyperlink-function-333c7ce6-c5ae-4164-9c47-7de9b76f577f)
- `[B]` PPTX: slide-to-slide jump actions and hyperlinks to other files are part of the format; slides have persistent internal IDs distinct from position — [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- `[B]` PDF: links can target `#page=N` or `#nameddest=Name` (Adobe "PDF open parameters"); named destinations and link annotations are standard; support for open parameters varies by viewer — [Adobe PDF Open Parameters](https://pdfobject.com/pdf/pdf_open_parameters_acro8.pdf), [ISO 32000 overview at PDF Association](https://pdfa.org/resource/iso-32000-pdf/)
- `[B]` Standard highlight/note annotations written into a PDF are visible in every reader (unlike app-private highlights) — see `pdf-stack.md` §5; [PDF Association](https://pdfa.org/)

**Where tags/properties can be stored, and portability**
- `[B]` Markdown: YAML front matter — de facto standard (Obsidian, Jekyll, Hugo, Pandoc); plain text, survives every sync service — [Obsidian Help: properties](https://help.obsidian.md/properties)
- `[B]` OOXML: `docProps/core.xml` holds title, subject, keywords, category; `docProps/custom.xml` holds arbitrary typed custom properties; both travel inside the zip, so they survive OneDrive/Android/iOS copies; Windows Explorer surfaces Office keywords as "Tags" — [Microsoft Learn: Open XML SDK custom properties](https://learn.microsoft.com/office/open-xml/word/how-to-set-a-custom-property-in-a-word-processing-document)
- `[B]` PDF: Info dictionary Keywords and XMP metadata (`dc:subject`, custom namespaces) travel inside the file — [Adobe XMP](https://www.adobe.com/devnet/xmp.html)
- `[B]` CSV, plain text and code have no metadata container; tags need a sidecar or the index (CSV comment headers are non-standard and break parsers) — [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180)
- `[S]` Extended attributes / NTFS alternate data streams are **not portable**: an Eclectic Light survey lists OneDrive, Google Drive and Box as not preserving extended attributes; iCloud strips xattrs by default unless flagged; Syncthing/Resilio need explicit whitelisting — [Eclectic Light 2018](https://eclecticlight.co/2018/01/12/which-file-systems-and-cloud-services-preserve-extended-attributes/), [Eclectic Light 2023](https://eclecticlight.co/2023/07/21/icloud-drive-changes-extended-attributes/), [Resilio](https://help.resilio.com/hc/en-us/articles/204754729), [Syncthing forum](https://forum.syncthing.net/t/rfc-syncing-extended-attributes/18452/9)
- `[S]` OneDrive can raise spurious conflicts when only embedded metadata (e.g. photo tags) changes — a caution for apps that rewrite a file just to add a tag — [Tech Community](https://techcommunity.microsoft.com/discussions/onedriveforbusiness/how-can-i-force-onedrive-to-accept-metadata-for-images-and-photos-11/4015930/replies/4016011)

**Index, sidecars, deep links**
- `[B]` Precedent for "index is a cache, files are truth": Obsidian's metadata cache and `.obsidian/` folder; `.base` and `.canvas` files are small sidecar-style JSON/YAML documents stored next to notes — [Obsidian Help: how Obsidian stores data](https://help.obsidian.md/data-storage), [JSON Canvas](https://jsoncanvas.org/)
- `[B]` Precedent for sidecar metadata: XMP sidecar files (`photo.xmp`) used by Adobe and darktable; Zotero keeps PDF annotations in its database and only writes them into the PDF on export — [darktable manual: sidecar files](https://docs.darktable.org/usermanual/development/en/overview/sidecar-files/), [Zotero docs: PDF reader](https://www.zotero.org/support/pdf_reader)
- `[B]` Custom URI schemes for file+location deep links are established: `obsidian://open?vault=…&file=…`, `zotero://open-pdf/…?page=`, Office URI schemes (`ms-word:ofe|u|<url>`), and Hookmark on macOS (links to files/locations across apps) — [Obsidian URI](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI), [Office URI schemes](https://learn.microsoft.com/office/client-developer/office-uri-schemes), [Hookmark](https://hookproductivity.com/)
- `[S]` Zotero's own URI links sometimes fail to launch on Windows/Edge — custom schemes are convenient but OS/browser handling is a known weak point — [Zotero Forums](https://forums.zotero.org/discussion/88586/unable-to-open-zotero-link-to-pdf-with-page-number-in-microsoft-edge-chromium)

### Inferences
Feasibility matrix (researcher's assessment, not sourced):

| Feature | Mechanism on ordinary files | Portable to other apps? | Difficulty |
|---|---|---|---|
| Link from a note to a file | relative Markdown link / wikilink | Yes | Low |
| Link to a location (heading, bookmark, named range, slide, PDF page) | relative path + fragment (`#Bookmark`, `#Sheet!Range`, `#slide=id`, `#page=N`) | Partly (Office and PDF fragments work in native apps; slide fragment is app-specific) | Low-medium |
| Link to an exact PDF passage | page + quad coordinates + quoted text in the link; optionally a real PDF highlight | Highlight yes; coordinate link no | Medium |
| Backlinks across all formats | index every hyperlink found in md/docx/xlsx/pptx/pdf at save/scan time | Derived; rebuildable | Medium (extraction per format) |
| Unified tags/properties | front matter (md), docProps (OOXML), XMP/Keywords (pdf), index-only or sidecar for csv/txt/code | Yes except csv/txt/code | Medium |
| Live preview of a sheet range/chart/PDF page/slide inside a Markdown note | embed syntax (`![[book.xlsx#Range]]`) rendered by the app; other Markdown apps show a plain link | Degrades gracefully | Medium-high (depends on engine render-to-image APIs) |
| "Linked copy" of a chart/table in a docx/pptx that refreshes | insert as image/table + store source (relative path, anchor, hash, timestamp) in a custom XML part or alt-text/custom property; "Update" button à la Google | Content yes (it is a normal picture/table); refresh only in this app | High |
| Full-text search across formats | local SQLite FTS index with per-format text extractors | n/a | Medium |
| File moves/renames keep links | watcher + index rewrites relative links; file content hash as fallback identity | n/a | Medium-high (moves made outside the app, on mobile, are the hard case) |

- Mobile is the constraint: on Android (Storage Access Framework) and iOS (file provider/security-scoped bookmarks) the app cannot freely watch a folder tree, sidecar "dot-folders" may be hidden or not granted, and xattrs are unavailable; so in-file metadata plus a per-device rebuildable index is the only approach that works on all four platforms. (Background assessment; [Android SAF docs](https://developer.android.com/guide/topics/providers/document-provider).)
- Writing tags into docx/pdf modifies the file (changing hashes/modified-time and potentially triggering sync conflicts), so tag edits should be batched with normal saves or kept index-only by user choice.

### Gaps
- No test evidence on whether OneDrive/Google Drive mobile clients preserve OOXML custom properties and XMP (expected yes, since they are inside the file bytes; untested).
- Whether the chosen embedded engines (ONLYOFFICE etc.) preserve unknown custom XML parts and custom properties on round-trip is unverified and is the key technical risk for "linked copies" — see `office-suite-engines.md`.
- No authoritative source found on Android xattr behaviour.

---

## 4. User actions and workflow features praised elsewhere but absent from office suites

### Takeaway
The praised interaction patterns come from code editors and notes apps (palette, quick switcher, split panes, multi-file search, capture, diff). Each has an existing implementation to copy; what is missing is anyone applying them to Office/PDF files. Visual diff of office files is feasible with open-source parts for docx, weaker for xlsx/pptx.

### Cited Findings
- `[B]` Command palettes and quick-open (VS Code, Obsidian, Linear, Raycast) and slash commands (Notion) are the standard "search the commands" patterns; Office's nearest equivalent is the Tell Me/Search box — [VS Code UI docs](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette), [Obsidian command palette](https://help.obsidian.md/plugins/command-palette); details in `ux-ui-design.md` §4
- `[B]` Quick capture / global-hotkey note: Raycast floating notes, Obsidian daily notes + QuickAdd plugin, Things "Quick Entry", Windows Sticky Notes — [Raycast Notes](https://www.raycast.com/core-features/notes), [Things support (Quick Entry)](https://culturedcode.com/things/support/)
- `[B]` Templates with variables: Obsidian Templates/Templater; Word content controls/mail-merge are the office-world equivalents — [Obsidian Templates](https://help.obsidian.md/plugins/templates), [Templater](https://github.com/SilentVoid13/Templater)
- `[B]` Multi-file find/replace exists for text (VS Code, ripgrep) and search-only across Office/PDF (ripgrep-all, DocFetcher); no mainstream consumer tool offers find-and-replace across a folder of docx/xlsx/pptx — [ripgrep-all](https://github.com/phiresky/ripgrep-all), [DocFetcher](https://docfetcher.sourceforge.io/)
- `[S]` Batch PDF operations (merge/split/convert/OCR) are the core of the free tools reviewers recommend (PDFgear, PDF24, Stirling-PDF) — [Lifehacker Japan](https://www.lifehacker.jp/article/2608-adobes-pdf-features-powerful-but-mostonly-need-whats-already-free/), [roundup](https://gauravtiwari.org/adobe-acrobat-alternatives/)
- `[B]` "Open as another representation": Markdown as slides (Obsidian Slides, Marp, iA Presenter), CSV as table or text (VS Code extensions, Obsidian Bases-style views), document as outline (Word Navigation Pane/Outline view) — [Marp](https://marp.app/), [iA Presenter](https://ia.net/presenter), [Obsidian Slides](https://help.obsidian.md/plugins/slides)
- `[B]` Focus/typewriter/reading modes are signature features of iA Writer and Bear; Word has Focus and Immersive Reader — [iA Writer focus mode](https://ia.net/writer/support/editor/focus-mode); details in `ux-ui-design.md` §7

**Version history and diff of office files**
- `[S]` Docxodus: MIT-licensed fork of Open-Xml-PowerTools on .NET 8; compares two .docx files and outputs a redline with native Word tracked changes, with move detection; available as NuGet, CLI (`redline a.docx b.docx out.docx`), Python bindings (Python-Redlines) and a client-side WebAssembly/npm build (verify the npm package before relying on it) — [Docxodus on GitHub](https://github.com/JSv4/Docxodus/wiki), [NuGet](https://packages.nuget.org/packages/Docxodus), [Python-Redlines](https://raw.githubusercontent.com/JSv4/Python-Redlines/e639de87c5d70919577c89ab7a8b1d4fb697a599/README.md)
- `[S]` The original Open-Xml-PowerTools was archived by Microsoft; commercial SDKs (Apryse) and web services (Diffchecker, ConvertAPI) also produce docx redlines — [Apryse](https://docs.apryse.com/core/guides/compare-docx), [Diffchecker](https://www.diffchecker.com/docs/document/redline/), [Microsoft archive blog on Open XML diff tools](https://learn.microsoft.com/en-us/archive/blogs/dmahugh/open-xml-diff-tools)
- `[S]` xltrail is described as a Git extension showing changes in cells and VBA without Excel add-ins (via StackShare; popularity figures inconsistent) — [StackShare](https://stackshare.io/xltrail/integrations)
- `[B]` Other building blocks: git-xl (open-source Git diff/merge driver for Excel VBA), Microsoft Spreadsheet Compare (ships only with some Office Professional Plus/365 Apps editions), LibreOffice/Word/ONLYOFFICE built-in "Compare documents", Draftable (commercial side-by-side docx/pptx/pdf compare with an offline desktop version), diff-pdf (open source visual PDF diff), and `git diff` textconv drivers using pandoc to diff docx as text — [git-xl](https://www.xltrail.com/git-xl), [Spreadsheet Compare](https://support.microsoft.com/office/overview-of-spreadsheet-compare-13fafa61-62aa-451b-8674-242ce5f2c986), [Draftable](https://www.draftable.com/), [diff-pdf](https://github.com/vslavik/diff-pdf), [ONLYOFFICE compare](https://helpcenter.onlyoffice.com/onlyoffice-editors/onlyoffice-document-editor/usageinstructions/comparison.aspx), [Pandoc](https://pandoc.org/)
- `[S]` ONLYOFFICE 9.1 added automatic recovery of unsaved documents after crashes — i.e. safety nets, not history, are what suites ship locally — [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2025/10/meet-onlyoffice-desktop-editors-9-1)

### Inferences
- Local, automatic version history for *every* file type (snapshots on save in a hidden store, browsable timeline) is something no local office suite does; cloud suites do it only for cloud files. Snapshotting is easy; *visual diff* is format-dependent: docx (good, via Docxodus-style redline or engine compare), text/md/csv/code (trivial), xlsx (cell-level diff is buildable from parsed values/formulas), pptx and pdf (slide/page thumbnails side-by-side plus extracted-text diff is the realistic level).
- Split view of two different formats is cheap in a tabbed shell and immediately demonstrates the "one app" value (PDF beside notes; spreadsheet beside the report). True *synced scrolling* is only meaningful for same-content pairs (Markdown source/preview, two versions of one file).
- "Drag a table from a spreadsheet into a document" depends on clipboard/drag interop between two embedded engine instances; HTML-table clipboard format is the realistic bridge, with formatting loss.
- Optional local AI should be an add-on, off by default: the market evidence in §1 is that *forced* AI is the complaint, not AI itself.

### Gaps
- xlsx/pptx diff tooling was not well surfaced by search; xltrail/git-xl details are thin and should be verified.
- No evidence gathered on how many users actually want version diff for office files (the demand is inferred from the existence of commercial tools like Draftable).
- Docxodus WASM bundle size/performance inside an Electron/Tauri app is untested.

---

## 5. Design quality: who is regarded as best-designed, and what "better than Office" concretely means

### Takeaway
The apps repeatedly held up as best-designed (Linear, Things, Craft, Bear, iA Writer, Raycast, Notion, Figma, Apple's pre-2026 iWork) share traits that are about restraint and speed rather than visuals. 2025-2026 platform awards skewed toward AI and non-productivity apps, so they offer little direct guidance; the notable productivity-adjacent winner is Goodnotes (large screens).

### Cited Findings
- `[S]` Apple Design Awards 2026 (announced 2 June 2026) app winners: grug (Delight and Fun), Guitar Wiz (Inclusivity), NBA (Innovation), Moonlitt (Interaction), Primary: News in Depth (Social Impact), Tide Guide (Visuals and Graphics) — no office/productivity suite among them — [Apple Newsroom](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/), [9to5Mac](https://9to5mac.com/2026/06/02/apple-reveals-apple-design-awards-app-and-game-winners-for-2026/)
- `[B]` Apple Design Awards 2025 app winners: CapWords, Speechify, Play, Taobao, Watch Duty, Feather: Draw in 3D — again none in the document-productivity category — [Apple Newsroom 2025](https://www.apple.com/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/)
- `[S]` Google Play Best of 2025: Focus Friend (Best App, Best for Personal Growth), Luminar (Best Multi-device), **Goodnotes: Notes, docs, PDF (Best for Large Screens**, cited for an adaptable interface for big displays) — [Google blog](https://blog.google/products/google-play/best-apps-games-2025/), [TechRadar](https://www.techradar.com/phones/these-are-the-10-best-android-apps-of-the-year-according-to-google)
- `[S]` Microsoft Store Awards 2025 were AI-heavy (Perplexity/ChatGPT tie for AI Assistants, Manus for computer-using agents, ngrok for developer tools) and dropped community voting; press called the list unimpressive — [Windows blog](https://blogs.windows.com/windowsdeveloper/2025/12/03/announcing-the-microsoft-store-awards-2025-winners/), [Windows Central](https://www.windowscentral.com/software-apps/microsoft-store-awards-2025-lean-heavily-on-ai-and-community-voting-ditched)
- `[B]` Traits commonly credited to the admired apps: keyboard-first with a command palette and instant response (Linear, Raycast); few visible controls, contextual inspectors rather than permanent toolbars (iWork, Craft, Things); one typeface and a restrained palette with careful spacing (iA Writer, Bear, Things); content-first canvas; consistent native feel per platform; no nags — [Linear Method](https://linear.app/method), [Things](https://culturedcode.com/things/), [iA Writer](https://ia.net/writer), [Raycast](https://www.raycast.com/); fuller treatment in `ux-ui-design.md` §2, §7, §12
- `[S]` Counter-evidence on "simpler is always better": Collabora's new web-tech desktop UI drew complaints about lag and missing power features, and some LibreOffice users defend dense classic menus — [HN mirror](https://alt-hn.vercel.app/item/46899591), [Fedora Discussion](https://discussion.fedoraproject.org/t/suggestion-retire-libreoffice-ship-collabora-as-the-default-office-suite-out-of-the-box/202428)

### Inferences
"Better design than Office" can be made testable as:
1. One shell, one visual language, one shortcut scheme across all formats (Office has four apps with four ribbons).
2. Content first: a quiet default surface; formatting in a contextual side inspector; everything else via palette.
3. Perceived speed: file visible quickly, no splash, no sign-in, no "what's new" modal.
4. Zero upsell, zero ads, zero account, AI off unless asked — now a visible differentiator against M365, Keynote and WPS.
5. Files and locations are first-class: recent files, links, backlinks and search in the shell rather than in a cloud portal.

The honest caveat: the *editing surfaces themselves* will be embedded third-party engines whose chrome and behaviour the developer only partly controls (see `ux-ui-design.md` §6), so design leadership is achievable in the shell and workflows, not pixel-for-pixel inside the docx/xlsx/pptx canvases.

### Gaps
- No 2026 Google Play Best Of or Microsoft Store Awards results were found (2026 lists are typically published late November/December).
- No independent "best-designed productivity apps 2026" review roundup was retrieved; the trait list is background knowledge.
- Arc/Dia and Figma were not researched in this session.

---

## 6. Reality check: where incumbents are simply better

### Takeaway
A solo-built app should not claim parity on collaboration, AI, fidelity or mobile polish. It should position as a *personal workbench over your own files* that is complementary to Office/Google, and be explicit about what it will not do.

### Cited Findings
- `[B]` Real-time co-authoring, comments/mentions, sharing and permissions are mature in Microsoft 365 and Google Workspace and require server infrastructure — [Microsoft co-authoring](https://support.microsoft.com/office/document-collaboration-and-co-authoring-ee1509b4-1f6e-401e-b04a-782d26f564a4)
- `[S]` AI at scale is where incumbents are investing most (Copilot Chat folded into every commercial plan; Copilot Pages/Notebooks; Apple intelligent features in iWork; UPDF "10+ AI agents") — [The Register](https://www.theregister.com/2025/12/05/microsoft_365_prices_up_2026), [Microsoft Support](https://support.microsoft.com/en-US/Microsoft-365-Copilot/compare-microsoft-loop-copilot-pages-and-copilot-notebooks), [UPDF](https://updf.com/)
- `[B]` Native fidelity: only Word/Excel/PowerPoint render every feature of their own formats; third-party engines (ONLYOFFICE, LibreOffice/Collabora) have known gaps with SmartArt, complex charts, macros, pivot features, fonts — see `office-suite-engines.md`; [ONLYOFFICE](https://www.onlyoffice.com/), [LibreOffice feature comparison](https://wiki.documentfoundation.org/Feature_Comparison:_LibreOffice_-_Microsoft_Office)
- `[S]` Even reduced-scope engines trade power for simplicity: Collabora's new desktop app dropped Base and macro editing; Proton Sheets lacks advanced features — [It's FOSS](https://itsfoss.com/news/collabora-launches-desktop-office-suite/), [devproblems](https://www.devproblems.com/proton-sheets-review/)
- `[S]` Mobile is hard even for Microsoft, which withdrew editing from its unified mobile app; Notion's mobile offline mode drew crash/battery complaints — [Microsoft Support](https://support.microsoft.com/en-us/microsoft-365-copilot/understand-changes-to-microsoft-365-copilot-mobile-app), [Latenode community](https://community.latenode.com/t/notion-just-released-offline-functionality-whats-everyone-thinking/39156)
- `[S]` Depending on another product's internals is fragile even for a beloved plugin (PDF++ warns it may break on host updates) — [GitHub](https://www.github.com/RyotaUshio/obsidian-pdf-plus)
- `[B]` Enterprise compliance (DLP, retention, sensitivity labels, eDiscovery) is out of reach and irrelevant for a personal app — [Microsoft Purview](https://learn.microsoft.com/purview/)

### Inferences
Do NOT compete on: real-time collaboration; cloud AI copilots; enterprise admin/compliance; 100% fidelity with complex Office documents (macros, pivots, SmartArt, advanced animations); large-team mobile polish; Notion-style relational databases; a plugin ecosystem to rival Obsidian's.

Implications for honest positioning:
- Say "edits your real Office and PDF files well enough for everyday personal documents; for the hard 5% there is an 'Open in Word/Excel' button" — and build that escape hatch.
- Make round-trip safety a visible promise (never silently degrade a file; warn before saving a document with unsupported features; keep automatic local versions).
- Treat mobile as *view, annotate, light-edit, capture, search* first; full editing parity on a phone is where the largest vendor retreated.
- "Export anything to anything" should be stated as a tested matrix with fidelity grades, not an absolute.

### Gaps
- No measured fidelity comparison among engines in this note (see the engine-specific notes).
- No evidence on how single users rank "collaboration" vs "local files" — positioning is an inference.

---

## 7. Bottom line: ranked differentiators and positioning

### Takeaway
The credible differentiation is not a better word processor; it is the *layer between files* — one calm shell, links and backlinks that span formats, search over everything, safe local history, and frictionless conversion — delivered on ordinary files with no account, ads, subscription or forced AI.

### Cited Findings
(Evidence for each row is cited in §1-§6; the ranking itself is the researcher's inference.)
- `[S]` The unified-mobile-editing position was vacated by Microsoft in 2025 — [Microsoft Support](https://support.microsoft.com/en-us/microsoft-365-copilot/understand-changes-to-microsoft-365-copilot-mobile-app)
- `[S]` Forced AI, price rises and upsell are current, documented grievances against Microsoft, Apple, Adobe and WPS — [The Register](https://www.theregister.com/2025/02/07/microsoft_365_price_rises/), [TidBITS](https://tidbits.com/2026/02/06/pages-keynote-and-numbers-15-go-freemium/), [Adobe Community](https://community.adobe.com/questions-12/can-we-have-a-bare-bones-acrobat-please-dump-the-bloat-and-ai-junk-1506799), [WPS privacy policy](https://www.wps.com/privacy-policy-new/)
- `[S]` OLE links break because they store absolute paths; Google's linked objects use an explicit Update action — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5073368/linking-excel-to-word-my-excel-link-source-name-ke), [9to5Google](https://9to5google.com/?p=291886)
- `[S]` "Backlink = PDF highlight" and "database views over plain files" are proven, popular patterns in Obsidian (PDF++, Bases) — [GitHub PDF++](https://www.github.com/RyotaUshio/obsidian-pdf-plus), [Obsidian changelog](https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0)
- `[S]` Open-source docx redline exists (Docxodus, MIT, with WASM build) — [Docxodus](https://github.com/JSv4/Docxodus/wiki)

### Inferences

**Ranked shortlist of differentiators**

| # | Differentiator | User pain answered | Nearest existing implementation | Feasibility (embedded engines + ordinary files) | Main risk |
|---|---|---|---|---|---|
| 1 | **One calm tabbed shell for every format, no account / ads / subscription / forced AI** | App switching; upsell and AI fatigue; WPS distrust | WPS Office (tabs, but ads); ONLYOFFICE Desktop (tabs, no notes/code) | High — it is the base architecture | Engine chrome inconsistency; memory use with many heavy tabs; "another WPS" perception |
| 2 | **Universal search + quick-open across names and contents of all formats, with location results (page, sheet/cell, slide, heading)** | File-finding; "which document had that number?" | ripgrep-all, DocFetcher, Recoll (search only, crude UI); Spotlight/Windows Search | High on desktop (SQLite FTS + extractors); medium on mobile (folder access limits) | Index freshness for files changed outside the app; large-vault performance; OCR for scanned PDFs out of scope initially |
| 3 | **Cross-format deep links and backlinks** (note ↔ docx bookmark ↔ xlsx named range ↔ slide ↔ PDF page/passage) | Weak cross-format linking; context lost between documents | Obsidian (Markdown only), Hookmark (macOS), Zotero URIs (PDF only) | Medium — standard hyperlinks/anchors + index; needs "go to location" API from each engine | Links breaking when files move outside the app; engine APIs for navigating to an anchor; custom URI scheme reliability on Windows |
| 4 | **PDF reading linked to notes: highlight → quote in note with jump-back; backlinks shown as highlights; real PDF annotations written to the file** | Poor PDF handling; research/reading workflow split across apps | Obsidian PDF++ (fragile plugin), Zotero, LiquidText/MarginNote (proprietary stores) | Medium-high — pdf.js-class viewer the app owns + standard annotations | Annotation write-back correctness; scanned PDFs; scope creep toward a reference manager |
| 5 | **Automatic local version history for every file with visual compare** (docx redline; cell diff for xlsx/csv; text diff; page/slide side-by-side) | Fear of losing work; no history for local files; "what changed?" | OneDrive/Google version history (cloud only); Draftable (paid, compare only); Docxodus (library) | Medium — snapshots easy; diff quality varies by format | Disk usage; xlsx/pptx diff quality; users expecting Word-grade compare |
| 6 | **Linked copies that refresh**: put a sheet range/chart into a document, deck or note; see "stale" badge; one-click Update | OLE/paste-link fragility; manual re-pasting of charts | Google linked objects (cloud only); Office Paste Link (breaks on move) | Medium-low — needs engine APIs to export a range/chart as image/table and to replace an object in place; metadata must survive round-trip | Highest technical risk; engines may strip custom metadata; formatting drift on refresh. Ship first inside Markdown notes (easy), later inside docx/pptx |
| 7 | **Convert/export hub with honest fidelity grades + batch operations** (any → PDF, md ↔ docx, csv ↔ xlsx, md → slides, merge/split/reorder PDFs, batch rename/convert) | Conversion fidelity; needing separate PDF utilities and web converters | Stirling-PDF, PDF24, PDFgear, Pandoc, LibreOffice headless | High — orchestrates existing converters | Fidelity complaints land on this app; "anything to anything" overpromise; bundling size of converters |
| 8 | **Command palette, quick capture and a shared action vocabulary across formats** (same shortcuts for find, export, link, split, history everywhere) | Ribbon complexity; four apps with four UIs | VS Code, Obsidian, Raycast, Linear; Office Tell Me (per app) | High in the shell; medium for engine-internal commands (depends on exposed APIs) | Palette can only run engine commands the embed exposes; discoverability for non-keyboard users |
| 9 | **Unified tags/properties stored inside the files** (front matter, OOXML docProps, PDF XMP) with saved views over a folder | File-finding; organisation beyond folders; lock-in fear | Obsidian Properties/Bases (Markdown only); Windows Explorer tags (Office files only) | Medium — writers for docProps/XMP exist; index for views | Rewriting files to tag them triggers sync churn/conflicts; csv/txt/code need sidecar or index-only tags |
| 10 | **Split view of mixed formats + "open as" alternate representations** (PDF beside notes; CSV as grid or text; Markdown as outline/slides) | Context switching; alt-tabbing between source and writing | VS Code split editors; Obsidian panes; LiquidText | High for split and CSV/Markdown; medium for synced scrolling | Small-screen layout; two heavy engines side by side on low-RAM machines |
| 11 | **Round-trip safety promise**: never silently damage a file; warn on unsupported features; atomic saves; "Open in Word/Excel" escape hatch | Distrust of non-Microsoft editors; conversion fidelity | Partial warnings in LibreOffice ("Keep current format?"); ONLYOFFICE crash recovery | Medium — detection of unsupported features is engine-specific | False reassurance if detection misses something; this is a trust feature that fails badly when wrong |
| 12 | **Same model on Android/iOS: view, annotate, search, capture, light edit of the same files** | Poor/fragmented mobile editing since Microsoft split its app | WPS mobile (ads), Documents by Readdle (iOS viewer), Goodnotes (large-screen award) | Low-medium — engines are heavy on mobile; platform file access is restrictive | Biggest schedule risk; should not be promised at parity; do after desktop is solid |

Opportunities that look attractive but are *not* real differentiators: graph view (pretty, low utility, crowded); block-level databases/relations (Notion/Anytype/Bases do it better); AI writing assistance (incumbents outspend; keep optional and local); canvas/whiteboard (Freeform, Heptabase, Kosmik, Obsidian Canvas already serve it).

**Suggested sequencing (inference):** 1 → 2 → 8 → 10 → 7 form the "one app" foundation; 3 → 4 → 9 deliver "interconnected"; 5 and 11 deliver trust; 6 is the stretch feature; 12 follows desktop.

**Honest positioning statement (one paragraph):**
A personal workbench for your own files. It opens and edits everyday Word, Excel, PowerPoint, PDF, Markdown, CSV, text and code files in one quiet tabbed window, keeps them as ordinary files in your own folders, and adds what office suites lack: search across everything, links and backlinks that reach a specific page, cell range, slide or paragraph in any file, PDF highlights tied to your notes, automatic local history with visual compare, and dependable conversion between formats — with no account, no ads, no subscription and no AI unless you switch it on. It is not a replacement for Microsoft 365 or Google Workspace when you need live co-editing, cloud copilots, enterprise controls or perfect rendering of the most complex Office documents; for those it gets out of the way and hands the same file to the native app.

### Gaps
- The ranking is a judgement, not derived from user research; a short survey or the owner's own workflow log would validate ordering of items 3-6.
- Feasibility grades for items 3, 6, 8 and 11 depend on what the chosen office engine exposes (navigate-to-anchor, export range/chart as image, replace object, command execution, feature detection) — to be confirmed against `office-suite-engines.md`.
- Mobile feasibility (item 12) is not evidenced here.
- Sources blocked in this session and worth opening before the final report: techcommunity.microsoft.com (2026 "Office in the new Copilot app" post), support.google.com (linked objects), stephango.com (File over app), plus Reddit threads for first-hand user sentiment.
