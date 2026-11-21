# App Shell, Architecture, UX Patterns, Prior Art, and Testing Strategy (state as of 21 Nov 2026)

Reading notes for the report writer:

- Research was done via web search on 21 Nov 2026. Direct page fetches of `electronjs.org` and `onlyoffice.com` were blocked by the session's network policy, so findings from those sites come from search-result summaries of the pages, not full-page reads. Anything I could not confirm is flagged "UNVERIFIED" or placed under Gaps.
- Items marked "(background knowledge, not re-verified this session)" come from my training data (cutoff mid-2026) and are attached to the canonical doc URL where the claim should be checkable. Treat them as lower confidence than items with a search-confirmed source.
- Many "Electron vs Tauri" numbers online are blog benchmarks with unpublished methodology; I report ranges and name the source.

---

## 1. Desktop framework: Electron vs Tauri v2 vs Wails vs Neutralino vs PWA/File System Access vs Electrobun

### Takeaway
For a shell whose whole job is hosting heavyweight third-party canvas editors (ONLYOFFICE, Univer, PDF.js) plus native helper binaries, Electron is the lowest-risk choice because it ships one known Chromium on all three OSes; Tauri v2 is viable on Windows (WebView2 = Chromium) but carries real rendering/perf risk on Linux (WebKitGTK) and its multi-webview feature is still behind an `unstable` flag. A browser PWA is ruled out for cross-browser use (File System Access pickers are Chromium-only) and cannot spawn LibreOffice/x2t.

### Cited Findings

