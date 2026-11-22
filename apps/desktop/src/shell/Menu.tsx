/** A lightweight popup menu used for context menus and the app menu. */
import { useEffect, useSyncExternalStore } from "react";

export interface MenuItem {
  label?: string;
  shortcut?: string;
  run?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

let menu: { x: number; y: number; items: MenuItem[] } | null = null;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

export function openMenu(x: number, y: number, items: MenuItem[]) {
  menu = { x: Math.max(4, Math.min(x, window.innerWidth - 240)), y: Math.max(4, Math.min(y, window.innerHeight - items.length * 30 - 16)), items };
  emit();
}
export function closeMenu() {
  menu = null;
  emit();
}

export function MenuHost() {
  const m = useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => menu);
  useEffect(() => {
    if (!m) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    const onDown = (e: MouseEvent) => !(e.target as HTMLElement).closest(".menu") && closeMenu();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("blur", closeMenu);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("blur", closeMenu);
    };
  }, [m]);
  if (!m) return null;
  return (
    <div className="menu" role="menu" style={{ left: m.x, top: m.y }}>
      {m.items.map((it, i) =>
        it.divider ? (
          <div key={i} className="menu-div" />
        ) : (
          <button key={i} role="menuitem" className="menu-item" disabled={it.disabled} onClick={() => { closeMenu(); it.run?.(); }}>
            <span>{it.label}</span>
            {it.shortcut && <span className="sc">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
