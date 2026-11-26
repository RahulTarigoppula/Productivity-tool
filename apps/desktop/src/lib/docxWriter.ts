/** Writes Word (.docx) files from Markdown or plain text, offline, with no extra dependencies.
 *  Headings, paragraphs, bold/italic/strikethrough/code, links, bullet and numbered lists (nested),
 *  task lists, quotes, code blocks, tables and dividers become real Word structures (styles,
 *  numbering, tables), so the result edits naturally in Word or the app's Office editor. Images are
 *  left out (their alt text is kept). */
import JSZip from "jszip";
import { marked, type Token, type Tokens } from "marked";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
    // XML 1.0 forbids most control characters.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "");

interface RunStyle {
  b?: boolean;
  i?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: boolean;
}

/** One document being written: paragraphs, hyperlink relationships and list numbering. */
class DocBuilder {
  body: string[] = [];
  rels: string[] = [];
  /** Numbered lists restart at 1: each gets its own numbering instance. */
  nums: { id: number; abstract: 0 | 1 }[] = [{ id: 1, abstract: 0 }];
  private relId = 10;

  link(href: string): string | null {
    // Only web and mail addresses become clickable; other targets keep their text only.
    if (!/^(https?:|mailto:)/i.test(href)) return null;
    const id = `rId${++this.relId}`;
    this.rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(href)}" TargetMode="External"/>`);
    return id;
  }

  newNumbered(): number {
    const id = this.nums.length + 1;
    this.nums.push({ id, abstract: 1 });
    return id;
  }

  run(text: string, st: RunStyle): string {
    if (!text) return "";
    const pr = [
      st.b ? "<w:b/>" : "",
      st.i ? "<w:i/>" : "",
      st.strike ? "<w:strike/>" : "",
      st.code ? '<w:rStyle w:val="InlineCode"/>' : "",
      st.link ? '<w:rStyle w:val="Hyperlink"/>' : "",
    ].join("");
    // Line breaks inside a paragraph become Word line breaks.
    return text
      .split("\n")
      .map((part, i) => `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(part)}</w:t></w:r>`)
      .join("");
  }

  inline(tokens: Token[] | undefined, st: RunStyle = {}): string {
    let out = "";
    for (const t of tokens ?? []) {
      switch (t.type) {
        case "strong":
          out += this.inline((t as Tokens.Strong).tokens, { ...st, b: true });
          break;
        case "em":
          out += this.inline((t as Tokens.Em).tokens, { ...st, i: true });
          break;
        case "del":
          out += this.inline((t as Tokens.Del).tokens, { ...st, strike: true });
          break;
        case "codespan":
          out += this.run(decodeEntities((t as Tokens.Codespan).text), { ...st, code: true });
          break;
        case "br":
          out += "<w:r><w:br/></w:r>";
          break;
        case "link": {
          const l = t as Tokens.Link;
          const id = this.link(l.href);
          const inner = this.inline(l.tokens, { ...st, link: true });
          out += id ? `<w:hyperlink r:id="${id}">${inner}</w:hyperlink>` : inner;
          break;
        }
        case "image": {
          const im = t as Tokens.Image;
          out += this.run(im.text ? `[${im.text}]` : "[image]", { ...st, i: true });
          break;
        }
        case "text": {
          const tx = t as Tokens.Text;
          out += tx.tokens?.length ? this.inline(tx.tokens, st) : this.run(decodeEntities(tx.text), st);
          break;
        }
        case "escape":
          out += this.run((t as Tokens.Escape).text, st);
          break;
        case "html":
          out += this.run((t as Tokens.HTML).text.replace(/<[^>]*>/g, ""), st);
          break;
        default:
          if ("text" in t && typeof (t as { text: unknown }).text === "string") out += this.run(decodeEntities((t as { text: string }).text), st);
      }
    }
    return out;
  }

  para(content: string, style?: string, extra = ""): void {
    const pPr = style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>` : "";
    this.body.push(`<w:p>${pPr}${content}</w:p>`);
  }

  blocks(tokens: Token[], ctx: { quote?: boolean } = {}): void {
    for (const t of tokens) this.block(t, ctx);
  }

  block(t: Token, ctx: { quote?: boolean }): void {
    switch (t.type) {
      case "heading": {
        const h = t as Tokens.Heading;
        this.para(this.inline(h.tokens), `Heading${Math.min(6, h.depth)}`);
        break;
      }
      case "paragraph":
        this.para(this.inline((t as Tokens.Paragraph).tokens), ctx.quote ? "Quote" : undefined);
        break;
      case "text": {
        const tx = t as Tokens.Text;
        this.para(tx.tokens?.length ? this.inline(tx.tokens) : this.run(decodeEntities(tx.text), {}), ctx.quote ? "Quote" : undefined);
        break;
      }
      case "blockquote":
        this.blocks((t as Tokens.Blockquote).tokens, { ...ctx, quote: true });
        break;
      case "code": {
        const lines = (t as Tokens.Code).text.split("\n");
        for (const line of lines) this.para(this.run(line, {}) || "", "CodeBlock");
        break;
      }
      case "hr":
        this.para("", undefined, '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="A0A0A8"/></w:pBdr>');
        break;
      case "list":
        this.list(t as Tokens.List, 0, ctx);
        break;
      case "table":
        this.table(t as Tokens.Table);
        break;
      case "html": {
        const text = (t as Tokens.HTML).text.replace(/<[^>]*>/g, "").trim();
        if (text) this.para(this.run(text, {}));
        break;
      }
      case "space":
        break;
      default:
        if ("text" in t && typeof (t as { text: unknown }).text === "string" && (t as { text: string }).text.trim()) this.para(this.run((t as { text: string }).text, {}));
    }
  }

  list(l: Tokens.List, level: number, ctx: { quote?: boolean }): void {
    const numId = l.ordered ? this.newNumbered() : 1;
    const lvl = Math.min(level, 8);
    for (const item of l.items) {
      let first = true;
      for (const child of item.tokens) {
        if (child.type === "list") {
          this.list(child as Tokens.List, level + 1, ctx);
          continue;
        }
        const content =
          child.type === "text" || child.type === "paragraph"
            ? (child as Tokens.Text).tokens?.length
              ? this.inline((child as Tokens.Text).tokens)
              : this.run(decodeEntities((child as Tokens.Text).text), {})
            : "";
        if (!content && child.type !== "text" && child.type !== "paragraph") {
          this.block(child, ctx);
          continue;
        }
        const box = first && item.task ? this.run(item.checked ? "☑ " : "☐ ", {}) : "";
        const numPr = first ? `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${numId}"/></w:numPr>` : `<w:ind w:left="${720 * (lvl + 1)}"/>`;
        this.para(box + content, "ListParagraph", numPr);
        first = false;
      }
      if (first) this.para(item.task ? this.run(item.checked ? "☑" : "☐", {}) : "", "ListParagraph", `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${numId}"/></w:numPr>`);
    }
  }

  table(t: Tokens.Table): void {
    const cols = t.header.length;
    const jc = (a: string | null) => (a === "center" ? "center" : a === "right" ? "right" : "left");
    const cell = (c: Tokens.TableCell, i: number, header: boolean) =>
      `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="EEEEF2"/>' : ""}</w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="${jc(t.align[i])}"/></w:pPr>${this.inline(c.tokens, header ? { b: true } : {})}</w:p></w:tc>`;
    const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${t.header.map((c, i) => cell(c, i, true)).join("")}</w:tr>`;
    const rows = t.rows
      .map((r) => `<w:tr>${Array.from({ length: cols }, (_, i) => cell(r[i] ?? { text: "", tokens: [], header: false, align: null }, i, false)).join("")}</w:tr>`)
      .join("");
    const grid = `<w:tblGrid>${Array.from({ length: cols }, () => '<w:gridCol w:w="2000"/>').join("")}</w:tblGrid>`;
    this.body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr>${grid}${head}${rows}</w:tbl>`);
    // Word needs a paragraph between a table and what follows.
    this.para("");
  }
}

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e as "amp"]);
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${[1, 2, 3, 4, 5, 6]
  .map(
    (n) =>
      `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n < 3 ? 280 : 200}" w:after="100"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="1F2A44"/><w:sz w:val="${[40, 32, 28, 24, 22, 22][n - 1]}"/></w:rPr></w:style>`,
  )
  .join("\n")}
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="C8C8D4"/></w:pBdr><w:ind w:left="300"/></w:pPr><w:rPr><w:color w:val="555560"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F4F4F6"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="character" w:styleId="InlineCode"><w:name w:val="Inline Code"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F0F0F3"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:uiPriority w:val="99"/><w:rPr><w:color w:val="2F5BD8"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="C8C8D0"/><w:left w:val="single" w:sz="4" w:space="0" w:color="C8C8D0"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="C8C8D0"/><w:right w:val="single" w:sz="4" w:space="0" w:color="C8C8D0"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="C8C8D0"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="C8C8D0"/></w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

