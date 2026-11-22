# 05 — Risks, licences and open questions

Status: draft for review · Last updated: 2026-11-21

## Decisions needed from you

These change the plan and only you can answer them. Each has a default that the plan assumes until told otherwise.

| # | Question | Default assumed | Why it matters |
|---|---|---|---|
| 1 | Which devices? | **Answered 2026-11-22: as assumed.** Windows 11 PC first; a mid-range Android phone; Mac and iPhone/iPad later. Exact models still to be noted when each phase starts | Sets the test devices and performance targets |
| 1b | Which cloud to build sync around? | **Deferred 2026-11-22 to the final release.** Sync is built last, after all platforms; the cloud is chosen then | See Release 4 in `03-roadmap.md` and `11-sync-and-continuity.md` |
| 1c | Is view-plus-light-edit acceptable for office files on phones at first? | **Answered 2026-11-22: yes.** Tablets and desktops get the full editor | No open-source touch editor for office formats exists today (`12-platforms-and-mobile.md`) |
| 1d | **For iPhone/iPad later: pay Apple's $99 yearly developer fee, or reinstall weekly for free?** | Decide when that phase starts | The only two ways to run your own app on iOS |
| 2 | Is this repository public, and will you ever share the app? | Private use only, never distributed | The office engine is AGPL; see below |
| 3 | Have you tried ONLYOFFICE Desktop Editors? | Not yet; try it before Phase 1 | It already does tabbed docx/xlsx/pptx/pdf. Your reaction tells us what the shell must do better |
| 4 | Is the ONLYOFFICE toolbar acceptable inside office tabs for v1? | Yes, in compact mode, themed as far as it allows | A fully custom toolbar is a large extra project |
| 5 | Do you have Microsoft Office available for verification? | Use the free web versions plus LibreOffice | Checking for "repair" prompts is the strongest corruption test |
| 6 | Auto-save for office files: write the real file on a timer, or only snapshots until you press save? | Snapshots continuously, real file on save | Trade-off between never losing work and never overwriting by accident |
| 7 | What do your real files look like? Heavy pivots, macros, tracked changes, large decks? | Typical personal documents | Sets the personal corpus and the performance targets |
| 8 | Slim app that fetches the office pack once on request, or one full installer with everything? | Full installer for your own machine; packs still load only when needed | "No huge dependencies" versus "works offline from the first minute" |
| 9 | Which programming languages do you work in? | None assumed | Decides which language servers and previews get tested first |

