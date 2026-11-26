import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpNarrowWide, ArrowDownWideNarrow, Rows3, Columns3, Trash2, Filter, Heading, FileText, X, BetweenHorizontalStart, BetweenVerticalStart } from "lucide-react";
import type { EngineHost, Command } from "../../app/editor-api";
import { loadCsv, saveCsv, serializeCsv, columnCount, setCell, emptyRow, insertColumn, deleteColumn, compareCells, looksLikeHeader, type CsvDoc, type CsvRow } from "../../lib/csv";
import { describeFormat, canEncode } from "../../lib/textcodec";
import { extname } from "../../lib/paths";
import { colName } from "../office/ooxml";
import { openMenu } from "../../shell/Menu";

const ROW_H = 28;
const NUM_W = 52;

interface Sel { r: number; c: number; r2: number; c2: number }
const norm = (s: Sel) => ({ r1: Math.min(s.r, s.r2), r2: Math.max(s.r, s.r2), c1: Math.min(s.c, s.c2), c2: Math.max(s.c, s.c2) });

/** The width that fits one column's text (header and the first 2,000 rows). */
function fitColumn(rows: CsvRow[], c: number, header: boolean): number {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = "13px Segoe UI, system-ui, sans-serif";
  let w = 60;
  for (const r of rows.slice(0, 2000)) w = Math.max(w, ctx.measureText(r.cells[c] ?? "").width + 22);
  if (header && rows[0]) w = Math.max(w, ctx.measureText(rows[0].cells[c] ?? "").width + 30);
  return Math.min(480, Math.ceil(w));
}

function measure(rows: CsvRow[], cols: number, header: boolean): number[] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = "13px Segoe UI, system-ui, sans-serif";
  const w: number[] = Array.from({ length: cols }, (_, c) => (c < 300 ? 60 : 100));
  // Measure a sample: the first rows, and at most the first 300 columns (very wide tables keep
  // a default width for the rest, so opening them stays quick).
  const sample = rows.slice(0, cols > 300 ? 40 : 300);
  const mc = Math.min(cols, 300);
  for (const r of sample) for (let c = 0; c < mc; c++) w[c] = Math.max(w[c], Math.min(320, ctx.measureText(r.cells[c] ?? "").width + 22));
  // Every header is measured, so even far columns show their names.
  if (header && rows[0]) for (let c = 0; c < cols; c++) w[c] = Math.max(w[c], Math.min(320, ctx.measureText(rows[0].cells[c] ?? "").width + 30));
  return w;
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

