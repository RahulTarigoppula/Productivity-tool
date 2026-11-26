import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { shiftedOrder } from "./pageTools";

type Watch = (el: Element, onChange: (near: boolean) => void) => () => void;

/** Tells each thumbnail whether it is near the visible part of the list (one observer for them all). */
function useNearList(list: RefObject<HTMLElement | null>): Watch {
  const io = useRef<{ observer: IntersectionObserver; calls: Map<Element, (near: boolean) => void> } | null>(null);
  useEffect(() => () => io.current?.observer.disconnect(), []);
  return useCallback((el, onChange) => {
    if (!io.current) {
      const calls = new Map<Element, (near: boolean) => void>();
      // About three thumbnails beyond each end of the visible part are drawn ahead of scrolling.
      const observer = new IntersectionObserver((entries) => entries.forEach((e) => calls.get(e.target)?.(e.isIntersecting)), { root: list.current, rootMargin: "600px 0px" });
      io.current = { observer, calls };
    }
    const { observer, calls } = io.current;
    calls.set(el, onChange);
    observer.observe(el);
    return () => {
      calls.delete(el);
      observer.unobserve(el);
    };
  }, [list]);
}

function Thumb({ doc, index, id, selected, current, cursor, watch, onRendered, onClick, onContextMenu, onDragStart, onDropAt }: {
  doc: PDFDocumentProxy; index: number; id: string; selected: boolean; current: boolean; cursor: boolean;
  watch: Watch; onRendered: (pageNumber: number, page: PDFPageProxy) => void;
  onClick: (e: React.MouseEvent) => void; onContextMenu: (e: React.MouseEvent) => void; onDragStart: () => void; onDropAt: (before: boolean) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [over, setOver] = useState<"before" | "after" | null>(null);
  useEffect(() => (ref.current ? watch(ref.current, setNear) : undefined), [watch]);
  // Only thumbnails near the visible part of the list hold a drawing; a long PDF would otherwise
  // keep hundreds of canvases (and the pages behind them) in memory.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (!near) {
      // Far away: give the drawing's memory back. The box keeps its size from its aspect ratio.
      if (c.width) c.width = c.height = 0;
      return;
    }
    let cancelled = false;
    let task: { cancel(): void } | null = null;
    void doc.getPage(index + 1).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 220 / base.width });
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.aspectRatio = `${c.width} / ${c.height}`;
      const t = page.render({ canvas: c, viewport: vp });
      task = t;
      // Then PDF.js may free what it decoded for the page, unless the main view is showing it.
      t.promise.then(() => !cancelled && onRendered(index + 1, page), () => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, doc, index, onRendered]);
  return (
    <div
      id={id}
      className={`thumb ${selected ? "sel" : ""} ${current ? "cur" : ""} ${cursor ? "cursor" : ""} ${over ? `drop-${over}` : ""}`}
      draggable
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={(e) => { e.dataTransfer.setData("text/x-page", String(index)); onDragStart(); }}
      onDragOver={(e) => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setOver(e.clientY < r.top + r.height / 2 ? "before" : "after");
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        onDropAt(over !== "after");
        setOver(null);
      }}
      role="option"
      aria-selected={selected}
      aria-current={current ? "page" : undefined}
      aria-label={`Page ${index + 1}`}
    >
      {/* Empty (0×0, no memory) until drawn; CSS gives it a page-like size meanwhile. */}
      <canvas ref={ref} width={0} height={0} />
      <span className="n">{index + 1}</span>
    </div>
  );
}

/** Scrolls the list just enough to show one of its pages. */
function reveal(list: HTMLElement | null, index: number) {
  const el = list?.children[index] as HTMLElement | undefined;
  if (!list || !el) return;
  const l = list.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < l.top) list.scrollTop -= l.top - r.top + 8;
  else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom + 8;
}

