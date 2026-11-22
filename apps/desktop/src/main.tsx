import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./shell/App";
import { platform } from "./platform";

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
  void import("@tauri-apps/api/core").then(({ invoke }) =>
    invoke<string | null>("self_test_dir").then((dir) => {
      if (dir) void import("./selftest").then((m) => m.runSelfTest(dir));
    }),
  );
}

createRoot(document.getElementById("root")!).render(<App />);