function parseClipboard(text: string): string[][] {
  const delim = text.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += ch;
    } else if (ch === '"' && f === "") q = true;
    else if (ch === delim) { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export default function CsvEngine({ host }: { host: EngineHost }) {
  const docRef = useRef<CsvDoc>(null as unknown as CsvDoc);
  if (!docRef.current) {
    const d = loadCsv(host.bytes, extname(host.name));
    // An empty file opens as one empty row that still saves back as an empty file.
    if (!d.rows.length) d.rows = [{ cells: [""], quoted: [false], raw: "", term: "" }];
    docRef.current = d;
  }
  const [rows, setRowsState] = useState<CsvRow[]>(docRef.current.rows);
  const [header, setHeader] = useState(() => looksLikeHeader(docRef.current.rows.slice(0, 2).map((r) => r.cells)));
  const cols = Math.max(1, useMemo(() => columnCount({ ...docRef.current, rows }), [rows]));
  const [widths, setWidths] = useState<number[]>(() => measure(docRef.current.rows, Math.max(1, columnCount(docRef.current)), header));
  const [sel, setSel] = useState<Sel>({ r: 0, c: 0, r2: 0, c2: 0 });
  const [editing, setEditingState] = useState<{ r: number; c: number; value: string } | null>(null);
  const editingRef = useRef<{ r: number; c: number; value: string } | null>(null);
  const setEditing = (e: { r: number; c: number; value: string } | null) => {
    editingRef.current = e;
    setEditingState(e);
  };
  const [filter, setFilter] = useState<string | null>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 600, left: 0, width: 1200 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const undo = useRef<CsvRow[][]>([]);
  const redo = useRef<CsvRow[][]>([]);
  const baseline = useRef<CsvRow[]>(docRef.current.rows);

  useEffect(() => {
    setWidths((w) => (w.length >= cols ? w : [...w, ...Array(cols - w.length).fill(100)]));
  }, [cols]);

  const commit = useCallback(
    (next: CsvRow[]) => {
      undo.current.push(docRef.current.rows);
      if (undo.current.length > 300) undo.current.shift();
      redo.current = [];
      docRef.current.rows = next;
      setRowsState(next);
      const dirty = next !== baseline.current;
      host.setDirty(dirty);
      if (dirty) host.changed();
    },
    [host],
  );

  const first = header ? 1 : 0;
  // View rows: data row indices shown in the grid (after the header row, filtered).
  const view = useMemo(() => {
    const idx: number[] = [];
    const f = filter?.trim().toLowerCase();
    for (let i = first; i < rows.length; i++) if (!f || rows[i].cells.some((c) => c.toLowerCase().includes(f))) idx.push(i);
    return idx;
  }, [rows, first, filter]);

  const setRows = (next: CsvRow[]) => commit(next);
  const viewRef = useRef(view);
  viewRef.current = view;
  /** Apply a cell edit that is still open (for example when Ctrl+S is pressed mid-edit). */
  const commitPendingEdit = () => {
    const e = editingRef.current;
    if (!e) return;
    const di = viewRef.current[e.r];
    const rowsNow = docRef.current.rows;
    if (di !== undefined && (rowsNow[di]?.cells[e.c] ?? "") !== e.value) {
      const next = rowsNow.slice();
      next[di] = setCell(next[di], e.c, e.value);
      commit(next);
    }
    setEditing(null);
  };
  const commitPendingRef = useRef(commitPendingEdit);
  commitPendingRef.current = commitPendingEdit;
  const term = docRef.current.eol;

  // Renaming a column (header row): its own small editor in the header.
  const [headEdit, setHeadEdit] = useState<{ c: number; value: string } | null>(null);
  const headDone = useRef(false);
  const editDone = useRef(true);
  const renameColumn = (c: number, value: string) => {
    // Enter and then the input losing focus must rename only once.
    if (headDone.current) return;
    headDone.current = true;
    setHeadEdit(null);
    if (rows[0] && (rows[0].cells[c] ?? "") !== value) {
      const next = rows.slice();
      next[0] = setCell(next[0], c, value);
      setRows(next);
    }
    scrollRef.current?.focus();
  };
  const startEdit = (r: number, c: number, initial?: string) => {
    const di = view[r];
    if (di === undefined) return;
    editDone.current = false;
    setEditing({ r, c, value: initial ?? rows[di]?.cells[c] ?? "" });
  };
  // Moving focus back to the grid blurs the cell editor, and its blur handler
  // would save again with the old closure; only the first finish counts.
  const finishEdit = (save: boolean, move?: [number, number]) => {
    if (editDone.current) return;
    editDone.current = true;
    if (editing && save) {
      const di = view[editing.r];
      if ((rows[di]?.cells[editing.c] ?? "") !== editing.value) {
        const next = rows.slice();
        next[di] = setCell(next[di], editing.c, editing.value);
        setRows(next);
      }
    }
    setEditing(null);
    if (move) moveSel(move[0], move[1], false);
    scrollRef.current?.focus();
  };

  const moveSel = (dr: number, dc: number, extend: boolean) => {
    setSel((s) => {
      const r = Math.max(0, Math.min(view.length - 1, (extend ? s.r2 : s.r) + dr));
      const c = Math.max(0, Math.min(cols - 1, (extend ? s.c2 : s.c) + dc));
      ensureVisible(r, c);
      return extend ? { ...s, r2: r, c2: c } : { r, c, r2: r, c2: c };
    });
  };
  const ensureVisible = (r: number, c?: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const top = r * ROW_H, bottom = top + ROW_H + ROW_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    if (c !== undefined) {
      const x0 = left(c) - NUM_W, x1 = left(c + 1);
      if (x0 < el.scrollLeft) el.scrollLeft = x0;
      else if (x1 > el.scrollLeft + el.clientWidth) el.scrollLeft = x1 - el.clientWidth;
    }
  };

  const selectionTable = (): string[][] => {
    const { r1, r2, c1, c2 } = norm(sel);
    const out: string[][] = [];
    for (let r = r1; r <= r2; r++) {
      const row = rows[view[r]];
      if (!row) continue;
      out.push(Array.from({ length: c2 - c1 + 1 }, (_, i) => row.cells[c1 + i] ?? ""));
    }
    return out;
  };

  const ops = {
    insertRow(after: boolean) {
      const di = view[sel.r] ?? rows.length - 1;
      const at = after ? di + 1 : Math.max(first, di);
      const next = rows.slice();
      next.splice(at, 0, emptyRow(cols, term));
      setRows(next);
    },
    deleteRows() {
      const { r1, r2 } = norm(sel);
      const remove = new Set(view.slice(r1, r2 + 1));
      if (!remove.size) return;
      setRows(rows.filter((_, i) => !remove.has(i)));
      setSel({ r: Math.max(0, r1 - 1), c: sel.c, r2: Math.max(0, r1 - 1), c2: sel.c });
    },
    insertCol(after: boolean) {
      const at = after ? sel.c + 1 : sel.c;
      let next = insertColumn(rows, at);
      // With a header row, the new column is named (not left as an empty heading).
      if (header && next[0]) {
        const names = new Set(next[0].cells.map((x) => x.trim().toLowerCase()));
        let n = cols + 1, name = `Column ${n}`;
        while (names.has(name.toLowerCase())) name = `Column ${++n}`;
        next = next.slice();
        next[0] = setCell(next[0], at, name);
      }
      setRows(next);
      setWidths((w) => [...w.slice(0, at), 100, ...w.slice(at)]);
    },
    deleteCol() {
      if (cols <= 1) return;
      const { c1, c2 } = norm(sel);
      let next = rows;
      for (let c = c2; c >= c1; c--) next = deleteColumn(next, c);
      setRows(next);
      setWidths((w) => w.filter((_, i) => i < c1 || i > c2));
      setSel({ r: sel.r, c: Math.max(0, c1 - 1), r2: sel.r, c2: Math.max(0, c1 - 1) });
    },
    sort(dir: 1 | -1) {
      const c = sel.c;
      const head = rows.slice(0, first);
      const body = rows.slice(first).map((r, i) => ({ r, i }));
      // Empty cells go last in either direction; equal values keep their order.
      body.sort((a, b) => {
        const x = (a.r.cells[c] ?? "").trim(), y = (b.r.cells[c] ?? "").trim();
        if (!x !== !y) return x ? -1 : 1;
        return dir * compareCells(a.r.cells[c] ?? "", b.r.cells[c] ?? "") || a.i - b.i;
      });
      setRows([...head, ...body.map((x) => x.r)]);
    },
    clear() {
      const { r1, r2, c1, c2 } = norm(sel);
      const next = rows.slice();
      let changed = false;
      for (let r = r1; r <= r2; r++) {
        const di = view[r];
        if (di === undefined) continue;
        for (let c = c1; c <= c2; c++) if ((next[di].cells[c] ?? "") !== "") { next[di] = setCell(next[di], c, ""); changed = true; }
      }
      if (changed) setRows(next);
    },
    paste(text: string) {
      const data = parseClipboard(text.replace(/\r?\n$/, ""));
      if (!data.length) return;
      const next = rows.slice();
      const startDi = view[sel.r] ?? next.length;
      for (let i = 0; i < data.length; i++) {
        let di = startDi + i;
        while (di >= next.length) next.push(emptyRow(cols, term));
        data[i].forEach((v, j) => (next[di] = setCell(next[di], sel.c + j, v)));
      }
      setRows(next);
    },
    undo() {
      const prev = undo.current.pop();
      if (!prev) return;
      redo.current.push(docRef.current.rows);
      docRef.current.rows = prev;
      setRowsState(prev);
      const dirty = prev !== baseline.current;
      host.setDirty(dirty);
      if (dirty) host.changed();
    },
    redo() {
      const n = redo.current.pop();
      if (!n) return;
      undo.current.push(docRef.current.rows);
      docRef.current.rows = n;
      setRowsState(n);
      host.setDirty(n !== baseline.current);
      host.changed();
    },
  };
  const opsRef = useRef(ops);
  opsRef.current = ops;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_H) - 2);
    if (k === "ArrowDown") moveSel(1, 0, e.shiftKey);
    else if (k === "ArrowUp") moveSel(-1, 0, e.shiftKey);
    else if (k === "ArrowRight") moveSel(0, 1, e.shiftKey);
    else if (k === "ArrowLeft") moveSel(0, -1, e.shiftKey);
    else if (k === "PageDown") moveSel(page, 0, e.shiftKey);
    else if (k === "PageUp") moveSel(-page, 0, e.shiftKey);
    else if (k === "Home") moveSel(mod ? -1e9 : 0, -1e9, e.shiftKey);
    else if (k === "End") moveSel(mod ? 1e9 : 0, 1e9, e.shiftKey);
    else if (k === "Tab") moveSel(0, e.shiftKey ? -1 : 1, false);
    else if (k === "Enter" || k === "F2") startEdit(sel.r, sel.c);
    else if (k === "Delete" || k === "Backspace") ops.clear();
    else if (mod && k.toLowerCase() === "z") (e.shiftKey ? ops.redo() : ops.undo());
    else if (mod && k.toLowerCase() === "y") ops.redo();
    else if (mod && k.toLowerCase() === "a") setSel({ r: 0, c: 0, r2: view.length - 1, c2: cols - 1 });
    else if (mod && k.toLowerCase() === "c") void navigator.clipboard.writeText(selectionTable().map((r) => r.join("\t")).join("\n"));
    else if (mod && k.toLowerCase() === "x") { void navigator.clipboard.writeText(selectionTable().map((r) => r.join("\t")).join("\n")); ops.clear(); }
    else if (mod && k.toLowerCase() === "v") void navigator.clipboard.readText().then((t) => opsRef.current.paste(t));
    else if (mod && k.toLowerCase() === "f") setFilter((f) => f ?? "");
    else if (k.length === 1 && !mod && !e.altKey) { startEdit(sel.r, sel.c, k); e.preventDefault(); return; }
    else return;
    e.preventDefault();
  };

  // Selection statistics for the status bar.
  const stats = useMemo(() => {
    const { r1, r2, c1, c2 } = norm(sel);
    let count = 0, nums = 0, sum = 0;
    for (let r = r1; r <= Math.min(r2, r1 + 20000); r++) {
      const row = rows[view[r]];
      if (!row) continue;
      for (let c = c1; c <= c2; c++) {
        const v = (row.cells[c] ?? "").trim();
        if (!v) continue;
        count++;
        const n = Number(v.replace(/,/g, ""));
        if (!isNaN(n)) { nums++; sum += n; }
      }
    }
    return { count, nums, sum, cells: (r2 - r1 + 1) * (c2 - c1 + 1) };
  }, [sel, rows, view]);

  const delimName = { ",": "Comma", ";": "Semicolon", "\t": "Tab", "|": "Pipe" }[docRef.current.delimiter] ?? docRef.current.delimiter;

  useEffect(() => {
    const f = describeFormat(docRef.current.format);
    const items = [
      { id: "size", text: `${plural(rows.length - first, "row")} × ${plural(cols, "column")}` },
      { id: "cell", text: `Cell ${colName(sel.c)}${sel.r + 1}` },
    ];
    if (stats.cells > 1 && stats.nums > 0) items.push({ id: "sum", text: `Sum ${+stats.sum.toFixed(10)} · Average ${+(stats.sum / stats.nums).toFixed(4)} · Count ${stats.count}` });
    else if (stats.cells > 1) items.push({ id: "sum", text: `Count ${stats.count}` });
    if (filter) items.push({ id: "filter", text: `Showing ${plural(view.length, "matching row")}` });
    // Separator, text format and line endings only when unusual; all of them under Details.
    const fmt = docRef.current.format;
    const extra: never[] = [];
    if (docRef.current.delimiter !== "," && docRef.current.delimiter !== "\t") extra.push({ id: "delim", text: `${delimName}-separated`, align: "right", title: "Separator" } as never);
    if (fmt.encoding !== "utf-8") extra.push({ id: "enc", text: f.encoding, align: "right", title: "Text format" } as never);
    const details = () =>
      openMenu(window.innerWidth - 270, window.innerHeight - 40, [
        { label: `Separator: ${delimName}`, disabled: true },
        { label: `Text format: ${f.encoding}`, disabled: true },
        { label: `Line endings: ${f.eol === "CRLF" ? "Windows (CRLF)" : f.eol === "LF" ? "Unix (LF)" : f.eol}`, disabled: true },
      ]);
    host.setStatus([...items, ...extra, { id: "details", text: "Details", align: "right", title: "Separator, text format and line endings", onClick: details } as never]);
  }, [rows, cols, sel, stats, filter, view.length, first, host, delimName]);

  useEffect(() => {
    const b = (id: string, label: string, icon: React.ReactNode, run: () => void, group: string, extra = {}) => ({ id, label, icon, run, group, ...extra });
    host.setToolbar([
      b("header", "First row is a header", <Heading />, () => setHeader((h) => !h), "a", { active: header, text: "Header row" }),
      b("rowAbove", "Insert row above", <BetweenHorizontalStart />, () => opsRef.current.insertRow(false), "b"),
      b("rowBelow", "Insert row below", <Rows3 />, () => opsRef.current.insertRow(true), "b"),
      b("delRow", "Delete rows", <Trash2 />, () => opsRef.current.deleteRows(), "b"),
      b("colLeft", "Insert column left", <BetweenVerticalStart />, () => opsRef.current.insertCol(false), "c", { overflow: true }),
      b("colRight", "Insert column right", <Columns3 />, () => opsRef.current.insertCol(true), "c"),
      b("delCol", "Delete columns", <Trash2 style={{ transform: "rotate(90deg)" }} />, () => opsRef.current.deleteCol(), "c", { overflow: true }),
      b("asc", "Sort A to Z by this column", <ArrowUpNarrowWide />, () => opsRef.current.sort(1), "d"),
      b("desc", "Sort Z to A by this column", <ArrowDownWideNarrow />, () => opsRef.current.sort(-1), "d"),
      b("filter", "Filter rows", <Filter />, () => setFilter((f) => (f === null ? "" : null)), "e", { active: filter !== null, shortcut: "Ctrl+F" }),
      b("text", "Open as plain text", <FileText />, () => host.openAs("text"), "f", { overflow: true }),
    ]);
  }, [header, filter, host]);

  useEffect(() => {
    const commands: Command[] = [
      { id: "csv.header", title: header ? "Treat first row as data" : "Treat first row as header", group: "Table", run: () => setHeader((h) => !h) },
      { id: "csv.rowBelow", title: "Insert row below", group: "Table", run: () => opsRef.current.insertRow(true) },
      { id: "csv.rowAbove", title: "Insert row above", group: "Table", run: () => opsRef.current.insertRow(false) },
      { id: "csv.delRow", title: "Delete selected rows", group: "Table", run: () => opsRef.current.deleteRows() },
      { id: "csv.colRight", title: "Insert column right", group: "Table", run: () => opsRef.current.insertCol(true) },
      { id: "csv.colLeft", title: "Insert column left", group: "Table", run: () => opsRef.current.insertCol(false) },
      { id: "csv.delCol", title: "Delete selected columns", group: "Table", run: () => opsRef.current.deleteCol() },
      { id: "csv.sortAsc", title: "Sort A to Z by current column", group: "Table", run: () => opsRef.current.sort(1) },
      { id: "csv.sortDesc", title: "Sort Z to A by current column", group: "Table", run: () => opsRef.current.sort(-1) },
      { id: "csv.filter", title: "Filter rows", group: "Table", shortcut: "Ctrl+F", run: () => setFilter("") },
      { id: "csv.undo", title: "Undo", group: "Edit", shortcut: "Ctrl+Z", run: () => opsRef.current.undo() },
      { id: "csv.redo", title: "Redo", group: "Edit", shortcut: "Ctrl+Y", run: () => opsRef.current.redo() },
    ];
    host.register({
      async serialize(opts) {
        if (opts?.forSave) commitPendingRef.current();
        let doc = docRef.current;
        // An older encoding (for example Windows-1252 from Excel) cannot hold every character:
        // ask, as the text editor does, instead of silently writing "?".
        if (!canEncode(serializeCsv(doc), doc.format.encoding)) {
          if (!opts?.forSave) return saveCsv({ ...doc, format: { ...doc.format, encoding: "utf-8", bom: false } });
          const { ask } = await import("../../app/dialogs");
          const choice = await ask(
            `Some characters can't be saved as ${describeFormat(doc.format).encoding}`,
            "This table uses an older encoding that cannot hold some of the characters you typed. Saving as UTF-8 keeps them, but programs that expect the old encoding may show accented letters differently.",
            ["Save as UTF-8", "Replace them with ?", "Cancel"],
          );
          if (choice === "Save as UTF-8") {
            doc = docRef.current = { ...doc, format: { ...doc.format, encoding: "utf-8", bom: false } };
          } else if (choice !== "Replace them with ?") throw new Error("Save cancelled.");
        }
        if (opts?.forSave) lastSaved.current = doc.rows;
        return saveCsv(doc);
      },
      markSaved() {
        if (!lastSaved.current) return;
        baseline.current = lastSaved.current;
        lastSaved.current = null;
        const dirty = docRef.current.rows !== baseline.current;
        if (dirty) { host.setDirty(true); host.changed(); }
      },
      focus: () => scrollRef.current?.focus(),
      flush: () => commitPendingRef.current(),
      find: () => setFilter((f) => f ?? ""),
      goTo: (loc) => {
        const n = Math.max(1, parseInt(loc, 10) || 1) - 1;
        const r = Math.min(viewRef.current.length - 1, n);
        // Same column, new row.
        setSel((s0) => ({ r, c: s0.c, r2: r, c2: s0.c }));
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, r * ROW_H - 100);
          scrollRef.current?.focus();
        });
      },
      getText: () => docRef.current.rows.map((r) => r.cells.join("\t")).join("\n"),
      commands: () => commands,
    });
  }, [host, header, view.length]);
  const lastSaved = useRef<CsvRow[] | null>(null);

  // A table that opens as the visible tab takes the keyboard straight away (new tables included).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && el.offsetParent !== null && (document.activeElement === document.body || !document.activeElement)) el.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScroll({ top: el.scrollTop, height: el.clientHeight, left: el.scrollLeft, width: el.clientWidth }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scroll.top / ROW_H) - 5);
  const end = Math.min(view.length, Math.ceil((scroll.top + scroll.height) / ROW_H) + 5);
  // Column positions, summed once (not per cell); only the columns in view are drawn.
  const offsets = useMemo(() => {
    const o = new Float64Array(cols + 1);
    o[0] = NUM_W;
    for (let c = 0; c < cols; c++) o[c + 1] = o[c] + (widths[c] ?? 100);
    return o;
  }, [widths, cols]);
  const totalW = offsets[cols];
  const { r1, r2, c1, c2 } = norm(sel);
  const left = (c: number) => offsets[Math.min(c, cols)];
  const colAt = (x: number) => {
    let lo = 0, hi = cols - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const colStart = Math.max(0, colAt(scroll.left) - 2);
  const colEnd = Math.min(cols, colAt(scroll.left + scroll.width) + 3);
  const visibleCols = Array.from({ length: Math.max(0, colEnd - colStart) }, (_, i) => colStart + i);
  // A column being renamed stays drawn while the grid scrolls sideways, so its editor keeps focus.
  const headCols = headEdit && (headEdit.c < colStart || headEdit.c >= colEnd) && headEdit.c < cols ? [...visibleCols, headEdit.c] : visibleCols;

  const resize = (c: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX, w0 = widths[c];
    const mv = (ev: MouseEvent) => setWidths((w) => w.map((x, i) => (i === c ? Math.max(40, w0 + ev.clientX - x0) : x)));
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  const dragFrom = useRef<{ r: number; c: number } | null>(null);

  return (
    <div className="csv">
      {filter !== null && (
        <div className="csv-filter">
          <Filter size={15} />
          <input className="input" autoFocus placeholder="Show rows containing…" value={filter} onChange={(e) => setFilter(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setFilter(null); scrollRef.current?.focus(); } if (e.key === "Enter") scrollRef.current?.focus(); }} aria-label="Filter rows" />
          <span className="help">{plural(view.length, "row")}</span>
          <button className="icon-btn" onClick={() => { setFilter(null); scrollRef.current?.focus(); }} aria-label="Clear filter"><X /></button>
        </div>
      )}
      <div
        className="csv-scroll"
        ref={scrollRef}
        tabIndex={0}
        role="grid"
        aria-rowcount={view.length}
        aria-colcount={cols}
        onKeyDown={onKeyDown}
        onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight, left: e.currentTarget.scrollLeft, width: e.currentTarget.clientWidth })}
      >
        <div style={{ height: (view.length + 1) * ROW_H, width: totalW, position: "relative" }}>
          <div className="csv-head" style={{ width: totalW }}>
            <div className="csv-corner" style={{ width: NUM_W }} onClick={() => setSel({ r: 0, c: 0, r2: view.length - 1, c2: cols - 1 })} />
            {headCols.map((c) => (
              <div
                key={c}
                className={`csv-hcell ${c >= c1 && c <= c2 ? "sel" : ""}`}
                style={{ left: left(c), width: widths[c] }}
                onClick={(e) => setSel(e.shiftKey ? { ...sel, r2: view.length - 1, c2: c } : { r: 0, c, r2: view.length - 1, c2: c })}
                // With a header row, double-click a column name to rename it.
                onDoubleClick={() => {
                  if (!header || !rows[0]) return;
                  headDone.current = false;
                  setHeadEdit({ c, value: rows[0].cells[c] ?? "" });
                }}
                title={header ? `${rows[0]?.cells[c] ?? ""} (double-click to rename)` : colName(c)}
              >
                {headEdit?.c === c ? (
                  <input
                    className="csv-head-input"
                    autoFocus
                    value={headEdit.value}
                    aria-label="Column name"
                    onChange={(e) => setHeadEdit({ c, value: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) renameColumn(c, headEdit.value);
                      if (e.key === "Escape") { headDone.current = true; setHeadEdit(null); scrollRef.current?.focus(); }
                    }}
                    onBlur={() => renameColumn(c, headEdit.value)}
                  />
                ) : (
                  <span className="t">{header ? rows[0]?.cells[c] || colName(c) : colName(c)}</span>
                )}
                <span
                  className="grip"
                  title="Drag to resize; double-click to fit"
                  onMouseDown={(e) => resize(c, e)}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const w = fitColumn(rows, c, header);
                    setWidths((ws) => ws.map((x, i) => (i === c ? w : x)));
                  }}
                />
              </div>
            ))}
          </div>
          {Array.from({ length: end - start }, (_, i) => {
            const r = start + i;
            const di = view[r];
            const row = rows[di];
            return (
              <div key={di} className="csv-row" style={{ top: (r + 1) * ROW_H, width: totalW }} role="row">
                <div className={`csv-num ${r >= r1 && r <= r2 ? "sel" : ""}`} style={{ width: NUM_W }} onClick={(e) => setSel(e.shiftKey ? { ...sel, r2: r, c2: cols - 1 } : { r, c: 0, r2: r, c2: cols - 1 })}>{di - first + 1}</div>
                {visibleCols.map((c) => {
                  const inSel = r >= r1 && r <= r2 && c >= c1 && c <= c2;
                  const isCur = r === sel.r && c === sel.c;
                  const v = row?.cells[c] ?? "";
                  return (
                    <div
                      key={c}
                      role="gridcell"
                      className={`csv-cell ${inSel ? "sel" : ""} ${isCur ? "cur" : ""} ${v && !isNaN(Number(v)) ? "num" : ""}`}
                      style={{ left: left(c), width: widths[c] }}
                      onMouseDown={(e) => {
                        if (editing) finishEdit(true);
                        dragFrom.current = { r, c };
                        setSel(e.shiftKey ? { ...sel, r2: r, c2: c } : { r, c, r2: r, c2: c });
                        scrollRef.current?.focus();
                      }}
                      onMouseEnter={(e) => { if (e.buttons === 1 && dragFrom.current) setSel({ r: dragFrom.current.r, c: dragFrom.current.c, r2: r, c2: c }); }}
                      onDoubleClick={() => startEdit(r, c)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!(r >= r1 && r <= r2 && c >= c1 && c <= c2)) setSel({ r, c, r2: r, c2: c });
                        openMenu(e.clientX, e.clientY, [
                          { label: "Edit cell", shortcut: "F2", run: () => startEdit(r, c) },
                          { divider: true },
                          { label: "Insert row above", run: () => opsRef.current.insertRow(false) },
                          { label: "Insert row below", run: () => opsRef.current.insertRow(true) },
                          { label: "Insert column left", run: () => opsRef.current.insertCol(false) },
                          { label: "Insert column right", run: () => opsRef.current.insertCol(true) },
                          { divider: true },
                          { label: "Sort A to Z", run: () => opsRef.current.sort(1) },
                          { label: "Sort Z to A", run: () => opsRef.current.sort(-1) },
                          { divider: true },
                          { label: "Clear cells", shortcut: "Delete", run: () => opsRef.current.clear() },
                          { label: "Delete rows", run: () => opsRef.current.deleteRows() },
                          { label: "Delete columns", run: () => opsRef.current.deleteCol(), disabled: cols <= 1 },
                        ]);
                      }}
                      title={v.length > 40 ? v : undefined}
                    >
                      {v}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {editing && (
            <textarea
              className="csv-editor"
              autoFocus
              style={{ top: (editing.r + 1) * ROW_H, left: left(editing.c), width: Math.max(widths[editing.c], 160) }}
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              onBlur={() => finishEdit(true)}
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" && !e.altKey && !e.shiftKey) { e.preventDefault(); finishEdit(true, [1, 0]); }
                else if (e.key === "Tab") { e.preventDefault(); finishEdit(true, [0, e.shiftKey ? -1 : 1]); }
                else if (e.key === "Escape") { e.preventDefault(); finishEdit(false); }
              }}
              aria-label={`Edit cell ${colName(editing.c)}${editing.r + 1}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