## Risk register

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| The client-side ONLYOFFICE stack does not behave inside the shell, or its API is too thin (no documented theming, chrome hiding or programmatic export) | Medium | High | Phase 0 spikes S1–S4 before anything depends on it. Fallbacks: private patch to `web-apps`; local Document Server sidecar; Collabora |
| The x2t-WASM builds lag upstream ONLYOFFICE (community build referenced 9.3 while upstream is 10.0) | High | Medium | Pin a known-good pair of editor and converter versions. Upgrade deliberately, gated by the fidelity suite. Learn to build x2t-WASM ourselves if the community build stalls |
| ONLYOFFICE upstream changes direction or licence terms (terms were reworded in 9.4; a fork, Euro-Office, appeared in 2026) | Medium | Medium | Pinned vendored build keeps working regardless. The provider contract allows swapping engines |
| Memory use with many office tabs | Medium | Medium | Measure in S2; hibernate idle tabs; cap live office tabs |
| Shortcut conflicts between shell and embedded editors | Medium | Low | Small reserved set intercepted in the main process; everything else passes through |
| PDF annotations do not display or stay editable in other readers | Medium | Medium | Interoperability test in S6 and in every release check; engine-neutral annotation model |
| EmbedPDF API churn (3.0 is weeks old) or PDF.js annotation gaps | Medium | Low | Decide in S6; the contract isolates the choice |
| CSV values silently altered | High if untreated | High | Text-by-default loading, dialect wrapper, byte-equality test, fallback grid |
| Documents lay out differently because Microsoft fonts are missing | High | Low–Medium | Bundle metric-compatible fonts; warn on missing fonts |
| Scope creep: rebuilding toolbars, adding formats, chasing parity, drifting toward a full IDE | High | High | The phase exit checks; "Later, optional" stays later; the "Never" list in `06-code-and-text-editor.md` |
| The office engine does not run correctly in Apple's webview (macOS, iOS) | Unknown | High | Device spikes M6–M8 before the Apple phase; Electron on macOS as a fallback; native converter library on iOS |
| No open-source touch interface exists for editing office files on phones (ONLYOFFICE's public mobile code is view-only) | Certain today | High | Tablets use the desktop editor; phones get view and light edit; watch the Euro-Office mobile editor |
| iOS limits web pages to about 300 MB for WebAssembly | High | High | File-size ceilings; native converter; honest read-only fallback |
| Tauri's mobile support is young; no verified list of production apps on it was found | Medium | High | Early spikes on a real phone; the `platform` interface allows Capacitor or a native host |
| No single cloud folder works well for third-party apps on all four platforms | High | Medium | Staged sync plan; built-in connector if needed (`11-sync-and-continuity.md`) |
| The same file edited on two devices | Medium | Medium | Three-way merge for text; keep-both with compare for office and PDF; never a silent overwrite |
| The project is about a year of full-time work | Certain | High | Strict release order; every phase ends with something in daily use |
| People expect PDF → Word to be perfect | High | Low | Honest quality labels and previews (`10-universal-export.md`) |
| The app feels slow or grows heavy over time | Medium | High | Budgets in `08-performance-and-footprint.md`, enforced in CI |
| Office tabs look and behave differently from the rest of the app | High | Medium | Compact themed engine toolbar in the shell's toolbar position; shell owns everything outside it (`07-ux-ui-design.md`) |
| npm supply-chain attacks (repeated through 2025–2026) | Medium | High | Dependency budget, exact pinning, install scripts off, no extension code ever executed |
| An engine bug corrupts a real file | Low–Medium | High | `.bak` on first save, snapshots, verify-after-save, fidelity suite |
| Research items that could not be verified first-hand | — | Medium | Listed below; each is resolved by a spike or a direct check |

## Licences

Not legal advice; this is a plain reading of the licence texts.

| Component | Licence | Effect on this project |
|---|---|---|
| ONLYOFFICE sdkjs, web-apps, core (x2t) | AGPL-3.0 with additional terms | Private use and modification carry no obligations. Distributing the app, or offering it to others over a network, would require releasing the app's source under AGPL and honouring the additional terms. Publishing a GPL-family app on Apple's App Store is a known conflict; installing it on your own devices is not distribution |
| `ranuts/document`, `cryptpad/onlyoffice-x2t-wasm` | AGPL-3.0 | Same |
| SuperDoc (if chosen) | AGPL-3.0 or commercial | Same |
| Pandoc WASM | GPL-2.0-or-later | Same pattern: free for private use |
| qpdf | Apache-2.0 | None |
| Tauri, React, CodeMirror 6, Shiki, PDF.js, EmbedPDF, `@cantoo/pdf-lib`, dockview, cmdk, Papa Parse, xterm.js, ripgrep | MIT / Apache-2.0 / Unlicense | None |
| Microsoft's VS Code Marketplace and its proprietary extensions (Pylance, C/C++, Remote) | Proprietary | Cannot be used outside Microsoft's own products; this plan does not depend on them |

Practical consequences:

- For a personal tool this is all fine.
- Keep AGPL code out of the repository by fetching the engine with a pinned script. The repository then holds only our own code.
- If the repository is public, pick its licence deliberately. If there is any chance of sharing the built app later, AGPL-3.0 for our own code is the simple compatible choice.
- If you later want to distribute under a permissive or closed licence, the office engine would have to be replaced or commercially licensed. That would be a different project.

## What the research could not confirm

Several vendor sites (onlyoffice.com, collaboraonline.com, electronjs.org, docs.univer.ai, embedpdf.com, learn.microsoft.com and others) were unreachable from the research environment, so some findings rest on search summaries or background knowledge. No library was tested hands-on. The ones that matter:

| Unconfirmed | Resolved by |
|---|---|
| Which ONLYOFFICE version `ranuts/document` bundles, and its size and large-file performance | S1, S2 |
| Whether chrome hiding, theming and programmatic PDF export are reachable from outside the editor frame | S3, S4 |
| The exact current wording of ONLYOFFICE's additional licence terms (logo requirement reportedly dropped in 9.4) | Read the LICENSE file in the pinned build |
| Independent fidelity numbers for any engine; all fidelity claims are vendor statements or reputation | The fidelity suite on your own files |
| PDF.js 6.5's exact annotation coverage and whether existing annotations can be edited | S6 |
| Cross-reader behaviour of written annotations | S6 |
| Whether ONLYOFFICE supports slicers, macros and `LAMBDA` | Check during Phase 3 if your files need them |
| Per-tab memory for every engine | S2, S16 |
| Whether the office editors work in macOS's or Linux's system webview | S14 |
| Size of the pinned upstream office build (measured on an unofficial build of the same architecture) | S15 |
| Whether ONLYOFFICE's free build honours the toolbar-hiding options documented as paid | S4 |
| How complete CodeMirror's language-server client is | S11 |
| Whether the office engine runs in Android's and Apple's webviews, and how large a file it can handle | M1, M6, M7 |
| Which cloud apps give a third-party app a lasting writable folder on Android and iOS | S27, S28 |
| Competitor complaints, prices and ratings (search summaries only) | Spot-check before quoting anywhere |
| dockview's current major version and what its paid tier holds back | Check at scaffold time; a plain tab strip is the fallback |

## Things to watch over time

- **IronCalc** reaching 1.0 (charts, pivots): a permissive native spreadsheet engine.
- **Euro-Office** becoming usable standalone: a possible alternative upstream.
- **EmbedPDF** settling after 3.0.
- **Official or community x2t-WASM builds** tracking ONLYOFFICE 10.
