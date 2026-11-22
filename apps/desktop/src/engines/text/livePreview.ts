/** Typora-style live Markdown: syntax marks are hidden on lines the cursor is not on,
 *  so headings, emphasis, links, task boxes and images read as formatted text.
 *  The document text itself is never changed by this view. */
import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) {
    super();
  }
  eq(o: CheckboxWidget) {
    return o.checked === this.checked && o.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.className = "cm-md-task";
    box.setAttribute("aria-label", this.checked ? "Done" : "To do");
    box.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("click", () => {
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? " " : "x" } });
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-md-bullet";
    s.textContent = "•";
    return s;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-md-hr";
    return s;
  }
}

export type ImageResolver = (src: string) => Promise<string | null>;

class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string, readonly resolver: ImageResolver) {
    super();
  }
  eq(o: ImageWidget) {
    return o.src === this.src && o.alt === this.alt;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-md-image";
    const img = document.createElement("img");
    img.alt = this.alt;
    img.title = this.alt;
    wrap.appendChild(img);
    void this.resolver(this.src).then((url) => {
      if (url) img.src = url;
      else wrap.textContent = `🖼 ${this.alt || this.src}`;
    });
    return wrap;
  }
}

/** Splits one GFM table row into cells (a backslash-escaped pipe stays in the cell). */
export function tableCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (t[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
}

/** A Markdown table shown as a table while the cursor is elsewhere. Cell text is set as text
 *  (never as HTML); **bold**, *italic* and `code` marks are shown without their symbols. */
class TableWidget extends WidgetType {
  constructor(readonly source: string, readonly from: number) {
    super();
  }
  eq(other: TableWidget) {
    return other.source === this.source && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const lines = this.source.split("\n").filter((l) => l.trim());
    const align = (lines[1] ? tableCells(lines[1]) : []).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : "left"));
    const wrap = document.createElement("div");
    wrap.className = "cm-md-table";
    wrap.title = "Click to edit the table";
    const table = document.createElement("table");
    const fill = (cell: HTMLElement, text: string, i: number) => {
      const strong = /^\*\*(.+)\*\*$/.exec(text), em = /^[*_](.+)[*_]$/.exec(text), code = /^`(.+)`$/.exec(text);
      if (strong) cell.appendChild(document.createElement("strong")).textContent = strong[1];
      else if (code) cell.appendChild(document.createElement("code")).textContent = code[1];
      else if (em) cell.appendChild(document.createElement("em")).textContent = em[1];
      else cell.textContent = text.replace(/\*\*|__|`/g, "");
      cell.style.textAlign = align[i] ?? "left";
    };
    const head = table.createTHead().insertRow();
    tableCells(lines[0] ?? "").forEach((c, i) => fill(head.appendChild(document.createElement("th")), c, i));
    const body = table.createTBody();
    const cols = head.cells.length;
    for (const l of lines.slice(2)) {
      const row = body.insertRow();
      const cells = tableCells(l);
      for (let i = 0; i < cols; i++) fill(row.insertCell(), cells[i] ?? "", i);
    }
    wrap.appendChild(table);
    wrap.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from } });
      view.focus();
    });
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

function buildTables(state: EditorState): DecorationSet {
  if (state.doc.length > 1_000_000) return Decoration.none;
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
    for (let i = a; i <= b; i++) lines.add(i);
  }
  const decos: Range<Decoration>[] = [];
  try {
    syntaxTree(state).iterate({
      enter: (node) => {
        if (node.name !== "Table") return;
        const first = state.doc.lineAt(node.from), last = state.doc.lineAt(node.to);
        for (let n = first.number; n <= last.number; n++) if (lines.has(n)) return false;
        const source = state.doc.sliceString(first.from, last.to);
        decos.push(Decoration.replace({ widget: new TableWidget(source, first.from), block: true }).range(first.from, last.to));
        return false;
      },
    });
  } catch {
    return Decoration.none;
  }
  return Decoration.set(decos, true);
}

/** Tables are block widgets, which CodeMirror only accepts from a state field. */
const tableField = StateField.define<DecorationSet>({
  create: (state) => buildTables(state),
  update: (value, tr) => (tr.docChanged || tr.selection || syntaxTree(tr.startState) !== syntaxTree(tr.state) ? buildTables(tr.state) : value),
  provide: (f) => EditorView.decorations.from(f),
});

class FenceLabel extends WidgetType {
  constructor(readonly lang: string) {
    super();
  }
  eq(o: FenceLabel) {
    return o.lang === this.lang;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-md-fence";
    el.textContent = this.lang;
    return el;
  }
}

const hide = Decoration.replace({});
const bullet = Decoration.replace({ widget: new BulletWidget() });

function activeLines(state: EditorState, focused: boolean): Set<number> {
  const lines = new Set<number>();
  if (!focused) return lines;
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
    for (let i = a; i <= b; i++) lines.add(i);
  }
  return lines;
}

function build(view: EditorView, resolver: ImageResolver): DecorationSet {
  // Pathological documents (thousands of nesting levels) can exhaust the stack; fall back to
  // plain source for them rather than failing.
  try {
    return buildUnsafe(view, resolver);
  } catch {
    return Decoration.none;
  }
}

function buildUnsafe(view: EditorView, resolver: ImageResolver): DecorationSet {
  const { state } = view;
  const active = activeLines(state, view.hasFocus);
  const decos: Range<Decoration>[] = [];
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number);
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        const h = /^ATXHeading(\d)$/.exec(name);
        if (h) {
          decos.push(Decoration.line({ class: `cm-md-h cm-md-h${h[1]}` }).range(state.doc.lineAt(node.from).from));
          return;
        }
        if (name === "HeaderMark") {
          if (!isActive(node.from)) {
            const after = state.doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
            decos.push(hide.range(node.from, after));
          }
          return;
        }
        if (name === "EmphasisMark" || name === "CodeMark" || name === "StrikethroughMark") {
          // Code fences (```) are CodeMark too; only hide inline ones.
          const parent = node.node.parent?.name;
          if (parent === "FencedCode") return;
          if (!isActive(node.from)) decos.push(hide.range(node.from, node.to));
          return;
        }
        if (name === "InlineCode") {
          decos.push(Decoration.mark({ class: "cm-md-code" }).range(node.from, node.to));
          return;
        }
        if (name === "Link") {
          decos.push(Decoration.mark({ class: "cm-md-link", attributes: { title: "Ctrl+click to open" } }).range(node.from, node.to));
          if (!isActive(node.from)) {
            const n = node.node;
            for (let c = n.firstChild; c; c = c.nextSibling) {
              if (c.name === "LinkMark" || c.name === "URL" || c.name === "LinkTitle" || c.name === "LinkLabel") decos.push(hide.range(c.from, c.to));
            }
          }
          return false;
        }
        if (name === "Image") {
          if (!isActive(node.from)) {
            const text = state.doc.sliceString(node.from, node.to);
            const m = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/.exec(text);
            if (m) decos.push(Decoration.replace({ widget: new ImageWidget(m[2], m[1], resolver) }).range(node.from, node.to));
          }
          return false;
        }
        if (name === "TaskMarker") {
          const checked = /x/i.test(state.doc.sliceString(node.from, node.to));
          if (!isActive(node.from)) decos.push(Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to));
          if (checked) {
            const line = state.doc.lineAt(node.from);
            if (node.to + 1 < line.to) decos.push(Decoration.mark({ class: "cm-md-done" }).range(node.to + 1, line.to));
          }
          return;
        }
        if (name === "ListMark") {
          const text = state.doc.sliceString(node.from, node.to);
          const isTask = state.doc.sliceString(node.to, node.to + 4).match(/^ \[[ xX]\]/);
          if ((text === "-" || text === "*" || text === "+") && !isActive(node.from)) {
            // A task item shows only its checkbox; a plain item shows a bullet.
            if (isTask) decos.push(hide.range(node.from, node.to + 1));
            else decos.push(bullet.range(node.from, node.to));
          }
          return;
        }
        if (name === "HorizontalRule") {
          if (!isActive(node.from)) decos.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
          return;
        }
        if (name === "Blockquote") {
          for (let pos = node.from; pos <= node.to; ) {
            const line = state.doc.lineAt(pos);
            decos.push(Decoration.line({ class: "cm-md-quote" }).range(line.from));
            pos = line.to + 1;
          }
          return;
        }
        if (name === "QuoteMark") {
          if (!isActive(node.from)) {
            const after = state.doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
            decos.push(hide.range(node.from, after));
          }
          return;
        }
        if (name === "FencedCode" || name === "CodeBlock") {
          const firstLine = state.doc.lineAt(node.from), lastLine = state.doc.lineAt(node.to);
          for (let pos = node.from; pos <= node.to; ) {
            const line = state.doc.lineAt(pos);
            const edge = name === "FencedCode" && (line.number === firstLine.number || line.number === lastLine.number);
            decos.push(Decoration.line({ class: `cm-md-codeblock${line.number === firstLine.number ? " cm-md-codeblock-first" : ""}${line.number === lastLine.number ? " cm-md-codeblock-last" : ""}` }).range(line.from));
            // The ``` lines read as the block's top and bottom edge while the cursor is elsewhere.
            if (edge && !isActive(line.from) && /^\s*(`{3,}|~{3,})/.test(line.text)) {
              const lang = line.number === firstLine.number && lastLine.number !== firstLine.number ? line.text.replace(/^\s*(`{3,}|~{3,})/, "").trim().split(/\s+/)[0] : "";
              decos.push(Decoration.replace({ widget: lang ? new FenceLabel(lang) : undefined }).range(line.from, line.to));
            }
            pos = line.to + 1;
          }
          return false;
        }
      },
    });
  }
  return Decoration.set(decos, true);
}

