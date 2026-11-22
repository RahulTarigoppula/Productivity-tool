/** Keyboard focus for dialogs: focus moves into the dialog, Tab and Shift+Tab stay inside it,
 *  Escape closes it, and focus returns to where it was when the dialog closes. */
import { useEffect, type RefObject } from "react";

/** Open dialogs and the palette, newest last: only the top one handles Tab and Escape. */
const layers: symbol[] = [];
export function pushLayer(): symbol {
  const t = Symbol("layer");
  layers.push(t);
  return t;
}
export function popLayer(t: symbol): void {
  const i = layers.lastIndexOf(t);
  if (i >= 0) layers.splice(i, 1);
}
const isTop = (t: symbol) => layers[layers.length - 1] === t;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalFocus(ref: RefObject<HTMLElement | null>, onClose?: () => void, opts: { trap?: boolean } = {}) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const layer = pushLayer();
    // Let autoFocus (if any) win, otherwise focus the first control.
    const t = window.setTimeout(() => {
      if (root && !root.contains(document.activeElement)) {
        const first = root.querySelector<HTMLElement>("[autofocus], " + FOCUSABLE);
        (first ?? root).focus();
      }
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      // A dialog or the palette opened on top of this one handles the keys.
      if (!root || !isTop(layer)) return;
      if (e.key === "Escape" && onClose) {
        e.stopPropagation();
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || opts.trap === false) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      popLayer(layer);
      // Back to where the person was (or the open document, if that control is gone).
      window.setTimeout(() => {
        if (document.activeElement && document.activeElement !== document.body && !root?.contains(document.activeElement)) return;
        if (before && before.isConnected && before !== document.body) before.focus();
        else document.querySelector<HTMLElement>("section.doc-pane:not([hidden]) .cm-content, section.doc-pane:not([hidden]) [tabindex='0']")?.focus();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
