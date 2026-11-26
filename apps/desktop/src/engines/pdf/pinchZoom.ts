import { useEffect, type RefObject } from "react";
import type { Viewer } from "./pdfjs";

/** Zoom limits for pinching (PDF.js scale; 1 is 100%). */
const MIN_SCALE = 0.25;
const MAX_SCALE = 8;

/** Two-finger pinch zoom on touch screens. While the fingers move, the pages are only stretched with
 *  a CSS transform, which stays smooth on any document; when they lift, PDF.js renders once at the new
 *  zoom, keeping the point between the fingers where it was. One finger still scrolls as usual (the
 *  container's touch-action leaves pinching to this code). */
export function usePinchZoom(containerRef: RefObject<HTMLElement | null>, pagesRef: RefObject<HTMLElement | null>, viewerRef: RefObject<Viewer | null>) {
  useEffect(() => {
    const c = containerRef.current;
    const pages = pagesRef.current;
    if (!c || !pages) return;
    /** The gesture so far; `page` is the spot under the fingers (as fractions of its page). */
    let start: { dist: number; x: number; y: number; scale: number; page: { div: HTMLElement; fx: number; fy: number } | null } | null = null;
    let ratio = 1;
    let panX = 0;
    let panY = 0;
    const fingers = (t: TouchList) => ({
      dist: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });
    const reset = () => {
      start = null;
      pages.style.transform = pages.style.transformOrigin = pages.style.willChange = "";
    };
    const onStart = (e: TouchEvent) => {
      const v = viewerRef.current;
      if (e.touches.length !== 2 || !v?.pagesCount) return;
      const f = fingers(e.touches);
      if (f.dist < 10) return;
      const div = document.elementFromPoint(f.x, f.y)?.closest<HTMLElement>(".page");
      const p = div && c.contains(div) ? div.getBoundingClientRect() : null;
      start = { ...f, scale: v.currentScale, page: div && p ? { div, fx: (f.x - p.left) / p.width, fy: (f.y - p.top) / p.height } : null };
      ratio = 1;
      panX = panY = 0;
      // Stretch around the point between the fingers, in the pages' own coordinates.
      const r = c.getBoundingClientRect();
      pages.style.transformOrigin = `${f.x - r.left + c.scrollLeft}px ${f.y - r.top + c.scrollTop}px`;
      pages.style.willChange = "transform";
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length < 2) return;
      // A second finger that lands while one-finger scrolling is under way cannot stop the scroll.
      if (!e.cancelable) return reset();
      e.preventDefault();
      const f = fingers(e.touches);
      ratio = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (start.scale * f.dist) / start.dist)) / start.scale;
      panX = f.x - start.x;
      panY = f.y - start.y;
      pages.style.transform = `translate(${panX}px, ${panY}px) scale(${ratio})`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || e.touches.length >= 2) return;
      const s = start;
      reset();
      const v = viewerRef.current;
      if (!v || (Math.abs(ratio - 1) < 0.01 && !panX && !panY)) return;
      const r = c.getBoundingClientRect();
      if (s.page?.div.isConnected) {
        // Render at the new zoom, then scroll so the spot that was under the fingers is under them
        // again (exact even where a narrow page sits centred, which a uniform scale gets wrong).
        v.currentScale = s.scale * ratio;
        const { div, fx, fy } = s.page;
        c.scrollLeft = div.offsetLeft + div.clientLeft + fx * div.clientWidth - (s.x + panX - r.left);
        c.scrollTop = div.offsetTop + div.clientTop + fy * div.clientHeight - (s.y + panY - r.top);
      } else {
        // Between pages: PDF.js keeps the point in place (it measures from the container's offset).
        const [top, left] = v.containerTopLeft;
        v.updateScale({ scaleFactor: ratio, origin: [s.x - r.left + left, s.y - r.top + top], pan: [panX, panY] });
      }
    };
    c.addEventListener("touchstart", onStart, { passive: true });
    c.addEventListener("touchmove", onMove, { passive: false });
    c.addEventListener("touchend", onEnd);
    c.addEventListener("touchcancel", onEnd);
    return () => {
      reset();
      c.removeEventListener("touchstart", onStart);
      c.removeEventListener("touchmove", onMove);
      c.removeEventListener("touchend", onEnd);
      c.removeEventListener("touchcancel", onEnd);
    };
  }, [containerRef, pagesRef, viewerRef]);
}
