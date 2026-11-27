/** Word (.docx) → Markdown, offline. Keeps headings, paragraphs, bold, italic, strikethrough and
 *  code, links, bullet and numbered lists (nested, with their numbers), task boxes, quotes, code
 *  blocks, tables, dividers and footnotes. Images become placeholders that keep their description.
 *  Page layout, fonts, colours, headers and footers, comments and tracked deletions are left out. */
import { marked, type Token } from "marked";
import { openZip, readPart } from "../engines/office/ooxml";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

// ---------- small XML helpers ----------

const kids = (el: Element) => Array.from(el.children);
const MAX_TABLE_COLS = 200;
const isW = (el: Element, name: string) => el.namespaceURI === W && el.localName === name;
const child = (el: Element | null | undefined, name: string): Element | null => (el ? kids(el).find((c) => isW(c, name)) ?? null : null);
const wAttr = (el: Element | null | undefined, name: string): string | null => (el && el.hasAttributeNS(W, name) ? el.getAttributeNS(W, name) : null);
/** A Word on/off property: present means on unless its value says otherwise. */
const on = (el: Element | null): boolean | undefined => (el ? !/^(0|false|off|none)$/i.test(wAttr(el, "val") ?? "") : undefined);
/** Strict Open XML files use other namespace names for the same vocabulary. */
const STRICT: [string, string][] = [
  ["http://purl.oclc.org/ooxml/wordprocessingml/main", "http://schemas.openxmlformats.org/wordprocessingml/2006/main"],
  ["http://purl.oclc.org/ooxml/officeDocument/relationships", "http://schemas.openxmlformats.org/officeDocument/2006/relationships"],
  ["http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"],
  ["http://purl.oclc.org/ooxml/drawingml/main", "http://schemas.openxmlformats.org/drawingml/2006/main"],
  ["http://purl.oclc.org/ooxml/officeDocument/math", "http://schemas.openxmlformats.org/officeDocument/2006/math"],
];
const parse = (xml: string) => {
  for (const [strict, transitional] of STRICT) if (xml.includes(strict)) xml = xml.split(strict).join(transitional);
  return new DOMParser().parseFromString(xml, "application/xml");
};
/** mc:AlternateContent offers the same content several ways; use the first choice only. */
const pickAlternate = (el: Element) => kids(el).find((c) => c.localName === "Choice") ?? kids(el).find((c) => c.localName === "Fallback") ?? null;
const isAlternate = (el: Element) => el.namespaceURI === MC && el.localName === "AlternateContent";

// ---------- formatting ----------

interface Fmt {
  b?: boolean;
  i?: boolean;
  s?: boolean;
  code?: boolean;
  hidden?: boolean;
}

const MONO = /^(consolas|courier( new)?|menlo|monaco|lucida (console|sans typewriter)|source code pro|fira (code|mono)|cascadia (code|mono)|jetbrains mono|dejavu sans mono|liberation mono|roboto mono|ubuntu mono|sf mono|inconsolata|andale mono|noto (sans )?mono|ibm plex mono|monospace)$/i;

function rprFmt(rPr: Element | null): Fmt {
  if (!rPr) return {};
  const f: Fmt = {};
  const b = on(child(rPr, "b"));
  if (b !== undefined) f.b = b;
  const i = on(child(rPr, "i"));
  if (i !== undefined) f.i = i;
  const s1 = on(child(rPr, "strike")), s2 = on(child(rPr, "dstrike"));
  if (s1 !== undefined || s2 !== undefined) f.s = !!(s1 || s2);
  const fonts = child(rPr, "rFonts");
  const face = wAttr(fonts, "ascii") ?? wAttr(fonts, "hAnsi");
  if (face) f.code = MONO.test(face.trim());
  const v = on(child(rPr, "vanish"));
  if (v !== undefined) f.hidden = v;
  return f;
}

// ---------- styles ----------

interface ParaKind {
  heading?: number;
  quote?: boolean;
  code?: boolean;
  toc?: boolean;
  listCont?: boolean;
}

interface Style {
  type: string;
  name: string;
  basedOn?: string;
  outline?: number;
  numId?: string;
  ilvl?: number;
  fmt: Fmt;
  kind: ParaKind | null;
}

/** Recognised by the style's name, which Word keeps in English even in other languages. */
function kindOf(name: string, id: string, type: string): ParaKind | null {
  const n = name.trim().toLowerCase();
  if (type === "character") return /code|verbatim|html (keyboard|typewriter|sample)/.test(n) ? { code: true } : null;
  const h = /^heading\s*([1-9])$/.exec(n) ?? /^heading([1-9])$/i.exec(id);
  if (h) return { heading: Math.min(6, Number(h[1])) };
  if (n === "title") return { heading: 1 };
  if (/^(toc\s*\d|toc heading|table of figures)$/.test(n)) return { toc: true };
  if (/quot(e|ations?)\b|block text/.test(n)) return { quote: true };
  if (/^(code|code block|source code|html preformatted|preformatted( text)?|plain text|macro text)$/.test(n)) return { code: true };
  if (/^list (paragraph|continue)/.test(n)) return { listCont: true };
  return null;
}

