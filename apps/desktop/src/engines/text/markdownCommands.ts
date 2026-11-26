/** Formatting commands that insert Markdown syntax (the file stays plain Markdown). */
import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export function toggleWrap(view: EditorView, mark: string): boolean {
  let { state } = view;
  // With nothing selected inside a word, the whole word is formatted (as word processors do).
  const words = state.selection.ranges.map((r) => (r.empty ? state.wordAt(r.head) : null));
  if (words.some(Boolean)) {
    view.dispatch({ selection: EditorSelection.create(state.selection.ranges.map((r, i) => (words[i] && words[i]!.from < r.head && r.head < words[i]!.to ? EditorSelection.range(words[i]!.from, words[i]!.to) : r)), state.selection.mainIndex) });
    state = view.state;
  }
  const tr = state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - mark.length, range.from);
    const after = state.sliceDoc(range.to, range.to + mark.length);
    if (before === mark && after === mark) {
      return {
        changes: [{ from: range.from - mark.length, to: range.from }, { from: range.to, to: range.to + mark.length }],
        range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
      };
    }
    const text = state.sliceDoc(range.from, range.to);
    if (text.startsWith(mark) && text.endsWith(mark) && text.length >= mark.length * 2) {
      return {
        changes: { from: range.from, to: range.to, insert: text.slice(mark.length, text.length - mark.length) },
        range: EditorSelection.range(range.from, range.to - mark.length * 2),
      };
    }
    return {
      changes: [{ from: range.from, insert: mark }, { from: range.to, insert: mark }],
      range: EditorSelection.range(range.from + mark.length, range.to + mark.length),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
  return true;
}

function selectedLines(view: EditorView) {
  const { state } = view;
  const lines = new Map<number, { from: number; text: string }>();
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to; ) {
      const line = state.doc.lineAt(pos);
      lines.set(line.number, { from: line.from, text: line.text });
      if (line.to + 1 > r.to) break;
      pos = line.to + 1;
    }
  }
  return [...lines.values()];
}

/** Markers a heading replaces: an existing heading, task, bullet, number or quote ("> - [ ] x"). */
const BLOCK_MARKER = /^\s*(?:#{1,6}(?:\s+|$)|[-*+] \[[ xX]\](?:\s+|$)|[-*+](?:\s+|$)|\d+[.)](?:\s+|$)|>\s?)/;
const DIVIDER = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;

export function setHeading(view: EditorView, level: number): boolean {
  const lines = selectedLines(view).filter((l) => !DIVIDER.test(l.text));
  if (!lines.length) return false;
  const levelOf = (t: string) => /^(#{1,6})(?:\s|$)/.exec(t)?.[1].length ?? 0;
  // One decision for the whole selection: if every line is already this heading, remove it.
  const off = lines.every((l) => levelOf(l.text) === level);
  const changes: ChangeSpec[] = lines.map((l) => {
    let len = 0;
    for (let m; (m = BLOCK_MARKER.exec(l.text.slice(len))) && m[0].length; ) len += m[0].length;
    return { from: l.from, to: l.from + len, insert: off ? "" : "#".repeat(level) + " " };
  });
  // The cursor moves past the inserted marker, so typing continues after "# ".
  const cs = view.state.changes(changes);
  view.dispatch({ changes: cs, selection: view.state.selection.map(cs, 1), userEvent: "input" });
  view.focus();
  return true;
}

const PREFIXES = [/^\s*[-*+] \[[ xX]\] /, /^\s*[-*+] /, /^\s*\d+[.)] /, /^\s*> ?/];

export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const lines = selectedLines(view);
  const has = (t: string) => (prefix === "1. " ? /^\s*\d+[.)] /.test(t) : t.startsWith(prefix));
  const all = lines.every((l) => has(l.text));
  const changes: ChangeSpec[] = [];
  lines.forEach((l, i) => {
    const existing = PREFIXES.map((re) => re.exec(l.text)).find(Boolean);
    if (all) changes.push({ from: l.from, to: l.from + (existing?.[0].length ?? 0), insert: "" });
    else changes.push({ from: l.from, to: l.from + (existing?.[0].length ?? 0), insert: prefix === "1. " ? `${i + 1}. ` : prefix });
  });
  // The cursor moves past the inserted marker, so typing continues after "- [ ] ", "# " etc.
  const cs = view.state.changes(changes);
  view.dispatch({ changes: cs, selection: view.state.selection.map(cs, 1), userEvent: "input" });
  view.focus();
  return true;
}

export function insertLink(view: EditorView, url = ""): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to);
    const text = selected || (url ? url.split(/[\\/]/).pop() ?? "link" : "link text");
    const insert = `[${text}](${url})`;
    const urlStart = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      // With a URL: after the link. With selected text: in the URL slot. Otherwise the placeholder
      // text is selected, so typing replaces it.
      range: url ? EditorSelection.cursor(range.from + insert.length) : selected ? EditorSelection.cursor(urlStart) : EditorSelection.range(range.from + 1, range.from + 1 + text.length),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
  return true;
}

