/** Typora-style live Markdown: syntax marks are hidden on lines the cursor is not on,
 *  so headings, emphasis, links, task boxes and images read as formatted text.
 *  The document text itself is never changed by this view. */
import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { type EditorState, type Range } from "@codemirror/state";

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
          for (let pos = node.from; pos <= node.to; ) {
            const line = state.doc.lineAt(pos);
            decos.push(Decoration.line({ class: "cm-md-codeblock" }).range(line.from));
            pos = line.to + 1;
          }
          return;
        }
      },
    });
  }
  return Decoration.set(decos, true);
}

export function livePreview(resolver: ImageResolver) {
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
  ".cm-md-image img": { maxWidth: "100%", maxHeight: "420px", borderRadius: "6px", display: "block", margin: "6px 0" },
});