class Styles {
  private map = new Map<string, Style>();
  private memo = new Map<string, ReturnType<Styles["build"]>>();
  defaultPara?: string;
  /** When normal text is already set in a typewriter font, a font alone does not mean code. */
  monoIsNormal = false;

  constructor(doc: Document | null) {
    if (!doc) return;
    for (const s of Array.from(doc.getElementsByTagNameNS(W, "style"))) {
      const id = wAttr(s, "styleId");
      if (!id) continue;
      const type = wAttr(s, "type") ?? "paragraph";
      const name = wAttr(child(s, "name"), "val") ?? id;
      const pPr = child(s, "pPr");
      const numPr = child(pPr, "numPr");
      const ol = wAttr(child(pPr, "outlineLvl"), "val");
      this.map.set(id, {
        type,
        name,
        basedOn: wAttr(child(s, "basedOn"), "val") ?? undefined,
        outline: ol !== null ? Number(ol) : undefined,
        numId: wAttr(child(numPr, "numId"), "val") ?? undefined,
        ilvl: numPr ? Number(wAttr(child(numPr, "ilvl"), "val") ?? 0) : undefined,
        fmt: rprFmt(child(s, "rPr")),
        kind: kindOf(name, id, type),
      });
      if (type === "paragraph" && /^(1|true|on)$/i.test(wAttr(s, "default") ?? "")) this.defaultPara = id;
    }
    this.monoIsNormal = !!this.get(this.defaultPara).fmt.code;
  }

  private build(id: string | undefined) {
    const chain: Style[] = [];
    const seen = new Set<string>();
    for (let cur = id; cur && !seen.has(cur) && chain.length < 20; ) {
      seen.add(cur);
      const s = this.map.get(cur);
      if (!s) break;
      chain.push(s);
      cur = s.basedOn;
    }
    let fmt: Fmt = {};
    for (const s of [...chain].reverse()) fmt = { ...fmt, ...s.fmt };
    const numbered = chain.find((s) => s.numId !== undefined);
    return {
      fmt,
      kind: chain.map((s) => s.kind).find(Boolean) ?? {},
      outline: chain.map((s) => s.outline).find((v) => v !== undefined),
      numId: numbered?.numId,
      ilvl: numbered?.ilvl ?? 0,
    };
  }

  get(id: string | undefined) {
    const key = id ?? "";
    let r = this.memo.get(key);
    if (!r) this.memo.set(key, (r = this.build(id)));
    return r;
  }
}

// ---------- numbering ----------

interface Level {
  fmt: string;
  start: number;
}

class Numbering {
  private abs = new Map<string, Map<number, Level>>();
  private absLink = new Map<string, string>();
  private nums = new Map<string, { abs: string; starts: Map<number, number>; lvls: Map<number, Level> }>();
  private counters = new Map<string, { counts: number[]; seen: Set<string> }>();

  constructor(doc: Document | null, private styles: Styles) {
    if (!doc) return;
    const level = (l: Element): [number, Level] => [
      Number(wAttr(l, "ilvl") ?? 0),
      { fmt: wAttr(child(l, "numFmt"), "val") ?? "decimal", start: Number(wAttr(child(l, "start"), "val") ?? 1) || 0 },
    ];
    for (const a of Array.from(doc.getElementsByTagNameNS(W, "abstractNum"))) {
      const id = wAttr(a, "abstractNumId") ?? "";
      this.abs.set(id, new Map(kids(a).filter((c) => isW(c, "lvl")).map(level)));
      const link = wAttr(child(a, "numStyleLink"), "val");
      if (link) this.absLink.set(id, link);
    }
    for (const n of Array.from(doc.getElementsByTagNameNS(W, "num"))) {
      const id = wAttr(n, "numId") ?? "";
      const starts = new Map<number, number>();
      const lvls = new Map<number, Level>();
      for (const o of kids(n).filter((c) => isW(c, "lvlOverride"))) {
        const ilvl = Number(wAttr(o, "ilvl") ?? 0);
        const so = wAttr(child(o, "startOverride"), "val");
        if (so !== null) starts.set(ilvl, Number(so));
        const lvl = child(o, "lvl");
        if (lvl) lvls.set(ilvl, level(lvl)[1]);
      }
      this.nums.set(id, { abs: wAttr(child(n, "abstractNumId"), "val") ?? "", starts, lvls });
    }
  }

