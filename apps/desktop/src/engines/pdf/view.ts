/** Keeping the person's place when a page change reloads the document. */
import type { Viewer } from "./pdfjs";

/** Where the view is: the page at the top of the window, how far into that page the window starts
 *  (CSS pixels at `scale`), and the zoom as a number and as chosen (a number or "page-width"). */
export interface PdfView {
  page: number;
  dx: number;
  dy: number;
  scale: number;
  scaleValue: string;
}

/** Where an old page is after a page change: its new index, or, for a page that is gone, the index
 *  of the page now in its place. */
export type PageMap = (oldIndex: number) => { at: number; gone?: boolean };

const pageDiv = (v: Viewer, i: number) => (v.getPageView(i) as { div: HTMLElement }).div;

export function captureView(v: Viewer, c: HTMLElement): PdfView | null {
  const n = v.pagesCount;
  if (!n) return null;
  // The first page whose bottom is below the top of the window (pages are stacked top to bottom).
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const d = pageDiv(v, mid);
    if (d.offsetTop + d.offsetHeight <= c.scrollTop) lo = mid + 1;
    else hi = mid;
  }
  const d = pageDiv(v, lo);
  return { page: lo, dx: c.scrollLeft - d.offsetLeft, dy: c.scrollTop - d.offsetTop, scale: v.currentScale, scaleValue: String(v.currentScaleValue) };
}

/** Shows the same place again: the same page (wherever the change moved it), the same zoom, and
 *  the same spot on the page. A page that is gone is replaced by the one now in its place, from its top. */
export function restoreView(v: Viewer, c: HTMLElement, view: PdfView, map: PageMap = (i) => ({ at: i })): void {
  const n = v.pagesCount;
  if (!n) return;
  const { at, gone } = map(view.page);
  const page = Math.max(0, Math.min(n - 1, at));
  // The page first, so that a "fit" zoom is measured on the same page as before.
  v.currentPageNumber = page + 1;
  v.currentScaleValue = view.scaleValue;
  const r = v.currentScale / view.scale;
  const d = pageDiv(v, page);
  c.scrollLeft = d.offsetLeft + view.dx * r;
  c.scrollTop = d.offsetTop + (gone ? 0 : view.dy * r);
}
