import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./shell/App";
import { Boundary } from "./shell/Boundary";
import { installErrorHandlers } from "./app/errors";
import { platform } from "./platform";

// No document content may navigate the app window: links go through the app's own link handling
// (which only opens web links in the system browser), and forms are never submitted.
window.addEventListener(
  "click",
  (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented) return;
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#") || href === "") return;
    e.preventDefault();
    // Views that route links themselves (Markdown preview, Word view, PDF) handle the click.
    if (a.closest("[data-links]")) return;
    if (/^(https?:|mailto:)/i.test(href)) void platform.openExternal(href);
  },
  true,
);
window.addEventListener("submit", (e) => e.preventDefault(), true);
window.addEventListener("auxclick", (e) => {
  if ((e.target as HTMLElement | null)?.closest?.("a[href]")) e.preventDefault();
}, true);

// Disable the webview's own context menu except in text fields and editors.
window.addEventListener("contextmenu", (e) => {
  const t = e.target as HTMLElement;
  if (!t.closest("input, textarea, .cm-editor, [contenteditable=true], .textLayer")) e.preventDefault();
});

// In the browser build (development and automated tests) expose a small hook for inspection.
if (platform.kind === "browser") {
  void Promise.all([import("./app/actions"), import("./app/store")]).then(([actions, store]) => {
    (window as unknown as { __app: unknown }).__app = { ...actions, getState: store.getState, handles: store.handles, platform };
  });
}

// Built-in self-test of the real file system bridge (run with PRODUCTIVITY_SELF_TEST=<folder>).
if (platform.kind === "tauri") {
  void import("./app/backButton").then((m) => m.installBackButton()).catch(() => {});
  // Self-test mode (CI). On Android the start flag is noted by the activity as the window opens,
  // so look again briefly if it is not there yet.
  void import("@tauri-apps/api/core").then(async ({ invoke }) => {
    for (const wait of [0, 800, 2500]) {
      if (wait) await new Promise((r) => setTimeout(r, wait));
      const dir = await invoke<string | null>("self_test_dir").catch(() => null);
      if (dir) return void import("./selftest").then((m) => m.runSelfTest(dir));
      if (!/Android/i.test(navigator.userAgent)) return;
    }
  });
}

installErrorHandlers();
void import("./shell/tooltips").then((m) => m.installTooltips());
createRoot(document.getElementById("root")!).render(
  <Boundary name="window" variant="page">
    <App />
  </Boundary>,
);
