// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { marked } from "marked";
import { docxToMarkdown } from "./docxToMarkdown";
import { markdownToDocx } from "./docxWriter";

const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"`;

async function docx(body: string, parts: Record<string, string> = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
  for (const [name, xml] of Object.entries(parts)) zip.file(name, xml);
  return zip.generateAsync({ type: "uint8array" });
}

const STYLES = `<?xml version="1.0"?><w:styles ${NS}>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="berschrift1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="MyHeading"><w:name w:val="My Heading"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Zitat"><w:name w:val="Quote"/></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code Block"/></w:style>
<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
<w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/><w:rPr><w:b/></w:rPr></w:style>
</w:styles>`;

const NUMBERING = `<?xml version="1.0"?><w:numbering ${NS}>
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const p = (inner: string, pPr = "") => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${inner}</w:p>`;
const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r = (text: string, rPr = "") => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
const style = (id: string) => `<w:pStyle w:val="${id}"/>`;
const num = (id: number, lvl = 0) => `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${id}"/></w:numPr>`;
const parts = { "word/styles.xml": STYLES, "word/numbering.xml": NUMBERING };

/** What a Markdown reader sees: the text and its formatting, without the exact characters used. */
const rendered = (md: string) => marked.parse(md, { gfm: true }) as string;

