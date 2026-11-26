// End-to-end tests of Office editing: the app (vite preview on :1420) with the Office pack served
// by tests/office-server.mjs on :4180. Run: node tests/office-server.mjs & pnpm preview --port 1420 & node tests/e2e/office.mjs
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const JSZip = require("jszip");
const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, "..", "corpus");
const shots = process.env.SHOTS ?? join(here, "..", "..", "test-results");
mkdirSync(shots, { recursive: true });
const APP = process.env.APP_URL ?? "http://localhost:1420/";
const OFFICE = process.env.OFFICE_URL ?? "http://localhost:4180";

const results = [];
let page;
const errors = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
async function check(id, name, fn) {
  try { await fn(); results.push({ id, ok: true }); console.log(`  ✓ ${id} ${name}`); }
  catch (e) { results.push({ id, ok: false }); console.log(`  ✗ ${id} ${name}\n      ${String(e?.message ?? e).split("\n")[0]}`); await page.screenshot({ path: join(shots, `office-fail-${id}.png`) }).catch(() => {}); await page.keyboard.press("Escape").catch(() => {}); }
}
const waitFor = async (pred, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pred().catch(() => false)) return; await page.waitForTimeout(150); } throw new Error(`Timed out waiting for ${label}`); };
const activeTab = () => page.evaluate(() => { const s = window.__app.getState(); const t = s.tabs.find((x) => x.id === s.activeId); return t && { name: t.name, dirty: t.dirty, kind: t.kind, saveState: t.saveState }; });
const fsRead = (p) => page.evaluate((p) => { const b = window.__fs.read(p); return b ? Array.from(b) : null; }, p);
const zipText = async (bytes) => { const z = await JSZip.loadAsync(Buffer.from(bytes)); let s = ""; for (const n of Object.keys(z.files).filter((n) => n.endsWith(".xml"))) s += await z.file(n).async("string"); return s; };
const editorReady = () => page.locator("section.doc-pane:not([hidden]) .office-frame").evaluate((f) => f.style.visibility === "visible");
const frameBox = async () => page.locator("section.doc-pane:not([hidden]) .office-frame").boundingBox();

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, serviceWorkers: "block" });
  await ctx.addInitScript((u) => { window.__OFFICE_URL = u; }, OFFICE);
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { const u = new URL(r.url()); if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.hostname.endsWith(".localhost") && !/^(data|blob):/.test(r.url())) errors.push("Outbound request: " + r.url()); });
  await page.goto(APP);
  await page.waitForFunction(() => window.__app && window.__fs);
  for (const f of ["report.docx", "budget.xlsx", "deck.pptx"]) await page.evaluate(([p, b]) => window.__fs.write(p, new Uint8Array(b)), [`/work/${f}`, Array.from(readFileSync(join(corpus, f)))]);
  console.log("Office flows:");

  await check("O-1", "a Word file opens in the full editor", async () => {
    await page.evaluate(() => window.__app.openPath("/work/report.docx"));
    await waitFor(editorReady, 90000, "editor ready");
    assert(!(await page.locator(".toolbar:not(.empty)").count()), "the app toolbar should give way to the editor's ribbon");
  });

  await check("O-2", "typing marks the tab unsaved; Ctrl+S inside the editor saves through the app", async () => {
    const b = await frameBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.6);
    await page.keyboard.type("OfficeTyped");
    await waitFor(async () => (await activeTab()).dirty, 8000, "tab unsaved");
    await page.keyboard.press("Control+s");
    await waitFor(async () => !(await activeTab()).dirty, 20000, "saved");
    const xml = await zipText(await fsRead("/work/report.docx"));
    assert(xml.includes("OfficeTyped"), "typed text not in the saved file");
    assert(xml.includes("Quarterly report"), "original content lost");
  });

  await check("O-3", "after a save, further edits are tracked and saved again", async () => {
    await page.keyboard.type(" SecondEdit");
    await waitFor(async () => (await activeTab()).dirty, 8000, "unsaved again");
    await page.keyboard.press("Control+s");
    await waitFor(async () => !(await activeTab()).dirty, 20000, "saved again");
    const xml = await zipText(await fsRead("/work/report.docx"));
    assert(xml.includes("OfficeTyped") && xml.includes("SecondEdit"), "second edit not saved");
  });

  await check("O-4", "Ctrl+K typed inside the editor opens the app's palette", async () => {
    await page.keyboard.press("Control+k");
    await waitFor(() => page.locator("[cmdk-input]").isVisible(), 4000, "palette");
    await page.keyboard.press("Escape");
  });

  await check("O-5", "export a Word file to PDF through the editor", async () => {
    await page.evaluate(() => window.__fs.queueSave("/work/report.pdf"));
    await page.keyboard.press("Control+e");
    await page.locator(".export-row", { hasText: "made by the Office editor" }).first().click();
    await waitFor(async () => !!(await fsRead("/work/report.pdf")), 30000, "PDF written");
    assert(Buffer.from((await fsRead("/work/report.pdf")).slice(0, 5)).toString() === "%PDF-", "not a PDF");
  });

  await check("O-6", "an Excel edit is saved with formulas kept", async () => {
    await page.evaluate(() => window.__app.openPath("/work/budget.xlsx"));
    await waitFor(editorReady, 90000, "spreadsheet ready");
    const b = await frameBox();
    // Cell C2 sits right of the data; the grid starts below the ribbon.
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowDown");
    await page.mouse.click(b.x + 260, b.y + 200);
    await page.keyboard.type("4242");
    await page.keyboard.press("Enter");
    await waitFor(async () => (await activeTab()).dirty, 8000, "unsaved");
    await page.keyboard.press("Control+s");
    await waitFor(async () => !(await activeTab()).dirty, 20000, "saved");
    const xml = await zipText(await fsRead("/work/budget.xlsx"));
    assert(xml.includes(">4242<"), "value not saved");
    assert(/SUM\(B2:B\d\)/.test(xml), "formula lost");
  });

  await check("O-7", "a PowerPoint file opens; closing an unsaved Office tab asks first", async () => {
    await page.evaluate(() => window.__app.openPath("/work/deck.pptx"));
    await waitFor(editorReady, 90000, "presentation ready");
    await page.screenshot({ path: join(shots, "office-pptx.png") });
    const b = await frameBox();
    await page.mouse.dblclick(b.x + b.width * 0.62, b.y + b.height * 0.36);
    await page.keyboard.press("End");
    await page.keyboard.type(" Draft");
    await waitFor(async () => (await activeTab()).dirty, 8000, "unsaved");
    await page.evaluate(() => { const s = window.__app.getState(); void window.__app.closeTab(s.activeId); });
    await waitFor(() => page.getByRole("alertdialog").isVisible(), 4000, "confirm dialog");
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  await check("O-8", "a new Word document can be created, typed into and saved", async () => {
    await page.evaluate(() => window.__app.newOfficeFile("docx"));
    await waitFor(editorReady, 90000, "new document ready");
    const b = await frameBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.4);
    await page.keyboard.type("Brand new document");
    await waitFor(async () => (await activeTab()).dirty, 8000, "unsaved");
    await page.evaluate(() => window.__fs.queueSave("/work/new.docx"));
    await page.keyboard.press("Control+s");
    await waitFor(async () => !!(await fsRead("/work/new.docx")), 20000, "file created");
    assert((await zipText(await fsRead("/work/new.docx"))).includes("Brand new document"), "text not saved");
    assert((await activeTab()).name === "new.docx", "tab not renamed after first save");
  });

  await check("O-9", "each tab's editor is isolated; a background editor cannot trigger app shortcuts", async () => {
    const editors = page.frames().filter((f) => /\/editor\?/.test(f.url()));
    assert(editors.length >= 2, `expected several editor frames, found ${editors.length}`);
    const origins = new Set(editors.map((f) => new URL(f.url()).origin));
    assert(origins.size === editors.length, "two tabs share an editor origin");
    for (const f of editors) {
      const reached = await f.evaluate(() => {
        let n = 0;
        for (let i = 0; i < window.top.frames.length; i++) {
          const w = window.top.frames[i];
          if (w === window) continue;
          try { if (w.document && w.editor !== undefined) n++; else if (w.document) n++; } catch { /* blocked, as it should be */ }
        }
        return n;
      });
      assert(reached === 0, `the editor at ${new URL(f.url()).host} could reach ${reached} other editor(s)`);
    }
    // A hidden tab forges Ctrl+, (settings) and the visible one forges a key the bridge never sends.
    const active = await page.locator("section.doc-pane:not([hidden]) .office-frame").getAttribute("src");
    const hidden = editors.find((f) => f.url() !== active);
    const shown = editors.find((f) => f.url() === active);
    await hidden.evaluate(() => window.top.postMessage({ type: "office:key", key: ",", ctrlKey: true }, "*"));
    await shown.evaluate(() => window.top.postMessage({ type: "office:key", key: "F", ctrlKey: true, shiftKey: true }, "*"));
    await page.waitForTimeout(600);
    assert(!(await page.getByRole("dialog").count()), "a forged shortcut opened a dialog");
    assert(!(await page.locator("[cmdk-input]").isVisible().catch(() => false)), "a forged shortcut opened the palette");
  });

  await check("O-10", "an unchanged background Office tab sleeps and comes back from its file", async () => {
    const before = await page.locator(".office-frame").count();
    // Pick a saved, unchanged Office tab that is not visible.
    const target = await page.evaluate(() => {
      const s = window.__app.getState();
      const t = s.tabs.find((x) => x.id !== s.activeId && ["docx", "xlsx"].includes(x.kind) && !x.dirty && x.path);
      return t && { id: t.id, path: t.path };
    });
    assert(target, "no clean background Office tab to test with");
    await page.evaluate(() => { window.__hibernateAfterMs = 0; });
    await waitFor(async () => (await page.locator(".office-frame").count()) < before, 20000, "the editor to be released");
    await page.evaluate(() => { window.__hibernateAfterMs = 600000; });
    await page.evaluate((id) => window.__app.activate(id), target.id);
    await waitFor(editorReady, 90000, "the editor to come back");
    const t = await activeTab();
    assert(!t.dirty, "a woken tab must not be marked unsaved");
  });

  await check("O-11", "a note exported to Word opens in the Word editor with its content", async () => {
    const md = "# Kickoff plan\n\nSome **bold** words and a [link](https://example.com).\n\n1. First step\n2. Second step\n\n| Owner | Task |\n|---|---|\n| Asha | Design |\n";
    await page.evaluate((t) => window.__fs.write("/work/kickoff.md", new TextEncoder().encode(t)), md);
    await page.evaluate(() => window.__app.openPath("/work/kickoff.md"));
    await page.waitForSelector("section.doc-pane:not([hidden]) .cm-content");
    await page.evaluate(() => window.__fs.queueSave("/work/kickoff.docx"));
    await page.keyboard.press("Control+e");
    await page.locator(".export-row", { hasText: "Word document" }).first().click();
    await waitFor(async () => !!(await fsRead("/work/kickoff.docx")), 15000, "Word file written");
    await page.evaluate(() => window.__app.openPath("/work/kickoff.docx"));
    await waitFor(editorReady, 90000, "Word editor ready");
    const xml = await page.evaluate(async () => {
      const s = window.__app.getState();
      const b = await window.__app.handles.get(s.activeId).serialize({ forSave: true });
      return Array.from(b);
    }).then(zipText);
    assert(xml.includes("Kickoff plan") && xml.includes("Second step") && xml.includes("Asha"), "content lost after the editor saved it");
  });

  await check("O-12", "a table exported to Excel opens in the spreadsheet editor with numbers and IDs intact", async () => {
    await page.evaluate(() => window.__fs.write("/work/sales.csv", new TextEncoder().encode("id,region,amount\n00012,North,10.5\n00013,South,20\n")));
    await page.evaluate(() => window.__app.openPath("/work/sales.csv"));
    await page.waitForSelector("section.doc-pane:not([hidden]) .csv-cell");
    await page.evaluate(() => window.__fs.queueSave("/work/sales.xlsx"));
    await page.keyboard.press("Control+e");
    await page.locator(".export-row", { hasText: "Excel workbook" }).first().click();
    await waitFor(async () => !!(await fsRead("/work/sales.xlsx")), 15000, "Excel file written");
    await page.evaluate(() => window.__app.openPath("/work/sales.xlsx"));
    await waitFor(editorReady, 90000, "spreadsheet editor ready");
    const xml = await page.evaluate(async () => {
      const s = window.__app.getState();
      const b = await window.__app.handles.get(s.activeId).serialize({ forSave: true });
      return Array.from(b);
    }).then(zipText);
    assert(xml.includes("00012") && xml.includes("North"), "text values lost");
    assert(/<v>10\.5<\/v>/.test(xml), "the amount is no longer a number");
  });

  await check("O-13", "after working in an Office file, opening another file sends typing to the new file", async () => {
    await page.evaluate(() => window.__app.openPath("/work/report.docx"));
    await waitFor(editorReady, 90000, "editor ready");
    const b = await frameBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.6);
    await page.evaluate(() => window.__fs.write("/work/after-office.md", new TextEncoder().encode("start\n")));
    await page.evaluate(() => window.__app.openPath("/work/after-office.md"));
    await page.waitForSelector("section.doc-pane:not([hidden]) .cm-content");
    await page.waitForTimeout(300);
    await page.keyboard.type("typed here");
    await page.waitForTimeout(300);
    const text = await page.evaluate(async () => { const s = window.__app.getState(); return new TextDecoder().decode(await window.__app.handles.get(s.activeId).serialize()); });
    assert(text.includes("typed here"), `typing went elsewhere; the note reads ${JSON.stringify(text)}`);
  });

  await page.screenshot({ path: join(shots, "office-final.png") });
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  const bad = errors.filter((e) => !/ResizeObserver/.test(e));
  console.log(`\n${results.length - failed.length}/${results.length} Office flows passed`);
  if (bad.length) console.log("Errors:\n  " + [...new Set(bad)].slice(0, 10).join("\n  "));
  process.exit(failed.length || bad.length ? 1 : 0);
})();
