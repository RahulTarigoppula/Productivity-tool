# Cross-platform technology strategy and mobile (Windows → Android → macOS / iOS / iPadOS)

Researched 2026-11-21. Scope: one code-sharing strategy for a personal, local-first, all-in-one document app; what must differ on phones and tablets; hard platform limits.

**Evidence tags used on every claim**

- **[read]** — I fetched the primary page/file in this session and read the text (npm registry JSON, raw GitHub files, developer.android.com, developer.apple.com, github.com pages).
- **[search]** — taken from a search-engine summary only; the page itself was not opened. Treat numbers as indicative.
- **[background]** — my own prior knowledge (cutoff mid-2026), not re-verified this session. Verify before relying on it.

**Access limits in this session.** The sandbox could reach github.com, raw.githubusercontent.com, registry.npmjs.org, developer.android.com and developer.apple.com. It could NOT reach v2.tauri.app, tauri.app, webkit.org / bugs.webkit.org, onlyoffice.com, capacitorjs.com, flutter.dev, reactnative.dev, codemirror.net, android-developers.googleblog.com, news.ycombinator.com, wikipedia. Claims from those hosts are [search] only. Tauri docs were read from the docs source repo (`tauri-apps/tauri-docs`, branch `v2`) instead. Nothing here was tested on a device.

---

## 1. Tauri v2 on mobile: version, maturity, plugins, webviews, sidecars, build and signing

### Takeaway
Tauri is on 2.12.x (18 Nov 2026) and its Android and iOS targets are real and shipping, with first-party support for the things this app needs most (file dialogs, file associations incl. Android VIEW/SEND intents, deep links, biometric, notifications), but mobile is still visibly second-tier: the in-app updater, window-state, single-instance, autostart and CLI plugins do not exist on mobile, the `shell`/sidecar, `fs`, `persisted-scope` and `localhost` plugins are marked "unknown/untested" on mobile, and durable "save back to the same file" on Android/iOS needs community plugins or a small custom Kotlin/Swift plugin. No sidecar binaries on mobile, so every desktop sidecar in the current plan needs an in-process or WASM replacement.

### Cited Findings