function numberingXml(nums: { id: number; abstract: 0 | 1 }[]): string {
  const bullets = ["•", "◦", "▪"];
  const lvls = (ordered: boolean) =>
    Array.from({ length: 9 }, (_, i) =>
      ordered
        ? `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${["decimal", "lowerLetter", "lowerRoman"][i % 3]}"/><w:lvlText w:val="%${i + 1}."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`
        : `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${bullets[i % 3]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`,
    ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvls(false)}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvls(true)}</w:abstractNum>
${nums.map((n) => `<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.abstract}"/>${n.abstract === 1 ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : ""}</w:num>`).join("\n")}
</w:numbering>`;
}

async function pack(b: DocBuilder, title: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${b.rels.join("")}</Relationships>`,
  );
  zip.file("word/styles.xml", STYLES);
  zip.file("word/numbering.xml", numberingXml(b.nums));
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Productivity</Application></Properties>`,
  );
  if (!b.body.length) b.para("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${b.body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Markdown → .docx */
export async function markdownToDocx(md: string, title: string): Promise<Uint8Array> {
  const b = new DocBuilder();
  b.blocks(marked.lexer(md, { gfm: true }));
  return pack(b, title);
}

/** Plain text or code → .docx (one paragraph per line; code keeps a fixed-width font). */
export async function textToDocx(text: string, title: string, code = false): Promise<Uint8Array> {
  const b = new DocBuilder();
  for (const line of text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n")) b.para(b.run(line, {}), code ? "CodeBlock" : undefined);
  return pack(b, title);
}
