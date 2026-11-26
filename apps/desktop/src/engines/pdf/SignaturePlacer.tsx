import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Bus, Viewer } from "./pdfjs";

/** A placed signature's width on the page, in PDF points (about 5.6 cm). */
export const SIGNATURE_WIDTH = 160;
/** Arrow keys move the preview this far, in PDF points; with Shift, the larger step. */
const STEP = 6;
const BIG_STEP = 48;

/** A spot on a page, as fractions of the page as shown, so zooming does not move it. */
interface Spot {
  page: number;
  fx: number;
  fy: number;
}
interface PageView {
  div: HTMLElement;
  viewport: { scale: number; width: number; height: number; convertToPdfPoint(x: number, y: number): number[] };
}

/** Height over width of a PNG, read from its header. */
function pngAspect(png: Uint8Array): number {
  if (png.length < 24) return 0.375;
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const w = v.getUint32(16);
  const h = v.getUint32(20);
  return w && h ? h / w : 0.375;
}

/** Choosing where a signature goes. A see-through preview at its real size starts in the middle of
 *  the page in view and follows the pointer; the arrow keys move it too (Shift for bigger steps, Page
 *  Up and Page Down for other pages). A click, or Enter, places it; Escape cancels. Rendered inside the
 *  scrolling pages container, so it scrolls with the pages. */
export function SignaturePlacer({ viewer, bus, container, png, onPlace, onCancel }: {
  viewer: Viewer;
  bus: Bus;
  container: HTMLElement;
  png: Uint8Array;
  /** The page index and the PDF point where the signature's centre goes. */
  onPlace: (page: number, x: number, y: number) => void;
  onCancel: () => void;
}) {
  const img = useRef<HTMLImageElement>(null);
  const [url] = useState(() => URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" })));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const handlers = useRef({ onPlace, onCancel });
  handlers.current = { onPlace, onCancel };

  useLayoutEffect(() => {
    // Nothing to place on yet (the document is still loading).
    if (!viewer.pagesCount) return void handlers.current.onCancel();
    const aspect = pngAspect(png);
    const view = (i: number) => viewer.getPageView(i) as PageView;
    // The preview is drawn at the size the signature will have, in CSS pixels at the current zoom.
    const size = (pv: PageView) => ({ w: SIGNATURE_WIDTH * pv.viewport.scale, h: SIGNATURE_WIDTH * pv.viewport.scale * aspect });
    let spot: Spot = { page: 0, fx: 0.5, fy: 0.5 };

    const draw = () => {
      const el = img.current;
      if (!el) return;
      const pv = view(spot.page);
      const { w, h } = size(pv);
      const d = pv.div;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.left = `${d.offsetLeft + d.clientLeft + spot.fx * d.clientWidth - w / 2}px`;
      el.style.top = `${d.offsetTop + d.clientTop + spot.fy * d.clientHeight - h / 2}px`;
    };
    /** Moves the preview, keeping the whole signature on the page. */
    const moveTo = (s: Spot) => {
      const page = Math.max(0, Math.min(viewer.pagesCount - 1, s.page));
      const pv = view(page);
      const { w, h } = size(pv);
      const fit = (f: number, half: number) => (half >= 0.5 ? 0.5 : Math.min(1 - half, Math.max(half, f)));
      spot = { page, fx: fit(s.fx, w / 2 / pv.div.clientWidth), fy: fit(s.fy, h / 2 / pv.div.clientHeight) };
      draw();
    };
    /** The spot under the pointer, when it is over a page. */
    const under = (e: MouseEvent): Spot | null => {
      const d = (e.target as Element).closest?.(".page") as HTMLElement | null;
      if (!d || !container.contains(d)) return null;
      const r = d.getBoundingClientRect();
      return { page: Number(d.dataset.pageNumber) - 1, fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height };
    };
    /** Scrolls just enough to show the whole preview after a keyboard move. */
    const reveal = () => {
      const r = img.current!.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const m = 16;
      if (r.top < c.top + m) container.scrollTop -= c.top + m - r.top;
      else if (r.bottom > c.bottom - m) container.scrollTop += r.bottom - c.bottom + m;
      if (r.left < c.left + m) container.scrollLeft -= c.left + m - r.left;
      else if (r.right > c.right - m) container.scrollLeft += r.right - c.right + m;
    };
    const place = () => {
      const { viewport } = view(spot.page);
      const [x, y] = viewport.convertToPdfPoint(spot.fx * viewport.width, spot.fy * viewport.height);
      handlers.current.onPlace(spot.page, x, y);
    };

    // Start in the middle of what can be seen of the page in view.
    {
      const page = Math.max(0, viewer.currentPageNumber - 1);
      const r = view(page).div.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const [x0, x1] = [Math.max(r.left, c.left), Math.min(r.right, c.right)];
      const [y0, y1] = [Math.max(r.top, c.top), Math.min(r.bottom, c.bottom)];
      moveTo({ page, fx: x1 > x0 ? ((x0 + x1) / 2 - r.left) / r.width : 0.5, fy: y1 > y0 ? ((y0 + y1) / 2 - r.top) / r.height : 0.5 });
    }
    // The keys work straight away, whichever way the signature was chosen.
    container.focus({ preventScroll: true });

    const onPointer = (e: PointerEvent) => {
      const s = under(e);
      if (s) moveTo(s);
    };
    const onClick = (e: MouseEvent) => {
      const s = under(e);
      if (!s) return;
      // The click is for placing only: no link, text box or selection underneath reacts to it.
      e.preventDefault();
      e.stopPropagation();
      moveTo(s);
      place();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handlers.current.onCancel();
        return;
      }
      // Moving and placing belong to the pages: not to the page list, a field or a modified key.
      const t = e.target as Node;
      if ((t !== document.body && !container.contains(t)) || e.ctrlKey || e.metaKey || e.altKey) return;
      const pv = view(spot.page);
      const step = (e.shiftKey ? BIG_STEP : STEP) * pv.viewport.scale;
      const arrow = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
      if (arrow) moveTo({ ...spot, fx: spot.fx + (arrow[0] * step) / pv.div.clientWidth, fy: spot.fy + (arrow[1] * step) / pv.div.clientHeight });
      else if (e.key === "PageDown" || e.key === "PageUp") moveTo({ ...spot, page: spot.page + (e.key === "PageDown" ? 1 : -1) });
      else if (e.key === "Enter") {
        e.preventDefault();
        place();
        return;
      } else return;
      e.preventDefault();
      reveal();
    };
    container.addEventListener("pointermove", onPointer);
    container.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    // Zooming or resizing moves the pages; the preview keeps its spot on its page.
    window.addEventListener("resize", draw);
    bus.on("scalechanging", draw);
    return () => {
      container.removeEventListener("pointermove", onPointer);
      container.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", draw);
      bus.off("scalechanging", draw);
    };
  }, [viewer, bus, container, png]);

  return <img ref={img} src={url} alt="" className="pdf-sig-preview" />;
}
