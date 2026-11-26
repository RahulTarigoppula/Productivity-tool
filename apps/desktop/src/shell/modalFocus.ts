/** Keyboard focus for dialogs: focus moves into the dialog, Tab and Shift+Tab stay inside it,
 *  Escape closes it, the page behind it is inert, and focus returns to where it was when the
 *  dialog closes. Also the shared helpers for putting focus somewhere useful. */
import { useEffect, type RefObject } from "react";

/** Elements that Tab stops at. */
export const FOCUSABLE =
  ':is(button, [href], input, select, textarea, [tabindex], [contenteditable]:not([contenteditable="false"])):not([disabled]):not([tabindex="-1"])';

const shown = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility === "visible";

/** The first control inside `root` that Tab would reach and that is on screen. */
export function firstFocusable(root: ParentNode): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) if (shown(el)) return el;
  return null;
}

/** For when the control that had the keyboard went away: the open document takes it (or its tab,
 *  for a document with nothing to focus, like an Office preview), or the home screen when no file
 *  is open. */
export function focusMain(): void {
  const pane = document.querySelector("section.doc-pane:not([hidden])");
  const target = pane
    ? pane.querySelector<HTMLElement>(".cm-content, [tabindex='0'], iframe") ?? document.querySelector<HTMLElement>('[role="tab"][tabindex="0"]')
    : document.querySelector<HTMLElement>(".home .create-card");
  target?.focus();
}

/** Open dialogs and the palette, newest last: only the top one handles Tab and Escape, and the
 *  rest of the window is inert while it is open (no clicks, no focus, hidden from screen readers). */
const layers: { id: symbol; root: HTMLElement | null }[] = [];
let inertNow: HTMLElement[] = [];

export function pushLayer(root: HTMLElement | null = null): symbol {
  const id = Symbol("layer");
  layers.push({ id, root });
  updateInert();
  return id;
}
export function popLayer(id: symbol): void {
  const i = layers.findLastIndex((l) => l.id === id);
  if (i >= 0) layers.splice(i, 1);
  updateInert();
}
const isTop = (id: symbol) => layers[layers.length - 1]?.id === id;

function updateInert() {
  for (const el of inertNow) el.inert = false;
  inertNow = [];
  // Everything beside the top layer and its ancestors, up to the app's root. Elements marked
  // data-stays-live are left alone: a notification that arrives meanwhile must still be read out.
  for (let el = layers[layers.length - 1]?.root ?? null; el?.parentElement && el.parentElement !== document.body; el = el.parentElement) {
    for (const sibling of el.parentElement.children) {
      if (sibling === el || !(sibling instanceof HTMLElement) || sibling.inert || sibling.hasAttribute("data-stays-live")) continue;
      sibling.inert = true;
      inertNow.push(sibling);
    }
  }
}

const DIALOG = '[role="dialog"], [role="alertdialog"]';

export function useModalFocus(ref: RefObject<HTMLElement | null>, onClose?: () => void, opts: { trap?: boolean } = {}) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const root = ref.current;
    // Screen readers stay in the dialog too: it says it is modal, and the page behind is inert.
    (root?.matches(DIALOG) ? root : root?.querySelector(DIALOG))?.setAttribute("aria-modal", "true");
    const layer = pushLayer(root);
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
        else focusMain();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