  level(numId: string, ilvl: number): (Level & { abs: string }) | null {
    const n = this.nums.get(numId);
    if (!n) return null;
    const own = n.lvls.get(ilvl);
    if (own) return { ...own, abs: n.abs };
    let levels = this.abs.get(n.abs);
    if (!levels?.size && this.absLink.has(n.abs)) {
      // A list style: its levels live with the numbering its style points to.
      const linked = this.styles.get(this.absLink.get(n.abs)).numId;
      const other = linked && linked !== numId ? this.nums.get(linked) : undefined;
      if (other) levels = this.abs.get(other.abs);
    }
    const l = levels?.get(ilvl);
    return l ? { ...l, abs: n.abs } : null;
  }

  /** The number Word shows for the next item: lists sharing a definition continue unless restarted. */
  next(numId: string, ilvl: number, lvl: Level & { abs: string }): number {
    let st = this.counters.get(lvl.abs);
    if (!st) this.counters.set(lvl.abs, (st = { counts: [], seen: new Set() }));
    const key = `${numId}:${ilvl}`;
    if (!st.seen.has(key)) {
      st.seen.add(key);
      const restart = this.nums.get(numId)?.starts.get(ilvl);
      if (restart !== undefined) st.counts[ilvl] = restart - 1;
    }
    if (st.counts[ilvl] === undefined) st.counts[ilvl] = lvl.start - 1;
    st.counts[ilvl]++;
    const n = st.counts[ilvl];
    st.counts.length = ilvl + 1;
    return n;
  }
}

// ---------- inline text ----------

interface Seg {
  text: string;
  fmt: Fmt;
  link?: string;
  /** Already Markdown (a footnote mark): never escaped. */
  raw?: boolean;
}

const WORD = /[\p{L}\p{N}]/u;

/** Escape what Markdown would read as formatting, keeping ordinary text readable. */
function escapeText(t: string): string {
  return t
    .replace(/[\\`*[\]~]/g, "\\$&")
    .replace(/_/g, (m, off: number, s: string) => (WORD.test(s[off - 1] ?? "") && WORD.test(s[off + 1] ?? "") ? m : "\\_"))
    .replace(/<(?=[A-Za-z/!?])/g, "\\<")
    .replace(/&(?=#?[A-Za-z0-9]+;)/g, "\\&");
}

/** What would start a heading, list, quote or divider at the start of a line. */
function escapeLineStart(line: string): string {
  return line
    .replace(/^(#{1,6})(?=\s|$)/, "\\$1")
    .replace(/^([-+])(?=\s|$)/, "\\$1")
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, "$1\\$2")
    .replace(/^>/, "\\>")
    .replace(/^(=+|-+)\s*$/, "\\$1");
}

function codeSpan(t: string): string {
  const longest = (t.match(/`+/g) ?? []).reduce((n, r) => Math.max(n, r.length), 0);
  const fence = "`".repeat(longest + 1);
  const pad = /^`|`$/.test(t) || (/^ /.test(t) && / $/.test(t)) ? " " : "";
  return fence + pad + t + pad + fence;
}

function destination(url: string): string {
  return /[\s()<>]/.test(url) ? `<${url.replace(/[<>\n]/g, (c) => encodeURIComponent(c))}>` : url;
}

const sameFmt = (a: Fmt, b: Fmt) => !!a.b === !!b.b && !!a.i === !!b.i && !!a.s === !!b.s && !!a.code === !!b.code;

type Marker = "**" | "*" | "~~";
const TAG: Record<Marker, string> = { "**": "strong", "*": "em", "~~": "del" };

/** Emphasis for a run of segments, nested properly. Markdown markers where they read back the
 *  same; otherwise (formatting that changes inside a word, next to punctuation) HTML tags. */
