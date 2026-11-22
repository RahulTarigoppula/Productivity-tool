/** The single command registry: shell commands plus the active engine's commands.
 *  Everything here appears in the palette; the menu and shortcuts use the same entries. */
import { platform } from "../platform";
import { getState, setState, activeTab, handles, toast } from "./store";
import {
  newFile, newOfficeFile, pickAndOpen, openFolder, closeFolder, saveTab, closeTab, reopenClosed, switchTab,
  switchToRecentTab, updateSettings, reopenAs, isTextual,
} from "./actions";
import type { Command } from "./editor-api";

/** Whether Word, Excel and PowerPoint files can be edited here (learned once at start). */
let officeEditing = false;
void platform.officePack().then((p) => (officeEditing = p.available)).catch(() => {});
import type { MenuItem } from "../shell/Menu";

const withTab = (f: (id: string) => void) => () => {
  const t = activeTab();
  if (t) f(t.id);
};

export function toggleFocusMode() {
  const on = !getState().focusMode;
  setState({ focusMode: on });
  if (on) toast(window.matchMedia("(hover: none)").matches ? "Focus mode. Use the back gesture to leave." : "Focus mode. Press F11 or Esc to leave.");
  void platform.setFullscreen(on);
}

export function openPalette(query = "") {
  setState({ palette: { open: true, query } });
}

