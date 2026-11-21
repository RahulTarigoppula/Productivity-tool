# 05 — Risks, licences and open questions

Status: draft for review · Last updated: 2026-11-21

## Decisions needed from you

These change the plan and only you can answer them. Each has a default that the plan assumes until told otherwise.

| # | Question | Default assumed | Why it matters |
|---|---|---|---|
| 1 | Which operating system do you use day to day? | Build and test on one primary OS first; Electron keeps the others possible | Packaging, fonts, file associations and which apps we verify against |
| 2 | Is this repository public, and will you ever share the app? | Private use only, never distributed | The office engine is AGPL; see below |
| 3 | Have you tried ONLYOFFICE Desktop Editors? | Not yet; try it before Phase 1 | It already does tabbed docx/xlsx/pptx/pdf. Your reaction tells us what the shell must do better |
| 4 | Is the ONLYOFFICE toolbar acceptable inside office tabs for v1? | Yes, in compact mode, themed as far as it allows | A fully custom toolbar is a large extra project |
| 5 | Do you have Microsoft Office available for verification? | Use the free web versions plus LibreOffice | Checking for "repair" prompts is the strongest corruption test |
| 6 | Auto-save for office files: write the real file on a timer, or only snapshots until you press save? | Snapshots continuously, real file on save | Trade-off between never losing work and never overwriting by accident |
| 7 | What do your real files look like? Heavy pivots, macros, tracked changes, large decks? | Typical personal documents | Sets the personal corpus and the performance targets |

## Risk register

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| The client-side ONLYOFFICE stack does not behave inside Electron, or its API is too thin (no documented theming, chrome hiding or programmatic export) | Medium | High | Phase 0 spikes S1–S4 before anything depends on it. Fallbacks: private patch to `web-apps`; local Document Server sidecar; Collabora |
| The x2t-WASM builds lag upstream ONLYOFFICE (community build referenced 9.3 while upstream is 10.0) | High | Medium | Pin a known-good pair of editor and converter versions. Upgrade deliberately, gated by the fidelity suite. Learn to build x2t-WASM ourselves if the community build stalls |
| ONLYOFFICE upstream changes direction or licence terms (terms were reworded in 9.4; a fork, Euro-Office, appeared in 2026) | Medium | Medium | Pinned vendored build keeps working regardless. The provider contract allows swapping engines |
| Memory use with many office tabs | Medium | Medium | Measure in S2; hibernate idle tabs; cap live office tabs |
| Shortcut conflicts between shell and embedded editors | Medium | Low | Small reserved set intercepted in the main process; everything else passes through |
| PDF annotations do not display or stay editable in other readers | Medium | Medium | Interoperability test in S6 and in every release check; engine-neutral annotation model |
| EmbedPDF API churn (3.0 is weeks old) or PDF.js annotation gaps | Medium | Low | Decide in S6; the contract isolates the choice |
| CSV values silently altered | High if untreated | High | Text-by-default loading, dialect wrapper, byte-equality test, fallback grid |
| Documents lay out differently because Microsoft fonts are missing | High | Low–Medium | Bundle metric-compatible fonts; warn on missing fonts |
| Scope creep: rebuilding toolbars, adding formats, chasing parity | High | High | The phase exit checks; "Later, optional" stays later |
| An engine bug corrupts a real file | Low–Medium | High | `.bak` on first save, snapshots, verify-after-save, fidelity suite |
| Research items that could not be verified first-hand | — | Medium | Listed below; each is resolved by a spike or a direct check |

## Licences

Not legal advice; this is a plain reading of the licence texts.

| Component | Licence | Effect on this project |
|---|---|---|
| ONLYOFFICE sdkjs, web-apps, core (x2t) | AGPL-3.0 with additional terms | Private use and modification carry no obligations. Distributing the app, or offering it to others over a network, would require releasing the app's source under AGPL and honouring the additional terms |
| `ranuts/document`, `cryptpad/onlyoffice-x2t-wasm` | AGPL-3.0 | Same |
| SuperDoc (if chosen) | AGPL-3.0 or commercial | Same |
| Pandoc WASM | GPL-2.0-or-later | Same pattern: free for private use |
| qpdf | Apache-2.0 | None |
| Electron, React, CodeMirror 6, PDF.js, EmbedPDF, `@cantoo/pdf-lib`, dockview, cmdk, Papa Parse, Harper | MIT / Apache-2.0 | None |

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
| Per-tab memory for every engine | S2 |
| dockview's current major version and what its paid tier holds back | Check at scaffold time; a plain tab strip is the fallback |

## Things to watch over time

- **IronCalc** reaching 1.0 (charts, pivots): a permissive native spreadsheet engine.
- **Euro-Office** becoming usable standalone: a possible alternative upstream.
- **EmbedPDF** settling after 3.0.
- **Official or community x2t-WASM builds** tracking ONLYOFFICE 10.