**Electron**
- Latest stable seen: Electron 45.3.3 (branch 45-x-y), Chromium 156.0.8078.100, Node.js 24.22.3, released 14 Nov 2026; 46.0.0-alpha.10 is in prerelease and 47 in nightly. The snapshot was a few days old, so a newer patch may exist. — [Electron Releases](https://releases.electronjs.org/)
- Support policy: the latest three stable majors are supported; 43.8.6 was the latest 43.x (31 Oct 2026), 43 reaches end of support 5 Jan 2027, and 42 is already unsupported. Implication: a new major roughly every 8 weeks, so an Electron app must budget for regular upgrades. — [endoflife.date/electron](https://endoflife.date/electron)
- Obsidian Desktop 1.12.7 (March 2026) ships Electron 39.8.3 — evidence that a successful local-first document app runs comfortably a few majors behind. — [codenote.net 2026 audit of famous Electron apps](https://codenote.net/en/posts/famous-electron-apps-2026-research/) (secondary source)
- Security defaults: process sandboxing has been the default since Electron 20; disabling context isolation also disables the sandbox; the official checklist says to avoid `file://` and prefer custom protocols, and to load remote/untrusted content only with `nodeIntegration` off and `contextIsolation` on, in a `<webview>` or `WebContentsView`. — [Electron security tutorial](https://electronjs.org/docs/latest/tutorial/security)

**Size and memory (Electron vs Tauri) — treat as indicative**
- Hello-world installers: about 3.2 MB (Tauri) vs about 85 MB (Electron), per a July 2026 write-up; note this article cites "Electron 34.x" as its baseline, which is far behind the real current version (45), so its numbers are dated. — [tech-insider.org](https://tech-insider.org/tauri-vs-electron-2026/)
- Heavier demo apps: Better Stack measured 323 MB (Electron) vs 57 MB (Tauri); Hopp measured 244 MiB vs 8.6 MiB bundle and about 409 MB vs about 172 MB memory. — [Better Stack comparison](https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/); [Hopp benchmark](https://dev.to/gethopp/tauri-vs-electron-performance-bundle-size-and-the-real-trade-offs-1el4)
- At least one 2026 analysis disputes the widely repeated "96% smaller / 5x less RAM" claim as having no reproducible benchmark behind it. — [eltexsoft.com](https://eltexsoft.com/blog/cross-platform-desktop-app-development-you-re-arguing-about-the-wrong-number/)
- Guides consistently warn that Tauri apps run on three different engines and recommend real cross-platform testing if the UI depends on Chromium-only APIs, WebGL, or pixel-accurate rendering. — [pkgpulse Electron vs Tauri 2026](https://www.pkgpulse.com/guides/electron-vs-tauri-2026)

**Tauri v2**
- Latest core release seen: tauri v2.12.0, dated 26 Sep 2026. Its notes include multi-webview fixes on Windows (focus handling with the `unstable` feature enabled). — [Tauri release notes v2.12.0](https://v2.tauri.app/release/tauri/v2.12.0/)
- Multi-webview (several webviews in one window) is still described in 2026 changelogs as the `unstable` feature-flag mode; it was introduced that way in the v2 beta and has not been stabilised in the releases I found. — [tauri-runtime-wry v2.10.0 notes](https://v2.tauri.app/release/tauri-runtime-wry/v2.10.0/); [Tauri v2 beta announcement](https://v2.tauri.app/blog/tauri-2-0-0-beta/)
- Linux rendering risk is documented by Tauri itself: on some setups (most often NVIDIA) WebKitGTK and the driver disagree, giving anything from a blank window to subtle glitches; `WEBKIT_DISABLE_DMABUF_RENDERER=1` works around some cases at the cost of the fast path and should not be shipped unconditionally; WebGL and canvas content "can silently land on a slow path while the rest of the app looks fine"; the docs suggest a non-WebGL fallback on Linux. — [Tauri: Linux Graphics Issues](https://v2.tauri.app/develop/debug/linux-graphics/)
- Community reports: canvas-heavy apps are noticeably slower in Tauri on Linux, especially Tauri v2 + X11 + NVIDIA, attributed to WebKitGTK; Windows/macOS reported unaffected. — [r/tauri thread: Canvas rendering performance in Tauri](https://axebps-redlib.hf.space/r/tauri/comments/1jur0hl/canvas_rendering_performance_in_tauri) (anecdotal)
- A third-party debugging guide reports WebKitGTK doing per-tile work on the main thread, with gaps of 500 ms+ vs under 50 ms on Chromium for a map canvas workload. — [GeoLibre WebKitGTK debugging guide](https://instagit.com/opengeos/GeoLibre/how-to-debug-webkitgtk-performance-linux/) (secondary; rough heuristic)
- Sidecars: `bundle.externalBin` lists binaries that Tauri embeds; each needs a per-target-triple suffix (e.g. `my-sidecar-x86_64-unknown-linux-gnu`); executing one needs an explicit `shell:allow-execute` capability with `"sidecar": true`, and arguments can be restricted with validators. — [Tauri: Embedding External Binaries](https://v2.tauri.app/develop/sidecar)
- Known sidecar packaging bug: a GitHub issue reports that on Windows NSIS reinstall an `externalBin` sidecar may not be replaced. — [tauri-apps/tauri#15134](https://github.com/tauri-apps/tauri/issues/15134)
- Tauri's permission model: capabilities, permissions and scopes checked on every IPC call from the WebView. — [Tauri capabilities](https://v2.tauri.app/security/capabilities/)

**Wails**
- Wails v3 was promoted from alpha to beta in v3.0.0-beta.2, dated 2 Aug 2026; the project status page still said "Current Status: Beta" with stable v3.0 as the goal. A newreleases.io page titled "Wails v3.0.0" exists but with no date I could confirm. — [Wails v3 changelog](https://v3.wails.io/fr/changelog); [Wails status](https://docs-preview.wails.io/status/); conflicting: [newreleases.io v3.0.0](https://newreleases.io/project/github/wailsapp/wails/release/v3.0.0)
- Wails uses the same system WebViews as Tauri (WebView2 / WKWebView / WebKitGTK) with a Go backend. — [Wails GitHub](https://github.com/wailsapp/wails) (background knowledge, not re-verified this session)

**Electrobun and other newcomers**
- Electrobun reached v1 in early 2026 (creator's post; a secondary summary dates it 6 Feb 2026) after about two years; npm showed 1.18.1 at search time. It uses Bun as the main-process runtime with native system webviews by default, and the v1.18.0 changelog mentions bumping bundled CEF from 145 to 147 — i.e. it can optionally ship Chromium via CEF. — [Electrobun v1 post](https://blackboard.sh/blog/electrobun-v1/); [v1.18.0 changelog](https://framework.blackboard.sh/electrobun/guides/changelog/v1-18-0/); [GitHub](https://github.com/blackboardsh/electrobun)
- A June 2026 decision-matrix article covers Tauri, Electron, Deno desktop and Wails side by side. — [digitalapplied.com](https://www.digitalapplied.com/blog/desktop-apps-web-stack-tauri-electron-deno-wails-2026) (not read in full)

**Local web app / PWA with File System Access API**
- `showOpenFilePicker()` is supported in Chrome and Edge since 86 and Opera since 72; unsupported in every Firefox version through 161 and Safari through 27.2; Brave only behind a flag. — [caniuse: showOpenFilePicker](https://caniuse.com/mdn-api_window_showopenfilepicker)
- Vendor positions: Firefox "negative", Safari "oppose (security concerns)"; the feature is described as very unlikely to become Baseline in its current form. — [web-features explorer: File System Access](https://web-platform-dx.github.io/web-features-explorer/features/file-system-access)

**How comparable apps build their shells**
- ONLYOFFICE Desktop Editors: staff state the app uses Chromium Embedded Framework to host the editors; the repo splits into `desktop-apps` (the OS-specific frontend/UI), `desktop-sdk` (the core SDK), and `core` (conversion components, shared with Document Server). — [ONLYOFFICE forum: "Why does it contain a web browser?"](https://community.onlyoffice.com/t/why-does-it-contain-a-web-browser/8250); [ONLYOFFICE/DesktopEditors README](https://github.com/ONLYOFFICE/DesktopEditors/blob/master/README.md)
- ONLYOFFICE Desktop Editors 10.0.0 shipped mid-October 2026 (reports dated 10–14 Oct) with optional AI tools and a redesigned start window; one outlet calls it a "fully rebuilt app" and warns that not all settings carry over. — [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2026/10/onlyoffice-desktop-editors-10); [UbuntuHandbook](https://ubuntuhandbook.org/index.php/2026/10/onlyoffice-desktop-editors-10-0-0-released-with-optional-ai-tools/); [OMG Ubuntu](https://omgubuntu.co.uk/2026/10/onlyoffice-10-expands-ai-tools)
- Stirling-PDF desktop: a Tauri 2.x client that bundles the Java backend JAR plus a `jlink`-minimised JRE (so the "native helper" is a JVM sidecar), uses the Tauri updater with public-key verification, supports "Open with" file association on Windows/macOS; v2.8.0 added a native Save As dialog; AUR listed 2.14.2 at search time. — [DeepWiki: Stirling-PDF configuration/desktop](https://deepwiki.com/Stirling-Tools/Stirling-PDF/2.3-configuration-system); [AUR stirling-pdf-desktop-bin](https://aur.archlinux.org/packages/stirling-pdf-desktop-bin); [release files v2.7.0](https://sourceforge.net/projects/stirling-pdf/files/v2.7.0/)
- Collabora Office (new desktop app, announced Nov 2025): the LibreOffice core engine with the Collabora Online web UI (JavaScript, CSS, Canvas, WebGL) on top, fully offline; "Collabora Office Classic" keeps the VCL toolkit UI. The new app drops Base and macro editing and removes the Java dependency. Packaging: Linux x86_64 Flatpak, Windows 11 64-bit APPX, macOS 15+ ARM only. A 26.04 release followed in 2026. — [Collabora press release](https://www.collaboraonline.com/blog/press-release-bringing-collabora-online-to-the-desktop/); [It's FOSS](https://itsfoss.com/news/collabora-launches-desktop-office-suite/); [Collabora Office 26.04](https://www.collaboraonline.com/blog/collabora-office-26-04-release/)
- VS Code, Obsidian, Notion, Slack are Electron apps. — [Wikipedia: List of software using Electron](https://en.wikipedia.org/wiki/List_of_software_using_Electron)

### Inferences
- The three editors that matter most (ONLYOFFICE web editors, Univer, PDF.js) are developed and tested primarily against Chromium. Electron gives exactly that engine on every OS; Tauri gives it only on Windows. On macOS, WKWebView is Safari-class and usually fine but is a second engine to test; on Linux, WebKitGTK is the documented weak spot for canvas/WebGL. If Linux is a possible target, this single fact tips the decision to Electron.
- The products closest to this project all bundle Chromium or own the engine: ONLYOFFICE Desktop uses CEF, Collabora's new desktop puts a web UI on a native core, Obsidian/VS Code/Notion use Electron. None of the heavyweight document-editor shells found relies on system WebViews. Stirling-PDF (Tauri) is the counter-example, but its UI is a conventional React app, not a canvas word processor.
- Bundle size is a weak argument here: bundling LibreOffice (hundreds of MB installed) or the ONLYOFFICE editor assets plus x2t dwarfs the roughly 80–100 MB Electron runtime. Tauri's headline advantage largely disappears for this app.
- Both Electron and Tauri can ship and spawn native helpers (Electron: `extraResources` + `child_process`/`utilityProcess`; Tauri: `externalBin` sidecars). Electron is simpler because Node is already present; Tauri requires per-triple naming and capability entries, and has at least one open installer bug.
- Electrobun is interesting (TypeScript end to end, optional CEF) but is under a year past v1 and driven by a small team; for a solo developer leaning on AI assistance, Electron's vastly larger body of documentation and examples is a practical advantage. Wails v3 and Neutralino share Tauri's system-WebView risk without Tauri's ecosystem.
- Recommended default: Electron (current stable 45.x; pin a major and upgrade every few months). Revisit Tauri only if the target is Windows-only or Windows+macOS and small download size matters.

### Gaps
- Neutralinojs: no search performed/returned for 2026 status; I have no current version or evidence it is used for heavy editors.
- No measured data on ONLYOFFICE/Univer editors running inside WKWebView or WebKitGTK specifically. The risk is inferred from general WebKitGTK canvas reports. A one-day spike (load each editor in Tauri on each OS) would settle it.
- Whether ONLYOFFICE Desktop Editors 10's "fully rebuilt app" changed the CEF + Qt shell is unknown; the official blog could not be fetched (network policy). The Qt part of the classic "Qt + CEF" description was not confirmed by any source this session (UNVERIFIED; background knowledge says the Windows/Linux shell is Qt-based).
- Whether the new Collabora Office desktop app hosts its UI in the system WebView or bundled engine was not explicitly confirmed (a 26.04 note about "WebView zoom" suggests a WebView).
- Exact Electron memory per extra renderer for these editors: no source; must be measured.
- Notion's and VS Code's internal tab/view implementation details were not found in sources this session.

---

## 2. Hosting multiple heavy editors in tabs: iframes vs WebContentsView vs Tauri multiwebview

### Takeaway
In Electron, host each open document in its own `WebContentsView` (the supported replacement for the deprecated `BrowserView`) stacked under a shell-rendered tab bar: this gives a separate renderer process per document (crash and memory isolation), the ability to destroy/recreate views to hibernate tabs, and per-view sandbox settings. Iframes are simpler and fine for light editors (Markdown, text, CSV), but share fate with the shell page unless served from different origins.

### Cited Findings
- `BrowserView` is deprecated (docs table says since 29.0.0; the migration blog says since Electron 30) and replaced by `WebContentsView`. Migration is mostly mechanical: same constructor shape with `webPreferences`; attach with `win.contentView.addChildView(view)` instead of `addBrowserView`; `setBounds` and `webContents` work as before; `setAutoResize` has no equivalent and must be replaced by a window `resize` listener. — [Electron blog: Migrating from BrowserView to WebContentsView](https://electronjs.org/blog/migrate-to-webcontentsview); [BrowserView docs](https://www.electronjs.org/docs/latest/api/browser-view/)
- A WebContents can be presented in only one WebContentsView at a time; passing an existing WebContents into the constructor had regressions between v29 and v31. — [electron/electron#42054](https://github.com/electron/electron/issues/42054)
- Electron's security guidance for embedded content: enable sandbox and context isolation, expose only narrow functions through preload, prefer a custom protocol to `file://`. — [Electron security tutorial](https://electronjs.org/docs/latest/tutorial/security)
- Tauri's equivalent (multiple webviews inside one window) is still the `unstable` feature mode with ongoing focus/behaviour fixes in 2026 releases. — [Tauri v2.12.0 notes](https://v2.tauri.app/release/tauri/v2.12.0/)
- WebContentsView webContents are not automatically destroyed when the view is removed or the window closes; the app must call `view.webContents.close()` itself or leak the renderer. — [Electron WebContentsView docs](https://www.electronjs.org/docs/latest/api/web-contents-view) (background knowledge, not re-verified this session; fetch was blocked)
- Custom protocols: `protocol.registerSchemesAsPrivileged` (with `standard`, `secure`, `supportFetchAPI`, `stream` flags) plus `protocol.handle` let the app serve bundled editor assets from an `app://`-style origin so editors get a real secure origin (needed for service workers, `fetch`, WASM streaming). — [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol) (background knowledge, not re-verified this session)
- ONLYOFFICE Desktop already demonstrates the pattern "one embedded browser view per document tab" on top of CEF. — [ONLYOFFICE forum](https://community.onlyoffice.com/t/why-does-it-contain-a-web-browser/8250)

### Inferences
- Comparison for this app:

| Option | Process isolation | Crash isolation | Memory | Overlay/z-order | Complexity |
|---|---|---|---|---|---|
| Same-origin iframe in the shell page | None (same renderer) | None — a hung editor freezes the shell | Lowest | Easy (it is DOM) | Lowest |
| Cross-origin iframe (different custom scheme/host per engine) | Usually a separate process under Chromium site isolation | Partial | Medium | Easy | Low |
| WebContentsView per document | Own renderer process | Full; shell can show "tab crashed, reload" | Highest (one renderer per tab) | Hard: native views sit above the shell DOM, so the command palette and menus cannot simply overlap them | Medium |
| Tauri multiwebview | Per-webview (engine dependent) | Engine dependent | Medium | Same overlay problem | High (unstable API) |

- The overlay problem is the main cost of WebContentsView: shell UI (command palette, dropdowns, toasts) rendered in the shell's DOM is hidden behind native views. Usual solutions: render the palette in its own top-most WebContentsView, or temporarily shrink/hide the editor view while the palette is open.
- Keeping editor state across tab switches is free with both approaches as long as the view/iframe is hidden rather than destroyed (`view.setVisible(false)` or CSS `display:none`). Never re-parent an iframe in the DOM — moving it reloads it. Dock libraries that re-mount panels on drag will reload iframes unless the panel content is kept alive (dockview has an "always"-rendered mode for this; see section 6).
- Tab hibernation: for a personal app a simple policy is enough — lazy-create the editor on first activation; after N background tabs or M minutes idle, if the document is clean (or after auto-saving it to the recovery store), destroy the view and keep only a tab stub (path, scroll position, thumbnail). Restore by reloading from disk/recovery copy. This is the "discarded tab" model browsers use.
- Security posture for untrusted documents: editor views get `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, no preload beyond a tiny message bridge, a strict CSP on the custom protocol responses, navigation and `window.open` denied (`will-navigate`, `setWindowOpenHandler`), and all network blocked for document views (offline app) via `session.webRequest`. Macros are simply not executed. Native converters (LibreOffice, x2t) parse hostile files outside the sandbox — run them with timeouts, in a temp directory, on a copy.
- Expect roughly 150–400 MB per open ONLYOFFICE-class editor tab (estimate from general Chromium renderer behaviour and the Hopp figure of about 409 MB for a whole small Electron app); this is why hibernation matters. Must be measured.

### Gaps
- No authoritative per-tab memory numbers for ONLYOFFICE/Univer/PDF.js in Electron were found.
- Could not fetch the WebContentsView and protocol API pages to quote them directly (network policy); the lifecycle and privileged-scheme details above are from background knowledge.
- Whether ONLYOFFICE's web editors run correctly from a custom scheme without their Document Server (they normally expect a server for load/save callbacks) is covered by the editor-engine researcher, not here; community projects in section 7 show it is possible with x2t-WASM.

---

## 3. Plugin-style "editor provider" architecture

### Takeaway
Copy VS Code's custom-editor model: a registry maps file patterns to a provider with a priority; the provider owns an opaque document model and the shell owns everything generic (tabs, dirty dot, save, backup/hot-exit, revert, Save As). The contract between shell and engine can be about ten methods.

### Cited Findings
- VS Code custom editors are declared in `package.json` under `contributes.customEditors` with a `viewType`, a `displayName` (shown in "View: Reopen With"), and a `selector` of filename glob patterns that decides which files the editor applies to. — [VS Code Custom Editor API guide](https://code.visualstudio.com/api/extension-guides/custom-editors)
- For binary formats VS Code uses `CustomEditorProvider` with a `CustomDocument` (instead of `TextDocument`), which "gives extensions full control over actions such as edit, save, and backup". The provider implements `saveCustomDocument`, `saveCustomDocumentAs`, `revertCustomDocument`, and `backupCustomDocument`. — [VS Code Custom Editor API guide](https://code.visualstudio.com/api/extension-guides/custom-editors); [CustomEditorProvider reference (mirror)](https://vscode-api-cn.js.org/interfaces/vscode.CustomEditorProvider.html)
- Dirty tracking: the editor fires edit events; for editors that do not support undo/redo through the host, the only way to clear dirty state is save or revert. — [CustomEditorProvider reference (mirror)](https://vscode-api-cn.js.org/interfaces/vscode.CustomEditorProvider.html)
- Backup/hot exit: VS Code calls `backupCustomDocument` about one second after the user stops editing (not when auto-save is enabled); a backup returns an `id` and a `delete()` that VS Code calls when a newer backup or a save supersedes it. — [CustomEditorProvider reference (mirror)](https://vscode-api-cn.js.org/interfaces/vscode.CustomEditorProvider.html); [Theia CustomDocumentBackup](https://eclipse-theia.github.io/theia/docs/next/interfaces/plugin.CustomDocumentBackup.html)
- VS Code's internal "working copy" abstraction is the generic unit the workbench saves, backs up and reverts, independent of editor type. — [VS Code wiki: Working Copies](https://github.com/microsoft/vscode/wiki/Working-Copies)
- Theia implements the same VS Code custom editor API (it exposes `CustomDocumentBackup` etc. in its plugin API, docs at v1.71.0), so the model is proven in a second independent shell. — [Theia API docs](https://eclipse-theia.github.io/theia/docs/next/interfaces/plugin.CustomDocumentBackup.html)
- JupyterLab's `DocumentRegistry` separates file types, model factories and widget factories; several widget factories can be registered for one file type with one default, which powers "Open With". — [JupyterLab documents extension guide](https://jupyterlab.readthedocs.io/en/stable/extension/documents.html) (background knowledge, not re-verified this session)
- Obsidian plugins call `registerView(type, creator)` and `registerExtensions(['ext'], type)` to bind file extensions to a view class (`FileView`/`TextFileView` with `getViewData`/`setViewData`). — [Obsidian developer docs: Plugin API](https://docs.obsidian.md/Reference/TypeScript+API/Plugin) (background knowledge, not re-verified this session)

### Inferences
- Recommended minimal interface (TypeScript sketch). The provider is static metadata; the session is one open document living in its own view:

```ts
interface EditorProvider {
  id: string;                        // "onlyoffice-word", "pdfjs", "codemirror-md"
  displayName: string;
  selectors: { ext: string[]; mime?: string[] }[];
  priority: "default" | "option";    // enables "Reopen with..."
  canCreate?: { ext: string; template(): Promise<Uint8Array> }[];
  exportTargets(ext: string): string[];   // e.g. docx -> ["pdf","odt","md","txt"]
  entryUrl: string;                  // app://engine-x/index.html loaded into the view
}

interface EditorSession {            // implemented inside the view, called over a message bridge
  open(bytes: Uint8Array, meta: { path?: string; ext: string; readOnly: boolean }): Promise<void>;
  getBytes(format?: string): Promise<Uint8Array>;   // native format by default; other = export
  isDirty(): boolean;
  onDidChangeDirty(cb: (dirty: boolean) => void): void;
  markSaved(): void;
  getCommands(): CommandDescriptor[];               // id, title, keybinding?, when?
  executeCommand(id: string, args?: unknown): Promise<unknown>;
  getText?(): Promise<string>;                      // for full-text index
  getState?(): unknown; setState?(s: unknown): void; // scroll/selection for hibernation
  setTheme?(theme: "light" | "dark"): void;
  focus(): void;
  dispose(): Promise<void>;
}
```

- The shell, not the engine, should own: file I/O, atomic writes, recovery snapshots, file watching, the recent list, conversions through native tools, and keybinding arbitration. Engines only ever see bytes. This keeps each engine adapter small (a few hundred lines) and replaceable — important because the choice of docx/xlsx engine may change.
- A message bridge (`postMessage`/`MessagePort` via a minimal preload) is the right transport, since engines live in sandboxed views. Transfer `ArrayBuffer`s rather than copying for large files.
- Engines that cannot produce bytes themselves (e.g. ONLYOFFICE's internal format needing x2t to produce .docx) can implement `getBytes` by returning an intermediate blob plus a flag, with the shell running the converter — keep that detail behind the adapter.

### Gaps
- JupyterLab and Obsidian API details were not re-verified this session; URLs are the canonical doc locations.
- No published "minimal editor-provider interface" standard exists; the sketch above is my synthesis.

---

## 4. File pipeline: associations, watching, atomic saves, auto-save/recovery, lock files, export matrix

### Takeaway
The shell should treat every save as: serialise in the engine → write to a temp file in the same directory → fsync → rename over the target, with a separate recovery store (per-document snapshots written a second or two after edits stop) providing crash recovery and lightweight version history. Respect, and optionally write, the Office (`~$name`) and LibreOffice (`.~lock.name#`) lock files so the app coexists with those suites.

### Cited Findings
- VS Code's hot-exit design, the best-documented reference: backups are written about one second after edits stop, kept outside the user's file, and deleted when superseded or saved; with auto-save on, backups are skipped. — [CustomEditorProvider reference (mirror)](https://vscode-api-cn.js.org/interfaces/vscode.CustomEditorProvider.html)
- LibreOffice lock file: named `.~lock.<filename>.<ext>#` next to the document; a short plain-text record containing the user name, host, timestamp, and profile path, comma-separated; it carries no document data and exists only to signal "in use"; it is created on open and removed on close, and an unclean exit leaves a stale lock behind. — [fileinfo.com .DOC# entry](https://fileinfo.com/extension/doc%23); [Ask LibreOffice thread](https://ask.libreoffice.org/t/lock-filename-odt/13437); [LibreOffice dev list, 2018 lock discussion](https://listarchives.libreoffice.org/global/dev/2018/msg01328.html)
- LibreOffice developers note the lock files are also the interop signal between LibreOffice/OpenOffice instances, and proposed (2018) adding a PID to detect stale locks and auto-deleting locks older than a week. — [LibreOffice dev list](https://listarchives.libreoffice.org/global/dev/2018/msg01328.html); [freedesktop list archive](https://lists.freedesktop.org/archives/libreoffice/2018-July/080562.html)
- Stirling-PDF desktop implements "Open with" file association on Windows and macOS and native Save As through Tauri — a small-team precedent for the file-association plumbing. — [DeepWiki: Stirling-PDF](https://deepwiki.com/Stirling-Tools/Stirling-PDF/2.3-configuration-system)
- Microsoft Office "owner files": Word creates a hidden `~$` + filename file in the same folder holding the logon name of the person who has the document open; it is deleted on close and can be left behind after a crash. — [Microsoft Support: Description of how Word creates temporary files](https://support.microsoft.com/en-us/topic/description-of-how-word-creates-temporary-files-66b112fb-d2c0-8f40-a0be-70a367cc4c85) (background knowledge, not re-verified this session)
- File watching libraries: chokidar (Node; used widely, v4+ dropped globs and many dependencies) and `@parcel/watcher` (native, what VS Code uses); in Rust/Tauri the `notify` crate. — [chokidar](https://github.com/paulmillr/chokidar); [parcel-bundler/watcher](https://github.com/parcel-bundler/watcher); [notify-rs](https://github.com/notify-rs/notify) (background knowledge, not re-verified this session)
- Atomic write helper for Node: `write-file-atomic` (npm's own library: write temp, fsync, rename). — [npm/write-file-atomic](https://github.com/npm/write-file-atomic) (background knowledge, not re-verified this session)
- Electron platform APIs for the pipeline: `app.addRecentDocument`, the macOS `open-file` event and Windows/Linux argv + `second-instance` for "open with", `app.requestSingleInstanceLock`, `webUtils.getPathForFile` for drag-and-drop paths, `webContents.printToPDF`. File associations are declared via electron-builder `fileAssociations`. — [Electron app API](https://www.electronjs.org/docs/latest/api/app); [electron-builder file associations](https://www.electron.build/configuration.html) (background knowledge, not re-verified this session)
- LibreOffice 26.2 (Feb 2026) added Markdown import/export support, widening what `soffice --headless --convert-to` can do in one tool. — [heise: LibreOffice 26.2](https://heise.de/-11165526); [OMG Ubuntu](https://www.omgubuntu.co.uk/2026/02/libreoffice-26-2-new-features)

### Inferences
- **Atomic save recipe:** write `.<name>.<rand>.tmp` in the same directory (same volume so rename is atomic) → `fsync` file → rename over the original → optionally fsync the directory (POSIX). On Windows, rename-over-existing can fail with EPERM/EBUSY when antivirus, the indexer, or a sync client (OneDrive/Dropbox) holds the file — retry with backoff, and fall back to in-place write only as a last resort. Preserve file mode/ownership. Rename-replace changes the inode, which breaks hard links and triggers some watchers twice — acceptable.
- **External-change detection:** record `mtime + size` (and ideally a content hash) at open/save. On a watcher event, ignore events caused by the app's own save (compare hash). If the tab is clean, reload silently; if dirty, show a non-modal bar: "Changed on disk — Reload / Keep mine / Compare". Watch the parent directory rather than the file itself, because atomic saves by other apps replace the inode.
- **Auto-save strategy options:** (a) recovery-only (VS Code hot exit model): never touch the user's file without an explicit save, but snapshot to an app-data recovery folder about 1–2 s after edits stop, and restore on next launch; (b) true auto-save to the original file after a delay or on blur/tab switch. For office formats, (a) should be the default: serialising a large docx/xlsx through an engine is expensive and every save is a fidelity risk on files the user may not want rewritten. Offer (b) per format, on by default for .md/.txt/.csv.
- **Version history cheaply:** keep the last N recovery snapshots per document keyed by path hash (e.g. hourly for a day, daily for a month), plus "backup of original before first save by this app" — the single most valuable safety net while round-trip fidelity is unproven.
- **Lock files:** on open, check for `~$<name>` and `.~lock.<name>#`; if present, warn and offer read-only/open-a-copy. While editing, writing a LibreOffice-style lock file is cheap and makes LibreOffice warn its user; writing Word's binary owner-file format is fiddlier and optional. Always remove own locks on close and on next start (stale-lock cleanup keyed by own host/user). Never show `~$*` or `.~lock*` files in open dialogs or recents.
- **Conversion matrix (which tool for which pair):**

| From → To | Preferred tool | Notes |
|---|---|---|
| docx/xlsx/pptx → pdf | LibreOffice headless (`--convert-to pdf`), or x2t if the ONLYOFFICE stack is bundled | LibreOffice gives best general coverage; fidelity depends on installed fonts |
| docx ↔ odt, xlsx ↔ ods, pptx ↔ odp, legacy doc/xls/ppt → OOXML | LibreOffice headless or x2t | |
| md ↔ docx, md → html, md → pptx, docx → md | Pandoc | Best for structural (not layout) conversion; LibreOffice 26.2 can now also read/write Markdown |
| md/txt/html → pdf | Electron `webContents.printToPDF` on a rendered HTML view | No extra binary; controllable CSS |
| csv ↔ xlsx | The spreadsheet engine itself, or LibreOffice headless | Mind encoding/delimiter/locale; formula injection on csv open |
| pdf → docx | LibreOffice (Draw import) is poor; treat as "best effort" or omit | Genuinely hard; do not promise |
| pdf → txt/md | pdf.js text layer or Poppler `pdftotext` | |
| pdf merge/split/rotate | pdf-lib (JS) or qpdf | |
| xlsx → pdf | LibreOffice headless | Page breaks/print areas vary |

- Only one of LibreOffice or x2t needs to be bundled for MVP; choose based on the editing engine. LibreOffice is the more general converter but is a large dependency (consider "use system LibreOffice if found, otherwise offer download").
- LibreOffice headless caveats: slow cold start (seconds), one conversion at a time per user profile — use a dedicated `-env:UserInstallation` profile directory and a job queue, with timeouts.

### Gaps
- Word `~$` owner file binary layout, chokidar/parcel-watcher current versions, write-file-atomic, and the Electron/electron-builder API details were not re-verified this session (searches returned nothing usable or fetches were blocked); they are well-established but should be checked against current docs during implementation.
- No source found comparing auto-save policies for binary office formats specifically.
- x2t conversion coverage and command-line details belong to the editor-engine researcher's scope.

---

## 5. Command palette (Ctrl/Cmd+K), shortcuts, and full-text search

### Takeaway
Use `cmdk` (headless, the 2026 default for React) fed by a shell-owned command registry into which each editor session publishes its commands over the message bridge; resolve keyboard conflicts by intercepting a small reserved set of shell chords in the main process before the embedded editor sees them. For search across open/recent documents, SQLite FTS5 in the main process is the simplest durable option.

### Cited Findings
- cmdk is an unstyled, headless primitive where you render items yourself, suited to matching a custom design system; it does its own filtering and sorting. kbar is an action-registry style library, better when the palette is mostly keyboard actions, nested pages and app-wide shortcuts. A 2026 tooling directory calls cmdk the default choice and kbar the older alternative. — [pkgpulse: cmdk vs kbar vs Mantine Spotlight 2026](https://www.pkgpulse.com/guides/cmdk-vs-kbar-vs-mantine-spotlight-2026); [Web Dev Tools: command palette category](https://tooling-2ry.pages.dev/docs/categories/command-palette/); [kbar GitHub](https://github.com/timc1/kbar)
- ninja-keys is a framework-agnostic web component palette (works with vanilla JS, Vue, React, Svelte). — [awesome-command-palette](https://github.com/stefanjudis/awesome-command-palette)
- VS Code's model for routing: every command has an id and commands are contributed declaratively with optional keybindings and `when` context clauses; the palette lists whatever is registered. — [VS Code Custom Editor API guide](https://code.visualstudio.com/api/extension-guides/custom-editors) (general model; keybinding `when` clause details are background knowledge)
- Electron exposes `webContents.on('before-input-event')`, which lets the main process see and `preventDefault()` key events before the page (including an embedded editor view) handles them. — [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents) (background knowledge, not re-verified this session)
- Fuzzy matchers: uFuzzy (tiny, fast, good ranking for short phrase lists), fzf-for-js (fzf's algorithm, familiar scoring), Fuse.js (popular but slower and with looser, less predictable ranking). — [uFuzzy](https://github.com/leeoniya/uFuzzy); [fzf-for-js](https://github.com/ajitid/fzf-for-js); [Fuse.js](https://www.fusejs.io/) (background knowledge, not re-verified this session)
- Full-text options: SQLite FTS5 (built into SQLite; persistent, BM25 ranking, snippet/highlight functions), MiniSearch and FlexSearch (in-memory JS), tantivy (Rust, Lucene-class; natural fit for Tauri). — [SQLite FTS5](https://www.sqlite.org/fts5.html); [MiniSearch](https://github.com/lucaong/minisearch); [FlexSearch](https://github.com/nextapps-de/flexsearch); [tantivy](https://github.com/quickwit-oss/tantivy) (background knowledge, not re-verified this session)

### Inferences
- **Registry design:** one `CommandRegistry` in the shell. Sources: (1) shell commands (new, open, save, save as, export, close tab, switch tab, toggle theme); (2) per-format commands published by the active `EditorSession.getCommands()` when a tab activates and withdrawn when it deactivates; (3) dynamic providers for "go to file" (open tabs + recents) and content search. Each command: `{ id, title, category, keybinding?, when?, run() }`. Palette modes by prefix, VS Code/Raycast style: no prefix = files and tabs, `>` = commands, `/` or `?` = full-text search.
- Start with a curated list of 15–30 commands per engine (bold, heading levels, insert table, freeze panes, sort, add sheet, rotate page, etc.) mapped to whatever API the engine exposes, rather than attempting to mirror the engine's entire ribbon.
- **Shortcut conflicts:** embedded editors grab many chords (Ctrl+K is "insert hyperlink" in Word-like editors, Ctrl+P prints, Ctrl+S saves, Ctrl+W, Ctrl+Tab). Policy: (a) reserve a short list of shell chords (palette, save, close tab, next/previous tab, new, open) and intercept them at `before-input-event` on every editor view, so the editor never sees them; (b) everything else belongs to the focused editor; (c) make the palette chord configurable and offer Ctrl/Cmd+Shift+P as an alias since Ctrl+K collides with "insert link" muscle memory; (d) route Ctrl+S to the shell's save pipeline and disable the engine's own save/download. With same-renderer iframes the equivalent is a capture-phase `keydown` listener injected into each frame.
- Because the palette must appear above native editor views, render it in a dedicated overlay view or temporarily hide the active editor (see section 2).
- **Search:** for a personal app with hundreds to low thousands of documents, FTS5 via `better-sqlite3` in the main process is sufficient and persistent; an in-memory MiniSearch index is enough for an MVP limited to open tabs + recents. Text extraction per format: docx — `word/document.xml` text runs (mammoth raw text, or the engine's `getText`); xlsx — shared strings + cell values (SheetJS/ExcelJS); pptx — slide XML `a:t` runs; pdf — pdf.js `getTextContent` or `pdftotext`; md/txt/csv — raw. Index on save and on open, keyed by path + mtime; store extracted text, not the file.
- For palette-size lists (a few thousand strings), any matcher is fast enough; choose on ranking quality — uFuzzy or fzf-for-js over Fuse.js, or just cmdk's built-in scorer initially.

### Gaps
- No benchmark comparing uFuzzy, fzf-for-js and Fuse.js was found this session; the comparison is from background knowledge.
- No source describing how an existing app unifies commands from several embedded third-party editors into one palette — this appears to be genuinely novel integration work, and how much each engine exposes programmatically (ONLYOFFICE plugin/automation API, Univer command system, PDF.js event bus) determines its feasibility. That is engine-researcher scope.
- Electron `before-input-event` behaviour inside WebContentsView child views should be confirmed with a quick test.

---

## 6. UI stack for the shell: framework, docking/tabs, design system, state, theming

### Takeaway
React + TypeScript with dockview (tabs, splits, floating/popout groups; MIT core) and Radix/shadcn-style headless components is the most conservative stack — largest ecosystem, most AI-assistant training coverage, and the embedded engines' own SDKs lean React. A simple single tab strip is enough for MVP; add dockview when split view is wanted.

### Cited Findings
- dockview is a zero-dependency layout manager with tabs, groups, grids, split views, drag and drop, floating groups and popout windows (a group can be moved into a separate browser window and back). Packages: `dockview-core` (vanilla TypeScript engine), `dockview` (React bindings; peer deps react ≥ 16.8), `dockview-vue`, `dockview-angular`. The core is MIT; a commercial "Dockview Enterprise" tier now exists. — [dockview.dev](https://dockview.dev/); [GitHub mathuo/dockview](https://github.com/mathuo/dockview); [npm dockview](https://npmjs.com/package/dockview)
- dockview's current version is unclear from search: npm listing showed 4.4.x while pinned CDN READMEs reference 6.5.0, 7.0.2 (core) and 8.0.0 — so several majors shipped in 2025–2026; check npm before pinning. — [npm dockview](https://npmjs.com/package/dockview); [unpkg dockview@8.0.0 README](https://unpkg.com/dockview@8.0.0/README.md)
- cmdk is the headless palette primitive that shadcn/ui's `Command` component wraps, making it the natural fit for a Radix/shadcn design system. — [pkgpulse comparison](https://www.pkgpulse.com/guides/cmdk-vs-kbar-vs-mantine-spotlight-2026)
- Alternatives in the docking space: FlexLayout (React, mature, used in finance UIs), rc-dock (React), golden-layout (framework-agnostic, older). — [FlexLayout](https://github.com/caplin/FlexLayout); [rc-dock](https://github.com/ticlo/rc-dock); [golden-layout](https://github.com/golden-layout/golden-layout) (background knowledge, not re-verified this session)
- Ark UI is a headless component library (from the Chakra team, built on Zag state machines) with React, Solid, Vue and Svelte bindings — the option if not using React. — [Ark UI](https://ark-ui.com/) (background knowledge, not re-verified this session)
- ONLYOFFICE Desktop Editors 10 itself redesigned its start window and added tab context menus on macOS — tabbed multi-format shells keep converging on the same UI pattern. — [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2026/10/onlyoffice-desktop-editors-10)

### Inferences
- The shell UI is small (tab bar, sidebar, palette, dialogs, status bar); framework runtime performance is irrelevant next to the editors. Choose on ecosystem and AI-assist quality: React wins on both. Svelte/Solid would give a slightly leaner shell but fewer ready-made dock/palette components (dockview has no Svelte/Solid bindings, though `dockview-core` works from any framework).
- If editors are hosted in WebContentsViews, the dock library only manages empty placeholder rectangles; the shell must observe each panel's bounding box (ResizeObserver) and call `view.setBounds` to keep the native view aligned, and hide views during drag. This is workable for one visible editor (plain tabs) and fiddlier for arbitrary splits. If editors are iframes, they must not be re-mounted on layout changes (dockview offers a render mode that keeps panel DOM alive for exactly this reason — verify the option name in current docs).
- State management: keep it boring — Zustand (or Redux Toolkit) store in the shell renderer for tabs/layout/commands; the main process is the source of truth for documents on disk, recents, and settings (JSON or SQLite). Persist the layout via dockview's `toJSON()`/`fromJSON()` to restore sessions.
- Theming: define CSS variables (light/dark, following `nativeTheme`/`prefers-color-scheme`) in the shell and pass the theme through `EditorSession.setTheme`. Full visual consistency with third-party editors is not achievable; realistic targets: (1) match light/dark and accent colour where the engine has theme hooks (ONLYOFFICE ships light/dark UI themes; Univer and PDF.js viewer are themable via CSS/config), (2) hide each engine's own file/title chrome so only the shell provides tabs and file actions, (3) prefer engines' compact toolbar modes for the "distraction-free" look, and (4) keep the document canvas white in dark mode by default (as Word does) unless the user opts in.
- A "minimal" look mostly comes from removing duplicated chrome (engine headers, logos, file menus), not from restyling the engines' toolbars.

### Gaps
- dockview's exact current major version and the Enterprise/MIT feature split were not confirmed (conflicting listings).
- No source found on theming ONLYOFFICE/Univer to match a host shell beyond their own built-in themes; depth of customisation belongs to the engine researcher.
- No comparative 2026 source on React vs Svelte vs Solid specifically for dock-style workspaces.

---

## 7. Prior art: all-in-one document apps — what they prove and where they fall short

### Takeaway
Tabbed all-in-one office apps already exist and are good (ONLYOFFICE Desktop Editors 10, WPS, Collabora Office), which proves the single-window multi-format pattern but also means a custom app only earns its keep through things those apps do not do: Markdown/text/CSV as first-class peers, a unified command palette, a distraction-free shell, personal automation/AI hooks, and a pluggable best-engine-per-format design. Several open-source projects show the ONLYOFFICE editors can run fully client-side with x2t compiled to WASM.

### Cited Findings
- ONLYOFFICE Desktop Editors 10.0 (Oct 2026): tabbed docx/xlsx/pptx/pdf editors, optional AI tools, redesigned start window, new cloud provider connections; press coverage describes "modular apps" and 35 closed security issues. — [ONLYOFFICE blog](https://www.onlyoffice.com/blog/2026/10/onlyoffice-desktop-editors-10); [technode press release](https://technode.global/prnasia/onlyoffice-10-0-brings-ai-tools-modular-apps-and-stronger-security-to-its-open-source-office-suite/); [borncity](https://borncity.com/news/onlyoffice-10-0-50-neue-funktionen-und-35-geschlossene-sicherheitsluecken/)
- ONLYOFFICE Desktop 9.3 (Feb 2026) added multiple-window support on macOS; 9.4 followed 19 May 2026. — [ONLYOFFICE blog 9.3](https://onlyoffice.com/blog/2026/02/onlyoffice-desktop-editors-9-3); [desktop changelog](https://helpcenter.onlyoffice.com/desktop/desktop-changelog.aspx)
- Collabora Office (new desktop line since Nov 2025; 26.04 in 2026): LibreOffice engine with the Collabora Online web UI, offline, on Windows/macOS/Linux; lacks Base and macro editing compared with Classic. — [Collabora press release](https://www.collaboraonline.com/blog/press-release-bringing-collabora-online-to-the-desktop/); [Collabora Office 26.04](https://www.collaboraonline.com/blog/collabora-office-26-04-release/)
- LibreOffice 26.2 (Feb 2026): added Markdown support and Office-compatibility improvements — the classic suite is itself moving toward multi-format including Markdown. — [heise](https://heise.de/-11165526)
- Univer 1.0 was released 24 Sep 2026 (later notes reference v1.5.0), positioned as an open-source office SDK (Sheets, Docs, Slides; Apache-2.0 core) and "a harness for AI agents". Import/export of xlsx/docx/pptx/pdf is tied to the commercial Pro packages according to most sources; v1.5.0 notes say exports continue with a licence watermark after a monthly allowance of 10 watermark-free exports. It is an embeddable SDK, not a desktop app. — [Univer v1.0.0 release](https://newreleases.io/project/github/dream-num/univer/release/v1.0.0); [Univer v1.5.0 release](https://newreleases.io/project/github/dream-num/univer/release/v1.5.0); [ai-tldr summary](https://ai-tldr.dev/releases/dream-num-univer-1-0/) (sources disagree on the exact free/Pro boundary)
- Client-side ONLYOFFICE projects: `ranuts/document` (browser-only ONLYOFFICE-based editor; cached resources work offline), `InledGroup/office` ("free, local, client-side Office suite powered by OnlyOffice on WASM"), `sweetwisdom/onlyoffice-web-local` (pure-frontend, format conversion through x2t-wasm, AGPL-3.0). These reuse the x2t WebAssembly build that CryptPad maintains for its ONLYOFFICE integration. — [ranuts/document wiki](https://github.com/ranuts/document/wiki); [InledGroup/office](https://github.com/InledGroup/office); [sweetwisdom/onlyoffice-web-local](https://awesome.ecosyste.ms/projects/github.com%2Fsweetwisdom%2Fonlyoffice-web-local)
- LibreOffice in WASM: ZetaOffice (allotropia) with the `zetajs` npm library (1.1.0–1.2.0 seen) lets a page embed and script LibreOffice WASM via UNO; examples load the binary from the ZetaOffice CDN, and self-hosting requires CORS headers; OPFS support and binary-size reduction were roadmap items in 2025 talks. — [zetajs on npm](https://npmjs.com/package/zetajs); [allotropia launch post](https://blog.allotropia.de/2024/11/08/launching-zetaoffice/); [The Register, Feb 2025](https://www.theregister.com/2025/02/13/libreoffice_wasm_zetaoffice/)
- Stirling-PDF: full PDF toolbox with a Tauri desktop client bundling its Java backend; shows that "web UI + bundled heavy backend" desktop packaging is maintainable by a small team. — [DeepWiki: Stirling-PDF](https://deepwiki.com/Stirling-Tools/Stirling-PDF/2.3-configuration-system)
- A commercial precedent for "DOCX editor inside Tauri" is Apryse's WebViewer tutorial — proprietary SDK, but confirms the embedding pattern. — [Apryse blog](https://apryse.com/blog/webviewer/docx-editor-tauri)
- An academic-style comparison of LibreOffice vs ONLYOFFICE round-trip behaviour exists, using XML structural diffs plus ImageMagick pixel comparison of headless PDF exports — both engines lose information on round trip to differing degrees. — [A Comparative Study of OOXML and ODF Implementations (PDF)](https://akrillick.github.io/web/archive/A%20Comparative%20Study%20of%20OOXML%20and%20ODF%20Implementations.pdf) (rigor unverified)

### Inferences
- **What existing apps prove:** (1) a tabbed single window over docx/xlsx/pptx/pdf is the accepted UX; (2) a web-technology UI over a native or WASM engine is now mainstream (ONLYOFFICE via CEF, Collabora's new desktop); (3) the editors can be embedded by third parties without a document server (ranuts/InledGroup/sweetwisdom via x2t-WASM).
- **Where they fall short for this brief:** ONLYOFFICE Desktop, WPS and Collabora are office suites first — Markdown/plain-text/CSV are not first-class distraction-free editors; no universal command palette across formats; busy ribbon UIs; limited extensibility for personal workflows; WPS is proprietary with ads/account prompts and telemetry concerns (UNVERIFIED this session). Anytype/AppFlowy/AFFiNE solve "all-in-one" by inventing their own block formats, so they do not open/save real .docx/.xlsx files round-trip. CryptPad is server/browser-oriented. Univer is an SDK with file import/export behind a commercial licence.
- **Honest value test:** if the user's need is only "open and edit Office files and PDFs in tabs offline", ONLYOFFICE Desktop Editors 10 already does that for free, and the custom app cannot beat its fidelity (it would be embedding the same engine). The custom app is justified by the shell: Markdown + text + CSV + office + PDF under one palette, one file pipeline with safety nets (snapshots/version history), a minimal look, and room for personal features.
- **Licensing consequence:** ONLYOFFICE editors and the x2t-based community wrappers are AGPL-3.0. For private personal use this imposes no practical obligation, but distributing the app would require AGPL compliance (and attention to ONLYOFFICE's branding terms). Flag for the report; details are the engine researcher's scope.

### Gaps
- WPS Office: no 2026 source gathered (version, architecture, privacy posture) — claims about it above are unverified background.
- Anytype/AppFlowy/AFFiNE/CryptPad: not searched this session; statements are general background.
- No indie Electron or Tauri project wrapping ONLYOFFICE or LibreOffice-WASM as a polished multi-format desktop app was found; the wrappers found are browser apps. Absence in one search is weak evidence.
- Maintenance status, stars, and last-commit dates of ranuts/document, InledGroup/office, and sweetwisdom/onlyoffice-web-local were not checked.
- ZetaOffice/zetajs 2026 status (performance, binary size, OPFS) not confirmed.

---

## 8. Testing and verification: round-trip fidelity strategy

### Takeaway
Use a layered harness per test file — (1) package/schema validity, (2) semantic comparison of extracted content, (3) visual regression of renders before vs after — run over a curated corpus, with end-to-end "open → edit → save → reopen" automation via Playwright's Electron support. No single layer is sufficient: validators have no layout engine, and pixel diffs cannot tell you what was lost.

### Cited Findings
- A published comparison methodology matches this layering: export back to the original format, structurally diff input vs output XML to quantify degradation, and measure layout fidelity by rendering headless PDF exports and running pixel-mismatch analysis with ImageMagick. — [A Comparative Study of OOXML and ODF Implementations (PDF)](https://akrillick.github.io/web/archive/A%20Comparative%20Study%20of%20OOXML%20and%20ODF%20Implementations.pdf) (rigor unverified)
- Open-source visual-regression precedents: `docxide-pdf` compares its output against Word-generated reference PDFs using Jaccard and SSIM metrics (`tests/visual_comparison.rs`, fixtures pair a DOCX with a reference PDF); `dom-docx` runs render → convert to DOCX → rasterise with LibreOffice → score layout and structure, using LibreOffice only in the test harness. — [docxide-pdf](https://docs.rs/crate/docxide-pdf/0.8.0); [dom-docx README](https://cdn.jsdelivr.net/npm/dom-docx@1.0.1/README.md)
- The Open XML SDK is MIT-licensed and validates/manipulates OOXML but has no layout engine or rendering, so it must be paired with a renderer for visual checks. — [Nutrient DOCX SDK buyer's guide](https://www.nutrient.io/sdk/docx-editor-buyers-guide/) (vendor source)
- A layered verifier design in the wild: Uniword describes checks for OPC package integrity plus XSD validation against 40 bundled schemas as separate layers of round-trip verification. — [Uniword round-trip fidelity guide](https://metanorma.github.io/uniword/guides/round-trip-fidelity/) (project's own claim)
- Apache POI's repository carries OOXML test files under `test-data/` (e.g. `test-data/openxml4j` with small docx/xlsx/pptx plus deliberate OPC-compliance failure cases); the wider `test-data` tree has per-format folders (document, spreadsheet, slideshow). — [Apache POI test-data/openxml4j](https://apache.googlesource.com/poi/+/trunk/test-data/openxml4j)
- Microsoft and Fraunhofer published a public library of ISO/IEC 29500 interoperability test documents under CC BY 3.0, with validators attached. — [Microsoft archive blog (Chris Rae)](https://learn.microsoft.com/nl-nl/archive/blogs/chrisrae/new-interoperability-testing-library-for-isoiec-29500-documents) (old; current availability of the site not checked)
- An Apache OpenOffice bug thread recommends running both the POI-based and Microsoft (Open XML SDK) validators in test automation because each catches different errors. — [AOO Bugzilla 124282](https://bz.apache.org/ooo/show_bug.cgi?id=124282)
- Playwright has experimental Electron support through the `_electron` namespace (`const { _electron } = require('playwright')`); `electron.launch({ args: ['main.js'] })` returns an `ElectronApplication` to control the main process and windows; browser downloads can be skipped with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Electron's own docs list Playwright as a testing option via CDP. — [Playwright: class Electron](https://playwright.dev/docs/api/class-electron); [Electron: Automated Testing](https://electronjs.org/docs/latest/tutorial/automated-testing)
- Tauri E2E: `tauri-driver` used directly supports only Windows and Linux on desktop, because macOS has no WKWebView driver. Tauri's docs now recommend WebdriverIO with `@wdio/tauri-service`, whose embedded provider (`tauri-plugin-wdio-webdriver`) covers macOS too; CrabNebula's fork supports macOS with a paid API key. — [Tauri WebDriver docs](https://v2.tauri.app/develop/tests/webdriver/); [WebdriverIO Tauri platform support](https://webdriver.io/docs/desktop-testing/tauri/platform-support)
- Tools named in the brief, canonical locations: Open XML SDK `OpenXmlValidator` ([dotnet/Open-XML-SDK](https://github.com/dotnet/Open-XML-SDK)); Office-o-tron ODF/OOXML validator ([officeotron](https://github.com/probatron/officeotron)); ODF Validator ([ODF Toolkit](https://odftoolkit.org/conformance/ODFValidator.html)); pixelmatch ([mapbox/pixelmatch](https://github.com/mapbox/pixelmatch)); odiff ([dmtrKovalenko/odiff](https://github.com/dmtrKovalenko/odiff)); qpdf `--check` ([qpdf docs](https://qpdf.readthedocs.io/)); veraPDF from the Open Preservation Foundation ([verapdf.org](https://verapdf.org/)); python-docx ([docs](https://python-docx.readthedocs.io/)); openpyxl ([docs](https://openpyxl.readthedocs.io/)); python-pptx ([docs](https://python-pptx.readthedocs.io/)); GovDocs1 corpus of about one million public documents ([Digital Corpora](https://digitalcorpora.org/corpora/file-corpora/files/)); LibreOffice's crash-testing/bug-document infrastructure that harvests Bugzilla attachments ([LibreOffice core repo `bin/get-bugzilla-attachments-by-mimetype`](https://github.com/LibreOffice/core/blob/master/bin/get-bugzilla-attachments-by-mimetype)). — all (background knowledge, not re-verified this session)

### Inferences
- **Recommended harness (per corpus file, per engine):**
  1. *Open-and-save without edits* through the real app engine (headless via Playwright, or via the engine's conversion path) to produce `out.ext`.
  2. *Layer A — validity:* zip integrity; `[Content_Types].xml` and relationship targets resolve; XSD validation (Open XML SDK validator as a small .NET CLI; officeotron as a second opinion); for PDF `qpdf --check`. Gate: zero new errors compared with the input (inputs from the wild are often already non-conformant, so compare error sets, do not demand zero).
  3. *Layer B — package diff:* list parts added/removed (e.g. dropped `customXml`, VBA, embedded fonts, comments, tracked-changes parts); canonicalise XML (sort attributes, strip rsids and volatile ids) and diff per part. Report as an informational "what the engine rewrote" summary rather than a pass/fail — engines legitimately rewrite most XML.
  4. *Layer C — semantic:* docx via python-docx: paragraph text, style names, run formatting, tables, headers/footers, comment count, tracked-change count, image count; xlsx via openpyxl loaded twice (formulas, and cached values): cell values, formulas, number formats, merged ranges, defined names, sheet order, conditional-format and data-validation counts, chart count; pptx via python-pptx: slide count, shapes per slide with type/position/size, text, notes; pdf: page count, per-page text, annotation/form-field counts. Gate: exact equality on text/values/formulas; tolerances on geometry.
  5. *Layer D — visual:* render both the original and `out.ext` to PDF with the same pinned LibreOffice build and font set (ideally in a container so renders are deterministic), rasterise pages (e.g. `pdftoppm` at 100–150 dpi), compare page-by-page with pixelmatch/odiff or SSIM. Because the same renderer is used on both sides, differences reflect what the save changed, not renderer inaccuracy. Gate: page count equal; per-page diff below a threshold; keep diff images as artifacts.
  6. *Edit round trip:* scripted small edit (type a word, change one cell, move a shape, add a PDF annotation) → save → reopen → assert the edit is present and Layers A–D show only localised change.
- **Cross-check with the real apps:** a small "golden" subset should be opened manually (or via COM automation on Windows) in Microsoft Office to catch "file opens with repair prompt" failures — the most damaging class, which Layer A catches only partly.
- **Corpus strategy:** start with 30–50 of the user's own real documents (the files that actually matter), add a few hundred from Apache POI test-data and LibreOffice bug attachments for feature coverage (tracked changes, footnotes, pivot tables, charts, SmartArt, embedded OLE, RTL text, password protection), and sample GovDocs1 for scale/robustness (crash and timeout detection rather than fidelity). Tag each file with the features it exercises so regressions can be reported by feature.
- **Known hard cases to include deliberately:** tracked changes and comments, fields/TOC, SmartArt and charts, macros (xlsm/docm — must be preserved or refused, never silently dropped), pivot tables and slicers, conditional formatting, external links, embedded fonts, custom XML parts/content controls, PDF forms/signatures (a saved edit invalidates signatures — warn).
- **E2E:** Playwright `_electron` is "experimental" in name but widely used and is another reason Electron is the lower-risk shell; with WebContentsViews, each view's page is reachable through the Electron app's windows/CDP targets (verify early). Tauri's E2E story works but needs the WebdriverIO service for macOS.
- Policy outcome of testing: maintain a per-format "safe to overwrite" status. Until a format passes the corpus gates, the app should default to "Save a copy" or auto-backup the original on first save.

### Gaps
- Could not verify this session: current maintenance state of officeotron, the Fraunhofer/Microsoft document-interoperability corpus availability, the LibreOffice bug-document download script location, and OpenPreserve's format corpus — URLs given are canonical from background knowledge and need a click-through check.
- No source found documenting how ONLYOFFICE or Collabora test round-trip fidelity internally.
- No ready-made open-source "OOXML round-trip test harness" that combines all layers was found; the harness must be assembled (roughly a few days of scripting).
- Whether Playwright can attach to pages inside `WebContentsView` children without extra work was not confirmed.

---

## 9. Realistic scope/effort and MVP phasing for a solo developer with AI assistance

### Takeaway
Building editors is out of reach for a solo developer (the comparable products are multi-year, team-scale efforts), but building a shell around existing engines is feasible: the shell, file pipeline, and palette are a matter of weeks; the long tail is engine integration quirks and round-trip trust. Phase by format risk — text formats first, then PDF, then spreadsheets/documents/presentations via one embedded suite.

### Cited Findings
- Electrobun — a framework only, not editors — took its creator roughly two years to reach v1. — [Electrobun v1 post](https://blackboard.sh/blog/electrobun-v1/)
- Collabora needed the existing LibreOffice core plus the existing Collabora Online UI to ship a new desktop app, announced Nov 2025, and as of that launch still lacked features of Classic (Base, macro editing) with enterprise support targeted for 2026. — [It's FOSS](https://itsfoss.com/news/collabora-launches-desktop-office-suite/); [Collabora press release](https://www.collaboraonline.com/blog/press-release-bringing-collabora-online-to-the-desktop/)
- Univer took until 24 Sep 2026 to declare 1.0 for its Sheets/Docs/Slides SDK, with a company behind it. — [Univer v1.0.0](https://newreleases.io/project/github/dream-num/univer/release/v1.0.0)
- ONLYOFFICE is still shipping major rebuilds at version 10 (Oct 2026) after more than a decade of development. — [UbuntuHandbook](https://ubuntuhandbook.org/index.php/2026/10/onlyoffice-desktop-editors-10-0-0-released-with-optional-ai-tools/)
- Small projects have successfully wrapped the ONLYOFFICE editors client-side with x2t-WASM, showing the "wrap, don't build" route is within reach of individuals or very small teams. — [ranuts/document](https://github.com/ranuts/document/wiki); [InledGroup/office](https://github.com/InledGroup/office)
- Stirling-PDF's desktop client reuses its existing web UI and backend inside Tauri rather than building a native app. — [DeepWiki: Stirling-PDF](https://deepwiki.com/Stirling-Tools/Stirling-PDF/2.3-configuration-system)

### Inferences
- **Suggested phasing (effort estimates are my judgement for an experienced solo developer using AI coding tools; not sourced):**
  - *Phase 0 — spikes (about 1 week):* prove the riskiest assumptions before committing: load the chosen docx/xlsx/pptx engine offline inside an Electron `WebContentsView` from a custom protocol; open a real file and get bytes back out; measure memory per tab; confirm shell shortcuts can be intercepted. Decide Electron vs Tauri on evidence.
  - *Phase 1 — shell + text formats (about 2–3 weeks):* Electron app, tab strip, `EditorProvider` registry, file pipeline (open/save/save as, atomic writes, recents, drag-and-drop, file associations, external-change detection), recovery snapshots, command palette with shell commands, light/dark theme. Engines: CodeMirror 6 for .md/.txt (with Markdown preview), a grid for .csv. This is already a usable daily tool.
  - *Phase 2 — PDF (about 1–2 weeks):* PDF.js viewer with search, annotations where supported, page operations (merge/split/rotate via pdf-lib or qpdf), print-to-PDF export from Markdown.
  - *Phase 3 — office formats via one embedded suite (about 4–8 weeks, high variance):* integrate the docx/xlsx/pptx engine behind the provider interface; wire save/dirty/commands; bundle the converter (x2t or LibreOffice); build the round-trip test harness in parallel and default to "backup original on first save".
  - *Phase 4 — polish and trust (ongoing):* tab hibernation, full-text search, export matrix UI, version history browser, per-format command coverage, installers/auto-update, corpus-driven fidelity fixes.
- **Where AI assistance helps most and least:** shell, pipeline, palette, test harness are well-trodden and fast with AI. Engine integration is under-documented, version-specific, and requires reading the engine's source; expect most of the calendar time and frustration there. Fidelity bugs inside a third-party engine are generally not fixable by the app author — the mitigation is engine choice, backups, and clear "safe formats" status.
- **Scope traps to avoid:** building a custom docx/xlsx renderer or editor; promising PDF → Word conversion; real-time collaboration; mobile; supporting all three OSes from day one (pick the daily-driver OS, keep the others building in CI); unifying the engines' toolbars visually.
- **Decision checkpoint after Phase 1–2:** honestly compare the result plus ONLYOFFICE Desktop Editors side by side. If Phase 3 would only reproduce ONLYOFFICE Desktop in a different frame, an alternative is to keep the custom app for md/txt/csv/pdf and hand .docx/.xlsx/.pptx off to the installed office suite ("open with") — a much smaller project with most of the daily value.

### Gaps
- No published effort data (person-months) for wrapping ONLYOFFICE or LibreOffice-WASM in a desktop shell was found; all time estimates are judgement, not evidence.
- Team sizes and development timelines for ONLYOFFICE, WPS, and Collabora were not sourced this session.
- Maintenance burden estimate (Electron major upgrades about every 8 weeks, engine upgrades, OS signing/notarisation costs for macOS and Windows) is not quantified; code-signing requirements and costs were not researched.