**Versions (date-stamped)**
- [read] `tauri` v2.12.7 and `tauri-cli` v2.12.6 released 18 Nov; `tauri-runtime-wry` 2.12.5 builds on `wry` 0.57.0. — [tauri releases](https://github.com/tauri-apps/tauri/releases)
- [read] npm: `@tauri-apps/cli` 2.12.6 (2026-11-18), `@tauri-apps/api` 2.12.5 (2026-11-16), `plugin-dialog` 2.8.4 (2026-10-28), `plugin-fs` 2.7.1 (2026-10-14), `plugin-deep-link` 2.6.3 (2026-10-28), `plugin-biometric` 2.5.0 (2026-10-14), `plugin-updater` 2.14.1 (2026-10-28), `plugin-notification` 2.8.1 (2026-11-10), `plugin-opener` 2.7.3 (2026-11-10). — [npm registry](https://registry.npmjs.org/@tauri-apps/cli)
- [search] One 2026 tutorial blog mentions a Tauri `3.0.0-alpha.6` pre-release while saying 2.x is the stable line. Not confirmed against a primary source; I found no official Tauri 3 roadmap statement. — [tech-insider tutorial](https://tech-insider.org/tauri-tutorial-cross-platform-rust-app-2026/)
- [search] Tauri 2.0 stable shipped Oct 2024; the RC post said mobile was "not yet a first-class target" and that not all desktop features and plugins were ported to mobile, to be closed in later minors. — [Tauri 2.0 RC blog](https://v2.tauri.app/blog/tauri-2-0-0-release-candidate/), [Tauri 2.0 stable blog](https://v2.tauri.app/blog/tauri-20/)

**Official plugin coverage on mobile** (from the plugins-workspace README table; legend there: ✅ "(Partially) Supported", ❌ "Not supported", `?` "Unknown/Untested or Planned")
- [read] ✅ on both iOS and Android: `dialog`, `deep-link`, `clipboard-manager`, `http`, `log`, `notification`, `opener`, `os`, `sql`, `store`, `upload`, plus mobile-only `biometric`, `barcode-scanner`, `geolocation`, `haptics`, `nfc`, `torch`. — [plugins-workspace README](https://github.com/tauri-apps/plugins-workspace/blob/v2/README.md)
- [read] ❌ on iOS and Android: `updater` (in-app updates), `window-state`, `single-instance`, `autostart`, `cli`, `positioner`. — [plugins-workspace README](https://github.com/tauri-apps/plugins-workspace/blob/v2/README.md)
- [read] `?` (unknown/untested) on iOS and Android: `fs`, `shell` (child processes / sidecars), `process`, `persisted-scope`, `global-shortcut`, `localhost`, `stronghold`, `websocket`. — [plugins-workspace README](https://github.com/tauri-apps/plugins-workspace/blob/v2/README.md)
- [read] Plugins workspace requires Rust ≥ 1.90. — [plugins-workspace README](https://github.com/tauri-apps/plugins-workspace/blob/v2/README.md)
- [read] Although the README marks `fs` as `?` on mobile, the fs docs do carry Android and iOS setup sections (Android: `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` manifest permissions for public directories; iOS: a `PrivacyInfo.xcprivacy` file declaring the file-timestamp API reason). — [tauri-docs file-system.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/file-system.mdx)
- [read] Dialog plugin: "On iOS, `file://<path>` URIs are returned. On Android, content URIs are returned." — [tauri-docs dialog.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/dialog.mdx)
- [search] The fs plugin reads `content://` URIs through Android's ContentResolver and handles iOS security-scoped access automatically for picker URLs; one developer PR reports that each open starts security-scoped access with nothing ending it (unconfirmed leak). — [fs JS reference](https://v2.tauri.app/reference/javascript/fs/), [hanzitutor PR #61](https://github.com/hherb/hanzitutor/pull/61)

**File associations, "open with", share target**
- [read] "Tauri supports file associations on Android and iOS." Declared once in `tauri.conf.json > bundle.fileAssociations`; the CLI generates Android intent filters and iOS `CFBundleDocumentTypes`/`UTExportedTypeDeclarations`. Option `androidIntentActionFilters` takes `Send`, `SendMultiple`, `View`, "all three are used by default" — so the app is both an "open with" target and a share target on Android without an extra plugin. Opened files arrive as `RunEvent::Opened` (macOS, iOS, Android), both for cold start and when already running. — [tauri-docs mobile-file-associations.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/learn/mobile-file-associations.mdx)
- [search] This landed around a 2.6.0 plugin/CLI release dated 30 Apr 2026; the earlier feature request is tauri issue #13844. — [tauri-plugin changelog](https://tauri.app/release/tauri-plugin/all-versions/), [issue #13844](https://github.com/tauri-apps/tauri/issues/13844)
- [search] Community plugins fill the remaining gaps: `tauri-plugin-mobile-sharetarget` (incoming shares, Android + iOS), `tauri-plugin-sharesheet` / `tauri-plugin-sharekit` (outgoing share sheet), `tauri-plugin-android-fs` (SAF pickers, persistable URI permissions; v12.0.0 on crates.io), `tauri-plugin-ios-bookmark` (Files picker + security-scoped bookmark create/store/reopen). — [mobile-sharetarget](https://docs.rs/crate/tauri-plugin-mobile-sharetarget/latest/source/README.md), [sharekit](https://lib.rs/crates/tauri-plugin-sharekit), [android-fs](https://crates.io/crates/tauri-plugin-android-fs/12.0.0), [ios-bookmark](https://docs.rs/tauri-plugin-ios-bookmark/latest/tauri_plugin_ios_bookmark/)

**Rendering engines**
- [read] Windows: "Tauri uses Microsoft Edge WebView2 to render content on Windows"; WebView2 "is already installed on Windows 10 (from version 1803 onward) and later". — [tauri-docs prerequisites.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/start/prerequisites.mdx)
- [background] Android uses Android System WebView (Chromium, updated through Google Play independently of the OS); iOS/iPadOS uses WKWebView (WebKit, updated only with the OS); macOS uses WKWebView. So the app faces Chromium on Windows + Android and WebKit on macOS + iOS: two engines, four platforms.

**Sidecars / native binaries**
- [read] The sidecar ("Embedding External Binaries") doc describes `externalBin` only in desktop terms and has no Android/iOS section; the `shell` plugin that spawns them is `?` on mobile. — [tauri-docs sidecar.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/develop/sidecar.mdx), [plugins-workspace README](https://github.com/tauri-apps/plugins-workspace/blob/v2/README.md)
- [background] iOS forbids spawning child processes from an app (no `fork`/`exec` in the sandbox) and forbids JIT in the app's own process; all native code must be linked into the signed app. Android (targetSdk ≥ 29) blocks executing files from the app's writable data directory; a binary can only be run if it ships inside the APK's native-library directory, which is a fragile trick. Practical rule: on mobile, anything native must be a library linked into the Rust core (`.so` / static lib), not a process.

**Rust core reuse and build/signing workflow**
- [read] One Rust crate serves all targets via `#[cfg_attr(mobile, tauri::mobile_entry_point)]`. — [tauri-docs file-system.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/file-system.mdx)
- [read] Android prerequisites: Android Studio, SDK Platform + Platform-Tools + Build-Tools + Command-line Tools, NDK, `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, and four rustup targets (`aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`). Android builds work from Windows. iOS needs full Xcode on a Mac. — [tauri-docs prerequisites.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/start/prerequisites.mdx)
- [read] `tauri android build --apk` or `--aab`; `--target aarch64` and `--split-per-abi` shrink the output ("By default the generated AAB and APK is universal, containing all supported targets"); minimum Android is 7.0 / SDK 24, configurable via `bundle.android.minSdkVersion`; `versionCode = major*1000000 + minor*1000 + patch`. — [tauri-docs google-play.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/distribute/google-play.mdx)
- [read] iOS: `tauri ios build --export-method app-store-connect` produces an IPA in `src-tauri/gen/apple/build/arm64/`; upload via `xcrun altool`; needs certificate + provisioning profile. Mac App Store builds must enable App Sandbox entitlements. — [tauri-docs app-store.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/distribute/app-store.mdx)

**Maturity signals (secondary sources only)**
- [search] 2026 blog consensus: mobile is "functional but less mature than desktop"; rough edges are plugin support, signing and webview quirks; several authors still recommend React Native/Flutter for mobile-first products. One comparison calls Tauri v2 "production-ready for mobile" with unsourced figures. None of the results named a verified, well-known production mobile app built on Tauri. — [CODERCOPS](https://blog.codercops.com/blog/tauri-2-desktop-mobile-apps-rust-web-2026), [MakerStack review](https://makerstack.co/reviews/tauri-review/), [butlermindhub](https://butlermindhub.com/blogs/tauri-v2-vs-react-native), [rustify](https://rustify.rs/articles/rust-tauri-vs-electron-2026)
- [search] A May 2026 team decision record evaluated Capacitor 8.0 against Tauri 2.11 and rejected both in favour of fully native apps (team-specific). — [range-day decision doc](https://range-day-docs.pages.dev/decisions/Tauri-vs-Capacitor)

### Inferences
- For THIS app the Tauri-mobile gaps that matter are narrow and known: (1) no updater on mobile (irrelevant for a sideloaded personal app: reinstall the APK / re-run from Xcode); (2) durable file handles (Android persistable URI permission, iOS security-scoped bookmark) are not first-party, so plan a ~200-line Kotlin + Swift plugin or adopt the two community plugins; (3) no sidecars.
- Because mobile Tauri plugins are written in Kotlin and Swift anyway, anything missing (pen input, print, share sheet) can be added natively without leaving Tauri. The exit cost is also low if the web UI talks only to the `platform` interface: the same web bundle can be dropped into a Capacitor or hand-written native shell.
- Multiwebview (one webview per editor tab) is a desktop feature; assume ONE webview per window on mobile and host editors as iframes inside it. (Existing notes cover desktop multiwebview; I found no mobile statement, so this is a planning assumption.)

### Gaps
- No primary-source list of notable production apps shipping on Tauri mobile; awesome-tauri and the Tauri showcase were not reachable.
- No official roadmap text for Tauri 3 or for mobile parity was reachable; the "3.0.0-alpha.6" mention is a single blog.
- Minimum Android System WebView / iOS version actually required by wry 0.57 not confirmed (docs page `reference/webview-versions` 404 in the docs repo).
- Whether Tauri's custom protocol on iOS/Android serves a ~100 MB on-demand engine pack from app storage with the right MIME types and range requests, and whether cross-origin isolation headers (COOP/COEP for `SharedArrayBuffer`) can be set on mobile, is untested.

---

## 2. Alternatives compared for this app (heavy web engines embedded)

### Takeaway
Because roughly all of the document-editing value sits inside web engines (ONLYOFFICE sdkjs, PDF.js, a web text editor), every credible option ends up being "a webview with native glue"; frameworks that draw their own UI (Flutter, Compose, MAUI, React Native) add a second UI stack without removing the webview. The realistic contest is Tauri-everywhere versus Tauri (or Electron) on desktop + Capacitor on mobile; both share the same web UI, and the `platform` interface keeps the choice reversible.

### Cited Findings
- [read] Current versions: `@capacitor/core` 8.6.2 (2026-11-12); `electron` 45.4.1 (2026-11-19); `react-native` 0.88.1 (2026-10-27); `react-native-windows` 0.85.2 (2026-11-13); `react-native-macos` 0.83.0 (2026-09-30); `react-native-webview` 14.0.1 (2026-06-20); `expo` 58.0.26 (2026-11-17). — [npm registry](https://registry.npmjs.org/@capacitor/core)
- [search] Capacitor 8 was announced 8 Dec 2025; Swift Package Manager is the default for new iOS projects; requires Xcode 26+ and Android Studio Otter 2025.2.1+. — [Ionic blog](https://ionic.io/blog/announcing-capacitor-8), [Capacitor 8 update guide](https://capacitorjs.com/docs/updating/8-0)
- [search] Capacitor is the most mature "wrap an existing web app" route with the larger mobile plugin ecosystem; Tauri's mobile ecosystem is thinner. iOS suspends WebView execution when the app is backgrounded (applies to every webview shell). — [oflight overview](https://www.oflight.co.jp/en/columns/flutter-rn-capacitor-tauri-overview-2026), [devradar Capacitor note](https://devradar-dev.github.io/open-research/frameworks/capacitor)
- [search] Flutter 3.41 (Dart 3.11) shipped Feb 2026; a community package changelog requires "Dart 3.12+ / Flutter 3.44+", implying 3.44 exists by late 2026. The official `webview_flutter` has no Windows implementation in the results; Windows WebView2 comes from community packages (`flutter_inappwebview_windows` 0.6.0 stable / 0.7.0-beta, `webview_flutter_windows` 1.1.1 community fork, `webview_win_floating`). — [codenote comparison](https://codenote.net/en/posts/cross-platform-dev-tools-comparison-2026/), [webview_flutter_windows](https://pub.dev/packages/webview_flutter_windows), [flutter_inappwebview_windows](https://pub.dev/packages/flutter_inappwebview_windows)
- [search] Compose Multiplatform for iOS became stable with 1.8.0 (May 2025); JetBrains reported about 9 MB added to an iOS app versus SwiftUI; 1.11.0 shipped May 2026 with an experimental native iOS text input; desktop minimums are Windows 10 and macOS 13. — [JetBrains 1.8.0 blog](https://blog.jetbrains.com/kotlin/2025/05/compose-multiplatform-1-8-0-released-compose-multiplatform-for-ios-is-stable-and-production-ready/), [JetBrains 1.11.0 blog](https://blog.jetbrains.com/zh-hans/kotlin/2026/05/compose-multiplatform-1-11-0), [compatibility page](https://kotlinlang.org/docs/multiplatform/compose-compatibility-and-versioning.html)
- [search] .NET MAUI 10 focused on quality; `HybridWebView` and `BlazorWebView` gained web-request interception. Avalonia 12 open-sources its WebView (previously commercial). Uno has had WebView2 since 6.0; no 2026 mobile-webview detail found. — [MAUI .NET 10 what's new](https://learn.microsoft.com/en-us/dotnet/maui/whats-new/dotnet-10), [Avalonia blog](https://avaloniaui.net/blog), [heise on Uno](https://heise.de/-10494870)
- [read] The Euro-Office fork, facing the same "ONLYOFFICE editors on phones" problem in 2026, lists exactly two shell options: "two native apps with WebViews (Swift and Kotlin), or one cross-platform WebView shell (Capacitor, Flutter, or React Native)", undecided, with a first PoC of "open → edit → save a local .docx fully offline". — [Euro-Office/DocumentServer issue #189](https://github.com/Euro-Office/DocumentServer/issues/189)

### Inferences
Comparison for this app. Percentages are my estimates of realistic sharing of *app code you write* (the engines are shared 100% in every webview-based option), not measured numbers.

| Strategy | Shared code (estimate) | Size impact | Webview story | 2026 maturity | Solo effort |
|---|---|---|---|---|---|
| **Tauri v2 on all four** | ~90–95% (one React UI, one Rust core; small Kotlin/Swift plugins) | Smallest: system webviews everywhere; Rust core a few MB per ABI | WebView2 / Android WebView / WKWebView ×2, first-class (the shell *is* the webview) | Desktop solid; mobile usable with gaps (§1) | Lowest total; one toolchain, but you debug mobile edge cases with fewer community answers |
| **Tauri desktop + Capacitor mobile** | ~85–90% of UI/TS; Rust core NOT reused on mobile unless built as a native lib and bridged (extra work) | Small on both | Same system webviews; Capacitor's file/share/intent plugins are more battle-tested | Capacitor very mature on mobile | Two shells, two build systems, core logic must live in TS or be bridged twice |
| **Electron desktop + Capacitor mobile** | ~85–90% UI/TS | Desktop +~100 MB class (see existing footprint notes) | Bundled Chromium on desktop removes WebKit-on-macOS risk | Both very mature | Conflicts with "small" goal on Windows |
| **React Native (+ RN Windows/macOS) + react-native-webview** | ~60–70%: RN chrome is a second UI stack; editors still live in webviews | Medium | Webview is a guest component; multi-webview/tab and focus/keyboard handling are extra | RN core mature; RN-macOS lags core (0.83 vs 0.88) [read] | High: three out-of-tree platforms to keep in sync |
| **Flutter + webview plugin** | ~60–70%: Dart shell + web engines; two languages | Medium (Flutter engine per platform) | Windows webview is community-only [search]; platform-view composition of a webview under Flutter UI is a known friction area [background] | Flutter mature; desktop-webview weakest link | High, and no reuse of existing TS UI |
| **KMP + Compose Multiplatform** | ~60–70% | Desktop bundles a JVM runtime (tens of MB) [background] | No first-party cross-platform webview [background] | iOS stable since 2025 [search] | High; Kotlin + web stacks |
| **.NET MAUI / Uno / Avalonia** | ~60–70% | Medium (.NET runtime) | HybridWebView exists [search]; macOS via Mac Catalyst [background] | MAUI "quality" phase | High; C# + web stacks |
| **Fully native ×3–4 (WinUI 3, Compose, SwiftUI) + shared Rust/C++ core + web engines** | ~40–50%: core + engines shared, every screen written 3 times | Small | You hand-write each webview host | Each toolkit mature | Highest; only justified for best-in-class per-platform feel |
| **PWA** | ~100% | Zero install | Browser | Capable on Chromium; no File System Access API in Safari/iOS, no file associations on iOS, storage eviction [background] | Lowest, but fails "open any file, save back" on iOS |

- The app's "first-class interface on every device" goal is met mostly by responsive web UI + per-form-factor layouts, not by native widgets, because the document surface is a canvas/DOM engine in every option. Native chrome (RN/Flutter/Compose) would only restyle the thin shell around it at the cost of a second UI codebase.
- Keeping the Rust core (file pipeline, atomic save, backups, search, conversions) is the main argument for Tauri-everywhere over Tauri+Capacitor: with Capacitor that logic must be re-homed in TypeScript or exposed through two native bridges.

### Gaps
- No measured binary sizes for a Tauri Android APK / iOS IPA of this shape; no like-for-like 2026 benchmark of webview shells with a 100 MB WASM engine.
- Flutter/React Native/Capacitor official docs were unreachable; their rows rest on search summaries and background knowledge.
- Current stable Flutter and Compose Multiplatform versions as of November 2026 not confirmed (latest seen: Flutter ≥3.44 implied, CMP 1.11.0 May 2026).

---

## 3. Can the heavy engines run on phones and tablets at all?

### Takeaway
Yes in principle, with two hard problems. (a) UI: the open-source ONLYOFFICE `web-apps` mobile (Framework7) UI ships with editing stubbed out — `EditorUIController.isSupportEditFeature()` returns `false` in the AGPL repo — and ONLYOFFICE's own Documents apps and native mobile editors are proprietary and no longer publicly cloneable; the Euro-Office fork is actively building an open mobile editing UI in a WebView, which is the same architecture this app would use. (b) Memory: iOS WKWebView gives WebAssembly far less reliable memory than desktop (a WebKit bug is titled "Only ~300 MB of RAM is reliably available to WebAssembly pages"), so x2t-WASM converting a large file is the single most likely thing to fail on an iPhone.

### Cited Findings

**ONLYOFFICE mobile web UI (web-apps `apps/*/mobile`)**
- [read] In upstream `ONLYOFFICE/web-apps` (branches `master` and `develop`), `apps/documenteditor/mobile/src/lib/patch.jsx` is a stub: `EditorUIController.isSupportEditFeature = () => { return false }`, `getToolbarOptions = () => null`, `initFonts`/`initEditorStyles`/`initTableTemplates` return null, `ContextMenu.mapMenuItems: () => []`. File header is AGPL-3.0-only, © 2009-2026. — [web-apps patch.jsx (master)](https://github.com/ONLYOFFICE/web-apps/blob/master/apps/documenteditor/mobile/src/lib/patch.jsx)
- [read] The mobile `Main.jsx` controller gates editing on that stub: `storeAppOptions.setPermissionOptions(..., EditorUIController.isSupportEditFeature())` and `if (appOptions.config.mode !== 'view' && !EditorUIController.isSupportEditFeature())` (the view-only warning path). So the restriction is missing UI code plus a flag, not only a server licence check. — [web-apps Main.jsx](https://github.com/ONLYOFFICE/web-apps/blob/master/apps/documenteditor/mobile/src/controller/Main.jsx)
- [read] In `Euro-Office/web-apps` branch `main`, the same file imports `./editor` and sets `isSupportEditFeature = () => true`, wiring `getToolbarOptions`, `getUndoRedo`, `initThemeColors`, `initFonts`, `initEditorStyles`, `initFocusObjects`, `initTableTemplates`, `updateChartStyles`, `getEditCommentControllers`; the context menu is commented out "for EE parity". The fork has therefore re-implemented open mobile editing UI (maturity unknown). — [Euro-Office web-apps patch.jsx (main)](https://github.com/Euro-Office/web-apps/blob/main/apps/documenteditor/mobile/src/lib/patch.jsx)
- [search] ONLYOFFICE's own statements: "mobile web editors are not available in the free Community version, files will open in the viewing mode only"; available "only for commercial builds of Enterprise and Developer editions"; the change dates to Community Document Server 5.5.0 (2020). On paid editions the mobile web editors offer "a complete toolset of editing features" with a mobile-adapted interface. — [ONLYOFFICE help: Android mobile web editors](https://helpcenter.onlyoffice.com/mobile/android/mobile-web-editors/overview.aspx), [ONLYOFFICE mobile integration docs](https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/mobile-integration/mobile-integration-on-android-devices), [Nextcloud forum thread](https://help.nextcloud.com/t/onlyoffice-removed-web-mobile-editing-from-version-5-5-0-of-community-document-server/74360), [compare editions](https://www.onlyoffice.com/compare-editions)
- [search] Tablets are treated as mobile by default, but an integrator can force the full desktop editor UI in a tablet browser through the config `type` parameter; users have asked for full desktop UI on iPad/Android tablets/DeX. — [ONLYOFFICE forum: editing modes across platforms](https://forum.onlyoffice.com/t/varied-document-editing-modes-across-platforms/5126), [community thread: desktop UI on tablet/DeX](https://community.onlyoffice.com/t/desktop-ui-layout-on-tablet-samsung-dex/11754)
- [search] A community fork "OnlyOffice Web Apps patched to allow mobile editing" exists (not inspected; host unreachable). — [Lea/web-apps](https://git.amogus.cloud/Lea/web-apps)

**How ONLYOFFICE's own Android and iOS apps are built, and their licence**
- [read] Euro-Office analysis (issue opened 16 Jun 2026, "In progress" 21 Oct 2026): there is no complete forkable open-source mobile app. Public and AGPLv3: thin demo WebView apps `editors-webview-ios` (Swift) and `editors-webview-android` (Kotlin) showing the JS↔native bridge, and `editors-ios-sp` which ships editors as binary xcframeworks. "The full 'Documents' apps (file browser, cloud connectors) are proprietary." Earlier AGPL app repos were taken offline. — [Euro-Office/DocumentServer issue #189](https://github.com/Euro-Office/DocumentServer/issues/189)
- [read] Android layering per that analysis: open Kotlin app-manager → private Kotlin editor UI (`libgeditors`, `libgdocs`, `libgcells`, `libgslides`) → private JNI layer `core-ext` (`libeditors`, `libdocs`, `libcells`, `libslides`) → open C++ `core` including `libx2t` as a build artifact. The app talks to editors via `startActivityForResult`. So ONLYOFFICE's Android editors are NATIVE (C++ core + JNI + Kotlin UI) with x2t compiled natively, not the web editors in a WebView. — [issue #189](https://github.com/Euro-Office/DocumentServer/issues/189)
- [read] iOS per that analysis: five private dependencies from `editors-ios` (DocumentEditor, SpreadsheetEditor, PresentationEditor, DocumentConverter Swift packages; HtmlRenderer binary xcframework); "The compiled artefacts must be obtained directly from Ascensio"; rendering described as "a C++ WebKit-hybrid engine from ONLYOFFICE sdkjs + core". — [issue #189](https://github.com/Euro-Office/DocumentServer/issues/189)
- [read] `https://github.com/ONLYOFFICE/documents-app-android` and `…/documents-app-ios` returned HTTP 404 on 2026-11-21, as did their raw READMEs on four branch names — consistent with the repos being private/removed (could also be a proxy restriction in this session). — [documents-app-android](https://github.com/ONLYOFFICE/documents-app-android), [documents-app-ios](https://github.com/ONLYOFFICE/documents-app-ios)
- [search] ONLYOFFICE's May 2026 licence guide lists the mobile apps for iOS and Android as free but under a commercial licence, while Desktop Editors are AGPLv3; the Docs FAQ says "enterprise features like mobile web editors, administration panel, etc. are available under commercial licenses". An older Gitee mirror README says the Android app was AGPLv3 (earlier state). — [ONLYOFFICE licence guide, May 2026](https://www.onlyoffice.com/blog/2026/05/onlyoffice-license-and-trademark-policy), [ONLYOFFICE Docs page](https://www.onlyoffice.com/docs), [Gitee mirror](https://gitee.com/office-research/documents-app-android)
- [search] ONLYOFFICE's roadmap mentions work on "the common engine for the native part of mobile applications". — [ONLYOFFICE Docs roadmap](https://helpcenter.onlyoffice.com/docs/docs-roadmap.aspx)
- [read] Euro-Office's proposed design is what this app plans: a web editor bundle ("web-apps Framework7 mobile UI + sdkjs + core compiled to WASM and native") inside a WebView, "Offline-capable: bundle the editors + an on-device converter". Existing notes list a `MobileEditors` repo in the euro-office org. — [issue #189](https://github.com/Euro-Office/DocumentServer/issues/189)

**Collabora Office for Android / iOS**
- [search] Built on LibreOffice core via LibreOfficeKit: native code renders tiles; the Collabora Online JavaScript handles tile composition and input; "only a thin Java layer to instantiate a WebView where the JS lives". The iOS app shares the Online JS UI and also runs the Online server C++ code plus most of LibreOffice core on-device, "no server involved"; keyboard handling was moved into native iOS code. Licence MPL-2.0 and others. Collabora Office 25.04 mobile fixed a long-standing Android WebView `loadUrl` performance problem. — [FOSDEM 2020 talk](https://archive.fosdem.org/2020/schedule/event/collabora_office_android_app_gory_details/), [LibOCon 2019 iOS slides](https://latam.conference.libreoffice.org/assets/Conference/Almeria/libocon-2019-iosapp.pdf), [About Collabora Office for Android & iOS](https://www.collaboraonline.com/?p=12560), [Collabora Office 25.04 mobile](https://www.collaboraonline.com/blog/collabora-office-25-04-for-mobile/), [FOSDEM 2025 talk](https://fosdem.org/schedule/event/fosdem-2025-5093-libreoffice-on-mobile-with-the-collabora-office-app)

**WebAssembly memory and JIT in mobile webviews**
- [search] WebKit bug 269777 is titled "Only ~300 MB of RAM is reliably available to WebAssembly pages" (iOS 17 era; filed from Unity, whose developers "reported being unable to allocate even a tenth of the memory that Android Chrome allows"). Current status/fixes not confirmed (bugs.webkit.org unreachable). — [WebKit bug 269777](https://bugs.webkit.org/show_bug.cgi?id=269777)
- [search] Apple engineers on the developer forums: the WKWebView memory limit cannot be raised and "is not a set number. It depends on things like total device RAM, current system load"; iOS jettisons the web content process ("per_process_limit"). — [Apple forum 771787](https://developer.apple.com/forums/thread/771787), [Apple forum 133449](https://developer.apple.com/forums/thread/133449)
- [search] Other iOS WASM failure modes on record: `WebAssembly.Memory` with `shared: true` and large initial size failing with "Out of memory" on iOS 16.4 (bug 255103); a workaround of allocating a large memory up front on iOS 15.4; a WASM web app crashing with "A problem repeatedly occurred" (bug 256703). — [WebKit bug 255103](https://bugs.webkit.org/show_bug.cgi?id=255103), [webkit-unassigned bug 256703](https://lists.webkit.org/pipermail/webkit-unassigned/2023-May/1103477.html)
- [search] Android: V8 supports up to 4 GB wasm32 memory, but older reports describe 32-bit Chrome on Android failing to grow past ~256 MB or reaching only ~500–700 MB due to address-space fragmentation; a comment in the WebKit bug says a Redmi Note 10 5G (5 GB RAM) "reliably acquires 4GB in Chrome 121". Reports are 2021–2024 and conflict; device and Chrome/WebView bitness matter. — [v8.dev 4GB wasm](https://v8.dev/blog/4gb-wasm-memory), [Unity forum](https://discussions.unity.com/t/android-chromium-unable-to-grow-allocated-memory-above-256mb-confirmed/818820), [WebKit bug 269777](https://bugs.webkit.org/show_bug.cgi?id=269777)
- [read] Android WebView memory model: on Android 8+ web content runs in an isolated renderer process (single-process fallback on low-RAM devices); most WebView memory, including the JS runtime, is native memory outside the Java heap; "native memory can silently grow to gigabytes", after which the Low Memory Killer terminates background processes "before eventually killing the foreground app"; WebViews must be explicitly torn down to avoid leaks. — [developer.android.com: Manage and diagnose WebView memory](https://developer.android.com/develop/ui/views/layout/webapps/manage-webview-memory)
- [background] JIT: WKWebView's out-of-process WebContent has JIT, so sdkjs and WASM run compiled in an embedded WKWebView (unless the user enables Lockdown Mode, which disables JIT and WASM optimisations). An app's own process cannot JIT. Android WebView always has V8 JIT.

**Storage quotas (IndexedDB / OPFS / Cache)**
- [search] MDN: from iOS 17 / macOS 14, WebKit-based browser apps let each origin store up to about 60% of total disk (previously an initial 1 GiB quota). WebKit's storage-policy post describes origin quota (writes fail with `QuotaExceededError`) and overall quota (triggers eviction; origins with an active page or in persistent mode may be excluded). — [MDN storage quotas](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [WebKit: Updates to Storage Policy](https://webkit.org/?p=14403)
- [search] A 2023 WebKit bug says non-Safari WKWebViews cannot show the extra-quota prompt because it is private SPI (fix status unknown); web.dev documents Safari's seven-day cap on script-writable storage for sites (not home-screen PWAs). Whether either applies to an app's own custom-scheme origin in WKWebView was not established. — [WebKit bug 258859](https://bugs.webkit.org/show_bug.cgi?id=258859), [web.dev storage for the web](https://web.dev/articles/storage-for-the-web)

### Inferences
- Three workable ways to get office EDITING on touch devices, in rising effort: (1) load the DESKTOP web-apps UI (the one already planned for Windows) on tablets and in desktop-windowing/DeX, where there is pointer/keyboard and enough width — zero new UI but small touch targets; (2) adopt the Euro-Office mobile editing UI (AGPL, Framework7, React) for phones once it stabilises; (3) phone = view + comment + light text edits only. ONLYOFFICE's native mobile editors are not an option (proprietary, not obtainable).
- Storing the ~100 MB engine pack in IndexedDB/OPFS on iOS is avoidable risk: download it with native code into the app's Application Support directory and serve it through the shell's custom protocol; then web storage quotas and eviction do not apply to it.
- x2t is the memory hot spot (whole document in WASM linear memory during conversion) — on iOS plan for a hard file-size ceiling, run x2t in a dedicated Worker that is terminated after each conversion to return memory, and keep only one office document live at a time on phones. A native x2t (as ONLYOFFICE's own Android app uses via `libx2t`) is the escape hatch: on Android it could be linked into the Rust core as a `.so`; on iOS as a static lib. That removes the WASM ceiling but adds a C++ cross-compile of `core` for 2–3 targets — significant solo effort.
- Collabora's shipping apps prove the general pattern "native core + web UI in a system WebView" is viable on both mobile platforms, including the lesson that keyboard/IME handling needed native code on iOS.

### Gaps
- No measurement found of x2t-WASM peak memory per document size, or of sdkjs canvas editing frame rates on mid-range Android phones. No benchmark of ONLYOFFICE desktop web UI used by touch.
- Feature-by-feature list of ONLYOFFICE mobile web editor versus desktop web editor not found.
- State and completeness of Euro-Office's mobile editing code (`./editor` module) and `MobileEditors` repo not inspected beyond one file.
- Current status of WebKit bug 269777 on iOS 26 unknown; whether wasm Memory64 or larger limits shipped in WKWebView unknown.
- Whether `SharedArrayBuffer`/threads (if the x2t-WASM build uses them) are available in Tauri's mobile webviews is unverified.

---

## 4. Text/code editor on touch devices

### Takeaway
Monaco's maintainers still answer "No" to mobile support, while CodeMirror 6 was designed around native contentEditable for touch, virtual keyboards and IME; if one text engine must serve Windows, Android and iOS, it has to be CodeMirror 6, with Monaco at most an optional desktop-only provider.

### Cited Findings
- [read] Monaco README FAQ: "Is the editor supported in mobile browsers or mobile web app frameworks?" — "No." — [microsoft/monaco-editor](https://github.com/microsoft/monaco-editor)
- [read] `monaco-editor` 0.57.0 (2026-09-24); `@codemirror/view` 6.43.15 (2026-10-19). — [npm registry](https://registry.npmjs.org/monaco-editor)
- [search] "One of the main goals of the CodeMirror 6 rewrite was adding touch device support", achieved by relying on the browser's native editing via contentEditable. Replit moved its mobile IDE from Ace to CodeMirror 6 because Monaco lacked mobile support; GitLab's tracker notes Monaco "does not support mobile browsers and currently has no intention of supporting them" and ran a spike on CodeMirror as a replacement. — [Replit: A New Code Editor for Mobile](https://replit.com/blog/codemirror-mobile), [Replit: Betting on CodeMirror](https://replit.com/blog/codemirror), [GitLab issue 229159](https://gitlab.com/gitlab-org/gitlab/-/issues/229159), [GitLab spike 387586](https://gitlab.com/gitlab-org/gitlab/-/work_items/387586)
- [search] A 2026 project (Arcane) "reintroduces CodeMirror for mobile and touch devices while keeping Monaco on desktop" — the two-engine pattern exists in the wild. — [arcane PR 1366](https://gh.r-mj.com/getarcaneapp/arcane/pull/1366)
- [search] What mobile code editors use: Code App (iPad, MIT) uses "Monaco Editor from Visual Studio Code" plus native code — a counter-example showing Monaco can be made to work in WKWebView on iPad with effort; Acode (Android) is built on Ace; Runestone (iOS, MIT) is a native UIKit text view using Tree-sitter for incremental parsing, highlighting and indentation. — [Code App on App Store](https://apps.apple.com/app/id1512938504), [Acode repo](https://github.com/Acode-Foundation/Acode), [simonbs/Runestone](https://github.com/simonbs/Runestone)
- [search] Replit moved to CodeMirror 6 across its product ("Betting on CodeMirror"); the project's existing notes file `code-editor-engines.md` also records Sourcegraph's Monaco-to-CM6 migration, citing bundle size, customisability and performance. — [Replit: Betting on CodeMirror](https://replit.com/blog/codemirror)

### Inferences
- Decision that must change: plan line 3 ("Text and code: Monaco") cannot hold across phones. Options: (A) CodeMirror 6 everywhere — one engine, one theme/keymap/extension set, smaller base bundle (helps the "small, fast" goal on Windows too); loses Monaco's built-in TS/JSON/CSS language services and VS Code-identical feel. (B) Monaco on desktop + CM6 on mobile behind the editor-provider contract — best desktop feel, but two integrations for find/replace, keybindings, themes, diff, settings. For a solo developer (A) is the lower-risk default, with (B) reachable later because of the provider contract.
- A native text view (Runestone on iOS) would give the best iOS feel but is iOS-only and breaks code sharing; not justified for a personal app.
- Phone-specific needs regardless of engine: an accessory key row above the virtual keyboard (Tab, brackets, arrows, undo/redo), `visualViewport` handling so the caret is not hidden by the keyboard, and no reliance on hover.

### Gaps
- codemirror.net and the Monaco issue tracker were unreachable; no 2026 primary statement beyond the README FAQ on Monaco touch work.
- Textastic, Kodex and Working Copy internals not researched (closed-source native apps [background]).
- No hands-on data on Monaco 0.57 behaviour in WKWebView/Android WebView (selection handles, IME composition).

---

## 5. PDF on mobile

### Takeaway
PDF.js works in mobile webviews but hits iOS canvas limits (16,777,216-pixel canvas area cap; jetsam on zoom of large pages), so mobile needs capped render scale and tile-or-CSS zoom; the platform-native alternatives are now strong on Android (androidx.pdf 1.0.0-beta01 with an experimental editable viewer built on androidx.ink) and long-standing on iOS (PDFKit + PencilKit), and they are the only route to low-latency pen ink.

### Cited Findings
- [read] `pdfjs-dist` 6.5.438 (2026-11-01). — [npm registry](https://registry.npmjs.org/pdfjs-dist)
- [search] iOS Safari cannot draw canvases above 16,777,216 pixels of area; react-pdf/ngx-extended-pdf-viewer users report PDFs not displaying on iPhone 12–14 when exceeded; a WebKit bug describes jetsam on iOS when opening a large single-page PDF and zooming; a vendor claims iOS caps canvas memory at 256–384 MB by device (unverified vendor figure); blank pages after the canvas memory budget is exhausted are reported. — [react-pdf issue mirror](https://lightrun.com/answers/wojtekmaj-react-pdf-canvas-area-exceeds-the-maximum-limit-width--height--16777216-on-ios), [WebKit bug 195325](https://bugs.webkit.org/show_bug.cgi?id=195325), [Nutrient: PDF.js limitations](https://www.nutrient.io/blog/pdfjs-limitations-commercial-upgrade/), [Apple forum: WKWebView canvas memory](https://developer.apple.com/forums/thread/683573)
- [read] androidx.pdf `1.0.0-beta01` released 26 Aug 2026: public APIs promoted to Beta; `PdfViewer`, `PdfViewerState`, `EditablePdfViewerFragment`, `AnnotationsView`, `OcrProvider` remain `@ExperimentalPdfApi`; streaming page-by-page search; `MlKitOcrProvider` for scanned PDFs. alpha19 (1 Jul 2026) made `AnnotationView` public. — [androidx.pdf release notes](https://developer.android.com/jetpack/androidx/releases/pdf)
- [search] `EditablePdfViewerFragment` adds annotations and form filling; annotations use the androidx.ink library (highlighter, eraser, toolbar). — [Android PDF viewer guide](https://developer.android.com/develop/ui/views/layout/pdf/pdf-viewer)
- [search] androidx.ink 1.0.0 released 17 Dec 2025 (1.1.0-alpha10 on 21 Oct 2026); live-authoring module aims for "the lowest latency a device can provide"; Google's launch post cites a 4 ms end-to-end latency demo on a Galaxy Tab S8 (vendor demo). — [androidx.ink releases](https://developer.android.com/jetpack/androidx/releases/ink), [About Ink API](https://developer.android.com/develop/ui/compose/touch-input/stylus-input/about-ink-api), [Android Developers Blog, Oct 2024](https://android-developers.googleblog.com/2024/10/introducing-ink-api-jetpack-library.html)
- [search] Apple: iPadOS cut Apple Pencil latency from 20 ms to 9 ms through Metal rendering, touch prediction and mid-frame event processing; PencilKit exposes low-latency capture to third parties. — [WWDC 2019 session 221](https://developer.apple.com/videos/play/wwdc2019/221), [MacRumors](https://www.macrumors.com/2019/06/21/apple-pencil-latency-ipados-developers)

### Inferences
- Keep PDF.js as the shared viewer/annotation engine on all platforms (one annotation model, one save path via the pdf-lib fork), but on mobile cap `devicePixelRatio × zoom` so canvas area stays under the iOS limit, render visible pages only, and destroy off-screen canvases aggressively.
- Web-canvas ink in a webview goes through Pointer Events (`getCoalescedEvents`/`getPredictedEvents` where available) and the webview compositor; it will not match native front-buffer/Metal ink. No source quantifies the gap. If handwriting on PDFs with S Pen / Apple Pencil is a core use, plan a native ink overlay plugin (androidx.ink on Android, PencilKit `PKCanvasView` on iOS) positioned over the PDF page that hands finished strokes to the web layer to be written as PDF ink annotations. That is per-platform code and should be a later phase.
- Native viewers (androidx.pdf, PDFKit) are attractive for quick view on phones but would create a second annotation/saving code path; not worth it unless PDF.js proves too slow in the spike.

### Gaps
- No measured webview-versus-native stylus latency comparison found.
- No 2026 data on PDF.js 6.x memory use on mid-range Android or on whether PDF.js now tiles large pages.
- PDFium-WASM versus PDF.js on mobile not compared in any source found.

---

## 6. File access models per platform ("open any file, save back to it")

### Takeaway
Only Windows and non-sandboxed macOS give plain paths; Android and iOS hand the app opaque, permission-scoped handles (content:// URIs, security-scoped URLs) that must be explicitly persisted to reopen recent files and that do not support "write temp file next to original, then rename". The `platform` interface must therefore model a document as an opaque handle with read-bytes / write-bytes / persist / release operations, never as a path.

### Cited Findings
- [read] Android SAF: opening a file gives "a URI permission grant for that file, which lasts until the user's device restarts"; to keep access (e.g. a recent-files list) the app must call `contentResolver.takePersistableUriPermission(uri, READ|WRITE flags)`. — [developer.android.com: documents and other files](https://developer.android.com/training/data-storage/shared/documents-files)
- [read] `MANAGE_EXTERNAL_STORAGE` (all-files access) is restricted by Google Play policy for apps targeting Android 11+ (in effect since May 2021); it should be requested only when privacy-friendly APIs are insufficient. This is a Play policy, so a sideloaded personal app can declare it. — [developer.android.com: manage all files](https://developer.android.com/training/data-storage/manage-all-files)
- [read] Tauri: Android file pickers return content URIs, iOS returns `file://` URIs; Android "open with"/share arrive as `RunEvent::Opened`; file associations generate intent filters for `VIEW`, `SEND`, `SEND_MULTIPLE` and iOS document types. — [tauri-docs dialog.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/dialog.mdx), [tauri-docs mobile-file-associations.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/learn/mobile-file-associations.mdx)
- [search] Persisting access is community territory in Tauri: `tauri-plugin-android-fs` takes persistable URI permissions; `tauri-plugin-ios-bookmark` creates, stores and resolves security-scoped bookmarks; the official `persisted-scope` plugin persists Tauri's own fs scopes (must be registered after `fs`) and is marked `?` on mobile. — [tauri-plugin-android-fs](https://crates.io/crates/tauri-plugin-android-fs/12.0.0), [tauri-plugin-ios-bookmark](https://docs.rs/tauri-plugin-ios-bookmark/latest/tauri_plugin_ios_bookmark/), [persisted-scope docs](https://v2.tauri.app/plugin/persisted-scope/)
- [read] Mac App Store distribution requires the App Sandbox entitlement ("Your app must include the App Sandbox capability to be distributed in the App Store"). — [tauri-docs app-store.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/distribute/app-store.mdx)
- [read] Windows uses the evergreen WebView2 runtime, preinstalled on Windows 10 1803+ and Windows 11 per Tauri's docs. — [tauri-docs prerequisites.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/start/prerequisites.mdx)

### Inferences
Per-platform model (items marked [background] are from prior knowledge, not re-verified):

| Platform | Handle | Reopen later | Save-in-place | Notes |
|---|---|---|---|---|
| Windows | Normal path | Path | Atomic temp+rename works | File associations via installer/registry; jump lists and MSIX-vs-unpackaged covered in existing shell notes [background] |
| macOS (notarised, non-sandboxed) | Normal path | Path | Atomic works | TCC prompts for Desktop/Documents/Downloads [background] |
| macOS (sandboxed / App Store) | Security-scoped URL | Security-scoped bookmark | In place only inside granted scope | Only needed if ever distributed via Mac App Store [read] |
| Android | `content://` URI from `ACTION_OPEN_DOCUMENT` / `VIEW` / `SEND` intents | `takePersistableUriPermission` [read] | Open an output stream on the URI and overwrite; no sibling temp file, no rename; some providers (cloud, mail attachments) are read-only or give one-shot grants [background] | `SEND` shares are copies: treat as "import", save needs "Save as" [background] |
| iOS/iPadOS | Security-scoped `file://` URL from document picker / Files "Open in" | Security-scoped bookmark | Coordinated write to the URL; requires `LSSupportsOpeningDocumentsInPlace` + `UISupportsDocumentBrowser`/document types to open in place rather than receive a copy in the app's Inbox [background] | iCloud Drive and third-party File Providers appear through the same picker [background] |

- The file pipeline in the existing plan (keep original, backup before first save, atomic write) needs a mobile variant: backups go to app-private storage keyed by a hash of the handle, and "atomic" becomes "write backup → stream-overwrite the handle → verify by re-reading size/hash → on failure restore from backup or force Save-as".
- File watching (detect external change) is not generally available for content:// URIs or File Provider documents; on mobile compare modified-time/size on resume instead [background].

### Gaps
- Apple's developer documentation pages on document pickers/bookmarks rendered as JavaScript apps and could not be text-extracted; the iOS rows rest on background knowledge.
- Windows specifics (MSIX vs unpackaged, jump lists) were not re-researched here; see the existing `app-shell-ux-testing.md` notes.
- Behaviour of Tauri's `fs` plugin when WRITING to Android content URIs from different providers (Drive, Nextcloud, Samsung My Files) is untested.

---

## 7. Distribution for a personal app in 2026

### Takeaway
Windows and Android stay free for a personal app (unsigned exe with a SmartScreen click-through; APK installed over ADB is explicitly exempt from Android's new developer verification, and a free "limited distribution" account covers up to 20 devices); iOS is the only platform with a real cost or chore: free provisioning expires every 7 days with a 3-app, 3-device cap, so the practical choice is the paid Apple Developer Program or a weekly re-sign.

### Cited Findings

**Android**
- [read] Android developer verification: "Effective September 30, 2026 — Protections begin for users installing apps from participating stores in select regions on certified Android devices. We'll continue rolling out user protections globally in 2027." — [developer.android.com/developer-verification](https://developer.android.com/developer-verification)
- [read] "Limited distribution accounts are now available — … students, teachers, and hobbyists can share apps with up to 20 devices without a government-issued ID or registration fee." — [developer.android.com/developer-verification](https://developer.android.com/developer-verification)
- [read] FAQ: "As a developer, you are free to install apps without verification with ADB"; "Apps installed using ADB won't require verification"; enforcement "will apply to all certified Android devices running Android 8 (API level 26) or higher", delivered through Google Play services (entry updated 10 Nov 2026); limited accounts can be migrated to full accounts but not the reverse. — [developer verification FAQ](https://developer.android.com/developer-verification/guides/faq)
- [search] First enforcement countries: Brazil, Indonesia, Singapore, Thailand (September 2026); an "advanced flow" lets power users install apps from unverified developers after confirming the risk, enabling it for 7 days or indefinitely. — [Google support: Understanding Android developer verification](https://support.google.com/android-developer-console/answer/16561738), [Android Developers Blog, Mar 2026](https://android-developers.googleblog.com/2026/03/android-developer-verification.html)
- [read] Tauri builds a sideloadable APK with `tauri android build --apk` (optionally `--split-per-abi`); a release keystore of your own is enough for sideloading. — [tauri-docs google-play.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/distribute/google-play.mdx)

**iOS / iPadOS**
- [read] Free "Personal Team": "You can register up to 10 App IDs, which expire after 7 days. You can register up to 3 devices, which expire after 7 days. You can install up to 3 apps per device. Provisioning profiles … will expire 7 days from issuance. You'll need to rebuild and reinstall your app to your device after expiration." — [Apple: Choosing a Membership](https://developer.apple.com/support/compare-memberships/)
- [read] TestFlight requires App Store Connect (paid program); "You can share up to 100 builds". — [Apple TestFlight](https://developer.apple.com/testflight/)
- [background] Paid Apple Developer Program is US$99/year; development provisioning profiles then last one year; TestFlight builds expire after 90 days; internal testers need no beta review. Not re-verified this session.
- [search] AltStore/SideStore automate re-signing with a free Apple ID (still 7-day refresh, about 3 active apps). — [Apple forum 838074](https://developer.apple.com/forums/thread/838074), [sideloading FAQ](https://sideloading.gitbook.io/sideloading-master-guide/introduction/what-is-sideloading/faq)
- [read] EU Web Distribution is not a personal route: eligibility requires e.g. being "enrolled in the Apple Developer Program in good standing for two continuous years or more" with "an app that had more than one million first annual installs" in the prior year, or other organisational criteria. — [Apple: Web Distribution in the EU](https://developer.apple.com/support/web-distribution-eu/)

**Windows**
- [search] Unsigned or newly signed executables trigger SmartScreen until reputation builds; Azure Artifact Signing (formerly Trusted Signing) Basic tier is about US$10/month, individuals eligible only in the USA and Canada; signing "does not provide instant SmartScreen trust"; April 2026 forum reports describe signed binaries still warned after an intermediate-CA change; Store-distributed apps are re-signed by Microsoft and never show SmartScreen. — [Microsoft Learn: code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [Microsoft Learn: SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [Microsoft Q&A 5855708](https://learn.microsoft.com/en-us/answers/questions/5855708/trusted-signing-regression-in-smartscreen-reputati)

**macOS**
- [background] An app built and run on your own Mac needs only ad-hoc signing (mandatory on Apple silicon; done by the toolchain); Gatekeeper quarantine applies to downloaded apps, and notarisation (paid program) matters only when giving the app to other Macs. Not re-verified.

**AGPL/GPL versus app stores (only if ever distributed)**
- [search] FSF concluded GPLv2 conflicts with Apple's App Store terms because the Usage Rules add restrictions; VLC for iOS was removed 7 Jan 2011 after a contributor complaint and returned in 2013 after relicensing; GNU Go was removed in 2010. — [Computerworld](https://www.computerworld.com/article/1347653/gplv2-blocks-vlc-from-apple-s-app-store.html), [Engadget](https://www.engadget.com/2011-01-09-the-gpl-the-app-store-and-you.html), [michelf.ca](https://michelf.ca/blog/2011/gpl-ios-app-store)
- [read] Euro-Office's 2026 reading for the AGPL ONLYOFFICE code: store distribution is possible ("ONLYOFFICE does it") but corresponding source must be offered and "Apple's terms need a GPL exception granted by a copyright holder" — which only the copyright holder (Ascensio) can grant for upstream code; flagged "Needs legal sign-off". — [Euro-Office issue #189](https://github.com/Euro-Office/DocumentServer/issues/189)

### Inferences
- Personal-use path with zero recurring cost: Windows unsigned (click "More info → Run anyway" once), Android `adb install` of a self-signed APK (or the free limited-distribution account if installing by tapping an APK on a certified device in an enforced region), macOS local build. iOS: budget the US$99/year, because a 7-day expiry on a daily-use document app is an operational risk (the app stops launching away from the Mac).
- AGPL components are a non-issue while the app never leaves the owner's devices; TestFlight to other people or any App Store listing would be "distribution" and reopen both the AGPL source-offer duty and the App-Store-terms conflict (an individual cannot grant an exception for Ascensio's code).

### Gaps
- Apple fee and TestFlight 90-day figures are background knowledge; the Apple pages read did not surface them in extractable text.
- Whether Android's verification already blocks tap-to-install of self-signed APKs in the owner's country as of November 2026 depends on region (only four countries named for 2026); global dates beyond "2027" are not published in what I read.
- Microsoft Store individual registration fee and winget submission rules not confirmed this session.
- iOS 26-specific sideloading changes, if any, not found.

---

## 8. Platform capability gaps to plan around on mobile

### Takeaway
On mobile assume: no child processes, no long background work, the OS may kill the webview at any time, and input is touch-first but must also work with hardware keyboards and resizable windows (iPadOS 26 and Android 16 both now have desktop-style windowing), so the layout must be continuously responsive rather than "phone vs desktop".

### Cited Findings
- [read] Tauri's `shell` plugin (child processes) is `?` on iOS/Android; `global-shortcut` is `?`; `window-state`, `single-instance`, `updater`, `cli`, `autostart` are ❌. — [plugins-workspace README](https://github.com/tauri-apps/plugins-workspace/blob/v2/README.md)
- [read] Android: unmanaged WebView native memory leads the Low Memory Killer to terminate background processes and eventually the foreground app. — [developer.android.com: WebView memory](https://developer.android.com/develop/ui/views/layout/webapps/manage-webview-memory)
- [search] iOS suspends WebView execution when the app is backgrounded; iOS jettisons the WKWebView content process under memory pressure with no adjustable threshold. — [devradar Capacitor note](https://devradar-dev.github.io/open-research/frameworks/capacitor), [Apple forum 771787](https://developer.apple.com/forums/thread/771787)
- [search] iPadOS 26: freely resizable, freely placed windows (no grid), Exposé-style overview, a Mac-like menu bar revealed by swiping down or moving the pointer to the top (File/Edit/View/Window…), windowing extends to external displays; Split View and Slide Over were removed in favour of the new system, Stage Manager remains. — [MacRumors, 9 Jun 2025](https://www.macrumors.com/2025/06/09/windowing-menu-bar-and-pointer-come-to-ipados/), [Apple Support: Multitask on iPad with iPadOS 26](https://support.apple.com/en-ie/125309), [MacStories review: The Menu Bar](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/11)
- [search] Android 16: desktop windowing built with Samsung (enhances DeX, extends to other devices); phones start a desktop session on a connected display; taskbar, multiple desktops, keyboard shortcuts; minimum window size 386 × 352 dp — "smaller than most phones", so apps must tolerate very small windows. — [Android Developers Blog, Jun 2025](https://android-developers.googleblog.com/2025/06/developer-preview-enhanced-android-desktop-experiences-connected-displays.html)
- [search] Collabora's precedent: on iOS, keyboard handling had to move into native code. — [LibOCon 2019 iOS slides](https://latam.conference.libreoffice.org/assets/Conference/Almeria/libocon-2019-iosapp.pdf)

### Inferences
- Language servers, terminal, ripgrep, Pandoc, headless LibreOffice as child processes: desktop-only. Mobile replacements: project search implemented in-process in the Rust core (the ripgrep library crates rather than the `rg` binary) so one implementation serves all four platforms; language intelligence limited to what runs in a Web Worker (TS/JSON/CSS/HTML services, tree-sitter/Lezer highlighting); conversions limited to x2t-WASM and JS libraries; no terminal.
- Save model: on mobile, autosave on every `visibilitychange → hidden` / app-pause and keep a recovery journal in app-private storage, because the process can be killed without notice the moment the app leaves the foreground; conversions must be restartable.
- Memory discipline on phones: one live heavy engine at a time; background tabs are serialised and their iframe destroyed (the desktop plan keeps several editors alive); the tab strip becomes a document switcher.
- Hardware keyboards: keep the full shortcut map and `Ctrl/Cmd+K` palette on tablets; on iPadOS expose commands through the system menu bar (`UIMenuBuilder`, needs a small Swift plugin) so shortcuts are discoverable [background]; some combinations are reserved by the OS (e.g. Cmd+H, Cmd+Tab, Cmd+Space on iPadOS) [background].
- Multi-window: Tauri mobile is effectively single-window/single-activity [background, unverified]; design for one resizable window with internal tabs/split rather than OS multi-window; treat width breakpoints (compact < ~600 dp, medium, expanded) as the only layout switch so phone, foldable-unfolded, tablet split, DeX and iPad windows all work.
- Drag and drop: HTML5 DnD of files into a webview is inconsistent on mobile; inter-app drop on iPadOS/Android needs native drop handlers forwarding to the web layer [background]. Low priority for phase 1 mobile.
- Print-to-PDF: the desktop plan's webview `printToPDF`/headless routes do not exist on mobile webviews. Use engine-level export (ONLYOFFICE "download as PDF" through x2t; PDF.js/pdf-lib for PDFs; a JS HTML→PDF path for Markdown) and hand the result to the system share/print sheet via a native plugin.
- Engine pack on demand: fine for a sideloaded personal app; if ever store-distributed, downloading executable code post-install runs into store rules [background]. Bundle the pack inside the app for store builds.

### Gaps
- No primary source on Tauri multi-window/scene support on iPadOS or Android; assumption above needs a spike.
- No source on hardware-keyboard shortcut delivery into WKWebView/Android WebView under Tauri (which keys the OS or webview swallows).
- Foldable posture/hinge APIs in a webview not researched.

---

## 9. Bottom line: architecture, shells, decisions that must change, risks, spikes

### Takeaway
Stay with one web UI (TypeScript/React) + one Rust core + web engines, hosted by Tauri v2 on all four platforms, with every OS difference hidden behind the `platform` interface so that the mobile shell can be swapped to Capacitor or a thin native host if Tauri mobile blocks. Mobile forces four changes to earlier decisions: CodeMirror 6 as the cross-platform text engine, opaque file handles instead of paths, no sidecars (in-process Rust or WASM only), and a separate answer for office editing UI on phones, because upstream ONLYOFFICE's open mobile UI is view-only.

### Cited Findings
(Decisive evidence, restated with sources.)
- [read] Tauri 2.12.x has first-party Android/iOS file associations incl. `VIEW`/`SEND` intents, dialog, deep-link, biometric, notification; lacks updater/window-state/single-instance on mobile; `shell` and `fs` are "unknown/untested" on mobile. — [plugins-workspace README](https://github.com/tauri-apps/plugins-workspace/blob/v2/README.md), [mobile-file-associations](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/learn/mobile-file-associations.mdx)
- [read] Upstream ONLYOFFICE mobile web UI has `isSupportEditFeature() → false`; Euro-Office `main` has it `true` with an open editor module. — [ONLYOFFICE patch.jsx](https://github.com/ONLYOFFICE/web-apps/blob/master/apps/documenteditor/mobile/src/lib/patch.jsx), [Euro-Office patch.jsx](https://github.com/Euro-Office/web-apps/blob/main/apps/documenteditor/mobile/src/lib/patch.jsx)
- [read] ONLYOFFICE's native mobile editors and Documents apps are proprietary/unavailable; Euro-Office plans the WebView + WASM/native-converter route. — [Euro-Office issue #189](https://github.com/Euro-Office/DocumentServer/issues/189)
- [search] iOS: "Only ~300 MB of RAM is reliably available to WebAssembly pages". — [WebKit bug 269777](https://bugs.webkit.org/show_bug.cgi?id=269777)
- [read] Monaco: mobile support "No". — [monaco-editor README](https://github.com/microsoft/monaco-editor)
- [read] Android ADB installs are exempt from developer verification; Apple free provisioning expires in 7 days. — [developer verification FAQ](https://developer.android.com/developer-verification/guides/faq), [Apple: Choosing a Membership](https://developer.apple.com/support/compare-memberships/)

### Inferences

**Recommended code-sharing architecture**
- Shared (≈90%+ of written code): React/TS UI with responsive layouts; editor-provider contract; engines (ONLYOFFICE sdkjs + web-apps + x2t-WASM pack, PDF.js + pdf-lib fork, CodeMirror 6, Markdown/CSV code); Rust core (document registry, backup/recovery journal, save pipeline, in-process search, settings, engine-pack download/verify/serve).
- Per platform (thin): Tauri config and signing; `platform` adapter implementations; Android Kotlin plugin (SAF open/create, persistable URI permission, stream read/write on content URIs, share/print sheet, later androidx.ink overlay); iOS Swift plugin (document picker in place, security-scoped bookmarks, coordinated writes, share/print, menu bar commands, later PencilKit overlay); desktop-only extras (sidecars, language servers, multiwebview, updater, window-state).
- `platform` interface shape implied by §6–§8: `DocumentHandle` (opaque id + display name + capabilities {writable, persistable, watchable}), `read(handle) → bytes`, `write(handle, bytes) → verified`, `persist/release(handle)`, `pickOpen/pickSaveAs`, `onOpenRequest` (file association / intent / share), `share(bytes|handle)`, `print(pdfBytes)`, `capabilities` {childProcesses, multiWindow, hover, pen, physicalKeyboard, maxEngineMemoryHint}, lifecycle events (`willBackground`, `memoryWarning`).

**Recommended shell per platform**
- Windows: Tauri v2 (WebView2) — unchanged.
- Android: Tauri v2 Android (System WebView, Chromium — same engine family as WebView2, lowest-risk second platform). Fallback: Capacitor 8 with the same web bundle.
- iOS/iPadOS: Tauri v2 iOS (WKWebView). Fallback: Capacitor 8 or a hand-written `WKWebView` host. Decide after the iPhone spike, since WebKit memory is the gating risk.
- macOS: Tauri v2 (WKWebView) if the iOS/WebKit spike shows the engines behave on WebKit; otherwise Electron on macOS only (existing plan already says "macOS decided by test"). Doing iOS and macOS together is sensible: same engine, same Swift plugin code for bookmarks.

**Earlier decisions that must change because of mobile**
1. Text engine: Monaco → CodeMirror 6 as the single cross-platform engine (Monaco optional desktop-only provider later).
2. Paths → opaque document handles throughout the UI, recents list, backup naming and save pipeline; "atomic temp + rename" becomes a desktop-only strategy.
3. Sidecars (headless LibreOffice, Pandoc, ripgrep, language servers) → desktop-only capabilities behind feature flags; core features must not depend on them. Search moves in-process into Rust.
4. Office engine packaging: keep x2t-WASM as the shared path; serve the pack from native app storage via custom protocol (not IndexedDB/OPFS); add per-device file-size ceilings; reserve native `libx2t` in the Rust core as the mobile escape hatch.
5. Office UI on small screens: desktop web-apps UI on tablets/desktop windowing; phones get view + light edit first, then evaluate the Euro-Office open mobile editor (AGPL) — do not plan on ONLYOFFICE's upstream mobile editing.
6. Print-to-PDF: engine-level PDF export + system share/print sheet, not webview print.
7. Tabs: one live heavy editor at a time on phones; iframes inside a single webview instead of multiwebview.
8. PDF pen annotation: web ink first; native ink overlay as a later per-platform plugin.
9. Updates: no in-app updater on mobile; reinstall builds manually.

**Top risks (ranked)**
1. x2t-WASM / sdkjs memory on iOS WKWebView (and on low-RAM Android): crashes or reloads on realistic documents.
2. Office editing UX on touch: no ready-made open mobile editing UI upstream; desktop UI may be unusable on a phone; dependence on Euro-Office's young fork.
3. Save-back correctness on content:// and File Provider documents (partial writes, read-only providers, lost permissions) — data-loss class.
4. WebKit compatibility of engines validated only on Chromium (affects macOS and iOS at once): IME, selection, clipboard, canvas limits, `SharedArrayBuffer`.
5. Tauri mobile maturity: thin community knowledge, `fs`/`shell` marked untested on mobile, reliance on small community plugins or own Kotlin/Swift code.
6. Virtual keyboard + canvas-based editors (ONLYOFFICE draws to canvas with a hidden input): caret visibility, IME composition, autocorrect — Collabora needed native keyboard code on iOS.
7. iOS provisioning friction (7-day expiry) or recurring US$99/year.
8. Solo-developer surface area: four platforms × two webview engines × three heavy engines; needs strict phase gates.

**Spike experiments on a real Android phone and iPhone/iPad** (do before committing; each ends with a number or a yes/no)
- M1 Tauri hello on devices: build the existing Windows web shell for Android (APK via ADB) and iOS (Xcode, free provisioning); record APK/IPA size, cold-start time, build friction.
- M2 Engine pack load: serve the ONLYOFFICE pack from app storage via custom protocol; measure first-open time and whether COOP/COEP / WASM streaming compile work in Android WebView and WKWebView.
- M3 x2t memory ladder: convert .docx/.xlsx/.pptx of 1, 5, 20, 50 MB; record peak memory, time, and the size at which the webview process dies, on a mid-range Android phone, a current iPhone and an iPad; repeat 10 times to catch leaks; test Worker-terminate-after-convert.
- M4 Office editing by touch: desktop web-apps UI on a tablet and on a phone (usable or not); Euro-Office mobile editor build on the same devices; type with virtual keyboard incl. IME/autocorrect, selection handles, pinch zoom, scroll frame rate on a 10k-row sheet.
- M5 File round-trip matrix: open → edit → save-back → reopen after reboot for local storage, SD card, Google Drive, a mail attachment and a share-sheet import on Android; Files local, iCloud Drive and one third-party provider on iOS; verify persistable permission / bookmark and byte-exact writes; kill the app mid-save.
- M6 Text engine: CodeMirror 6 with a 5 MB file and a 100k-line file on both phones (typing latency, selection, keyboard accessory row, viewport resize); optionally the same with Monaco to quantify the gap.
- M7 PDF: PDF.js on a 500-page and a large-format single-page PDF; pinch-zoom memory on iPhone (canvas area cap); ink with S Pen and Apple Pencil via Pointer Events — subjective latency versus Samsung Notes / Apple Notes to decide whether a native ink overlay is needed.
- M8 Lifecycle: background the app during edit and during conversion; force memory pressure; confirm autosave/recovery journal restores state after the webview is killed.
- M9 Keyboard and windowing: hardware keyboard shortcuts (which are swallowed), iPadOS 26 window resize down to phone width, Android 16 desktop windowing / DeX at 386 × 352 dp, foldable fold/unfold.
- M10 Distribution dry run: ADB install on the owner's actual phone under current developer-verification rules; 7-day expiry behaviour on iPhone; decide on the paid Apple program.

### Gaps
- Everything in this section is desk research; no engine has been run on a phone by this project. The spikes above are the only way to close risks 1–4.
- No source gave real sizes or start-up times for a Tauri mobile app carrying a 100 MB engine pack.
- Legal position on store distribution of AGPL ONLYOFFICE code is explicitly unresolved even for the Euro-Office project ("Needs legal sign-off").
