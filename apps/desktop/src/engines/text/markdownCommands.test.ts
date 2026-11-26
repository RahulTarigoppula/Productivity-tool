// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { setHeading, toggleLinePrefix, insertLink, insertBlock } from "./markdownCommands";

function view(doc: string, anchor = doc.length, head = anchor) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({ parent, state: EditorState.create({ doc, selection: { anchor, head } }) });
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
    ]) {
      const v = view(src, 0);
      setHeading(v, 1);
      expect(v.state.doc.toString()).toBe(want);
    }
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
