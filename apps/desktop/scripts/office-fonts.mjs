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
//   3. A family with no shipped file at all uses a shipped family of the same kind; fonts for other
//      writing systems use the shipped font of their script (office-font-scripts.json), never a
//      Latin one, which would draw boxes.
//   4. The usual Windows and Mac font names for each script are added, pointing at that font.
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

const KIND_FALLBACK = {
  mono: "Liberation Mono", serif: "Liberation Serif", sans: "Liberation Sans", symbol: "OpenSymbol",
  cjk: "Droid Sans Fallback", korean: "NanumSquare", devanagari: "Lohit Devanagari", bengali: "Lohit Bengali", tamil: "Lohit Tamil",
  gujarati: "Lohit Gujarati", gurmukhi: "Lohit Gurmukhi", kannada: "Lohit Kannada", malayalam: "Lohit Malayalam",
  telugu: "Lohit Telugu", odia: "Lohit Odia", khmer: "Khmer OS", sinhala: "Noto Serif Sinhala",
  ethiopic: "Abyssinica SIL", myanmar: "Padauk", mongolian: "Noto Sans Mongolian", arabic: "Noto Naskh Arabic",
};

/** Fonts for other writing systems go to a shipped font of the same script, never to a Latin one
 *  (which would draw boxes). Names cover common Windows, macOS and open fonts for each script. */
const SCRIPT_FONTS = [
  ["korean", /batang|gulim|dotum|gungsuh|malgun|nanum|apple ?sd ?gothic|\bkr\b|korean|hangul/i],
  ["cjk", /yahei|simsun|nsimsun|simhei|kaiti|fangsong|dengxian|mingliu|pmingliu|jhenghei|mincho|ms ?p?gothic|meiryo|yu ?gothic|yu ?mincho|hiragino|pingfang|heiti|songti|ar pl|cjk|source han|wenquanyi|droid sans fallback|ukai|uming|\bsong\b|\bhei\b|\bkai\b/i],
  ["devanagari", /devanagari|mangal|kokila|aparajita|utsaah|sanskrit/i],
  ["bengali", /bengali|bangla|vrinda|shonar/i],
  ["tamil", /tamil|latha|vijaya/i],
  ["gujarati", /gujarati|shruti/i],
  ["gurmukhi", /gurmukhi|raavi/i],
  ["kannada", /kannada|tunga/i],
  ["malayalam", /malayalam|kartika/i],
  ["telugu", /telugu|gautami|vani/i],
  ["odia", /odia|oriya|kalinga/i],
  ["khmer", /khmer|daunpenh|moolboran/i],
  ["sinhala", /sinhala|iskoola/i],
  ["ethiopic", /ethiopic|abyssinica|nyala|amharic|ebrima/i],
  ["myanmar", /myanmar|padauk/i],
  ["mongolian", /mongolian/i],
];

/** Default fonts of Windows, Office and macOS for each writing system. Documents name them, and
 *  when a name is missing from the table the editors may draw boxes, so each one is added and
 *  pointed at the shipped font of its script. */
const SCRIPT_NAMES = {
  cjk: ["Microsoft YaHei", "Microsoft YaHei UI", "SimSun", "NSimSun", "SimHei", "KaiTi", "FangSong", "DengXian", "Microsoft JhengHei", "MingLiU", "PMingLiU", "MS Mincho", "MS PMincho", "MS Gothic", "MS PGothic", "Meiryo", "Meiryo UI", "Yu Gothic", "Yu Mincho", "Hiragino Sans", "Hiragino Mincho ProN", "PingFang SC", "PingFang TC", "Songti SC", "Heiti SC"],
  korean: ["Malgun Gothic", "Batang", "BatangChe", "Gulim", "GulimChe", "Dotum", "DotumChe", "Gungsuh", "Apple SD Gothic Neo"],
  devanagari: ["Mangal", "Kokila", "Aparajita", "Utsaah", "Nirmala UI"],
  bengali: ["Vrinda", "Shonar Bangla"],
  tamil: ["Latha", "Vijaya"],
  gujarati: ["Shruti"],
  gurmukhi: ["Raavi"],
  kannada: ["Tunga"],
  malayalam: ["Kartika"],
  telugu: ["Gautami", "Vani"],
  odia: ["Kalinga"],
  khmer: ["Khmer UI", "DaunPenh", "MoolBoran"],
  sinhala: ["Iskoola Pota"],
  ethiopic: ["Nyala", "Ebrima"],
  myanmar: ["Myanmar Text"],
  mongolian: ["Mongolian Baiti"],
};

/** Writing system of each font in the pinned font set that is made for one (read from the fonts'
 *  character maps when the font set was pinned). The editors substitute these by name for text in
 *  that script, so an unshipped one must lead to the shipped font of the same script. */
const FONT_SCRIPTS = new Map(
  Object.entries(JSON.parse(readFileSync(new URL("./office-font-scripts.json", import.meta.url), "utf8"))).flatMap(([kind, names]) => names.map((n) => [n, kind])),
);

function kindOf(name) {
  if (FONT_SCRIPTS.has(name)) return FONT_SCRIPTS.get(name);
  for (const [kind, re] of SCRIPT_FONTS) if (re.test(name)) return kind;
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

  // Families shipped as separate "X" and "X Bold" entries (NanumSquare) become one family.
  for (const e of entries) {
    const bold = byName.get(`${e.name} Bold`);
    if (!bold || !shipped(bold.faces[0])) continue;
    for (const s of [4, 6]) if (!shipped(e.faces[s])) [e.faces[s], e.faces[s + 1]] = [bold.faces[0], bold.faces[1]];
  }

  const changed = [];
  for (const e of entries) {
    if (complete(e.faces)) continue;
    const before = e.faces.join();
    const kindFaces = (name) => {
      const own = byName.get(KIND_FALLBACK[kindOf(name)]);
      // A script font whose fallback is not shipped either still gets a readable Latin font.
      return own && anyShipped(own.faces) ? own.faces : byName.get(KIND_FALLBACK.sans)?.faces;
    };
    e.faces = twinFaces(e.name) ?? (anyShipped(e.faces) ? fill(e.faces) : fill(kindFaces(e.name) ?? e.faces));
    if (e.faces.join() !== before) changed.push(e.name);
  }
  const added = [];
  for (const name of Object.keys(METRIC_TWINS)) {
    if (byName.has(name)) continue;
    const faces = twinFaces(name);
    if (faces) added.push({ name, faces });
  }
  for (const [kind, names] of Object.entries(SCRIPT_NAMES)) {
    const own = byName.get(KIND_FALLBACK[kind]);
    if (!own || !anyShipped(own.faces)) continue;
    for (const name of names) if (!byName.has(name) && !added.some((a) => a.name === name)) added.push({ name, faces: fill(own.faces) });
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
