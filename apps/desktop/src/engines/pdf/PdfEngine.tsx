import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import {
  MousePointer2, Highlighter, Type, PenLine, Signature, ZoomIn, ZoomOut, MoveHorizontal, GalleryVertical, RotateCw, RotateCcw,
  Trash2, FileOutput, FilePlus2, Search, ChevronUp, ChevronDown, X, Undo2, LockKeyhole,
} from "lucide-react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { ErrorState } from "../../shell/ErrorState";
import type { EngineHost, OutlineItem, Command, ToolbarItem } from "../../app/editor-api";
import { loadPdfjs, loadViewer, type Viewer, type Bus } from "./pdfjs";
import { rotatePages, deletePages, reorderPages, extractPages, insertPdf, placeImage, movedOrder, shiftedOrder } from "./pageTools";
import { captureView, restoreView, type PdfView, type PageMap } from "./view";
import { Thumbnails } from "./Thumbnails";
import { SignaturePad } from "./SignaturePad";
import { SignaturePlacer, SIGNATURE_WIDTH } from "./SignaturePlacer";
import { PasswordPrompt } from "./PasswordPrompt";
import { usePinchZoom } from "./pinchZoom";
import { lastInputWasKeyboard } from "./inputModality";
import { openMenu } from "../../shell/Menu";
import { platform } from "../../platform";
import { openBytes } from "../../app/actions";
import { stem } from "../../lib/paths";

const MODE = { none: 0, freetext: 3, highlight: 9, ink: 15 } as const;
type Mode = keyof typeof MODE;
/** PDF.js's "add an editor" parameter (AnnotationEditorParamsType.CREATE). */
const CREATE_EDITOR = 2;
/** Zoom settings that follow the window's size. */
const PRESETS = ["page-width", "page-fit", "auto", "page-actual"];

/** A state of the file that undo or redo can return to, with the view to show it in. */
interface Entry {
  bytes: Uint8Array;
  view: PdfView | null;
}
/** Puts the view in place once a reloaded document has its pages. */
type Place = (v: Viewer, c: HTMLElement) => void;
const fitWidth: Place = (v) => void (v.currentScaleValue = "page-width");

