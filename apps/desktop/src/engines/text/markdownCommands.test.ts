// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { setHeading, toggleLinePrefix, insertLink, insertBlock, toggleWrap, exitListOnEmptyItem, tableNextCell, tableEnter, tableCells } from "./markdownCommands";

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

  it("Bold with nothing selected formats the word at the cursor", () => {
    const v = view("make this bold", 7);
    toggleWrap(v, "**");
    expect(v.state.doc.toString()).toBe("make **this** bold");
    const empty = view("end ", 4);
    toggleWrap(empty, "**");
    expect(empty.state.doc.toString()).toBe("end ****");
    expect(empty.state.selection.main.head).toBe(6);
  });

  it("Enter on an empty list item ends the list with a blank line", () => {
    const v = view("- Mitochondria\n- ");
    expect(exitListOnEmptyItem(v)).toBe(true);
    v.dispatch(v.state.replaceSelection("Next paragraph"));
    expect(v.state.doc.toString()).toBe("- Mitochondria\n\nNext paragraph");
    // Not for a nested item (the editor moves it out a level) or a line being typed on its own.
    expect(exitListOnEmptyItem(view("- a\n  - "))).toBe(false);
    expect(exitListOnEmptyItem(view("- "))).toBe(false);
    expect(exitListOnEmptyItem(view("text\n- "))).toBe(false);
  });

  it("finds the cells of a table row, with escaped pipes", () => {
    const t = "| a | b \\| c |  |";
    expect(tableCells(t).map((c) => t.slice(c.from, c.to))).toEqual(["a", "b \\| c", ""]);
  });

  it("Tab moves through table cells, skips the divider row and adds a row at the end", () => {
    const doc = "| Name | Qty |\n| --- | --- |\n| Pens | 3 |";
    const v = view(doc, 2);
    const selected = () => v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to);
    tableNextCell(v, 1);
    expect(selected()).toBe("Qty");
    tableNextCell(v, 1);
    expect(selected()).toBe("Pens");
    tableNextCell(v, -1);
    expect(selected()).toBe("Qty");
    tableNextCell(v, 1);
    tableNextCell(v, 1);
    expect(selected()).toBe("3");
    tableNextCell(v, 1);
    expect(v.state.doc.toString()).toBe(doc + "\n|  |  |");
    v.dispatch(v.state.replaceSelection("Ink"));
    expect(v.state.doc.toString()).toBe(doc + "\n| Ink |  |");
    expect(tableNextCell(view("plain text", 2), 1)).toBe(false);
  });

  it("Enter at the end of a table row adds a row; on an empty last row it leaves the table", () => {
    const v = view("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(tableEnter(v)).toBe(true);
    expect(v.state.doc.toString()).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |\n|  |  |");
    v.dispatch({ selection: { anchor: v.state.doc.length } });
    expect(tableEnter(v)).toBe(true);
    v.dispatch(v.state.replaceSelection("After"));
    expect(v.state.doc.toString()).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |\n\nAfter");
    expect(tableEnter(view("| a | b |", 3))).toBe(false);
  });

  it("Enter just after the last cell's text (before \" |\") adds a row instead of splitting it", () => {
    const doc = "| a | b |\n| --- | --- |\n| Alice | Notes |";
    const v = view(doc, doc.length - 2);
    expect(tableEnter(v)).toBe(true);
    expect(v.state.doc.toString()).toBe(doc + "\n|  |  |");
  });

  it("a header row still being typed (no | --- | row yet) is left to plain Enter and Tab", () => {
    expect(tableEnter(view("| Owner | Task | Due |"))).toBe(false);
    expect(tableNextCell(view("| Owner | Task | Due |", 3), 1)).toBe(false);
    // Once the delimiter row is there, it is a table.
    expect(tableEnter(view("| Owner | Task |\n|---|---|\n| Alice | Notes |"))).toBe(true);
  });

  it("Bold pressed again at the end of bold text steps out of it", () => {
    const v = view("");
    toggleWrap(v, "**");
    v.dispatch(v.state.replaceSelection("bold"));
    toggleWrap(v, "**");
    v.dispatch(v.state.replaceSelection(" normal"));
    expect(v.state.doc.toString()).toBe("**bold** normal");
  });
});
