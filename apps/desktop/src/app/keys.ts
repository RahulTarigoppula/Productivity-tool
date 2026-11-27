/** Reserved shell shortcuts (docs/plans/07-ux-ui-design.md, "Keyboard").
 *  They are handled before any engine sees them; everything else belongs to the focused format. */
import { getState, setState, activeTab, handles } from "./store";
import { newFile, pickAndOpen, saveTab, closeTab, reopenClosed, switchTab, switchToRecentTab, activate } from "./actions";
import { openPalette, toggleFocusMode, runCommand } from "./commands";
import { firstFocusable } from "../shell/modalFocus";

/** The window's parts in F6 order. Only those on screen with something to focus are visited. */
const REGIONS = [".tabrow", ".toolbar[role=toolbar]", ".side:not(.right)", ".doc-area", ".side.right", ".statusbar", ".toasts"];

/** F6 and Shift+F6: the keyboard moves to the next or previous part of the window (tab bar,
 *  toolbar, sidebar, document, side panel, status bar, notifications) without Tabbing through
 *  every control on the way. */
export function cycleRegions(dir: 1 | -1) {
  const tab = activeTab();
  const parts = REGIONS.map((sel) => document.querySelector<HTMLElement>(sel)).filter(
    (el): el is HTMLElement => !!el && (!!firstFocusable(el) || (!!tab && el.matches(".doc-area"))),
  );
  if (!parts.length) return;
  const here = parts.findIndex((el) => el.contains(document.activeElement));
  // From nowhere in particular, F6 goes to the document.
  const doc = Math.max(0, parts.findIndex((el) => el.matches(".doc-area")));
  const next = parts[here < 0 ? doc : (here + dir + parts.length) % parts.length];
  if (tab && next.matches(".doc-area")) {
    handles.get(tab.id)?.focus();
    if (next.contains(document.activeElement)) return;
  }
  // The tab bar starts on the open tab; elsewhere, the first control.
  (next.querySelector<HTMLElement>('[role="tab"][tabindex="0"]') ?? firstFocusable(next))?.focus();
}

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Runs the app shortcut for a key press; returns true if it was one. Also used for shortcuts
 *  typed inside embedded editors, which forward them to the app. */
export function handleShortcut(e: KeyLike): boolean {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const s = getState();
    const tab = activeTab();
    let handled = true;

    if (e.key === "F11") toggleFocusMode();
    // F2 renames the open file wherever the keyboard is (not while typing in a box of the app's own).
    else if (e.key === "F2" && !mod && !e.altKey && !e.shiftKey && tab && !s.dialog && !s.palette.open) {
      // (In a table, F2 edits the cell, as in Excel; in the app's own text boxes it does nothing.)
      const t = (e as { target?: EventTarget | null }).target as HTMLElement | null;
      if (t?.closest?.('input, textarea, [role="grid"], .tab-rename')) handled = false;
      else window.dispatchEvent(new CustomEvent("app:rename-tab", { detail: tab.id }));
    }
    else if (e.key === "F6" && !mod && !e.altKey) {
      // A dialog or the palette keeps the keyboard while it is open.
      if (!document.querySelector('[aria-modal="true"]')) cycleRegions(e.shiftKey ? -1 : 1);
    }
    // An open menu takes Escape for itself.
    else if (e.key === "Escape" && s.focusMode && !s.palette.open && !s.dialog && !document.querySelector(".menu")) toggleFocusMode();
    else if (!mod) handled = false;
    else if (k === "k" && !e.shiftKey && !e.altKey) openPalette("");
    else if (k === "p" && e.shiftKey) openPalette(">");
    // Ctrl+P prints, as everywhere else (Ctrl+K finds files); with nothing open it finds files. It
    // never prints the app window itself.
    else if (k === "p" && !e.shiftKey) {
      if (!tab) openPalette("");
      else if (!["binary", "media", "archive"].includes(tab.kind) && !tab.error) void runCommand("file.print");
    }
    else if (k === "n" && !e.shiftKey) newFile("markdown");
    else if (k === "o" && !e.shiftKey) void pickAndOpen();
    else if (k === "s" && tab) {
      // Holding the keys down repeats them; that is still one save.
      if (!(e as { repeat?: boolean }).repeat) void saveTab(tab.id, { as: e.shiftKey, explicit: true });
    }
    else if (k === "w" && tab && !e.shiftKey) void closeTab(tab.id);
    else if (k === "t" && e.shiftKey) void reopenClosed();
    else if (k === "e" && tab && !e.shiftKey && !tab.error) setState({ dialog: { kind: "export" } });
    else if (e.key === "Tab") e.shiftKey ? switchTab(-1) : switchToRecentTab();
    else if (e.key === "PageDown") switchTab(1);
    else if (e.key === "PageUp") switchTab(-1);
    else if (/^[1-9]$/.test(e.key) && !e.shiftKey && !e.altKey) {
      const t = e.key === "9" ? s.tabs[s.tabs.length - 1] : s.tabs[Number(e.key) - 1];
      if (t) activate(t.id);
    } else if (e.key === "\\") setState((st) => ({ leftOpen: !st.leftOpen }));
    else if (e.key === ",") setState({ dialog: { kind: "settings" } });
    else if (k === "f" && e.shiftKey) setState({ leftOpen: true, leftView: "search" });
    else if ((e.key === "=" || e.key === "+") && tab) handles.get(tab.id)?.zoom?.(1);
    else if (e.key === "-" && tab) handles.get(tab.id)?.zoom?.(-1);
    else if (e.key === "0" && tab) handles.get(tab.id)?.zoom?.(0);
    else if (k === "f" && !e.shiftKey && !e.altKey && tab && tab.kind !== "text" && tab.kind !== "markdown") handles.get(tab.id)?.find?.();
    else if (k === "g" && !e.shiftKey && tab) openPalette(":");
    else handled = false;
    return handled;
}

export function installKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (handleShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  window.addEventListener("keydown", onKey, true);
  // Block the browser's own zoom/print/find shortcuts inside the app window.
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const t = activeTab();
      if (t) handles.get(t.id)?.zoom?.(e.deltaY < 0 ? 1 : -1);
    }
  };
  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("wheel", onWheel, true);
  };
}
