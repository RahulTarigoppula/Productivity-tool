import { useEffect, useState } from "react";
import { useStore, getState } from "../app/store";
import { startup, openPath, handleExternalChange, flushAll, persistSession, openBytes } from "../app/actions";
import { installKeys } from "../app/keys";
import { platform } from "../platform";
import { TabBar } from "./TabBar";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { Home } from "./Home";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { Palette } from "./Palette";
import { Dialogs, Toasts } from "./Dialogs";
import { DocPane } from "./DocPane";
import { MenuHost } from "./Menu";
import { Boundary } from "./Boundary";

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const density = useStore((s) => s.settings.density);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => setSystemDark(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.density = density;
    document.documentElement.style.background = dark ? "#18181c" : "#f4f4f6";
  }, [dark, density]);
  // The Windows title bar follows the app's theme.
  useEffect(() => {
    void platform.setWindowTheme(theme === "system" ? null : theme);
  }, [theme]);
}

export function App() {
  useTheme();
  const tabs = useStore((s) => s.tabs);
  const activeId = useStore((s) => s.activeId);
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const focusMode = useStore((s) => s.focusMode);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    void startup();
    const offKeys = installKeys();
    const offChange = platform.onFileChanged(handleExternalChange);
    const offOpen = platform.onOpenFiles((paths) => paths.forEach((p) => void openPath(p)));
    const offClose = platform.onCloseRequested(flushAll);
    let offDrop = () => {};
    if (platform.kind === "tauri") {
      void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
        getCurrentWebview()
          .onDragDropEvent((e) => {
            if (e.payload.type === "enter" || e.payload.type === "over") setDragOver(true);
            else if (e.payload.type === "leave") setDragOver(false);
            else if (e.payload.type === "drop") {
              setDragOver(false);
              e.payload.paths.forEach((p) => void openPath(p));
            }
          })
          .then((f) => (offDrop = f)),
      );
    }
    const onUnload = () => void flushAll();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      offKeys();
      offChange();
      offOpen();
      offClose();
      offDrop();
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  // Persist the session whenever the set of tabs or panels changes.
  useEffect(() => {
    if (getState().ready) persistSession();
  }, [tabs.length, activeId, leftOpen, rightOpen]);

  // In the browser build, accept dropped files (they have no path; open as unsaved copies).
  const onDrop = async (e: React.DragEvent) => {
    if (platform.kind === "tauri" || !e.dataTransfer.files.length) return;
    e.preventDefault();
    setDragOver(false);
    for (const f of Array.from(e.dataTransfer.files)) openBytes(f.name, new Uint8Array(await f.arrayBuffer()));
  };

  return (
    <div
      className={`app ${focusMode ? "focus" : ""} ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        if (platform.kind !== "tauri" && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={onDrop}
    >
      <Boundary name="tab bar"><TabBar /></Boundary>
      {tabs.length ? <Boundary name="toolbar"><Toolbar /></Boundary> : <div className="toolbar empty" aria-hidden />}
      <div className="main">
        {leftOpen && !focusMode && <Boundary name="sidebar"><Sidebar /></Boundary>}
        <main className="doc-area">
          {tabs.map((t) => <DocPane key={t.id} tab={t} active={t.id === activeId} />)}
          {!tabs.length && <Boundary name="home screen"><Home /></Boundary>}
        </main>
        {rightOpen && !focusMode && tabs.length > 0 && <Boundary name="side panel"><RightPanel /></Boundary>}
      </div>
      <Boundary name="status bar"><StatusBar /></Boundary>
      <Boundary name="command palette" variant="silent"><Palette /></Boundary>
      <Boundary name="dialog" variant="silent"><Dialogs /></Boundary>
      <Boundary name="notifications" variant="silent"><Toasts /></Boundary>
      <Boundary name="menu" variant="silent"><MenuHost /></Boundary>
    </div>
  );
}