export function livePreview(resolver: ImageResolver): Extension {
  return [tableField, livePreviewPlugin(resolver)];
}

function livePreviewPlugin(resolver: ImageResolver) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, resolver);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
          this.decorations = build(u.view, resolver);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export const livePreviewTheme = EditorView.baseTheme({
  ".cm-md-h1": { paddingTop: "0.5em" },
  ".cm-md-h2": { paddingTop: "0.4em" },
  ".cm-md-h3": { paddingTop: "0.3em" },
  ".cm-md-code": { backgroundColor: "var(--surface-2)", borderRadius: "4px", padding: "1px 3px" },
  ".cm-md-link": { color: "var(--syn-link)", textDecoration: "underline", textDecorationColor: "var(--accent-soft)", textUnderlineOffset: "3px", cursor: "pointer" },
  ".cm-md-task": { margin: "0 6px 0 0", verticalAlign: "middle", width: "15px", height: "15px", accentColor: "var(--accent)", cursor: "pointer" },
  ".cm-md-done": { color: "var(--text-3)", textDecoration: "line-through" },
  ".cm-md-bullet": { color: "var(--text-3)", fontWeight: "700", padding: "0 2px" },
  ".cm-md-hr": { display: "inline-block", width: "100%", height: "1px", verticalAlign: "middle", backgroundColor: "var(--border-strong)" },
  ".cm-md-quote": { borderLeft: "3px solid var(--border-strong)", paddingLeft: "14px !important", color: "var(--text-2)" },
  ".cm-md-codeblock": { backgroundColor: "var(--surface-2)", fontFamily: "var(--font-mono)", fontSize: "0.92em", padding: "0 12px !important" },
  ".cm-md-codeblock-first": { borderTopLeftRadius: "8px", borderTopRightRadius: "8px", paddingTop: "4px !important" },
  ".cm-md-codeblock-last": { borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px", paddingBottom: "4px !important" },
  ".cm-md-fence": { display: "inline-block", fontFamily: "var(--font-ui)", fontSize: "11px", color: "var(--text-3)", letterSpacing: "0.03em", textTransform: "lowercase" },
  ".cm-md-table": { margin: "6px 0", overflowX: "auto", cursor: "text" },
  ".cm-md-table table": { borderCollapse: "collapse", fontSize: "0.95em", minWidth: "40%" },
  ".cm-md-table th, .cm-md-table td": { border: "1px solid var(--border)", padding: "5px 12px" },
  ".cm-md-table th": { backgroundColor: "var(--surface-2)", fontWeight: "600" },
  ".cm-md-table tr:nth-child(even) td": { backgroundColor: "color-mix(in srgb, var(--surface-2) 55%, transparent)" },
  ".cm-md-table code": { fontFamily: "var(--font-mono)", fontSize: "0.92em", backgroundColor: "var(--surface-2)", borderRadius: "4px", padding: "1px 4px" },
  ".cm-md-image img": { maxWidth: "100%", maxHeight: "420px", borderRadius: "6px", display: "block", margin: "6px 0" },
});
