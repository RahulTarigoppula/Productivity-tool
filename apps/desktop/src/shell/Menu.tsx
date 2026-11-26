/** A lightweight popup menu used for context menus and the app menu. It opens with the keyboard on
 *  its first item: arrow keys, Home, End and typing the start of a name move; Enter or Space
 *  chooses; Escape closes it and goes back to where it was opened from; Tab closes it and moves on. */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { focusMain } from "./modalFocus";

export interface MenuItem {
  label?: string;
  shortcut?: string;
  run?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

/** What React renders: the items without their handlers. React keeps its previous render around,
 *  and a handler would keep a closed document's whole content alive. */
interface MenuView {
  x: number;
  y: number;
  label?: string;
  items: Omit<MenuItem, "run">[];
}

let menu: { view: MenuView; items: MenuItem[]; opener: HTMLElement | null } | null = null;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());
const subscribe = (l: () => void) => {
  ls.add(l);
  return () => void ls.delete(l);
};

/** Opens a menu at (x, y). The keyboard goes back to `opener` when it closes; by default that is
 *  whatever has the keyboard now (the button or the document the menu was opened from). */
export function openMenu(x: number, y: number, items: MenuItem[], opts: { opener?: HTMLElement | null; label?: string } = {}) {
  const a = document.activeElement;
  const opener = opts.opener ?? (a instanceof HTMLElement && a !== document.body && !a.closest(".menu") ? a : null);
  menu = {
    view: {
      x: Math.max(4, Math.min(x, window.innerWidth - 240)),
      y: Math.max(4, Math.min(y, window.innerHeight - items.length * 30 - 16)),
      label: opts.label,
      items: items.map((it) => ({ label: it.label, shortcut: it.shortcut, disabled: it.disabled, divider: it.divider })),
    },
    items,
    opener,
  };
  emit();
}

/** Closes the menu; with `refocus`, the keyboard goes back to where the menu was opened from. */
export function closeMenu(refocus = false) {
  if (!menu) return;
  const { opener } = menu;
  menu = null;
  emit();
  if (!refocus) return;
  if (opener?.isConnected) opener.focus();
  else focusMain();
}

/** The id of the element the open menu was opened from, for aria-expanded on menu buttons. */
export function useMenuOpenerId(): string | null {
  return useSyncExternalStore(subscribe, () => menu?.opener?.id || null);
}

export function MenuHost() {
  const m = useSyncExternalStore(subscribe, () => menu?.view ?? null);
  const ref = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const buttons = () => Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);

  // The keyboard starts on the first item that can be chosen.
  useLayoutEffect(() => {
    if (!m) return;
    const all = buttons();
    (all.find((b) => b.getAttribute("aria-disabled") !== "true") ?? all[0])?.focus();
  }, [m]);

  useEffect(() => {
    if (!m) return;
    const onDown = (e: MouseEvent) => !(e.target as HTMLElement).closest(".menu") && closeMenu();
    const onBlur = () => closeMenu();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [m]);
  if (!m) return null;

  const choose = (index: number) => {
    const it = menu?.items[index];
    if (!it || it.disabled) return;
    closeMenu(true);
    it.run?.();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const all = buttons();
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => all[(j + all.length) % all.length]?.focus();
    if (e.key === "Escape") closeMenu(true);
    else if (e.key === "Tab") {
      // Back on the opener, the Tab itself then moves on from there.
      closeMenu(true);
      return;
    } else if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i < 0 ? -1 : i - 1);
    else if (e.key === "Home" || e.key === "PageUp") go(0);
    else if (e.key === "End" || e.key === "PageDown") go(-1);
    else if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing the start of a name: letters typed within a second add up, and one letter typed
      // again and again steps through the items that start with it.
      const t = typed.current;
      const now = Date.now();
      t.text = (now - t.at < 1000 ? t.text : "") + e.key.toLowerCase();
      t.at = now;
      const name = (b: HTMLElement) => (b.firstElementChild?.textContent ?? "").toLowerCase();
      const from = (start: number) => [...all.slice(start), ...all.slice(0, start)];
      const hit =
        from(t.text.length > 1 ? Math.max(i, 0) : i + 1).find((b) => name(b).startsWith(t.text)) ??
        (/^(.)\1+$/.test(t.text) ? from(i + 1).find((b) => name(b).startsWith(t.text[0])) : undefined);
      hit?.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="menu"
      role="menu"
      aria-label={m.label}
      ref={ref}
      style={{ left: m.x, top: m.y }}
      onKeyDown={onKey}
      // Clicks inside the menu never move the keyboard out of it (to a gap, a divider or a dimmed item).
      onMouseDown={(e) => e.preventDefault()}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && closeMenu()}
    >
      {m.items.map((it, i) =>
        it.divider ? (
          <div key={i} className="menu-div" role="separator" />
        ) : (
          // Dimmed items can still be reached with the arrow keys, so they can be read.
          <button key={i} type="button" role="menuitem" tabIndex={-1} className="menu-item" aria-disabled={it.disabled || undefined} onClick={() => choose(i)}>
            <span>{it.label}</span>
            {it.shortcut && <span className="sc">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