// On phone-width windows the page list has no room beside the pages: it opens over them when asked for.
const NARROW = "(max-width: 599px)";
const watchNarrow = (cb: () => void) => {
  const m = window.matchMedia(NARROW);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const isNarrow = () => window.matchMedia(NARROW).matches;

export default function PdfEngine({ host }: { host: EngineHost }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerDivRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const bus = useRef<Bus | null>(null);
  const uiManager = useRef<{ unselectAll(): void } | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const bytesRef = useRef<Uint8Array>(host.bytes);
  /** What is on disk: undoing back to exactly these bytes reads as saved again. */
  const savedBytes = useRef<Uint8Array>(host.bytes);
  const annotDirty = useRef(false);
  const lastSerialized = useRef<Uint8Array | null>(null);
  const undoStack = useRef<Entry[]>([]);
  const redoStack = useRef<Entry[]>([]);
  /** Whether PDF.js has annotation changes to undo or redo. Its history starts afresh on every reload. */
  const annotHistory = useRef({ undo: false, redo: false });
  const outlineDests = useRef<unknown[]>([]);
  /** Resolves when the running page change (or undo or redo of one) finishes; saves wait for it. */
  const pageOpDone = useRef<Promise<unknown>>(Promise.resolve());
  /** Counts annotation edits, to tell whether any happened after a save started. */
  const annotEdits = useRef(0);
  const savedAt = useRef<{ bytes: Uint8Array; edits: number; base: Uint8Array } | null>(null);
  /** The password that opened this PDF, so reloading it after a page change does not ask again. */
  const pdfPassword = useRef<string | null>(null);
  /** Removes the view-placing listeners of a load that a newer one replaced. */
  const loadAbort = useRef<AbortController | null>(null);
  /** Whether PDF.js has finished reading every page's size (it does so in the background after opening). */
  const allPagesLoaded = useRef(false);
  /** Whether the viewer has the open document's pages yet, and what waits for them. */
  const pagesReady = useRef<{ done: boolean; waiting: (() => void)[] }>({ done: false, waiting: [] });
  /** Runs `fn` once the viewer has pages (at once if it already has). */
  const whenPagesReady = (fn: () => void) => (pagesReady.current.done ? fn() : void pagesReady.current.waiting.push(fn));
  /** Shows page `n` (1-based), once there are pages to show. */
  const goToPage = (n: number) =>
    whenPagesReady(() => {
      const v = viewer.current;
      if (v?.pagesCount) v.currentPageNumber = Math.max(1, Math.min(v.pagesCount, Math.round(n) || 1));
    });

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [mode, setModeState] = useState<Mode>("none");
  const narrow = useSyncExternalStore(watchNarrow, isNarrow);
  const [thumbsBeside, setThumbsBeside] = useState(true);
  const [thumbsOver, setThumbsOver] = useState(false);
  const showThumbs = narrow ? thumbsOver : thumbsBeside;
  const [selected, setSelected] = useState<number[]>([]);
  const [find, setFind] = useState<{ open: boolean; q: string; current: number; total: number }>({ open: false, q: "", current: 0, total: 0 });
  const [signing, setSigning] = useState(false);
  const [placing, setPlacing] = useState<{ png: Uint8Array; keyboard: boolean } | null>(null);
  const [password, setPassword] = useState<{ retry: boolean; attempt: number; submit: (p: string) => void; cancel: () => void } | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canStep, setCanStep] = useState({ undo: false, redo: false });

  const openDoc = useCallback(async (bytes: Uint8Array, place: Place = fitWidth) => {
    const pdfjs = await loadPdfjs();
    const V = await loadViewer();
    if (!viewer.current) {
      const eventBus = new V.EventBus();
      const linkService = new V.PDFLinkService({ eventBus });
      const findController = new V.PDFFindController({ eventBus, linkService });
      const v = new V.PDFViewer({
        container: containerRef.current!,
        viewer: viewerDivRef.current!,
        eventBus,
        linkService,
        findController,
        annotationEditorMode: MODE.none,
        textLayerMode: 1,
        // Highlighting needs a colour palette; without one PDF.js fails when the tool is used.
        annotationEditorHighlightColors: "yellow=#FFF176,green=#A5E8B1,blue=#9FD8FF,pink=#FFC4E1,red=#FF9E9E",
      } as ConstructorParameters<typeof V.PDFViewer>[0]);
      linkService.setViewer(v);
      eventBus.on("pagechanging", (e: { pageNumber: number }) => setPage(e.pageNumber));
      eventBus.on("scalechanging", (e: { scale: number }) => setScale(e.scale));
      const onCount = (e: { matchesCount: { current: number; total: number } }) => setFind((f) => ({ ...f, current: e.matchesCount.current, total: e.matchesCount.total }));
      eventBus.on("updatefindmatchescount", onCount);
      eventBus.on("updatefindcontrolstate", (e: { matchesCount?: { current: number; total: number } }) => e.matchesCount && onCount(e as never));
      // The editors' manager commits a text box still being typed or a drawing still in progress.
      eventBus.on("annotationeditoruimanager", (e: { uiManager?: { unselectAll(): void } }) => {
        uiManager.current = e.uiManager ?? null;
      });
      eventBus.on("annotationeditormodechanged", (e: { mode: number }) => {
        const m = (Object.keys(MODE) as Mode[]).find((k) => MODE[k] === e.mode) ?? "none";
        setModeState(m);
        modeRef.current = m;
      });
      viewer.current = v;
      bus.current = eventBus;
      (v as unknown as { _link: typeof linkService })._link = linkService;
    }
    const v = viewer.current!;
    const linkService = (v as unknown as { _link: { setDocument(d: unknown): void } })._link;
    const task = pdfjs.getDocument({ data: bytes.slice(), ...(pdfPassword.current ? { password: pdfPassword.current } : {}) });
    let cancelled = false;
    task.onPassword = (answer: (p: string) => void, reason: number) =>
      setPassword((p) => ({
        retry: reason === 2, // PasswordResponses.INCORRECT_PASSWORD
        attempt: (p?.attempt ?? 0) + 1,
        submit: (pw) => {
          pdfPassword.current = pw;
          answer(pw);
        },
        cancel: () => {
          cancelled = true;
          setPassword(null);
          void task.destroy();
        },
      }));
    let d: PDFDocumentProxy;
    try {
      d = await task.promise;
    } catch (e) {
      // Cancelling the password question is not an error: the PDF stays closed until asked to open.
      if (!cancelled) throw e;
      setLocked(true);
      return;
    }
    setPassword(null);
    setLocked(false);
    const old = docRef.current;
    docRef.current = d;
    annotHistory.current = { undo: false, redo: false };
    // Place the view once the pages exist (PDF.js has no pages until "pagesinit": choosing one sooner
    // fails), and again once every page's size is known (pages of other sizes can shift what was
    // shown), unless the person has scrolled in between. Then whatever waited for the pages runs.
    loadAbort.current?.abort();
    const listen = (loadAbort.current = new AbortController()).signal;
    pagesReady.current.done = false;
    const c = containerRef.current!;
    const where = () => `${c.scrollLeft},${c.scrollTop}`;
    let placed = "";
    bus.current!.on("pagesinit", () => {
      place(v, c);
      placed = where();
      pagesReady.current.done = true;
      for (const fn of pagesReady.current.waiting.splice(0)) fn();
    }, { once: true, signal: listen });
    bus.current!.on("pagesloaded", () => where() === placed && place(v, c), { once: true, signal: listen });
    allPagesLoaded.current = false;
    bus.current!.on("pagesloaded", () => (allPagesLoaded.current = true), { once: true, signal: listen });
    v.setDocument(d);
    linkService.setDocument(d);
    await old?.loadingTask.destroy();
    (d.annotationStorage as unknown as { onSetModified: (() => void) | null }).onSetModified = markAnnotEdited;
    setDoc(d);
    setNumPages(d.numPages);
    setSelected((s) => s.filter((i) => i < d.numPages));
    updateHistory();
    // Outline (bookmarks) for the sidebar and palette.
    const outline = await d.getOutline().catch(() => null);
    const items: OutlineItem[] = [];
    outlineDests.current = [];
    const walk = (nodes: { title: string; dest: unknown; items: unknown[] }[] | null, level: number) => {
      for (const n of nodes ?? []) {
        outlineDests.current.push(n.dest);
        items.push({ level, text: n.title, loc: `outline:${outlineDests.current.length - 1}` });
        walk(n.items as never, level + 1);
      }
    };
    walk(outline as never, 1);
    host.setOutline(items);
  }, [host]);

  useEffect(() => {
    // First open: back where the person was last session (page and zoom), else the top at page width.
    const vs = host.viewState as { page?: unknown; scale?: unknown } | undefined;
    const zoom = typeof vs?.scale === "string" && (PRESETS.includes(vs.scale) || Number(vs.scale) > 0) ? vs.scale : "page-width";
    const page = typeof vs?.page === "number" ? vs.page : 1;
    openDoc(bytesRef.current, (v) => {
      // The page first, so that a "fit" zoom is measured on it.
      v.currentPageNumber = Math.max(1, Math.min(v.pagesCount, Math.round(page) || 1));
      v.currentScaleValue = zoom;
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // External links inside a PDF open in the system browser, never inside the app window.
    const c = containerRef.current!;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      const href = a?.getAttribute("href");
      if (a && href && /^(https?:|mailto:)/i.test(href)) {
        e.preventDefault();
        e.stopPropagation();
        host.openLink(href);
      }
    };
    c.addEventListener("click", onClick, true);
    // The focus ring is for the keyboard. Chrome keeps it on a container focused from the keyboard
    // even after it is clicked, so a press with the pointer hides it until the focus moves on.
    const byPointer = () => c.classList.add("by-pointer");
    const focusLeft = (e: FocusEvent) => !c.contains(e.relatedTarget as Node | null) && c.classList.remove("by-pointer");
    c.addEventListener("pointerdown", byPointer, true);
    c.addEventListener("focusout", focusLeft);
    // Re-fit and re-render when the view becomes visible again or the window is resized
    // (PDF.js measures the container, which has no size while its tab is hidden).
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      const v = viewer.current;
      const w = c.clientWidth;
      if (!v || !w || w === lastW) return;
      lastW = w;
      const preset = String(v.currentScaleValue);
      if (PRESETS.includes(preset)) v.currentScaleValue = preset;
      v.update();
    });
    ro.observe(c);
    return () => {
      ro.disconnect();
      c.removeEventListener("click", onClick, true);
      c.removeEventListener("pointerdown", byPointer, true);
      c.removeEventListener("focusout", focusLeft);
      loadAbort.current?.abort();
      // Closing the tab must free the pages: PDF.js keeps every text layer in a static list, and its
      // editor listens on the window, until the viewer lets go of the document. If it is still reading
      // page sizes in the background, let it finish first (stopping it midway logs errors).
      const v = viewer.current;
      const task = docRef.current?.loadingTask;
      let done = false;
      const release = () => {
        if (done) return;
        done = true;
        v?.setDocument(null as unknown as PDFDocumentProxy);
        (v as unknown as { _link?: { setDocument(d: unknown): void } } | null)?._link?.setDocument(null);
        void task?.destroy();
      };
      if (allPagesLoaded.current || !v?.pdfDocument) release();
      else {
        bus.current?.on("pagesloaded", release, { once: true });
        window.setTimeout(release, 10000);
      }
    };
  }, [openDoc, host]);

  usePinchZoom(containerRef, viewerDivRef, viewer);

  // Once a thumbnail is drawn, PDF.js frees what it decoded for that page, unless the main view
  // is keeping the page.
  const onThumbRendered = useCallback((pageNumber: number, pdfPage: PDFPageProxy) => bus.current?.dispatch("thumbnailrendered", { source: null, pageNumber, pdfPage }), []);

  // A pending "highlight what is selected" step; any later tool choice or closing the tab cancels it.
  const highlightTimer = useRef<number | undefined>(undefined);
  const modeRef = useRef<Mode>("none");
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);
  const setMode = (m: Mode) => {
    const v = viewer.current;
    if (!v) return;
    window.clearTimeout(highlightTimer.current);
    // Text already selected in this PDF when Highlight is chosen gets highlighted straight away.
    const sel = window.getSelection();
    const anchor = sel?.anchorNode ?? null;
    const hadSelection =
      m === "highlight" && !!sel && !sel.isCollapsed && !!anchor && !!containerRef.current?.contains(anchor) && !!(anchor instanceof Element ? anchor : anchor.parentElement)?.closest(".textLayer");
    // A text box asked for from the keyboard appears in the middle of the page in view, ready to type
    // into (no click needed); Escape then leaves it selected, and the arrow keys move it.
    const fromKeyboard = m === "freetext" && lastInputWasKeyboard();
    try {
      if (fromKeyboard && modeRef.current === "freetext") bus.current?.dispatch("switchannotationeditorparams", { source: null, type: CREATE_EDITOR, value: {} });
      else v.annotationEditorMode = { mode: MODE[m], isFromKeyboard: fromKeyboard };
      setModeState(m);
      modeRef.current = m;
      if (hadSelection) {
        highlightTimer.current = window.setTimeout(() => {
          if (viewer.current === v && modeRef.current === "highlight") bus.current?.dispatch("editingaction", { source: null, name: "highlightSelection" });
        }, 60);
      }
    } catch (e) {
      host.toast(`That tool is not available for this PDF: ${e instanceof Error ? e.message : e}`, "error");
    }
  };

  /** Annotation changes. PDF.js reports only the first change after each save, so edits to an
   *  existing annotation (retyping, moving, deleting) are also caught from the editor layer below. */
  function markAnnotEdited() {
    annotEdits.current++;
    annotDirty.current = true;
    // A new change ends what redo could bring back.
    redoStack.current = [];
    updateHistory();
    host.setDirty(true);
    host.changed();
  }

  /** Whether Undo and Redo have anything to do (annotation changes or page changes). */
  function updateHistory() {
    const undo = annotHistory.current.undo || undoStack.current.length > 0;
    const redo = annotHistory.current.redo || redoStack.current.length > 0;
    setCanStep((h) => (h.undo === undo && h.redo === redo ? h : { undo, redo }));
  }

  // Edits to annotations that already exist: typing in a text box, moving with the keyboard or
  // deleting, and undo/redo (a plain click to select one is not an edit). Dragging is caught by
  // the editors' undo history below.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const hasAnnotations = () => ((docRef.current?.annotationStorage as unknown as { size?: number })?.size ?? 0) > 0;
    const inEditor = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.(".annotationEditorLayer");
    // Typing into a text box counts at once, even a new one that is not in the document's storage
    // until it is committed (otherwise Ctrl+S or Ctrl+W right after typing would lose it).
    const onEdit = (e: Event) => {
      if (inEditor(e.target)) markAnnotEdited();
    };
    const onKey = (e: KeyboardEvent) => {
      // Shortcuts (Ctrl+S and others) and lone modifier keys are not edits.
      if (e.ctrlKey || e.metaKey || e.altKey || ["Control", "Shift", "Alt", "Meta", "Escape", "Tab"].includes(e.key)) return;
      if ((inEditor(e.target) && (e.target as HTMLElement).isContentEditable) || (hasAnnotations() && ["Delete", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && el.querySelector(".annotationEditorLayer .selectedEditor"))) markAnnotEdited();
    };
    // A stroke drawn with the pen is an edit when it ends, before it is committed.
    const onStroke = (e: PointerEvent) => {
      if (modeRef.current === "ink" && inEditor(e.target)) markAnnotEdited();
    };
    el.addEventListener("input", onEdit, true);
    el.addEventListener("keyup", onKey, true);
    el.addEventListener("pointerup", onStroke, true);
    // The editors' undo history changing means an annotation changed (selection alone does not).
    // PDF.js 6 calls this event "editingstateschanged" (it was "annotationeditorstateschanged").
    let lastHistory = "";
    const onState = (e: { details?: { hasSomethingToUndo?: boolean; hasSomethingToRedo?: boolean } }) => {
      annotHistory.current = { undo: !!e.details?.hasSomethingToUndo, redo: !!e.details?.hasSomethingToRedo };
      updateHistory();
      const h = `${!!e.details?.hasSomethingToUndo}/${!!e.details?.hasSomethingToRedo}`;
      if (h !== lastHistory && lastHistory && hasAnnotations()) markAnnotEdited();
      lastHistory = h;
    };
    bus.current?.on("editingstateschanged", onState);
    return () => {
      el.removeEventListener("input", onEdit, true);
      el.removeEventListener("keyup", onKey, true);
      el.removeEventListener("pointerup", onStroke, true);
      bus.current?.off("editingstateschanged", onState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const currentBytes = async (): Promise<Uint8Array> => {
    if (annotDirty.current && docRef.current) return docRef.current.saveDocument();
    return bytesRef.current;
  };

  const view = () => (viewer.current && containerRef.current ? captureView(viewer.current, containerRef.current) : null);

  // Page changes, and undoing or redoing them, run one after another: one started while another is
  // still reloading the document waits for it instead of being dropped.
  const queue = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = pageOpDone.current.then(fn);
    pageOpDone.current = run.catch(() => {});
    return run;
  };

  /** Shows new bytes, with the view put in place by `place`. If they cannot be shown, nothing changes. */
  const reload = async (bytes: Uint8Array, place: Place) => {
    const before = { bytes: bytesRef.current, annotDirty: annotDirty.current };
    bytesRef.current = bytes;
    annotDirty.current = false;
    // Exactly what is on disk again (after undo) reads as saved. Anything else is marked unsaved
    // before the viewer reloads, so a quick Ctrl+S never sees a "clean" tab.
    const clean = bytes === savedBytes.current;
    host.setDirty(!clean);
    if (!clean) host.changed();
    try {
      await openDoc(bytes, place);
    } catch (e) {
      bytesRef.current = before.bytes;
      annotDirty.current = before.annotDirty;
      throw e;
    }
  };

  /** A page change: pdf-lib rewrites the file, then the view comes back to the same place, following
   *  its page if the change moved it (`map`), or goes to the top of page `goTo`. */
  const pageOp = (label: string, fn: (b: Uint8Array) => Promise<Uint8Array>, keep: { map?: PageMap; goTo?: number } = {}): Promise<boolean> =>
    queue(async () => {
      setBusy(true);
      try {
        const before = await currentBytes();
        const after = await fn(before);
        const at = view();
        await reload(after, (v, c) => {
          if (!at) fitWidth(v, c);
          else if (keep.goTo) restoreView(v, c, { ...at, page: keep.goTo - 1, dy: 0 });
          else restoreView(v, c, at, keep.map);
        });
        undoStack.current.push({ bytes: before, view: at });
        if (undoStack.current.length > 20) undoStack.current.shift();
        redoStack.current = [];
        return true;
      } catch (e) {
        host.toast(`${label} failed: ${e instanceof Error ? e.message : e}`, "error");
        return false;
      } finally {
        setBusy(false);
        updateHistory();
      }
    });

  /** Ctrl+Z and Ctrl+Y. Annotation changes are always newer than page changes (a page change reloads
   *  the document, which starts a fresh annotation history), so they are undone first. Waits for a
   *  page change still running, so Ctrl+Z straight after one undoes it. */
  const step = (dir: "undo" | "redo") =>
    queue(async () => {
      if (annotHistory.current[dir]) {
        bus.current?.dispatch("editingaction", { source: null, name: dir });
        return;
      }
      const [from, to] = dir === "undo" ? [undoStack.current, redoStack.current] : [redoStack.current, undoStack.current];
      const entry = from.pop();
      if (!entry) return;
      setBusy(true);
      try {
        const here: Entry = { bytes: await currentBytes(), view: view() };
        await reload(entry.bytes, (v, c) => (entry.view ? restoreView(v, c, entry.view) : fitWidth(v, c)));
        to.push(here);
      } catch (e) {
        from.push(entry);
        host.toast(`${dir === "undo" ? "Undo" : "Redo"} failed: ${e instanceof Error ? e.message : e}`, "error");
      } finally {
        setBusy(false);
        updateHistory();
      }
    });

  /** Puts the pages in a new order (order[k] is the old index of the page now at k), keeps the moved
   *  pages selected, and keeps the view on the page it showed. */
  const reorder = async (order: number[], moved: number[], unchanged?: string) => {
    if (order.every((p, i) => p === i)) return void (unchanged && host.toast(unchanged));
    const map: PageMap = (i) => ({ at: order.indexOf(i) });
    if (await pageOp("Move pages", (b) => reorderPages(b, order), { map })) setSelected(moved.map((p) => order.indexOf(p)));
  };
  const targets = () => (selected.length ? selected : [page - 1]);

  const ops = {
    rotate: (d: 90 | -90, t = targets()) => pageOp("Rotate", (b) => rotatePages(b, t, d)),
    remove: async (t = targets()) => {
      const gone = new Set(t);
      // A deleted page's place is taken by the next page that stays.
      const map: PageMap = (i) => ({ at: i - t.filter((j) => j < i).length, gone: gone.has(i) });
      if (await pageOp("Delete pages", (b) => deletePages(b, t), { map })) setSelected([]);
    },
    move: (pages: number[], target: number) => reorder(movedOrder(numPages, pages, target), pages),
    shift: (delta: -1 | 1, pages = targets()) =>
      reorder(shiftedOrder(numPages, pages, delta), pages, delta < 0 ? "Already the first page." : "Already the last page."),
    extract: async (pages = targets()) => {
      const t = [...pages].sort((a, b) => a - b);
      const out = await extractPages(await currentBytes(), t);
      openBytes(`${stem(host.name)} (pages ${t.map((i) => i + 1).join(", ")}).pdf`, out, { kind: "pdf" });
    },
    insert: async () => {
      const [p] = await platform.pickOpen({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
      if (!p) return;
      const other = await platform.readFile(p);
      const at = (selected.length ? Math.max(...selected) : page - 1) + 1;
      await pageOp("Insert PDF", (b) => insertPdf(b, other, at), { goTo: at + 1 });
    },
    undo: () => step("undo"),
    redo: () => step("redo"),
    toggleThumbs: () => (narrow ? setThumbsOver((t) => !t) : setThumbsBeside((t) => !t)),
  };
  const opsRef = useRef(ops);
  opsRef.current = ops;

  /** The page list's menu (right-click, or a long press on a touch screen): page tools for these pages,
   *  including moving them without dragging. */
  const pageMenu = (pages: number[], x: number, y: number) => {
    const one = pages.length === 1;
    const stays = (delta: -1 | 1) => shiftedOrder(numPages, pages, delta).every((p, i) => p === i);
    openMenu(x, y, [
      { label: one ? "Move page up" : "Move pages up", shortcut: "Alt+Up", disabled: stays(-1), run: () => void opsRef.current.shift(-1, pages) },
      { label: one ? "Move page down" : "Move pages down", shortcut: "Alt+Down", disabled: stays(1), run: () => void opsRef.current.shift(1, pages) },
      { divider: true },
      { label: "Rotate right", run: () => void opsRef.current.rotate(90, pages) },
      { label: "Rotate left", run: () => void opsRef.current.rotate(-90, pages) },
      { label: one ? "Extract page to a new PDF" : "Extract pages to a new PDF", run: () => void opsRef.current.extract(pages) },
      { divider: true },
      { label: one ? "Delete page" : `Delete ${pages.length} pages`, disabled: pages.length >= numPages, run: () => void opsRef.current.remove(pages) },
    ]);
  };

  // Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) anywhere in this PDF, ahead of PDF.js's own handling, which
  // would otherwise undo an annotation a second time. Typing fields keep their own undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const dir = k === "z" ? (e.shiftKey ? "redo" : "undo") : k === "y" && !e.shiftKey ? "redo" : null;
      const t = e.target as HTMLElement;
      if (!dir || t.isContentEditable || t.closest?.("input, textarea")) return;
      // Only for this tab, while it is shown, and not for a dialog over it.
      if (!root.contains(t) && !(t === document.body && root.offsetParent)) return;
      e.preventDefault();
      e.stopPropagation();
      void opsRef.current[dir]();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const runFind = (q: string, again = false, previous = false) => {
    bus.current?.dispatch("find", { source: null, type: again ? "again" : "", query: q, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false });
  };

  // Signing: the pad gives a picture of the signature, then the person chooses where it goes.
  const startPlacing = (png: Uint8Array) => {
    setSigning(false);
    // The page takes the click, not a drawing or text tool.
    if (modeRef.current !== "none") setMode("none");
    setPlacing({ png, keyboard: lastInputWasKeyboard() });
  };
  const stopPlacing = () => {
    setPlacing(null);
    containerRef.current?.focus({ preventScroll: true });
  };
  const placeSignature = (png: Uint8Array, pageIndex: number, x: number, y: number) => {
    stopPlacing();
    void pageOp("Place signature", (b) => placeImage(b, pageIndex, png, x, y, SIGNATURE_WIDTH)).then((ok) => ok && host.toast("Signature added. Ctrl+Z to undo."));
  };
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const unlock = () => {
    setLocked(false);
    openDoc(bytesRef.current).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  // Toolbar
  useEffect(() => {
    const b = (id: string, label: string, icon: React.ReactNode, run: () => void, group: string, extra: Partial<ToolbarItem> = {}): ToolbarItem => ({ id, label, icon, run, group, ...extra });
    const items = [
      b("thumbs", "Pages panel", <GalleryVertical />, () => opsRef.current.toggleThumbs(), "a", { active: showThumbs }),
      b("select", "Select text", <MousePointer2 />, () => setMode("none"), "b", { active: mode === "none" }),
      // The everyday tools carry their names; page tools follow, with undo kept apart from rotate.
      b("highlight", "Highlight", <Highlighter />, () => setMode(mode === "highlight" ? "none" : "highlight"), "b", { active: mode === "highlight", text: "Highlight" }),
      b("text", "Add text", <Type />, () => setMode(mode === "freetext" ? "none" : "freetext"), "b", { active: mode === "freetext", text: "Text" }),
      b("ink", "Draw", <PenLine />, () => setMode(mode === "ink" ? "none" : "ink"), "b", { active: mode === "ink", text: "Draw" }),
      b("sign", "Sign", <Signature />, () => setSigning(true), "b", { text: "Sign" }),
      b("rotl", "Rotate left", <RotateCcw />, () => void opsRef.current.rotate(-90), "c", { overflow: true }),
      b("rotr", "Rotate right", <RotateCw />, () => void opsRef.current.rotate(90), "c", { text: "Rotate" }),
      b("del", "Delete pages", <Trash2 />, () => void opsRef.current.remove(), "c"),
      b("extract", "Extract pages to a new PDF", <FileOutput />, () => void opsRef.current.extract(), "c", { overflow: true }),
      b("insert", "Insert another PDF after this page", <FilePlus2 />, () => void opsRef.current.insert(), "c", { overflow: true }),
      // One undo for annotations and page changes alike. Redo and moving pages up or down are in the
      // palette, on the keyboard and in the page list's menu, so the toolbar keeps its width.
      b("undo", "Undo", <Undo2 />, () => void opsRef.current.undo(), "c2", { overflow: true, shortcut: "Ctrl+Z", disabled: !canStep.undo }),
      b("zout", "Zoom out", <ZoomOut />, () => viewer.current?.decreaseScale(), "d", { overflow: true }),
      b("zin", "Zoom in", <ZoomIn />, () => viewer.current?.increaseScale(), "d", { overflow: true }),
      b("fit", "Fit width", <MoveHorizontal />, () => viewer.current && (viewer.current.currentScaleValue = "page-width"), "d", { overflow: true }),
      b("find", "Find", <Search />, () => setFind((f) => ({ ...f, open: true })), "e", { shortcut: "Ctrl+F" }),
    ];
    // Nothing to work on while the PDF loads or waits for its password; nothing at all if it cannot be read.
    host.setToolbar(error ? [] : doc ? items : items.map((it) => ({ ...it, active: false, disabled: true })));
  }, [host, showThumbs, mode, doc, canStep, error]);

  // Status bar
  useEffect(() => {
    if (error) return host.setStatus([]);
    host.setStatus([
      { id: "page", text: numPages ? `Page ${page} of ${numPages}` : locked ? "Protected" : "Loading…", onClick: () => void import("../../app/commands").then((m) => m.openPalette(":")) },
      ...(selected.length > 1 ? [{ id: "sel", text: `${selected.length} pages selected` }] : []),
      ...(mode !== "none" ? [{ id: "mode", text: { highlight: "Select text to highlight", freetext: "Click or press Enter to add text", ink: "Draw on the page", none: "" }[mode] }] : []),
      { id: "zoom", text: `${Math.round(scale * 100)}%`, align: "right" as const, onClick: () => viewer.current && (viewer.current.currentScaleValue = "page-width") },
    ]);
  }, [host, page, numPages, scale, selected.length, mode, locked, error]);

  // Engine handle
  useEffect(() => {
    const commands: Command[] = [
      { id: "pdf.highlight", title: "Highlight text", group: "PDF", run: () => setMode("highlight") },
      { id: "pdf.text", title: "Add text box", group: "PDF", run: () => setMode("freetext") },
      { id: "pdf.ink", title: "Draw on page", group: "PDF", run: () => setMode("ink") },
      { id: "pdf.select", title: "Select text", group: "PDF", run: () => setMode("none") },
      { id: "pdf.sign", title: "Sign document", group: "PDF", run: () => setSigning(true) },
      { id: "pdf.undo", title: "Undo", group: "PDF", shortcut: "Ctrl+Z", run: () => void opsRef.current.undo() },
      { id: "pdf.redo", title: "Redo", group: "PDF", shortcut: "Ctrl+Y", run: () => void opsRef.current.redo() },
      { id: "pdf.rotr", title: "Rotate page right", group: "Pages", run: () => void opsRef.current.rotate(90) },
      { id: "pdf.rotl", title: "Rotate page left", group: "Pages", run: () => void opsRef.current.rotate(-90) },
      { id: "pdf.delete", title: "Delete selected pages", group: "Pages", run: () => void opsRef.current.remove() },
      { id: "pdf.moveUp", title: "Move page up", group: "Pages", run: () => void opsRef.current.shift(-1) },
      { id: "pdf.moveDown", title: "Move page down", group: "Pages", run: () => void opsRef.current.shift(1) },
      { id: "pdf.extract", title: "Extract pages to a new PDF", group: "Pages", run: () => void opsRef.current.extract() },
      { id: "pdf.insert", title: "Insert another PDF…", group: "Pages", run: () => void opsRef.current.insert() },
      { id: "pdf.thumbs", title: "Show or hide page thumbnails", group: "View", run: () => opsRef.current.toggleThumbs() },
      { id: "pdf.fit", title: "Fit page width", group: "View", run: () => viewer.current && (viewer.current.currentScaleValue = "page-width") },
      { id: "pdf.fitPage", title: "Fit whole page", group: "View", run: () => viewer.current && (viewer.current.currentScaleValue = "page-fit") },
    ];
    host.register({
      // Before a save or close: a text box still being typed or a drawing still open becomes part
      // of the document, so it is saved (or asked about) like any other change.
      flush() {
        try {
          uiManager.current?.unselectAll();
        } catch {
          // Nothing being edited.
        }
      },
      async serialize(opts) {
        if (opts?.forSave) await pageOpDone.current;
        const base = bytesRef.current;
        const edits = annotEdits.current;
        const b = await currentBytes();
        if (opts?.forSave) {
          lastSerialized.current = b;
          savedAt.current = { bytes: b, edits, base };
        }
        return b;
      },
      markSaved() {
        const s = savedAt.current;
        savedAt.current = null;
        lastSerialized.current = null;
        if (s) savedBytes.current = s.bytes;
        // Adopt the saved bytes only if nothing changed while the save was running.
        if (!s || bytesRef.current !== s.base) {
          host.setDirty(true);
          host.changed();
          return;
        }
        // The open document keeps every annotation in its own storage, so it is not reloaded;
        // later saves rebuild from it. With no newer edits, the saved file is the current state.
        bytesRef.current = s.bytes;
        if (annotEdits.current === s.edits) annotDirty.current = false;
        else {
          host.setDirty(true);
          host.changed();
        }
      },
      focus: () => containerRef.current?.focus(),
      find: () => setFind((f) => ({ ...f, open: true })),
      zoom: (d) => {
        const v = viewer.current;
        if (!v) return;
        if (d > 0) v.increaseScale();
        else if (d < 0) v.decreaseScale();
        else v.currentScaleValue = "page-width";
      },
      // The shell may ask before the pages exist (a file opened at a page): it waits for them.
      goTo: (loc) => {
        if (!loc.startsWith("outline:")) return goToPage(parseInt(loc, 10));
        const dest = outlineDests.current[Number(loc.slice(8))];
        whenPagesReady(() => dest && (viewer.current as unknown as { _link: { goToDestination(d: unknown): void } } | null)?._link.goToDestination(dest));
      },
      viewState: () => ({ page: viewer.current?.currentPageNumber ?? 1, scale: viewer.current?.currentScaleValue ?? "page-width" }),
      commands: () => commands,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, openDoc]);

  if (error) return <ErrorState tabId={host.tabId} path={host.path} title={`${host.name} can't be opened`} message={error} />;

  return (
    <div className="pdf-engine" ref={rootRef}>
      {showThumbs && doc && (
        <Thumbnails
          doc={doc}
          count={numPages}
          selected={selected}
          current={page}
          onSelect={setSelected}
          onActivate={(p) => {
            goToPage(p);
            // Over the pages (phones), the list makes way for the page that was chosen.
            if (narrow) {
              setThumbsOver(false);
              containerRef.current?.focus({ preventScroll: true });
            }
          }}
          onMove={(pages, target) => void opsRef.current.move(pages, target)}
          onShift={(pages, delta) => void opsRef.current.shift(delta, pages)}
          onMenu={pageMenu}
          onRendered={onThumbRendered}
        />
      )}
      <div className="pdf-main">
        {find.open && (
          <div className="pdf-find">
            <Search size={15} />
            <input
              className="input"
              autoFocus
              placeholder="Find in PDF"
              value={find.q}
              onChange={(e) => { setFind((f) => ({ ...f, q: e.target.value })); runFind(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") runFind(find.q, true, e.shiftKey);
                if (e.key === "Escape") { setFind((f) => ({ ...f, open: false })); runFind(""); }
              }}
              aria-label="Find in PDF"
            />
            <span className="help">{find.q ? (find.total ? `${find.current} of ${find.total}` : "No matches") : ""}</span>
            <button className="icon-btn" aria-label="Previous match" onClick={() => runFind(find.q, true, true)}><ChevronUp /></button>
            <button className="icon-btn" aria-label="Next match" onClick={() => runFind(find.q, true)}><ChevronDown /></button>
            <button className="icon-btn" aria-label="Close find" onClick={() => { setFind((f) => ({ ...f, open: false })); runFind(""); }}><X /></button>
          </div>
        )}
        {placing && (
          <div className="pdf-hint" role="status">
            <span>
              {placing.keyboard
                ? "Arrow keys move the signature (Shift: faster, Page Up/Down: other pages). Enter places it, Esc cancels."
                : coarsePointer
                  ? "Tap where the signature should go."
                  : "Click where the signature should go. Press Esc to cancel."}
            </span>
            <button className="btn" onClick={stopPlacing}>Cancel</button>
          </div>
        )}
        <div ref={containerRef} className={`pdf-container ${placing ? "placing" : ""}`} tabIndex={0} data-links="app">
          <div ref={viewerDivRef} className="pdfViewer" />
          {placing && viewer.current && bus.current && containerRef.current && (
            <SignaturePlacer
              viewer={viewer.current}
              bus={bus.current}
              container={containerRef.current}
              png={placing.png}
              onPlace={(i, x, y) => placeSignature(placing.png, i, x, y)}
              onCancel={stopPlacing}
            />
          )}
        </div>
        {busy && <div className="pdf-busy"><div className="spinner" /></div>}
        {locked && (
          <div className="center-note pdf-locked">
            <LockKeyhole size={28} aria-hidden />
            <h3>This PDF is protected</h3>
            <div id={`${host.tabId}-locked`}>It opens with its password.</div>
            <div className="acts">
              <button className="btn primary" autoFocus aria-describedby={`${host.tabId}-locked`} onClick={unlock}>Enter password…</button>
            </div>
          </div>
        )}
      </div>
      {password && <PasswordPrompt name={host.name} retry={password.retry} attempt={password.attempt} onSubmit={password.submit} onCancel={password.cancel} />}
      {signing && <SignaturePad onCancel={() => setSigning(false)} onDone={startPlacing} />}
    </div>
  );
}
