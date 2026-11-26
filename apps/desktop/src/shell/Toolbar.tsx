import { Share, MoreHorizontal } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
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
  const updateEdges = () => {
    const el = toolsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    const el = toolsRef.current;
    if (!el) return;
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, items, tab?.error, tab?.loading]);

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
    <div className="toolbar" role="toolbar" aria-label={`${tab.name} tools`}>
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
