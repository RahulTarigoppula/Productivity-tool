import { useEffect, useRef, useState } from "react";
import { X, Plus, PanelLeft, Search, Ellipsis, Layers } from "lucide-react";
import { useStore, setState, type Tab } from "../app/store";
import { activate, closeTab, moveTab, newFile } from "../app/actions";
import { KindIcon } from "./icons";
import { openMenu, useMenuOpenerId } from "./Menu";
import { appMenu } from "../app/commands";

const tabElement = (id: string) => document.getElementById(`tab-${id}`);

export function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeId = useStore((s) => s.activeId);
  const leftOpen = useStore((s) => s.leftOpen);
  const menuOpener = useMenuOpenerId();
  const [dragId, setDragId] = useState<string | null>(null);
  // Arrow keys move the keyboard along the tabs without opening them (a large file takes a moment
  // to open); Enter opens one. The tab the keyboard is on is the strip's one Tab stop, otherwise
  // the open tab is.
  const [keyId, setKeyId] = useState<string | null>(null);
  const stopId = keyId && tabs.some((t) => t.id === keyId) ? keyId : activeId;
  const tabsRef = useRef<HTMLDivElement>(null);
  // More tabs than fit: the active one is kept in view, soft edges show there are more, and the
  // all-tabs button appears.
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = () => {
    const el = tabsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    // After layout (a reopened tab moves into place first).
    const raf = requestAnimationFrame(() => {
      tabsRef.current?.querySelector<HTMLElement>(".tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
      updateEdges();
    });
    return () => cancelAnimationFrame(raf);
  }, [activeId, tabs]);
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const focusTab = (t: Tab | undefined) => {
    if (!t) return;
    setKeyId(t.id);
    tabElement(t.id)?.focus();
  };

  const tabMenu = (t: Tab, i: number, x: number, y: number) =>
    openMenu(x, y, [
      { label: "Close", run: () => void closeTab(t.id) },
      // Cancel on any "Save changes?" question stops closing the rest.
      { label: "Close others", run: async () => { for (const o of tabs) if (o.id !== t.id && !(await closeTab(o.id))) break; } },
      { label: "Close tabs to the right", run: async () => { for (const o of tabs.slice(i + 1)) if (!(await closeTab(o.id))) break; } },
    ], { label: t.name });

  const onTabKey = (e: React.KeyboardEvent<HTMLElement>, t: Tab, i: number) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowRight") focusTab(tabs[(i + 1) % tabs.length]);
    else if (e.key === "ArrowLeft") focusTab(tabs[(i - 1 + tabs.length) % tabs.length]);
    else if (e.key === "Home") focusTab(tabs[0]);
    else if (e.key === "End") focusTab(tabs[tabs.length - 1]);
    else if (e.key === "Enter" || e.key === " ") activate(t.id);
    else if (e.key === "Delete") {
      // Closing sends the keyboard to the document; stay on the strip, next to the closed tab, so
      // several can be closed in a row. With none left, the home screen takes it.
      const next = tabs[i + 1] ?? tabs[i - 1];
      void closeTab(t.id).then((closed) => closed && next && window.setTimeout(() => focusTab(next), 0));
    } else return;
    e.preventDefault();
  };

  return (
    <div className={`tabrow ${edges.left || edges.right ? "overflowing" : ""}`}>
      <div className="left">
        <button className={`icon-btn ${leftOpen ? "active" : ""}`} title="Show or hide the sidebar (Ctrl+\)" aria-label="Show or hide the sidebar" aria-pressed={leftOpen} onClick={() => setState((s) => ({ leftOpen: !s.leftOpen }))}>
          <PanelLeft />
        </button>
        {tabs.length > 0 && (
          <button className="icon-btn tab-count" title="All open files" aria-label={`All open files: ${tabs.length}`} onClick={() => setState({ palette: { open: true, query: "" } })}>
            <Layers /> {tabs.length}
          </button>
        )}
      </div>
      <div
        className={`tabs ${edges.left ? "fade-left" : ""} ${edges.right ? "fade-right" : ""}`}
        role="tablist"
        aria-label="Open files"
        ref={tabsRef}
        onScroll={updateEdges}
        onWheel={(e) => {
          if (tabsRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) tabsRef.current.scrollLeft += e.deltaY;
        }}
        onDoubleClick={(e) => {
          if (e.target === tabsRef.current) newFile("markdown");
        }}
        onBlur={(e) => {
          // Coming back to the strip later starts at the open tab again.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyId(null);
        }}
      >
        {tabs.map((t, i) => (
          <div
            key={t.id}
            className={`tab ${t.id === activeId ? "active" : ""} ${t.dirty ? "dirty" : ""} ${dragId === t.id ? "dragging" : ""}`}
            draggable
            onDragStart={(e) => {
              setDragId(t.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/x-tab", t.id);
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/x-tab");
              if (id) {
                e.preventDefault();
                e.stopPropagation();
                moveTab(id, i);
              }
            }}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                void closeTab(t.id);
              } else if (e.button === 0 && !(e.target as HTMLElement).closest(".close")) activate(t.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              // From the keyboard (Shift+F10 or the menu key) the menu opens below the tab.
              const r = e.currentTarget.getBoundingClientRect();
              const atPointer = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
              tabMenu(t, i, atPointer ? e.clientX : r.left, atPointer ? e.clientY : r.bottom);
            }}
          >
            <div
              role="tab"
              id={`tab-${t.id}`}
              className="tab-main"
              aria-selected={t.id === activeId}
              aria-keyshortcuts="Delete"
              tabIndex={t.id === stopId ? 0 : -1}
              title={t.path ?? t.name}
              onKeyDown={(e) => onTabKey(e, t, i)}
            >
              <KindIcon kind={t.kind} name={t.name} />
              <span className="name">{t.name}</span>
              {t.dirty && <span className="sr-only">, unsaved changes</span>}
            </div>
            {/* For the mouse and touch (a dot while there are unsaved changes); the keyboard closes
                the tab with Delete or Ctrl+W, so this is not a second stop inside the tab. */}
            <button type="button" className="close" tabIndex={-1} aria-hidden="true" title="Close" onMouseDown={(e) => e.preventDefault()} onClick={() => void closeTab(t.id)}>
              <X />
            </button>
          </div>
        ))}
      </div>
      <div className="right">
        <button className="icon-btn" title="New file (Ctrl+N)" aria-label="New file" onClick={() => setState({ dialog: { kind: "newFile" } })}>
          <Plus />
        </button>
        <button className="icon-btn" title="Search and commands (Ctrl+K)" aria-label="Search and commands" onClick={() => setState({ palette: { open: true, query: "" } })}>
          <Search />
        </button>
        <button
          id="app-menu-button"
          className="icon-btn"
          title="Menu"
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={menuOpener === "app-menu-button"}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openMenu(r.right - 220, r.bottom + 4, appMenu(), { opener: e.currentTarget, label: "Menu" });
          }}
        >
          <Ellipsis />
        </button>
      </div>
    </div>
  );
}