function emphasis(segs: Seg[]): string {
  const build = (html: boolean) => {
    let out = "";
    let pend = "";
    const stack: Marker[] = [];
    const open = (m: Marker) => (html ? `<${TAG[m]}>` : m);
    const shut = (m: Marker) => (html ? `</${TAG[m]}>` : m);
    for (const g of segs) {
      const want: Marker[] = [];
      if (!g.raw) {
        if (g.fmt.b) want.push("**");
        if (g.fmt.i) want.push("*");
        if (g.fmt.s) want.push("~~");
      }
      let lead = "", core = "", trail = "";
      if (g.raw) core = g.text;
      else if (g.fmt.code) {
        const t = g.text.replace(/\n/g, " ");
        if (t.trim()) core = codeSpan(t);
        else lead = t;
      } else [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(escapeText(g.text))!;
      if (!core) {
        pend += lead + trail;
        continue;
      }
      const k = stack.findIndex((m) => !want.includes(m));
      if (k >= 0) while (stack.length > k) out += shut(stack.pop()!);
      out += pend + lead;
      pend = "";
      for (const m of want) if (!stack.includes(m)) (stack.push(m), (out += open(m)));
      out += core;
      pend = trail;
    }
    while (stack.length) out += shut(stack.pop()!);
    return out + pend;
  };
  const md = build(false);
  if (!/[*~]/.test(md.replace(/\\[*~]/g, "")) || readsBack(md, segs)) return md;
  return build(true);
}

/** Whether Markdown text parses back to the same characters with the same formatting. */
function readsBack(md: string, segs: Seg[]): boolean {
  const want: string[] = [];
  for (const s of segs) {
    if (s.raw) continue;
    const t = s.fmt.code ? s.text.replace(/\n/g, " ") : s.text;
    for (const ch of t) want.push(/\s/.test(ch) ? " " : `${ch}${s.fmt.b ? "b" : ""}${s.fmt.i ? "i" : ""}${s.fmt.s ? "s" : ""}`);
  }
  const got: string[] = [];
  const decode = (t: string) => t.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e as "amp"]);
  const walk = (tokens: Token[] | undefined, f: string) => {
    for (const t of tokens ?? []) {
      const tok = t as Token & { tokens?: Token[]; text?: string };
      if (t.type === "strong") walk(tok.tokens, f + "b");
      else if (t.type === "em") walk(tok.tokens, f + "i");
      else if (t.type === "del") walk(tok.tokens, f + "s");
      else if (t.type === "link") walk(tok.tokens, f);
      else if (t.type === "br") got.push(" ");
      else if (t.type === "codespan" || t.type === "escape" || t.type === "text") {
        if (t.type === "text" && tok.tokens?.length) walk(tok.tokens, f);
        else for (const ch of decode(tok.text ?? "")) got.push(/\s/.test(ch) ? " " : ch + [...f].sort().join(""));
      } else got.push("\u0000");
    }
  };
  // Footnote marks are left as written; compare only the text around them.
  walk(marked.Lexer.lexInline(md.replace(/\[\^e?\d+\]/g, ""), { gfm: true }), "");
  const norm = (a: string[]) => a.join("|").replace(/( \|?)+/g, " ").trim();
  return norm(got) === norm(want);
}

type Ctx = "para" | "heading" | "table";

