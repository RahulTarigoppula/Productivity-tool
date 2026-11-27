import { Share, MoreHorizontal } from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { useStore, setState, getState } from "../app/store";
import type { ToolbarItem } from "../app/editor-api";
import { openMenu, useMenuOpenerId } from "./Menu";

/** What React keeps of the engine's tools: everything but the handlers, which are looked up when a
 *  button is used. React holds on to its previous render, and a handler would keep a closed
 *  document's whole content alive. */
type ToolView = Omit<ToolbarItem, "run">;
const views = new WeakMap<ToolbarItem[], ToolView[]>();
const NONE: ToolView[] = [];
function toolViews(items: ToolbarItem[] | undefined): ToolView[] {
  if (!items) return NONE;
  let v = views.get(items);
  if (!v) views.set(items, (v = items.map(({ run: _run, ...view }) => view)));
  return v;
}
function runTool(id: string) {
  const s = getState();
  (s.activeId ? s.toolbar[s.activeId] : undefined)?.find((i) => i.id === id)?.run();
}

export function Toolbar() {
  const activeId = useStore((s) => s.activeId);
  const items = useStore((s) => toolViews(s.activeId ? s.toolbar[s.activeId] : undefined));
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeId));
  const menuOpener = useMenuOpenerId();
  // The tools scroll sideways when they do not fit, with soft edges where there are more; More and
  // Export stay in place at the end, so they can always be reached.
  const toolsRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  // Tools marked "overflow" move into the More menu when the full set does not fit. The width the
  // full set needs is measured while it is shown, so the toolbar does not flip back and forth.
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);
  // When the tools were moved: the toolbar's width then, and how much wider it must get to fit them.
  const need = useRef({ at: 0, more: 0 });
  const hasOverflow = items.some((i) => i.overflow);
  const updateEdges = () => {
    const el = toolsRef.current;
    const bar = el?.parentElement;
    if (!el || !bar) return;
    if (hasOverflow && !collapsedRef.current && el.scrollWidth > el.clientWidth + 2) {
      need.current = { at: bar.clientWidth, more: el.scrollWidth - el.clientWidth };
      collapsedRef.current = true;
      setCollapsed(true);
      return;
    }
    // Back when the toolbar has grown by what was missing (whatever the More button's own width).
    if (collapsedRef.current && bar.clientWidth >= need.current.at + need.current.more + 1) {
      collapsedRef.current = false;
      setCollapsed(false);
      return;
    }
    const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  // Measured again when the set of tools changes (not when one is switched on or off, which happens
  // as the cursor moves), before the toolbar is painted, so a squeezed row is never shown.
  const toolSet = items.map((i) => `${i.id}:${i.text ?? ""}:${i.overflow ? 1 : 0}`).join();
  useLayoutEffect(() => {
    collapsedRef.current = false;
    setCollapsed(false);
  }, [activeId, toolSet]);
  const update = useRef(updateEdges);
  update.current = updateEdges;
  useLayoutEffect(() => {
    const el = toolsRef.current;
    if (!el) return;
    update.current();
    const ro = new ResizeObserver(() => update.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, toolSet, collapsed, tab?.error, tab?.loading]);

  // One Tab stop for the whole toolbar; the arrow keys, Home and End move between its buttons
  // (the usual toolbar keys). The stop stays on the button last used.
  const barRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<string | null>(null);
  const toolButtons = () =>
    Array.from(barRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []).filter((b) => !b.disabled && b.offsetParent !== null);
  useLayoutEffect(() => {
    const all = toolButtons();
    if (!all.length) return;
    const keep = all.find((b) => b.getAttribute("aria-label") === lastFocused.current) ?? all[0];
    for (const b of Array.from(barRef.current?.querySelectorAll("button") ?? [])) b.tabIndex = b === keep ? 0 : -1;
  });
  const onBarKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const all = toolButtons();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const to = e.key === "ArrowRight" ? (i + 1) % all.length : e.key === "ArrowLeft" ? (i - 1 + all.length) % all.length : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    for (const b of all) b.tabIndex = -1;
    all[to].tabIndex = 0;
    all[to].focus();
    all[to].scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const onBarFocus = (e: React.FocusEvent) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b) lastFocused.current = b.getAttribute("aria-label");
  };

  if (!activeId || !tab) return <div className="toolbar" />;
  // A file that could not be opened has nothing to edit or export.
  if (tab.error || tab.loading) return <div className="toolbar empty" aria-hidden />;
  // Office files bring their own ribbon; an empty app toolbar above it would only take space.
  if (!items.length && (tab.kind === "docx" || tab.kind === "xlsx" || tab.kind === "pptx")) return <div className="toolbar empty" aria-hidden />;

  const groups: ToolView[][] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last[0].group === it.group) last.push(it);
    else groups.push([it]);
  }
  const overflow = items.filter((i) => i.overflow);

  return (
    <div className={`toolbar ${collapsed ? "collapsed" : ""}`} role="toolbar" aria-label={`${tab.name} tools`} ref={barRef} onKeyDown={onBarKey} onFocus={onBarFocus}>
      <div
        className={`tools ${edges.left ? "fade-left" : ""} ${edges.right ? "fade-right" : ""}`}
        ref={toolsRef}
        onScroll={updateEdges}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
        }}
      >
        {groups.map((g, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <span className={`divider ${g.every((i) => i.overflow) ? "overflow-item" : ""}`} />}
            <div className="group">
              {g.map((it) => (
                <button
                  key={it.id}
                  className={`icon-btn ${it.active ? "active" : ""} ${it.overflow ? "overflow-item" : ""}`}
                  title={it.shortcut ? `${it.label} (${it.shortcut})` : it.label}
                  // The spoken name holds the words on the button (people using voice control say
                  // what they see); a label that does not is still the tooltip.
                  aria-label={it.text && !it.label.toLowerCase().includes(it.text.toLowerCase()) ? it.text : it.label}
                  aria-pressed={it.active}
                  disabled={it.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runTool(it.id)}
                >
                  {it.icon}
                  {it.text && <span>{it.text}</span>}
                </button>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
      {overflow.length > 0 && (
        <button
          id="toolbar-more-button"
          className="icon-btn more-btn"
          title="More"
          aria-label="More tools"
          aria-haspopup="menu"
          aria-expanded={menuOpener === "toolbar-more-button"}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openMenu(r.left - 160, r.bottom + 4, overflow.map((o) => ({ label: o.label, shortcut: o.shortcut, run: () => runTool(o.id), disabled: o.disabled })), { opener: e.currentTarget, label: "More tools" });
          }}
        >
          <MoreHorizontal />
        </button>
      )}
      <button className="icon-btn" title="Export (Ctrl+E)" aria-label="Export" aria-keyshortcuts="Control+E" onClick={() => setState({ dialog: { kind: "export" } })}>
        <Share /> <span className="export-label">Export</span>
      </button>
    </div>
  );
}