export function shellCommands(): Command[] {
  const tab = activeTab();
  const s = getState();
  // The theme on screen (System follows Windows).
  const shownDark = s.settings.theme === "dark" || (s.settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const cmds: Command[] = [
    { id: "file.newMarkdown", title: "New Markdown note", group: "File", shortcut: "Ctrl+N", run: () => void newFile("markdown") },
    { id: "file.newText", title: "New text file", group: "File", run: () => void newFile("text") },
    { id: "file.newCsv", title: "New CSV table", group: "File", run: () => void newFile("csv") },
    // New Office files only where they can be edited (installer with the Office pack).
    ...(officeEditing
      ? [
          { id: "file.newDocx", title: "New Word document", group: "File", run: () => void newOfficeFile("docx") },
          { id: "file.newXlsx", title: "New spreadsheet (Excel)", group: "File", run: () => void newOfficeFile("xlsx") },
          { id: "file.newPptx", title: "New presentation (PowerPoint)", group: "File", run: () => void newOfficeFile("pptx") },
        ]
      : []),
    { id: "file.open", title: "Open file…", group: "File", shortcut: "Ctrl+O", run: () => void pickAndOpen() },
    ...(platform.folders ? [{ id: "file.openFolder", title: "Open folder…", group: "File", run: () => void openFolder() }] : []),
    { id: "file.reopenClosed", title: "Reopen closed tab", group: "File", shortcut: "Ctrl+Shift+T", run: () => void reopenClosed() },
    { id: "view.toggleSidebar", title: "Show or hide the sidebar", group: "View", shortcut: "Ctrl+\\", run: () => setState((st) => ({ leftOpen: !st.leftOpen })) },
    { id: "view.files", title: "Show files", group: "View", run: () => setState({ leftOpen: true, leftView: "files" }) },
    { id: "view.outline", title: "Show outline", group: "View", run: () => setState({ leftOpen: true, leftView: "outline" }) },
    { id: "view.search", title: "Search in folder", group: "View", shortcut: "Ctrl+Shift+F", run: () => setState({ leftOpen: true, leftView: "search" }) },
    { id: "view.focus", title: "Focus mode", group: "View", shortcut: "F11", run: toggleFocusMode },
    { id: "view.theme", title: `Switch to ${shownDark ? "light" : "dark"} theme`, group: "View", run: () => void updateSettings({ theme: shownDark ? "light" : "dark" }) },
    { id: "view.themeSystem", title: "Use system theme", group: "View", run: () => void updateSettings({ theme: "system" }) },
    { id: "view.density", title: `Use ${s.settings.density === "compact" ? "comfortable" : "compact"} density`, group: "View", run: () => void updateSettings({ density: s.settings.density === "compact" ? "comfortable" : "compact" }) },
    { id: "app.settings", title: "Settings", group: "App", shortcut: "Ctrl+,", run: () => setState({ dialog: { kind: "settings" } }) },
    { id: "app.shortcuts", title: "Keyboard shortcuts", group: "Help", run: () => openPalette("?") },
    { id: "app.about", title: "About Productivity", group: "Help", run: () => setState({ dialog: { kind: "about" } }) },
  ];
  if (s.workspace) cmds.push({ id: "file.closeFolder", title: "Close folder", group: "File", run: closeFolder });
  if (tab) {
    cmds.push(
      { id: "file.save", title: "Save", group: "File", shortcut: "Ctrl+S", run: withTab((id) => void saveTab(id, { explicit: true })) },
      { id: "file.saveAs", title: "Save as…", group: "File", shortcut: "Ctrl+Shift+S", run: withTab((id) => void saveTab(id, { as: true, explicit: true })) },
      { id: "file.export", title: "Export…", group: "File", shortcut: "Ctrl+E", run: () => setState({ dialog: { kind: "export" } }) },
      { id: "file.print", title: "Print…", group: "File", run: () => void import("../shell/print").then((m) => m.printActive()) },
      { id: "file.close", title: "Close tab", group: "File", shortcut: "Ctrl+W", run: withTab((id) => void closeTab(id)) },
      { id: "tab.next", title: "Next tab", group: "View", shortcut: "Ctrl+PgDn", run: () => switchTab(1) },
      { id: "tab.prev", title: "Previous tab", group: "View", shortcut: "Ctrl+PgUp", run: () => switchTab(-1) },
      { id: "tab.recent", title: "Switch to last used tab", group: "View", shortcut: "Ctrl+Tab", run: switchToRecentTab },
      { id: "view.history", title: "Version history", group: "File", run: () => setState({ rightOpen: true, rightView: "history" }) },
      { id: "view.properties", title: "File properties", group: "File", run: () => setState({ rightOpen: true, rightView: "properties" }) },
      { id: "edit.find", title: "Find in file", group: "Edit", shortcut: "Ctrl+F", run: () => handles.get(tab.id)?.find?.() },
      { id: "edit.goto", title: "Go to line, page or row…", group: "Edit", shortcut: "Ctrl+G", run: () => openPalette(":") },
      { id: "edit.symbols", title: "Go to heading…", group: "Edit", run: () => openPalette("@") },
      { id: "view.zoomIn", title: "Zoom in", group: "View", shortcut: "Ctrl+=", run: () => handles.get(tab.id)?.zoom?.(1) },
      { id: "view.zoomOut", title: "Zoom out", group: "View", shortcut: "Ctrl+-", run: () => handles.get(tab.id)?.zoom?.(-1) },
      { id: "view.zoomReset", title: "Reset zoom", group: "View", shortcut: "Ctrl+0", run: () => handles.get(tab.id)?.zoom?.(0) },
    );
    if (tab.path) {
      const p = tab.path;
      if (platform.folders)
        cmds.push(
          { id: "file.reveal", title: "Show in folder", group: "File", run: () => void platform.reveal(p) },
          { id: "file.openExternal", title: "Open in default app", group: "File", run: () => void platform.openExternal(p).catch((e) => toast(String(e), "error")) },
          { id: "file.copyPath", title: "Copy file path", group: "File", run: () => void navigator.clipboard.writeText(p).then(() => toast("Path copied")) },
        );
    }
    if (tab.kind === "csv") cmds.push({ id: "file.openAsText", title: "Open as plain text", group: "File", run: () => void reopenAs(tab.id, "text") });
    if (tab.kind === "text" && /\.(csv|tsv)$/i.test(tab.name)) cmds.push({ id: "file.openAsTable", title: "Open as table", group: "File", run: () => void reopenAs(tab.id, "csv") });
    if (isTextual(tab.kind) && tab.kind !== "text") cmds.push({ id: "file.openAsPlain", title: "Open as plain text", group: "File", run: () => void reopenAs(tab.id, "text") });
  }
  return cmds;
}

export function allCommands(): Command[] {
  const tab = activeTab();
  const engine = tab ? handles.get(tab.id)?.commands?.() ?? [] : [];
  const seen = new Set<string>();
  return [...engine, ...shellCommands()].filter((c) => (seen.has(c.title) ? false : (seen.add(c.title), true)));
}

export function runCommand(id: string) {
  allCommands().find((c) => c.id === id)?.run();
}

export function appMenu(): MenuItem[] {
  const tab = activeTab();
  const item = (id: string, label?: string): MenuItem => {
    const c = allCommands().find((x) => x.id === id);
    return c ? { label: label ?? c.title, shortcut: c.shortcut, run: () => void c.run() } : { label: label ?? id, disabled: true };
  };
  return [
    item("file.newMarkdown", "New Markdown note"),
    item("file.open"),
    item("file.openFolder"),
    { divider: true },
    ...(tab ? [item("file.save"), item("file.saveAs"), item("file.export"), item("file.print"), { divider: true } as MenuItem] : []),
    item("view.toggleSidebar"),
    item("view.focus"),
    item("view.theme"),
    { divider: true },
    item("app.settings"),
    item("app.shortcuts"),
    item("app.about"),
  ];
}