export function insertBlock(view: EditorView, text: string, cursorOffset?: number, selectLength = 0): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const needsBreak = line.text.trim() ? "\n\n" : "";
  const insert = needsBreak + text;
  view.dispatch({
    changes: { from: line.text.trim() ? line.to : line.from, to: line.text.trim() ? line.to : line.to, insert },
    selection: (() => {
      const at = (line.text.trim() ? line.to : line.from) + needsBreak.length + (cursorOffset ?? text.length);
      return { anchor: at, head: at + selectLength };
    })(),
    userEvent: "input",
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

// ---------- lists ----------

const EMPTY_TOP_ITEM = /^([-*+]|\d{1,9}[.)])( \[[ xX]\])?\s*$/;
const LIST_LINE = /^\s*([-*+]|\d{1,9}[.)])\s/;

/** Enter on an empty top-level list item ends the list with a blank line, so what follows is its own
 *  paragraph. Without the blank line Markdown reads the next text as part of the last item. */
export function exitListOnEmptyItem(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (state.selection.ranges.length > 1 || !sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to || !EMPTY_TOP_ITEM.test(line.text) || line.number === 1) return false;
  const prev = state.doc.line(line.number - 1).text;
  if (!LIST_LINE.test(prev) && !/^\s+\S/.test(prev)) return false;
  view.dispatch({ changes: { from: line.from, to: line.to, insert: "\n" }, selection: { anchor: line.from + 1 }, scrollIntoView: true, userEvent: "input" });
  return true;
}

// ---------- tables ----------

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const DELIMITER_ROW = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;

/** The cells of a table row: where each cell's text starts and ends (offsets in the line). */
export function tableCells(text: string): { from: number; to: number }[] {
  const pipes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "|") pipes.push(i);
  }
  const cells: { from: number; to: number }[] = [];
  for (let k = 0; k + 1 < pipes.length; k++) {
    let from = pipes[k] + 1, to = pipes[k + 1];
    while (from < to && text[from] === " ") from++;
    while (to > from && text[to - 1] === " ") to--;
    // An empty cell: the cursor goes after the first space, inside the cell.
    if (from === to) from = to = Math.min(pipes[k] + 2, pipes[k + 1]);
    cells.push({ from, to });
  }
  return cells;
}

const isRow = (t: string) => TABLE_ROW.test(t) && !DELIMITER_ROW.test(t);
const emptyRowFor = (t: string) => "|" + "  |".repeat(Math.max(1, tableCells(t).length));

/** Tab and Shift+Tab move between table cells (selecting the cell's text); Tab after the last cell
 *  adds a row. Outside tables they do nothing, so indenting works as usual. */
export function tableNextCell(view: EditorView, dir: 1 | -1): boolean {
  const { state } = view;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.head);
  if (!isRow(line.text) || state.selection.ranges.length > 1) return false;
  const cells = tableCells(line.text);
  // The cell the cursor is in: one less than the number of cell borders before it.
  const at = sel.head - line.from;
  let borders = 0;
  for (let k = 0; k < at; k++) {
    if (line.text[k] === "\\") k++;
    else if (line.text[k] === "|") borders++;
  }
  const i = Math.max(0, Math.min(cells.length - 1, borders - 1));
  const select = (ln: { from: number; text: string }, cell: { from: number; to: number }) =>
    view.dispatch({ selection: EditorSelection.range(ln.from + cell.from, ln.from + cell.to), scrollIntoView: true });
  if (cells[i + dir]) {
    select(line, cells[i + dir]);
    return true;
  }
  const step = (n: number) => {
    let k = n + dir;
    while (k >= 1 && k <= state.doc.lines && DELIMITER_ROW.test(state.doc.line(k).text)) k += dir;
    return k >= 1 && k <= state.doc.lines && isRow(state.doc.line(k).text) ? state.doc.line(k) : null;
  };
  const next = step(line.number);
  if (next) {
    const nc = tableCells(next.text);
    select(next, dir > 0 ? nc[0] : nc[nc.length - 1]);
    return true;
  }
  if (dir < 0) return true;
  addRow(view, line);
  return true;
}

function addRow(view: EditorView, line: { to: number; text: string }) {
  const row = emptyRowFor(line.text);
  view.dispatch({ changes: { from: line.to, insert: "\n" + row }, selection: { anchor: line.to + 3 }, scrollIntoView: true, userEvent: "input" });
}

/** Enter at the end of a table row adds a row below; Enter on an empty last row leaves the table. */
export function tableEnter(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (state.selection.ranges.length > 1 || !sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (!isRow(line.text) || sel.head < line.from + line.text.trimEnd().length - 1) return false;
  const nextIsRow = line.number < state.doc.lines && TABLE_ROW.test(state.doc.line(line.number + 1).text);
  if (!nextIsRow && tableCells(line.text).every((c) => c.from === c.to)) {
    view.dispatch({ changes: { from: line.from, to: line.to, insert: "\n" }, selection: { anchor: line.from + 1 }, scrollIntoView: true, userEvent: "input" });
    return true;
  }
  addRow(view, line);
  return true;
}
