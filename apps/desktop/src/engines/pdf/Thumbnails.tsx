import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

function Thumb({ doc, index, selected, current, onClick, onDragStart, onDropAt }: {
  doc: PDFDocumentProxy; index: number; selected: boolean; current: boolean;
  onClick: (e: React.MouseEvent) => void; onDragStart: () => void; onDropAt: (before: boolean) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [over, setOver] = useState<"before" | "after" | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel(): void } | null = null;
    void doc.getPage(index + 1).then((page) => {
      if (cancelled || !ref.current) return;
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 220 / base.width });
      const c = ref.current;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const t = page.render({ canvas: c, viewport: vp });
      task = t;
      t.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, index]);
  return (
    <div
      className={`thumb ${selected ? "sel" : ""} ${current ? "cur" : ""} ${over ? `drop-${over}` : ""}`}
      draggable
      onClick={onClick}
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
      aria-label={`Page ${index + 1}`}
    >
      <canvas ref={ref} />
      <span className="n">{index + 1}</span>
    </div>
  );
}

export function Thumbnails({ doc, count, selected, current, onSelect, onActivate, onMove }: {
  doc: PDFDocumentProxy; count: number; selected: number[]; current: number;
  onSelect: (pages: number[]) => void; onActivate: (page: number) => void; onMove: (pages: number[], target: number) => void;
}) {
  const anchor = useRef(0);
  const dragging = useRef<number[]>([]);
  return (
    <div className="thumbs" role="listbox" aria-multiselectable aria-label="Pages">
      {Array.from({ length: count }, (_, i) => (
        <Thumb
          key={i}
          doc={doc}
          index={i}
          selected={selected.includes(i)}
          current={current === i + 1}
          onClick={(e) => {
            if (e.shiftKey) {
              const [a, b] = [Math.min(anchor.current, i), Math.max(anchor.current, i)];
              onSelect([...Array(b - a + 1).keys()].map((k) => k + a));
            } else if (e.ctrlKey || e.metaKey) {
              onSelect(selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i]);
              anchor.current = i;
            } else {
              onSelect([i]);
              anchor.current = i;
              onActivate(i + 1);
            }
          }}
          onDragStart={() => (dragging.current = selected.includes(i) ? selected : [i])}
          onDropAt={(before) => onMove(dragging.current, before ? i : i + 1)}
        />
      ))}
    </div>
  );
}
