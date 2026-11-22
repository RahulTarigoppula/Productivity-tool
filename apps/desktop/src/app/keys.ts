/** Reserved shell shortcuts (docs/plans/07-ux-ui-design.md, "Keyboard").
 *  They are handled before any engine sees them; everything else belongs to the focused format. */
import { getState, setState, activeTab, handles } from "./store";
import { newFile, pickAndOpen, saveTab, closeTab, reopenClosed, switchTab, switchToRecentTab, activate } from "./actions";
import { openPalette, toggleFocusMode } from "./commands";

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
    else if (e.key === "Escape" && s.focusMode && !s.palette.open && !s.dialog) toggleFocusMode();
    else if (!mod) handled = false;
    else if (k === "k" && !e.shiftKey && !e.altKey) openPalette("");
    else if (k === "p" && e.shiftKey) openPalette(">");
    else if (k === "p" && !e.shiftKey && (!tab || tab.kind === "text" || tab.kind === "markdown" || tab.kind === "csv")) openPalette("");
    else if (k === "n" && !e.shiftKey) newFile("markdown");
    else if (k === "o" && !e.shiftKey) void pickAndOpen();
    else if (k === "s" && tab) {
      // Holding the keys down repeats them; that is still one save.
      if (!(e as { repeat?: boolean }).repeat) void saveTab(tab.id, { as: e.shiftKey, explicit: true });
    }
    else if (k === "w" && tab && !e.shiftKey) void closeTab(tab.id);
    else if (k === "t" && e.shiftKey) void reopenClosed();
    else if (k === "e" && tab && !e.shiftKey) setState({ dialog: { kind: "export" } });
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
    else if (k === "g" && !e.shiftKey && tab && tab.kind !== "text" && tab.kind !== "markdown") openPalette(":");
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
