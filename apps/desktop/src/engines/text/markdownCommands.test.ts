// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { setHeading, toggleLinePrefix, insertLink, insertBlock } from "./markdownCommands";

// jsdom has no layout; the editor measures text on the next frame.
const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

const views: EditorView[] = [];
afterEach(() => views.splice(0).forEach((v) => v.destroy()));

function view(doc: string, anchor = doc.length, head = anchor) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const v = new EditorView({ parent, state: EditorState.create({ doc, selection: { anchor, head } }) });
  views.push(v);
  return v;
}

describe("Markdown commands", () => {
  it("a heading replaces a quote, list or task marker", () => {
    for (const [src, want] of [
      ["> Quote", "# Quote"],
      ["- item", "# item"],
      ["1. step", "# step"],
      ["- [ ] task", "# task"],
      ["## Title", "# Title"],
      ["# Title", "Title"],
      ["> > nested", "# nested"],
      ["> # Title", "# Title"],
      ["> - item", "# item"],
      ["  3) third", "# third"],
      ["-", "# "],
      ["#hashtag", "# #hashtag"],
      ["1.5 million", "# 1.5 million"],
    ]) {
      const v = view(src, 0);
      setHeading(v, 1);
      expect(v.state.doc.toString()).toBe(want);
    }
  });

  it("decides once for a whole selection and leaves dividers alone", () => {
    const v = view("# a\n- b\n---\n> c", 0, 15);
    setHeading(v, 1);
    expect(v.state.doc.toString()).toBe("# a\n# b\n---\n# c");
    setHeading(v, 1);
    expect(v.state.doc.toString()).toBe("a\nb\n---\nc");
  });

  it("list markers leave the cursor after the marker", () => {
    const v = view("", 0);
    toggleLinePrefix(v, "- [ ] ");
    v.dispatch(v.state.replaceSelection("abc"));
    expect(v.state.doc.toString()).toBe("- [ ] abc");
  });

  it("a new link selects its placeholder text", () => {
    const v = view("", 0);
    insertLink(v);
    const { from, to } = v.state.selection.main;
    expect(v.state.sliceDoc(from, to)).toBe("link text");
    v.dispatch(v.state.replaceSelection("Docs"));
    expect(v.state.doc.toString()).toBe("[Docs]()");
  });

  it("a link around selected text puts the cursor in the address", () => {
    const v = view("see docs", 4, 8);
    insertLink(v);
    v.dispatch(v.state.replaceSelection("https://example.com"));
    expect(v.state.doc.toString()).toBe("see [docs](https://example.com)");
  });

  it("insert table selects the first heading", () => {
    const v = view("", 0);
    insertBlock(v, "| Column | Column |\n| --- | --- |\n|  |  |\n", 2, 6);
    const { from, to } = v.state.selection.main;
    expect(v.state.sliceDoc(from, to)).toBe("Column");
  });
});
