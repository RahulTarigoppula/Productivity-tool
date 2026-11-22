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

export function setHeading(view: EditorView, level: number): boolean {
  const changes: ChangeSpec[] = [];
  for (const line of selectedLines(view)) {
    const m = /^(#{1,6})\s+/.exec(line.text);
    const current = m ? m[1].length : 0;
    const target = current === level ? 0 : level;
    changes.push({ from: line.from, to: line.from + (m ? m[0].length : 0), insert: target ? "#".repeat(target) + " " : "" });
  }
  view.dispatch({ changes, userEvent: "input" });
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
  view.dispatch({ changes, userEvent: "input" });
  view.focus();
  return true;
}

export function insertLink(view: EditorView, url = ""): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to) || (url ? url.split(/[\\/]/).pop() ?? "link" : "link text");
    const insert = `[${text}](${url})`;
    const urlStart = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: url ? EditorSelection.cursor(range.from + insert.length) : EditorSelection.cursor(urlStart),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
  return true;
}

export function insertBlock(view: EditorView, text: string, cursorOffset?: number): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const needsBreak = line.text.trim() ? "\n\n" : "";
  const insert = needsBreak + text;
  view.dispatch({
    changes: { from: line.text.trim() ? line.to : line.from, to: line.text.trim() ? line.to : line.to, insert },
    selection: { anchor: (line.text.trim() ? line.to : line.from) + needsBreak.length + (cursorOffset ?? text.length) },
    userEvent: "input",
    scrollIntoView: true,
  });
  view.focus();
  return true;
}
