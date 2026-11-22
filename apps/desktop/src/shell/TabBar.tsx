import { useEffect, useRef, useState } from "react";
import { X, Plus, PanelLeft, Search, Ellipsis, Layers } from "lucide-react";
import { useStore, setState } from "../app/store";
import { activate, closeTab, moveTab, newFile } from "../app/actions";
import { KindIcon } from "./icons";
import { openMenu } from "./Menu";
import { appMenu } from "../app/commands";

export function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeId = useStore((s) => s.activeId);
  const leftOpen = useStore((s) => s.leftOpen);
  const [dragId, setDragId] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  // More tabs than fit: the active one is kept in view, and soft edges show there are more.
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

  return (
    <div className="tabrow" role="tablist" aria-label="Open files">
      <div className="left">
        <button className={`icon-btn ${leftOpen ? "active" : ""}`} title="Toggle sidebar (Ctrl+\)" aria-label="Toggle sidebar" onClick={() => setState((s) => ({ leftOpen: !s.leftOpen }))}>
          <PanelLeft />
        </button>
        {tabs.length > 0 && (
          <button className="icon-btn tab-count" title="All open files" onClick={() => setState({ palette: { open: true, query: "" } })}>
            <Layers /> {tabs.length}
          </button>
        )}
      </div>
      <div
        className={`tabs ${edges.left ? "fade-left" : ""} ${edges.right ? "fade-right" : ""}`}
        ref={tabsRef}
        onScroll={updateEdges}
        onWheel={(e) => {
          if (tabsRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) tabsRef.current.scrollLeft += e.deltaY;
        }}
        onDoubleClick={(e) => {
          if (e.target === tabsRef.current) newFile("markdown");
        }}
      >
        {tabs.map((t, i) => (
          <div
            key={t.id}
            role="tab"
            aria-selected={t.id === activeId}
            className={`tab ${t.id === activeId ? "active" : ""} ${dragId === t.id ? "dragging" : ""}`}
            title={t.path ?? t.name}
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
              } else if (e.button === 0) activate(t.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY, [
                { label: "Close", run: () => void closeTab(t.id) },
                // Cancel on any "Save changes?" question stops closing the rest.
                { label: "Close others", run: async () => { for (const o of tabs) if (o.id !== t.id && !(await closeTab(o.id))) break; } },
                { label: "Close tabs to the right", run: async () => { for (const o of tabs.slice(i + 1)) if (!(await closeTab(o.id))) break; } },
              ]);
            }}
          >
            <KindIcon kind={t.kind} name={t.name} />
            <span className="name">{t.name}</span>
            {t.dirty ? (
              <span className="dot" aria-label="Unsaved changes" onMouseDown={(e) => { e.stopPropagation(); void closeTab(t.id); }} />
            ) : (
              <button className="close" aria-label={`Close ${t.name}`} onMouseDown={(e) => { e.stopPropagation(); if (e.button === 0) void closeTab(t.id); }}>
                <X />
              </button>
            )}
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
        <button className="icon-btn" title="Menu" aria-label="Menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openMenu(r.right - 220, r.bottom + 4, appMenu()); }}>
          <Ellipsis />
        </button>
      </div>
    </div>
  );
}