function renderInline(input: Seg[], ctx: Ctx): string {
  const segs: Seg[] = [];
  for (const s of input) {
    if (s.fmt.hidden || !s.text) continue;
    const last = segs[segs.length - 1];
    if (last && !last.raw && !s.raw && last.link === s.link && sameFmt(last.fmt, s.fmt)) last.text += s.text;
    else segs.push({ ...s });
  }
  let out = "";
  for (let i = 0; i < segs.length; ) {
    let j = i + 1;
    while (j < segs.length && segs[j].link === segs[i].link) j++;
    const inner = emphasis(segs.slice(i, j));
    const link = segs[i].link;
    if (!link || !inner.trim()) out += inner;
    else {
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
      out += core === escapeText(link) && /^https?:/i.test(link) ? `${lead}<${link}>${trail}` : `${lead}[${core}](${destination(link)})${trail}`;
    }
    i = j;
  }
  out = out.replace(/^\s+|\s+$/g, "");
  if (ctx === "heading") return out.replace(/\s*\n\s*/g, " ").replace(/(\s)(#+)$/, "$1\\$2");
  if (ctx === "table") return out.replace(/\s*\n\s*/g, "<br>").replace(/\|/g, "\\|");
  return out
    .split(/[ \t]*\n[ \t]*/)
    .map((line) => escapeLineStart(line.trimStart()))
    .join("\\\n");
}

function safeUrl(u: string | undefined | null): string | undefined {
  const t = u?.trim();
  return t && /^(https?:|mailto:|tel:|ftp:)/i.test(t) ? t : undefined;
}

// ---------- the document ----------

type Block =
  | { kind: "para" | "heading" | "hr" | "table"; text: string }
  /** fresh: the first item of a new list right after another list, so a blank line separates them. */
  | { kind: "item"; text: string; fresh?: boolean }
  | { kind: "code"; lines: string[] }
  | { kind: "quote"; paras: string[] };

interface FieldState {
  depth: number;
  inCode: boolean;
  instr: string;
  link?: string;
}

class Converter {
  out: Block[] = [];
  /** Content column of each open list level, so nested items line up under their parent. */
  list: number[] = [];
  /** Which Word list the top-level items belong to. */
  private listKey = "";
  field: FieldState = { depth: 0, inCode: false, instr: "" };
  links = new Map<string, string>();
  notes: string[] = [];
  private extra: Element[] = [];

  constructor(private styles: Styles, private numbering: Numbering) {}

  blocks(container: Element): void {
    for (const el of kids(container)) {
      if (isW(el, "p")) this.para(el);
      else if (isW(el, "tbl")) {
        this.list = [];
        this.out.push({ kind: "table", text: this.table(el) });
      } else if (isW(el, "sdt")) {
        const gallery = wAttr(child(child(child(el, "sdtPr"), "docPartObj"), "docPartGallery"), "val") ?? "";
        // A table of contents repeats the headings with page numbers; the outline shows them.
        if (/table of contents/i.test(gallery)) continue;
        const content = child(el, "sdtContent");
        if (content) this.blocks(content);
      } else if (isW(el, "customXml") || isW(el, "ins") || isW(el, "moveTo")) this.blocks(el);
      else if (isAlternate(el)) {
        const pick = pickAlternate(el);
        if (pick) this.blocks(pick);
      }
    }
  }

  /** The inline content of a paragraph, as segments. */
  inline(el: Element, fmt: Fmt, link: string | undefined, out: Seg[]): void {
    for (const k of kids(el)) {
      if (isAlternate(k)) {
        const pick = pickAlternate(k);
        if (pick) this.inline(pick, fmt, link, out);
        continue;
      }
      if (k.namespaceURI === M) {
        if (k.localName === "oMath" || k.localName === "oMathPara") {
          const t = Array.from(k.getElementsByTagNameNS(M, "t")).map((x) => x.textContent ?? "").join("");
          if (t) out.push({ text: t, fmt: { ...fmt, code: true }, link });
        }
        continue;
      }
      if (k.namespaceURI !== W) continue;
      switch (k.localName) {
        case "r":
          this.run(k, fmt, link, out);
          break;
        case "hyperlink": {
          const id = k.getAttributeNS(R, "id");
          this.inline(k, fmt, safeUrl(id ? this.links.get(id) : undefined) ?? link, out);
          break;
        }
        case "fldSimple": {
          const m = /HYPERLINK\s+"([^"]+)"/i.exec(wAttr(k, "instr") ?? "");
          this.inline(k, fmt, safeUrl(m?.[1]) ?? link, out);
          break;
        }
        case "sdt": {
          const content = child(k, "sdtContent");
          if (content) this.inline(content, fmt, link, out);
          break;
        }
        case "ins":
        case "moveTo":
        case "smartTag":
        case "customXml":
        case "bdo":
        case "dir":
          this.inline(k, fmt, link, out);
          break;
        // Deletions, moved-away text, bookmarks and proofing marks show nothing.
      }
    }
  }

  private run(r: Element, base: Fmt, link: string | undefined, out: Seg[]): void {
    const rPr = child(r, "rPr");
    const charStyle = wAttr(child(rPr, "rStyle"), "val");
    const fmt: Fmt = { ...base };
    if (charStyle) {
      const st = this.styles.get(charStyle);
      Object.assign(fmt, st.fmt);
      if (st.kind.code) fmt.code = true;
    }
    Object.assign(fmt, rprFmt(rPr));
    if (this.styles.monoIsNormal && !(charStyle && this.styles.get(charStyle).kind.code)) fmt.code = false;
    if (fmt.hidden) return;
    const push = (text: string) => {
      if (this.field.inCode) return;
      out.push({ text, fmt, link: (this.field.link && safeUrl(this.field.link)) || link });
    };
    for (const k of kids(r)) {
      if (isAlternate(k)) {
        const pick = pickAlternate(k);
        if (pick) for (const d of kids(pick)) this.drawing(d, out, fmt);
        continue;
      }
      if (k.namespaceURI !== W) continue;
      switch (k.localName) {
        case "t":
          push(k.textContent ?? "");
          break;
        case "tab":
        case "ptab":
          push(" ");
          break;
        case "br":
        case "cr": {
          const type = wAttr(k, "type");
          if (type !== "page" && type !== "column") push("\n");
          break;
        }
        case "noBreakHyphen":
          push("-");
          break;
        case "fldChar": {
          const type = wAttr(k, "fldCharType");
          if (type === "begin") Object.assign(this.field, { depth: this.field.depth + 1, inCode: true, instr: "" });
          else if (type === "separate") Object.assign(this.field, { inCode: false, link: /HYPERLINK\s+"([^"]+)"/i.exec(this.field.instr)?.[1] });
          else if (type === "end") Object.assign(this.field, { depth: Math.max(0, this.field.depth - 1), inCode: false, link: undefined });
          break;
        }
        case "instrText":
          if (this.field.inCode) this.field.instr += k.textContent ?? "";
          break;
        case "footnoteReference":
        case "endnoteReference": {
          const id = wAttr(k, "id");
          if (id && !this.field.inCode) {
            const label = `${k.localName === "endnoteReference" ? "e" : ""}${id}`;
            out.push({ text: `[^${label}]`, fmt: {}, raw: true });
            if (!this.notes.includes(label)) this.notes.push(label);
          }
          break;
        }
        case "drawing":
        case "pict":
        case "object":
          this.drawing(k, out, fmt);
          break;
      }
    }
  }

  /** A picture becomes a placeholder with its description; a text box's text follows the paragraph. */
  private drawing(d: Element, out: Seg[], fmt: Fmt): void {
    // Only the outermost text boxes, and only one copy of each (Word stores a box twice, as a
    // Choice and a Fallback): a box inside a box is reached when its outer box is read. Taking
    // every nested box here repeated their text, doubling with each level.
    const boxes: Element[] = [];
    const find = (el: Element, depth: number) => {
      if (depth > 64) return;
      for (const c of kids(el)) {
        if (c.localName === "AlternateContent") {
          const pick = pickAlternate(c);
          if (pick) find(pick, depth + 1);
        } else if (c.localName === "txbxContent" && c.namespaceURI === W) boxes.push(c);
        else find(c, depth + 1);
      }
    };
    find(d, 0);
    this.extra.push(...boxes);
    const picture = d.getElementsByTagNameNS(A, "blip").length > 0 || d.getElementsByTagNameNS("urn:schemas-microsoft-com:vml", "imagedata").length > 0;
    const chart = Array.from(d.getElementsByTagNameNS(A, "graphicData")).some((g) => /chart/.test(g.getAttribute("uri") ?? ""));
    if (!picture && !chart && !(d.localName === "object")) return;
    const pr = d.getElementsByTagNameNS(WP, "docPr")[0];
    const desc = (pr?.getAttribute("descr") || pr?.getAttribute("title") || "").replace(/\s+/g, " ").trim();
    const what = chart ? "Chart" : d.localName === "object" ? "Embedded object" : "Image";
    out.push({ text: desc ? `[${what}: ${desc}]` : `[${what}]`, fmt: { ...fmt, i: true, b: false, code: false } });
  }

  private para(p: Element): void {
    // A field's instructions never run past their paragraph; a broken one must not hide the rest.
    this.field.inCode = false;
    const pPr = child(p, "pPr");
    const styleId = wAttr(child(pPr, "pStyle"), "val") ?? this.styles.defaultPara;
    const st = this.styles.get(styleId);
    const outline = wAttr(child(pPr, "outlineLvl"), "val");
    const level = outline !== null ? Number(outline) : st.outline;
    const heading = st.kind.heading ?? (level !== undefined && level >= 0 && level < 9 ? Math.min(6, level + 1) : undefined);
    if (st.kind.toc) return;
    // Headings are bold through their style already; only formatting added by hand carries over.
    const base: Fmt = heading ? {} : { ...st.fmt };
    if (this.styles.monoIsNormal) base.code = false;

    const segs: Seg[] = [];
    this.extra = [];
    this.inline(p, base, undefined, segs);
    const boxes = this.extra;
    const visible = segs.filter((s) => !s.fmt.hidden);
    const plain = visible.filter((s) => !s.raw).map((s) => s.text).join("");

    const finish = () => {
      for (const box of boxes) this.blocks(box);
    };

    const numPr = child(pPr, "numPr");
    const numId = (numPr ? wAttr(child(numPr, "numId"), "val") : null) ?? st.numId;
    const ilvl = Number((numPr ? wAttr(child(numPr, "ilvl"), "val") : null) ?? st.ilvl ?? 0);
    const prev = this.out[this.out.length - 1];

    // Code: a code style, or every character in a typewriter font.
    const textSegs = visible.filter((s) => !s.raw && s.text.trim());
    const isCode = !heading && (st.kind.code || (textSegs.length > 0 && textSegs.every((s) => s.fmt.code)));
    if (isCode || (!plain.trim() && st.kind.code && prev?.kind === "code")) {
      const lines = visible.map((s) => s.text).join("").split("\n");
      if (prev?.kind === "code") prev.lines.push(...lines);
      else {
        this.list = [];
        this.out.push({ kind: "code", lines });
      }
      return finish();
    }

    if (!plain.trim() && !visible.some((s) => s.raw)) {
      const bdr = child(pPr, "pBdr");
      const line = [child(bdr, "bottom"), child(bdr, "top")].some((b) => b && !/^(none|nil)$/.test(wAttr(b, "val") ?? ""));
      if (line) {
        this.list = [];
        this.out.push({ kind: "hr", text: "---" });
      }
      return finish();
    }

    if (heading) {
      this.list = [];
      this.out.push({ kind: "heading", text: `${"#".repeat(heading)} ${renderInline(visible, "heading")}` });
      return finish();
    }

    const lvl = numId && numId !== "0" ? this.numbering.level(numId, ilvl) : null;
    // Bullets typed by hand ("• item") read as list items too.
    const manual = !lvl && /^\s*[•●▪◦‣∙]\s+/.exec(plain);
    if ((lvl && lvl.fmt !== "none") || manual) {
      if (manual) stripLeading(visible, manual[0].length);
      const ordered = !!lvl && lvl.fmt !== "bullet";
      const marker = ordered ? `${this.numbering.next(numId!, ilvl, lvl!)}.` : "-";
      const depth = Math.min(manual ? 0 : ilvl, this.list.length);
      const key = manual ? "manual" : `${numId}:${ordered}`;
      const fresh = depth === 0 && prev?.kind === "item" && this.listKey !== key;
      if (depth === 0) this.listKey = key;
      this.list.length = depth;
      const indent = depth ? this.list[depth - 1] : 0;
      const col = indent + marker.length + 1;
      this.list.push(col);
      const box = /^\s*([☐☑☒])\s*/.exec(visible.filter((s) => !s.raw).map((s) => s.text).join(""));
      if (box) stripLeading(visible, box[0].length);
      const text = renderInline(visible, "para").replace(/\n/g, "\n" + " ".repeat(col));
      this.out.push({ kind: "item", fresh, text: `${" ".repeat(indent)}${marker} ${box ? (box[1] === "☐" ? "[ ] " : "[x] ") : ""}${text}` });
      return finish();
    }

    const text = renderInline(visible, "para");
    if (st.kind.listCont && this.list.length && prev?.kind === "item") {
      // A follow-on paragraph inside the last list item.
      const col = this.list[this.list.length - 1];
      prev.text += `\n\n${" ".repeat(col)}${text.replace(/\n/g, "\n" + " ".repeat(col))}`;
      return finish();
    }
    this.list = [];
    if (st.kind.quote) {
      if (prev?.kind === "quote") prev.paras.push(text);
      else this.out.push({ kind: "quote", paras: [text] });
    } else this.out.push({ kind: "para", text });
    finish();
  }

  private table(tbl: Element): string {
    const rows: string[][] = [];
    const align: string[] = [];
    const rowsOf = (el: Element): Element[] =>
      kids(el).flatMap((c) => (isW(c, "tr") ? [c] : isW(c, "sdt") ? rowsOf(child(c, "sdtContent") ?? c) : isW(c, "customXml") ? rowsOf(c) : []));
    const cellsOf = (el: Element): Element[] =>
      kids(el).flatMap((c) => (isW(c, "tc") ? [c] : isW(c, "sdt") ? cellsOf(child(c, "sdtContent") ?? c) : isW(c, "customXml") ? cellsOf(c) : []));
    const trs = rowsOf(tbl);
    trs.forEach((tr, ri) => {
      const row: string[] = [];
      for (const tc of cellsOf(tr)) {
        // A table wider than this is not readable as Markdown; the rest of the row is left out.
        if (row.length >= MAX_TABLE_COLS) break;
        const tcPr = child(tc, "tcPr");
        const span = Math.max(1, Math.min(64, Number(wAttr(child(tcPr, "gridSpan"), "val") ?? 1) || 1));
        const vm = child(tcPr, "vMerge");
        const merged = vm && wAttr(vm, "val") !== "restart";
        if (ri === Math.min(1, trs.length - 1)) {
          const jc = wAttr(child(child(child(tc, "p"), "pPr"), "jc"), "val") ?? "";
          align[row.length] = /center/.test(jc) ? ":---:" : /right|end/.test(jc) ? "---:" : "---";
        }
        row.push(merged ? "" : this.cell(tc, ri === 0));
        for (let k = 1; k < span && row.length < MAX_TABLE_COLS; k++) row.push("");
      }
      rows.push(row);
    });
    if (!rows.length) return "";
    const cols = rows.reduce((n, r) => Math.max(n, r.length), 1);
    const line = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] || " ").join(" | ")} |`;
    return [line(rows[0]), `| ${Array.from({ length: cols }, (_, i) => align[i] ?? "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
  }

  /** A header row is bold in Markdown already, so its bold is not written again. */
  private cell(tc: Element, header = false): string {
    const parts: string[] = [];
    const visit = (el: Element) => {
      for (const k of kids(el)) {
        if (isW(k, "p")) {
          const st = this.styles.get(wAttr(child(child(k, "pPr"), "pStyle"), "val") ?? this.styles.defaultPara);
          const segs: Seg[] = [];
          this.inline(k, st.kind.heading ? {} : { ...st.fmt, code: false }, undefined, segs);
          if (header) for (const sg of segs) sg.fmt = { ...sg.fmt, b: false };
          const t = renderInline(segs, "table");
          const listed = child(child(k, "pPr"), "numPr") || st.numId;
          if (t) parts.push(listed ? `• ${t}` : t);
        } else if (isW(k, "tbl")) {
          for (const tr of kids(k).filter((c) => isW(c, "tr"))) {
            const t = kids(tr).filter((c) => isW(c, "tc")).map((c) => this.cell(c, header)).filter(Boolean).join(" · ");
            if (t) parts.push(t);
          }
        } else if (isW(k, "sdt")) {
          const content = child(k, "sdtContent");
          if (content) visit(content);
        } else if (isW(k, "customXml")) visit(k);
      }
    };
    visit(tc);
    return parts.join("<br>");
  }

  /** Footnotes and endnotes, in the order they are first referred to. */
  noteText(doc: Document | null, label: string): string {
    if (!doc) return "";
    const id = label.replace(/^e/, "");
    const tag = label.startsWith("e") ? "endnote" : "footnote";
    const note = Array.from(doc.getElementsByTagNameNS(W, tag)).find((n) => wAttr(n, "id") === id);
    if (!note) return "";
    return kids(note)
      .filter((c) => isW(c, "p"))
      .map((p) => {
        const segs: Seg[] = [];
        this.inline(p, {}, undefined, segs);
        return renderInline(segs, "para").replace(/\\\n/g, " ");
      })
      .filter(Boolean)
      .join(" ");
  }

  markdown(): string {
    const render = (b: Block): string => {
      if (b.kind === "code") {
        while (b.lines.length && !b.lines[b.lines.length - 1].trim()) b.lines.pop();
        const longest = b.lines.reduce((n, l) => Math.max(n, /^\s*(`+)/.exec(l)?.[1].length ?? 0), 0);
        const fence = "`".repeat(Math.max(3, longest + 1));
        return `${fence}\n${b.lines.join("\n")}\n${fence}`;
      }
      if (b.kind === "quote") return b.paras.map((p) => p.split("\n").map((l) => `> ${l}`.trimEnd()).join("\n")).join("\n>\n");
      return b.text;
    };
    let md = "";
    let prev: Block | undefined;
    for (const b of this.out) {
      const text = render(b);
      if (!text.trim()) continue;
      if (md) md += prev?.kind === "item" && b.kind === "item" && !b.fresh ? "\n" : "\n\n";
      md += text;
      prev = b;
    }
    return md;
  }
}

function stripLeading(segs: Seg[], count: number): void {
  for (const s of segs) {
    if (count <= 0) break;
    if (s.raw) continue;
    const take = Math.min(count, s.text.length);
    s.text = s.text.slice(take);
    count -= take;
  }
}

async function relsOf(zip: Awaited<ReturnType<typeof openZip>>, file: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const xml = await readPart(zip, file);
  if (!xml) return out;
  for (const r of Array.from(parse(xml).getElementsByTagNameNS(PKG, "Relationship"))) out.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? "");
  return out;
}

export async function docxToMarkdown(bytes: Uint8Array): Promise<string> {
  const zip = await openZip(bytes);
  const xml = await readPart(zip, "word/document.xml");
  if (!xml) throw new Error("This does not look like a Word document.");
  const doc = parse(xml);
  if (doc.getElementsByTagName("parsererror").length) throw new Error("This Word document is damaged and could not be read.");
  const read = async (name: string) => {
    const x = await readPart(zip, name);
    return x ? parse(x) : null;
  };
  const styles = new Styles(await read("word/styles.xml"));
  const numbering = new Numbering(await read("word/numbering.xml"), styles);
  const conv = new Converter(styles, numbering);
  conv.links = await relsOf(zip, "word/_rels/document.xml.rels");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (body) conv.blocks(body);
  let md = conv.markdown();
  if (conv.notes.length) {
    const [foot, end] = [await read("word/footnotes.xml"), await read("word/endnotes.xml")];
    const footLinks = await relsOf(zip, "word/_rels/footnotes.xml.rels");
    const endLinks = await relsOf(zip, "word/_rels/endnotes.xml.rels");
    const lines: string[] = [];
    for (let i = 0; i < conv.notes.length; i++) {
      const label = conv.notes[i];
      conv.links = label.startsWith("e") ? endLinks : footLinks;
      lines.push(`[^${label}]: ${conv.noteText(label.startsWith("e") ? end : foot, label)}`);
    }
    md += `\n\n${lines.join("\n")}`;
  }
  return md.trim() + "\n";
}