/** The page list. With the keyboard: arrows, Home and End move; Space selects (Shift+arrows and
 *  Shift+Space select a range, Ctrl+A all); Enter goes to the page; Alt+Up and Alt+Down move the
 *  page, or the selected pages, one place. Right-click (a long press on touch) opens page tools. */
export function Thumbnails({ doc, count, selected, current, onSelect, onActivate, onMove, onShift, onMenu, onRendered }: {
  doc: PDFDocumentProxy; count: number; selected: number[]; current: number;
  onSelect: (pages: number[]) => void; onActivate: (page: number) => void; onMove: (pages: number[], target: number) => void;
  /** Move these pages one place up (-1) or down (+1). */
  onShift: (pages: number[], delta: -1 | 1) => void;
  /** Show page tools for these pages at a point on screen. */
  onMenu: (pages: number[], x: number, y: number) => void;
  /** A thumbnail finished drawing (must not change between renders). */
  onRendered: (pageNumber: number, page: PDFPageProxy) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const watch = useNearList(list);
  const anchor = useRef(0);
  const dragging = useRef<number[]>([]);
  const id = useId();
  // The keyboard's place in the list. It follows the page in view while the list does not have the focus.
  const [cursor, setCursor] = useState(current - 1);
  const at = Math.max(0, Math.min(count - 1, cursor));
  useEffect(() => {
    if (document.activeElement !== list.current) setCursor(current - 1);
    reveal(list.current, current - 1);
  }, [current]);
  useEffect(() => reveal(list.current, at), [at]);

  const range = (to: number) => {
    const [a, b] = [Math.min(anchor.current, to), Math.max(anchor.current, to)];
    onSelect([...Array(b - a + 1).keys()].map((k) => k + a));
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? -1 : 1;
      const pages = selected.includes(at) ? selected : [at];
      setCursor(shiftedOrder(count, pages, delta).indexOf(at));
      onShift(pages, delta);
      return;
    }
    const arrow = ({ ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 } as Record<string, number>)[e.key];
    const to = arrow ? at + arrow : e.key === "Home" ? 0 : e.key === "End" ? count - 1 : null;
    if (to !== null && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const next = Math.max(0, Math.min(count - 1, to));
      setCursor(next);
      // Shift extends the selection from where it started; a plain move only moves.
      if (e.shiftKey) range(next);
      else anchor.current = next;
    } else if (e.key === " ") {
      e.preventDefault();
      if (e.shiftKey) return range(at);
      onSelect(selected.includes(at) ? selected.filter((x) => x !== at) : [...selected, at]);
      anchor.current = at;
    } else if (e.key === "Enter") {
      e.preventDefault();
      onActivate(at + 1);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      onSelect([...Array(count).keys()]);
    }
  };

  return (
    <div
      ref={list}
      className="thumbs"
      role="listbox"
      aria-multiselectable
      aria-label="Pages"
      tabIndex={0}
      aria-activedescendant={`${id}-${at}`}
      onKeyDown={onKeyDown}
    >
      {Array.from({ length: count }, (_, i) => (
        <Thumb
          key={i}
          doc={doc}
          index={i}
          id={`${id}-${i}`}
          selected={selected.includes(i)}
          current={current === i + 1}
          cursor={at === i}
          watch={watch}
          onRendered={onRendered}
          onClick={(e) => {
            setCursor(i);
            if (e.shiftKey) {
              range(i);
            } else if (e.ctrlKey || e.metaKey) {
              onSelect(selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i]);
              anchor.current = i;
            } else {
              onSelect([i]);
              anchor.current = i;
              onActivate(i + 1);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            // The menu acts on the selection when it includes this page, otherwise on this page alone.
            const pages = selected.includes(i) ? selected : [i];
            if (!selected.includes(i)) onSelect([i]);
            anchor.current = i;
            setCursor(i);
            onMenu(pages, e.clientX, e.clientY);
          }}
          onDragStart={() => (dragging.current = selected.includes(i) ? selected : [i])}
          onDropAt={(before) => onMove(dragging.current, before ? i : i + 1)}
        />
      ))}
    </div>
  );
}
