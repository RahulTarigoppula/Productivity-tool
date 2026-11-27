import { describe, expect, it } from "vitest";
import { fixFontTable } from "./office-fonts.mjs";

// A small AllFonts.js: file list, then [name, regular, i, italic, i, bold, i, bold italic, i].
const table = (entries, files = 12) =>
  `window["__fonts_files"] = [\n${Array.from({ length: files }, (_, i) => `"${String(i).padStart(3, "0")}"`).join(",\n")}\n];\n` +
  `window["__fonts_infos"] = [\n${entries.map((e) => JSON.stringify(e)).join(",\n")}\n];\nwindow["__fonts_ranges"] = [];\n`;
const faces = (text, name) => {
  const m = new RegExp(`\\["${name}",([-0-9,]+)\\]`).exec(text);
  return m ? m[1].split(",").map(Number) : null;
};

describe("fixFontTable", () => {
  const shipped = new Set(["000", "001", "002", "003", "004", "005", "006", "007"]);
  const fix = (entries) => fixFontTable(table(entries), (f) => shipped.has(f)).text;

  it("points Office fonts at their metric twins and fills missing faces", () => {
    const out = fix([
      ["Liberation Sans", 0, 0, 1, 0, 2, 0, 3, 0],
      ["Carlito", 4, 0, -1, -1, -1, -1, -1, -1],
      ["Calibri", 10, 0, -1, -1, -1, -1, -1, -1],
    ]);
    // Carlito has only a regular face: italic, bold and bold italic borrow it.
    expect(faces(out, "Carlito")).toEqual([4, 0, 4, 0, 4, 0, 4, 0]);
    expect(faces(out, "Calibri")).toEqual([4, 0, 4, 0, 4, 0, 4, 0]);
    // Twins missing from the table are added (Arial → Liberation Sans).
    expect(faces(out, "Arial")).toEqual([0, 0, 1, 0, 2, 0, 3, 0]);
  });

  it("sends fonts of other writing systems to the shipped font of their script, not a Latin one", () => {
    const out = fix([
      ["Liberation Sans", 0, 0, 1, 0, 2, 0, 3, 0],
      ["Droid Sans Fallback", 5, 0, -1, -1, -1, -1, -1, -1],
      ["Lohit Bengali", 6, 0, -1, -1, -1, -1, -1, -1],
      ["NanumSquare", 7, 0, -1, -1, -1, -1, -1, -1],
      ["NanumSquare Bold", 4, 0, -1, -1, -1, -1, -1, -1],
      ["SimSun", 11, 0, -1, -1, -1, -1, -1, -1],
      ["Ani", 9, 0, -1, -1, -1, -1, -1, -1],
      ["Some Display Face", 8, 0, -1, -1, -1, -1, -1, -1],
    ]);
    expect(faces(out, "SimSun")[0]).toBe(5);
    // "Ani" is a Bengali font (known from its character map), not a Latin one.
    expect(faces(out, "Ani")[0]).toBe(6);
    expect(faces(out, "Some Display Face")[0]).toBe(0);
    // "X" and "X Bold" become one family; Korean names point at it, bold included.
    expect(faces(out, "NanumSquare")).toEqual([7, 0, 7, 0, 4, 0, 4, 0]);
    expect(faces(out, "Malgun Gothic")).toEqual([7, 0, 7, 0, 4, 0, 4, 0]);
    // Windows names for a script are added: Vrinda (Bengali), Microsoft YaHei (Chinese).
    expect(faces(out, "Vrinda")[0]).toBe(6);
    expect(faces(out, "Microsoft YaHei")[0]).toBe(5);
  });

  it("uses a readable Latin font when the script's own font is not in the pack", () => {
    const out = fix([
      ["Liberation Sans", 0, 0, 1, 0, 2, 0, 3, 0],
      ["Mangal", 9, 0, -1, -1, -1, -1, -1, -1],
    ]);
    expect(faces(out, "Mangal")).toEqual([0, 0, 1, 0, 2, 0, 3, 0]);
    // Script names are only added when their font ships.
    expect(faces(out, "Kokila")).toBeNull();
  });

  it("leaves complete families and the file list alone", () => {
    const src = table([["Liberation Sans", 0, 0, 1, 0, 2, 0, 3, 0]]);
    const { text, changed } = fixFontTable(src, (f) => shipped.has(f));
    expect(faces(text, "Liberation Sans")).toEqual([0, 0, 1, 0, 2, 0, 3, 0]);
    expect(text.slice(0, text.indexOf("__fonts_infos"))).toBe(src.slice(0, src.indexOf("__fonts_infos")));
    expect(changed.every((n) => n.startsWith("+"))).toBe(true);
  });
});
