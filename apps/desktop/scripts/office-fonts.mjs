// Makes every font name the Office editors can pick resolve to a font file the pack ships.
//
// The editors' font table (sdkjs/common/AllFonts.js) lists each family's four faces (regular,
// italic, bold, bold italic) as indexes into the font file list. The pack ships only a core set of
// files, and some families come with a single face (Calibri: regular only). When a document asks
// for a face that is missing, the editors choose a substitute on their own, and that choice can be a
// symbol font: headings in Calibri bold then show as "= ÄJ ³ºX³". This keeps the table honest:
//   1. Office's common fonts use their metric-compatible open twins (Calibri → Carlito,
//      Cambria → Caladea, ...), so layout and line breaks match the original.
//   2. A missing face borrows the nearest face of the same family (bold → bold italic → regular).
//   3. A family with no shipped file at all uses a shipped family of the same kind.
// New names are appended, so the indexes other tables use for existing entries stay the same.
//
// Usage: node scripts/office-fonts.mjs <pack dir>   (patches an existing pack in place)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Office font → open font with the same widths. Only used when that open font is shipped. */
export const METRIC_TWINS = {
  Calibri: "Carlito",
  "Calibri Light": "Carlito",
  Cambria: "Caladea",
  Arial: "Liberation Sans",
  Helvetica: "Liberation Sans",
  "Arial Narrow": "Liberation Sans Narrow",
  "Times New Roman": "Liberation Serif",
  Times: "Liberation Serif",
  "Courier New": "Liberation Mono",
  Courier: "Liberation Mono",
  Aptos: "Liberation Sans",
  "Aptos Display": "Liberation Sans",
  "Aptos Narrow": "Liberation Sans Narrow",
  "Segoe UI": "Open Sans",
  Verdana: "DejaVu Sans",
  Tahoma: "DejaVu Sans",
  Georgia: "DejaVu Serif",
  Consolas: "DejaVu Sans Mono",
  "Lucida Console": "DejaVu Sans Mono",
};

const KIND_FALLBACK = { mono: "Liberation Mono", serif: "Liberation Serif", sans: "Liberation Sans", symbol: "OpenSymbol" };

function kindOf(name) {
  if (/symbol|wingding|webding|dings|emoji|math|ascw/i.test(name)) return "symbol";
  if (/mono|courier|consol|code|typewriter|fixed/i.test(name)) return "mono";
  if (/sans/i.test(name)) return "sans";
  if (/serif|times|roman|georgia|garamond|cambria|caladea|book|palatino|minion|schoolbook|baskerville|mincho|song|ming/i.test(name)) return "serif";
  return "sans";
}

const ENTRY = /\["((?:[^"\\]|\\.)*)",\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/g;
const START = 'window["__fonts_infos"] = [';

/**
 * @param {string} text AllFonts.js
 * @param {(file: string) => boolean} isShipped whether a font file (by its list name) is in the pack
 * @returns {{ text: string, changed: string[] }}
 */
export function fixFontTable(text, isShipped) {
  const head = text.indexOf(START);
  if (head < 0) throw new Error("Font table not found in AllFonts.js");
  const files = [...text.slice(0, head).matchAll(/"(\d{3})"/g)].map((m) => m[1]);
  const end = text.indexOf("];", head);
  const body = text.slice(head + START.length, end);
  const entries = [...body.matchAll(ENTRY)].map((m) => ({ name: m[1], faces: m.slice(2).map(Number) }));
  if (!entries.length) throw new Error("Font table is empty");
  const byName = new Map(entries.map((e) => [e.name, e]));
  const shipped = (i) => i >= 0 && i < files.length && isShipped(files[i]);
  const complete = (f) => [0, 2, 4, 6].every((s) => shipped(f[s]));
  const anyShipped = (f) => [0, 2, 4, 6].some((s) => shipped(f[s]));
  // Nearest face to borrow for each slot: regular, italic, bold, bold italic.
  const ORDER = { 0: [0, 4, 2, 6], 2: [2, 0, 6, 4], 4: [4, 6, 0, 2], 6: [6, 4, 2, 0] };
  const fill = (f) => {
    const out = [...f];
    for (const s of [0, 2, 4, 6]) {
      if (shipped(f[s])) continue;
      const from = ORDER[s].find((o) => shipped(f[o]));
      if (from !== undefined) [out[s], out[s + 1]] = [f[from], f[from + 1]];
    }
    return out;
  };
  const twinFaces = (name) => {
    const twin = byName.get(METRIC_TWINS[name] ?? "");
    return twin && anyShipped(twin.faces) ? fill(twin.faces) : null;
  };

  const changed = [];
  for (const e of entries) {
    if (complete(e.faces)) continue;
    const before = e.faces.join();
    e.faces = twinFaces(e.name) ?? (anyShipped(e.faces) ? fill(e.faces) : fill(byName.get(KIND_FALLBACK[kindOf(e.name)])?.faces ?? e.faces));
    if (e.faces.join() !== before) changed.push(e.name);
  }
  const added = [];
  for (const name of Object.keys(METRIC_TWINS)) {
    if (byName.has(name)) continue;
    const faces = twinFaces(name);
    if (faces) added.push({ name, faces });
  }
  const line = (e) => `["${e.name}",${e.faces.join(",")}]`;
  const table = [...entries, ...added].map(line).join(",\n");
  return {
    text: `${text.slice(0, head + START.length)}\n${table}\n${text.slice(end)}`,
    changed: [...changed, ...added.map((a) => `+${a.name}`)],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pack = process.argv[2];
  if (!pack) throw new Error("Usage: node scripts/office-fonts.mjs <pack dir>");
  const file = join(pack, "sdkjs/common/AllFonts.js");
  const have = new Set(readdirSync(join(pack, "fonts")));
  const raw = readFileSync(file, "utf8");
  const bom = raw.startsWith("﻿") ? "﻿" : "";
  const { text, changed } = fixFontTable(raw.slice(bom.length), (f) => have.has(f));
  writeFileSync(file, bom + text);
  console.log(`font table: ${changed.length} names adjusted (${changed.slice(0, 12).join(", ")}${changed.length > 12 ? ", ..." : ""})`);
}