describe("Word to Markdown", () => {
  it("keeps headings by style name and outline level, in any language", async () => {
    const md = await docxToMarkdown(await docx(p(r("Einleitung"), style("berschrift1")) + p(r("Deep"), style("MyHeading")) + p(r("C #"), style("berschrift1")), parts));
    expect(md).toBe("# Einleitung\n\n### Deep\n\n# C \\#\n");
  });

  it("joins runs Word split apart and nests overlapping formatting", async () => {
    const md = await docxToMarkdown(await docx(p(r("He", "<w:b/>") + r("llo ", "<w:b/>") + r("bold ", "<w:b/><w:i/>") + r("both", "<w:i/>") + r(" and ") + r("gone", "<w:strike/>") + r(" and ") + r("code", '<w:rFonts w:ascii="Consolas"/>') + r(" ") + r("strong", '<w:rStyle w:val="Strong"/>')), parts));
    expect(md).toBe("**Hello *bold*** *both* and ~~gone~~ and `code` **strong**\n");
  });

  it("uses HTML tags where Markdown markers would read differently", async () => {
    const md = await docxToMarkdown(await docx(p(r("un") + r("believ", "<w:b/>") + r("able, ") + r("(see)", "<w:i/>") + r("this")), parts));
    const html = rendered(md);
    expect(html).toContain("un<strong>believ</strong>able");
    expect(html).toContain("<em>(see)</em>this");
  });

  it("writes links from relationships and link fields, and only safe ones", async () => {
    const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="hyperlink" Target="https://example.com/a b" TargetMode="External"/><Relationship Id="rId6" Type="hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>`;
    const field = `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> HYPERLINK "https://field.test/" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${r("field link")}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const md = await docxToMarkdown(
      await docx(p(`<w:hyperlink r:id="rId5">${r("the ")}${r("site", "<w:b/>")}</w:hyperlink> ${r(" then ")}<w:hyperlink r:id="rId6">${r("bad")}</w:hyperlink>${r(" and ")}${field}`), { ...parts, "word/_rels/document.xml.rels": rels }),
    );
    expect(md).toBe("[the **site**](<https://example.com/a b>) then bad and [field link](https://field.test/)\n");
  });

  it("writes lists with Word's numbers, nesting and task boxes", async () => {
    const md = await docxToMarkdown(
      await docx(
        p(r("Fruit"), style("ListBullet")) +
          p(r("Apple"), num(1, 1)) +
          p(r("Pear"), num(1, 1)) +
          p(r("☑ Done task"), num(1)) +
          p(r("between")) +
          p(r("Third"), num(2)) +
          p(r("Fourth"), num(2)),
        parts,
      ),
    );
    expect(md).toBe("- Fruit\n  1. Apple\n  2. Pear\n- [x] Done task\n\nbetween\n\n3. Third\n4. Fourth\n");
  });

  it("writes tables with merged cells, alignment and pipes", async () => {
    const tc = (t: string, pr = "", jc = "") => `<w:tc>${pr ? `<w:tcPr>${pr}</w:tcPr>` : ""}${p(r(t), jc ? `<w:jc w:val="${jc}"/>` : "")}</w:tc>`;
    const tbl = `<w:tbl><w:tr>${tc("Item")}${tc("Price")}${tc("Note")}</w:tr><w:tr>${tc("Pens")}${tc("1.50", "", "right")}${tc("a | b", '<w:vMerge w:val="restart"/>')}</w:tr><w:tr>${tc("Wide", '<w:gridSpan w:val="2"/>')}${tc("", "<w:vMerge/>")}</w:tr></w:tbl>`;
    const md = await docxToMarkdown(await docx(tbl, parts));
    expect(md).toBe("| Item | Price | Note |\n| --- | ---: | --- |\n| Pens | 1.50 | a \\| b |\n| Wide |   |   |\n");
    expect(rendered(md)).toContain("<td>a | b</td>");
  });

  it("keeps code blocks, quotes, dividers and footnotes", async () => {
    const notes = `<?xml version="1.0"?><w:footnotes ${NS}><w:footnote w:type="separator" w:id="-1">${p(r("---"))}</w:footnote><w:footnote w:id="1">${p(`<w:r><w:footnoteRef/></w:r>${r(" A source.")}`)}</w:footnote></w:footnotes>`;
    const md = await docxToMarkdown(
      await docx(
        p(r("def f():"), style("Code")) +
          p(r("```"), style("Code")) +
          p(r("    return \"```\""), style("Code")) +
          p(r("Wise words."), style("Zitat")) +
          p(r("More words."), style("Zitat")) +
          p("", '<w:pBdr><w:bottom w:val="single" w:sz="6"/></w:pBdr>') +
          p(r("Claim") + `<w:r><w:footnoteReference w:id="1"/></w:r>` + r(".")),
        { ...parts, "word/footnotes.xml": notes },
      ),
    );
    // A line of backticks inside the code needs a longer fence around it.
    expect(md).toBe('````\ndef f():\n```\n    return "```"\n````\n\n> Wise words.\n>\n> More words.\n\n---\n\nClaim[^1].\n\n[^1]: A source.\n');
  });

  it("leaves out deleted, hidden and contents text, keeps inserted text and text boxes once", async () => {
    const box = `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:inline><wp:docPr id="1" name="Text Box 1"/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:txbx><w:txbxContent>${p(r("In the box"))}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent>${p(r("In the box"))}</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r>`;
    const pic = `<w:r><w:drawing><wp:inline><wp:docPr id="2" name="Picture 2" descr="Sales chart"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><a:blip r:embed="rId9"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    const toc = `<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/></w:docPartObj></w:sdtPr><w:sdtContent>${p(r("Contents 1"), style("TOC1"))}</w:sdtContent></w:sdt>`;
    const md = await docxToMarkdown(
      await docx(toc + p(r("Kept ") + `<w:del><w:r><w:delText>removed </w:delText></w:r></w:del><w:ins>${r("added ")}</w:ins>` + r("secret", "<w:vanish/>") + box) + p(pic) + p(r("Stray"), style("TOC1")), parts),
    );
    expect(md).toBe("Kept added\n\nIn the box\n\n*\\[Image: Sales chart\\]*\n");
  });

  it("escapes text that Markdown would otherwise read as formatting", async () => {
    const md = await docxToMarkdown(
      await docx(p(r("1. not a list")) + p(r("# not a heading")) + p(r("*stars* and snake_case_name and _under_")) + p(r("<script>alert(1)</script> & &amp; [x](y)")) + p(r("- dash")) + p(r("---")), parts),
    );
    const html = rendered(md);
    expect(html).not.toMatch(/<ol|<h1|<em>|<ul|<hr|<script|<a /);
    expect(html).toContain("snake_case_name");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;amp;");
  });

  it("reads back a note exported to Word", async () => {
    const src = `# Kickoff

Some **bold**, *italic*, ~~old~~ and \`code\` with a [link](https://example.com).

## Agenda

1. Introductions
2. Scope
   - Phase 1
   - Phase 2

- [x] Book the room
- [ ] Send the slides

> Keep it simple.

| Owner | Task |
| --- | ---: |
| Asha | Plan |

\`\`\`
total = 1
\`\`\`

---

The end.
`;
    expect(await docxToMarkdown(await markdownToDocx(src, "Kickoff"))).toBe(src);
  });

  it("refuses something that is not a Word document", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "hi");
    await expect(docxToMarkdown(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(/Word document/);
  });
});
