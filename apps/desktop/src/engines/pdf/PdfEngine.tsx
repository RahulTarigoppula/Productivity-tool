import { useEffect, useRef, useState, useCallback } from "react";
import {
  MousePointer2, Highlighter, Type, PenLine, Signature, ZoomIn, ZoomOut, MoveHorizontal, PanelLeft, RotateCw, RotateCcw,
  Trash2, FileOutput, FilePlus2, Search, ChevronUp, ChevronDown, X, Undo2,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EngineHost, OutlineItem, Command } from "../../app/editor-api";
import { loadPdfjs, loadViewer } from "./pdfjs";
import { rotatePages, deletePages, reorderPages, extractPages, insertPdf, placeImage, movedOrder } from "./pageTools";
import { Thumbnails } from "./Thumbnails";
import { SignaturePad } from "./SignaturePad";
import { platform } from "../../platform";
import { openBytes } from "../../app/actions";
import { stem } from "../../lib/paths";

type Viewer = InstanceType<typeof import("pdfjs-dist/web/pdf_viewer.mjs").PDFViewer>;
type Bus = InstanceType<typeof import("pdfjs-dist/web/pdf_viewer.mjs").EventBus>;

const MODE = { none: 0, freetext: 3, highlight: 9, ink: 15 } as const;
type Mode = keyof typeof MODE;

