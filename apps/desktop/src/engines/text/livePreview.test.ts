import { describe, it, expect } from "vitest";
import { tableCells } from "./livePreview";

describe("Markdown table cells", () => {
  it("splits rows with or without outer pipes", () => {
    expect(tableCells("| a | b | c |")).toEqual(["a", "b", "c"]);
    expect(tableCells("a | b")).toEqual(["a", "b"]);
    expect(tableCells("|---|:-:|--:|")).toEqual(["---", ":-:", "--:"]);
  });
  it("keeps escaped pipes inside a cell", () => {
    expect(tableCells("| a \\| b | c |")).toEqual(["a | b", "c"]);
  });
  it("keeps empty cells", () => {
    expect(tableCells("| a |  | c |")).toEqual(["a", "", "c"]);
  });
});
