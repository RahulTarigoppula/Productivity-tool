/** Formatting commands that insert Markdown syntax (the file stays plain Markdown). */
import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export function toggleWrap(view: EditorView, mark: string): boolean {
  const { state } = view;
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