export default function PdfEngine({ host }: { host: EngineHost }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerDivRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const bus = useRef<Bus | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const bytesRef = useRef<Uint8Array>(host.bytes);
  const annotDirty = useRef(false);
  const lastSerialized = useRef<Uint8Array | null>(null);
  const undoStack = useRef<Uint8Array[]>([]);
  const outlineDests = useRef<unknown[]>([]);
  /** Resolves when the running page operation finishes; saves wait for it. */
  const pageOpDone = useRef<Promise<void>>(Promise.resolve());
  /** Counts annotation edits, to tell whether any happened after a save started. */
  const annotEdits = useRef(0);
  const savedAt = useRef<{ bytes: Uint8Array; edits: number; base: Uint8Array } | null>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [mode, setModeState] = useState<Mode>("none");
  const [thumbs, setThumbs] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [find, setFind] = useState<{ open: boolean; q: string; current: number; total: number }>({ open: false, q: "", current: 0, total: 0 });
  const [signing, setSigning] = useState(false);
  const [placing, setPlacing] = useState<Uint8Array | null>(null);
  const [password, setPassword] = useState<{ retry: boolean; cb: (p: string) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openDoc = useCallback(async (bytes: Uint8Array, keep?: { page: number; scale: string | number }) => {
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
      eventBus.on("annotationeditormodechanged", (e: { mode: number }) => {
        const m = (Object.keys(MODE) as Mode[]).find((k) => MODE[k] === e.mode) ?? "none";
        setModeState(m);
      });
      viewer.current = v;
      bus.current = eventBus;
      (v as unknown as { _link: typeof linkService })._link = linkService;
    }
    const v = viewer.current!;
    const linkService = (v as unknown as { _link: { setDocument(d: unknown): void } })._link;
    const task = pdfjs.getDocument({ data: bytes.slice() });
    task.onPassword = (cb: (p: string) => void, reason: number) => setPassword({ cb, retry: reason === 2 });
    const d = await task.promise;
    setPassword(null);
    const old = docRef.current;
    docRef.current = d;
    bus.current!.on("pagesinit", function once() {
      v.currentScaleValue = String(keep?.scale ?? "page-width");
      if (keep?.page) v.currentPageNumber = Math.min(keep.page, d.numPages);
      bus.current!.off("pagesinit", once);
    });
    v.setDocument(d);
    linkService.setDocument(d);
    await old?.loadingTask.destroy();
    (d.annotationStorage as unknown as { onSetModified: (() => void) | null }).onSetModified = markAnnotEdited;
    setDoc(d);
    setNumPages(d.numPages);
    setSelected((s) => s.filter((i) => i < d.numPages));
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
    openDoc(bytesRef.current).catch((e) => setError(e instanceof Error ? e.message : String(e)));
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
    // Re-fit and re-render when the view becomes visible again or the window is resized
    // (PDF.js measures the container, which has no size while its tab is hidden).
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      const v = viewer.current;
      const w = c.clientWidth;
      if (!v || !w || w === lastW) return;
      lastW = w;
      const preset = String(v.currentScaleValue);
      if (["page-width", "page-fit", "auto", "page-actual"].includes(preset)) v.currentScaleValue = preset;
      v.update();
    });
    ro.observe(c);
    return () => {
      ro.disconnect();
      c.removeEventListener("click", onClick, true);
      void docRef.current?.loadingTask.destroy();
    };
  }, [openDoc, host]);

  const setMode = (m: Mode) => {
    const v = viewer.current;
    if (!v) return;
    try {
      v.annotationEditorMode = { mode: MODE[m] };
      setModeState(m);
    } catch (e) {
      host.toast(`That tool is not available for this PDF: ${e instanceof Error ? e.message : e}`, "error");
    }
  };

  /** Annotation changes. PDF.js reports only the first change after each save, so edits to an
   *  existing annotation (retyping, moving, deleting) are also caught from the editor layer below. */
  function markAnnotEdited() {
    annotEdits.current++;
    annotDirty.current = true;
    host.setDirty(true);
    host.changed();
  }

  // Edits to annotations that already exist: typing in a text box, moving with the keyboard or
  // deleting, and undo/redo (a plain click to select one is not an edit). Dragging is caught by
  // the editors' undo history below.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const hasAnnotations = () => ((docRef.current?.annotationStorage as unknown as { size?: number })?.size ?? 0) > 0;
    const inEditor = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.(".annotationEditorLayer");
    const onEdit = (e: Event) => {
      if (inEditor(e.target) && hasAnnotations()) markAnnotEdited();
    };
    const onKey = (e: KeyboardEvent) => {
      // Shortcuts (Ctrl+S and others) and lone modifier keys are not edits.
      if (!hasAnnotations() || e.ctrlKey || e.metaKey || e.altKey || ["Control", "Shift", "Alt", "Meta", "Escape", "Tab"].includes(e.key)) return;
      if (inEditor(e.target) || ["Delete", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && el.querySelector(".annotationEditorLayer .selectedEditor")) markAnnotEdited();
    };
    el.addEventListener("input", onEdit, true);
    el.addEventListener("keyup", onKey, true);
    // The editors' undo history changing means an annotation changed (selection alone does not).
    let lastHistory = "";
    const onState = (e: { details?: { hasSomethingToUndo?: boolean; hasSomethingToRedo?: boolean } }) => {
      const h = `${!!e.details?.hasSomethingToUndo}/${!!e.details?.hasSomethingToRedo}`;
      if (h !== lastHistory && lastHistory && hasAnnotations()) markAnnotEdited();
      lastHistory = h;
    };
    bus.current?.on("annotationeditorstateschanged", onState);
    return () => {
      el.removeEventListener("input", onEdit, true);
      el.removeEventListener("keyup", onKey, true);
      bus.current?.off("annotationeditorstateschanged", onState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const currentBytes = async (): Promise<Uint8Array> => {
    if (annotDirty.current && docRef.current) return docRef.current.saveDocument();
    return bytesRef.current;
  };

  const keepView = () => ({ page: viewer.current?.currentPageNumber ?? 1, scale: viewer.current?.currentScaleValue ?? "page-width" });

  // Page operations run one after another: one started while another is still reloading the
  // document waits for it instead of being dropped.
  const pageOp = (label: string, fn: (b: Uint8Array) => Promise<Uint8Array>, keepPage?: number): Promise<void> => {
    const run = pageOpDone.current.then(() => runPageOp(label, fn, keepPage));
    pageOpDone.current = run.catch(() => {});
    return run;
  };
  const runPageOp = async (label: string, fn: (b: Uint8Array) => Promise<Uint8Array>, keepPage?: number) => {
    setBusy(true);
    try {
      const before = await currentBytes();
      const after = await fn(before);
      undoStack.current.push(before);
      if (undoStack.current.length > 20) undoStack.current.shift();
      bytesRef.current = after;
      annotDirty.current = false;
      // Mark unsaved before the viewer reloads, so a quick Ctrl+S never sees a "clean" tab.
      host.setDirty(true);
      host.changed();
      await openDoc(after, { ...keepView(), ...(keepPage ? { page: keepPage } : {}) });
    } catch (e) {
      host.toast(`${label} failed: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(false);
    }
  };
  const targets = () => (selected.length ? selected : [page - 1]);

  const ops = {
    rotate: (d: 90 | -90) => {
      const t = targets();
      return pageOp("Rotate", (b) => rotatePages(b, t, d));
    },
    remove: () => {
      const t = targets();
      return pageOp("Delete pages", (b) => deletePages(b, t)).then(() => setSelected([]));
    },
    move: (pages: number[], target: number) => {
      const order = movedOrder(numPages, pages, target);
      if (order.every((v, i) => v === i)) return;
      return pageOp("Move pages", (b) => reorderPages(b, order)).then(() => setSelected(pages.map((p) => order.indexOf(p))));
    },
    extract: async () => {
      const t = targets().sort((a, b) => a - b);
      const out = await extractPages(await currentBytes(), t);
      openBytes(`${stem(host.name)} (pages ${t.map((i) => i + 1).join(", ")}).pdf`, out, { kind: "pdf" });
    },
    insert: async () => {
      const [p] = await platform.pickOpen({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
      if (!p) return;
      const other = await platform.readFile(p);
      const at = (selected.length ? Math.max(...selected) : page - 1) + 1;
      await pageOp("Insert PDF", (b) => insertPdf(b, other, at), at + 1);
    },
    undo: async () => {
      const prev = undoStack.current.pop();
      if (!prev) {
        host.toast("Nothing to undo for pages. Use Ctrl+Z inside an annotation to undo it.");
        return;
      }
      bytesRef.current = prev;
      annotDirty.current = false;
      await openDoc(prev, keepView());
      host.setDirty(true);
      host.changed();
    },
  };
  const opsRef = useRef(ops);
  opsRef.current = ops;

  const runFind = (q: string, again = false, previous = false) => {
    bus.current?.dispatch("find", { source: null, type: again ? "again" : "", query: q, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false });
  };

  // Placing a signature: click on a page.
  useEffect(() => {
    if (!placing) return;
    const c = containerRef.current!;
    const onClick = async (e: MouseEvent) => {
      const pageEl = (e.target as HTMLElement).closest(".page") as HTMLElement | null;
      if (!pageEl) return;
      e.preventDefault();
      e.stopPropagation();
      const n = Number(pageEl.dataset.pageNumber);
      const pv = viewer.current!.getPageView(n - 1) as unknown as { viewport: { convertToPdfPoint(x: number, y: number): number[]; scale: number } };
      const r = pageEl.getBoundingClientRect();
      const [x, y] = pv.viewport.convertToPdfPoint(e.clientX - r.left, e.clientY - r.top);
      const png = placing;
      setPlacing(null);
      await pageOp("Place signature", (b) => placeImage(b, n - 1, png, x, y, 160), n);
      host.toast("Signature placed. It is now part of the page; use Undo page change to remove it.");
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlacing(null);
    c.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    return () => {
      c.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing]);

  // Toolbar
  useEffect(() => {
    const b = (id: string, label: string, icon: React.ReactNode, run: () => void, group: string, extra = {}) => ({ id, label, icon, run, group, ...extra });
    host.setToolbar([
      b("thumbs", "Pages panel", <PanelLeft />, () => setThumbs((t) => !t), "a", { active: thumbs }),
      b("select", "Select text", <MousePointer2 />, () => setMode("none"), "b", { active: mode === "none" }),
      b("highlight", "Highlight", <Highlighter />, () => setMode(mode === "highlight" ? "none" : "highlight"), "b", { active: mode === "highlight" }),
      b("text", "Add text", <Type />, () => setMode(mode === "freetext" ? "none" : "freetext"), "b", { active: mode === "freetext" }),
      b("ink", "Draw", <PenLine />, () => setMode(mode === "ink" ? "none" : "ink"), "b", { active: mode === "ink" }),
      b("sign", "Sign", <Signature />, () => setSigning(true), "b", { text: "Sign" }),
      b("rotl", "Rotate left", <RotateCcw />, () => void opsRef.current.rotate(-90), "c", { overflow: true }),
      b("rotr", "Rotate right", <RotateCw />, () => void opsRef.current.rotate(90), "c"),
      b("del", "Delete pages", <Trash2 />, () => void opsRef.current.remove(), "c"),
      b("extract", "Extract pages to a new PDF", <FileOutput />, () => void opsRef.current.extract(), "c", { overflow: true }),
      b("insert", "Insert another PDF after this page", <FilePlus2 />, () => void opsRef.current.insert(), "c", { overflow: true }),
      b("undo", "Undo page change", <Undo2 />, () => void opsRef.current.undo(), "c", { overflow: true }),
      b("zout", "Zoom out", <ZoomOut />, () => viewer.current?.decreaseScale(), "d", { overflow: true }),
      b("zin", "Zoom in", <ZoomIn />, () => viewer.current?.increaseScale(), "d", { overflow: true }),
      b("fit", "Fit width", <MoveHorizontal />, () => viewer.current && (viewer.current.currentScaleValue = "page-width"), "d", { overflow: true }),
      b("find", "Find", <Search />, () => setFind((f) => ({ ...f, open: true })), "e", { shortcut: "Ctrl+F" }),
    ]);
  }, [host, thumbs, mode]);

  // Status bar
  useEffect(() => {
    host.setStatus([
      { id: "page", text: numPages ? `Page ${page} of ${numPages}` : "Loading…", onClick: () => void import("../../app/commands").then((m) => m.openPalette(":")) },
      ...(selected.length > 1 ? [{ id: "sel", text: `${selected.length} pages selected` }] : []),
      ...(mode !== "none" ? [{ id: "mode", text: { highlight: "Select text to highlight", freetext: "Click to add text", ink: "Draw on the page", none: "" }[mode] }] : []),
      { id: "zoom", text: `${Math.round(scale * 100)}%`, align: "right" as const, onClick: () => viewer.current && (viewer.current.currentScaleValue = "page-width") },
    ]);
  }, [host, page, numPages, scale, selected.length, mode]);

  // Engine handle
  useEffect(() => {
    const commands: Command[] = [
      { id: "pdf.highlight", title: "Highlight text", group: "PDF", run: () => setMode("highlight") },
      { id: "pdf.text", title: "Add text box", group: "PDF", run: () => setMode("freetext") },
      { id: "pdf.ink", title: "Draw on page", group: "PDF", run: () => setMode("ink") },
      { id: "pdf.select", title: "Select text", group: "PDF", run: () => setMode("none") },
      { id: "pdf.sign", title: "Sign document", group: "PDF", run: () => setSigning(true) },
      { id: "pdf.rotr", title: "Rotate page right", group: "Pages", run: () => void opsRef.current.rotate(90) },
      { id: "pdf.rotl", title: "Rotate page left", group: "Pages", run: () => void opsRef.current.rotate(-90) },
      { id: "pdf.delete", title: "Delete selected pages", group: "Pages", run: () => void opsRef.current.remove() },
      { id: "pdf.extract", title: "Extract pages to a new PDF", group: "Pages", run: () => void opsRef.current.extract() },
      { id: "pdf.insert", title: "Insert another PDF…", group: "Pages", run: () => void opsRef.current.insert() },
      { id: "pdf.undoPages", title: "Undo page change", group: "Pages", run: () => void opsRef.current.undo() },
      { id: "pdf.thumbs", title: "Toggle pages panel", group: "View", run: () => setThumbs((t) => !t) },
      { id: "pdf.fit", title: "Fit page width", group: "View", run: () => viewer.current && (viewer.current.currentScaleValue = "page-width") },
      { id: "pdf.fitPage", title: "Fit whole page", group: "View", run: () => viewer.current && (viewer.current.currentScaleValue = "page-fit") },
    ];
    host.register({
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
      goTo: (loc) => {
        const v = viewer.current;
        if (!v) return;
        if (loc.startsWith("outline:")) {
          const dest = outlineDests.current[Number(loc.slice(8))];
          const ls = (v as unknown as { _link: { goToDestination(d: unknown): void } })._link;
          if (dest) ls.goToDestination(dest);
        } else v.currentPageNumber = Math.max(1, Math.min(numPages || 1, parseInt(loc, 10) || 1));
      },
      viewState: () => keepView(),
      commands: () => commands,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, numPages, openDoc]);

  // Restore position from the last session once.
  const restored = useRef(false);
  useEffect(() => {
    const vs = host.viewState as { page?: number } | undefined;
    if (!restored.current && numPages && vs?.page && viewer.current) {
      restored.current = true;
      setTimeout(() => viewer.current && (viewer.current.currentPageNumber = Math.min(vs.page!, numPages)), 50);
    }
  }, [numPages, host.viewState]);

  if (error)
    return (
      <div className="center-note">
        <h3>This PDF could not be opened</h3>
        <div>{error}</div>
      </div>
    );

  return (
    <div className="pdf-engine">
      {thumbs && doc && (
        <Thumbnails
          doc={doc}
          count={numPages}
          selected={selected}
          current={page}
          onSelect={setSelected}
          onActivate={(p) => viewer.current && (viewer.current.currentPageNumber = p)}
          onMove={(pages, target) => void opsRef.current.move(pages, target)}
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
        {placing && <div className="pdf-hint">Click where the signature should go. Press Esc to cancel.</div>}
        <div ref={containerRef} className={`pdf-container ${placing ? "placing" : ""}`} tabIndex={0} data-links="app">
          <div ref={viewerDivRef} className="pdfViewer" />
        </div>
        {busy && <div className="pdf-busy"><div className="spinner" /></div>}
      </div>
      {password && (
        <div className="overlay">
          <form className="dialog" onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("pw") as HTMLInputElement).value; password.cb(v); }}>
            <h3>This PDF is protected</h3>
            <p>{password.retry ? "That password did not work. Try again." : "Enter the password to open it."}</p>
            <input name="pw" type="password" className="input" autoFocus aria-label="Password" />
            <div className="acts"><button type="submit" className="btn primary">Open</button></div>
          </form>
        </div>
      )}
      {signing && <SignaturePad onCancel={() => setSigning(false)} onDone={(png) => { setSigning(false); setPlacing(png); }} />}
    </div>
  );
}
