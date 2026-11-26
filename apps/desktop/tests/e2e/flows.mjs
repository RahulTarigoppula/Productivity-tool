// End-to-end flow tests against the built interface running in Chromium with the in-memory platform.
// Each check is named after a flow ID in docs/flows. Run: pnpm build && pnpm preview & node tests/e2e/flows.mjs
import { createRequire } from "node:module";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, "..", "corpus");
const shots = process.env.SHOTS ?? join(here, "..", "..", "test-results");
mkdirSync(shots, { recursive: true });
const URL_ = process.env.APP_URL ?? "http://localhost:4173/";

const results = [];
let page;
const errors = [];

async function check(id, name, fn) {
  try {
    await fn();
    results.push({ id, name, ok: true });
    console.log(`  ✓ ${id} ${name}`);
  } catch (e) {
    results.push({ id, name, ok: false, error: String(e?.message ?? e) });
    console.log(`  ✗ ${id} ${name}\n      ${String(e?.message ?? e).split("\n")[0]}`);
    await page.screenshot({ path: join(shots, `fail-${id}.png`) }).catch(() => {});
    // Leave no overlay behind so one failure does not cascade into the next check.
    await page.keyboard.press("Escape").catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const eqBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const fsRead = (p) => page.evaluate((p) => { const b = window.__fs.read(p); return b ? Array.from(b) : null; }, p);
const fsText = (p) => page.evaluate((p) => window.__fs.readText(p), p);
const appState = () => page.evaluate(() => { const s = window.__app.getState(); return { tabs: s.tabs.map((t) => ({ id: t.id, name: t.name, kind: t.kind, dirty: t.dirty, saveState: t.saveState, path: t.path, conflict: t.conflict })), activeId: s.activeId }; });
const open = (p) => page.evaluate((p) => window.__app.openPath(p), p);
const waitFor = async (pred, ms = 4000, label = "condition") => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await pred()) return; await page.waitForTimeout(80); }
  throw new Error(`Timed out waiting for ${label}`);
};
const activeTab = async () => { const s = await appState(); return s.tabs.find((t) => t.id === s.activeId); };

(async () => {
  const browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  // Documents must never cause requests to other hosts.
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && !/^(data|blob):/.test(r.url())) errors.push(`Outbound request: ${r.url()}`);
  });
  await page.goto(URL_);
  await page.waitForFunction(() => window.__app && window.__fs);
  // Seed the in-memory disk with the corpus under /work.
  for (const f of readdirSync(corpus)) {
    const bytes = Array.from(readFileSync(join(corpus, f)));
    await page.evaluate(([p, b]) => window.__fs.write(p, new Uint8Array(b)), [`/work/${f}`, bytes]);
  }
  console.log("Flows:");

  await check("F-02", "home screen shows new-file tiles", async () => {
    assert(await page.locator(".create-card", { hasText: "Note" }).first().isVisible(), "tile missing");
  });

  await check("F-03", "new Markdown note, type, first save asks for a location", async () => {
    await page.keyboard.press("Control+n");
    await waitFor(async () => (await activeTab())?.kind === "markdown", 3000, "new tab");
    await page.locator(".cm-content").first().click();
    await page.keyboard.type("# Hello\n\nFirst note.");
    await waitFor(async () => (await activeTab())?.dirty, 2000, "dirty");
    await page.evaluate(() => window.__fs.queueSave("/work/hello.md"));
    await page.keyboard.press("Control+s");
    await waitFor(async () => (await fsText("/work/hello.md")) !== null, 3000, "file written");
    const t = await fsText("/work/hello.md");
    assert(t.replace(/\r\n/g, "\n") === "# Hello\n\nFirst note.", `unexpected content: ${JSON.stringify(t)}`);
    const tab = await activeTab();
    assert(tab.name === "hello.md" && !tab.dirty, "tab not updated after save");
  });

  await check("F-04", "open Markdown with BOM and CRLF; unedited save is byte-identical", async () => {
    const before = await fsRead("/work/notes.md");
    await open("/work/notes.md");
    await waitFor(async () => (await page.locator(".cm-content:visible").count()) > 0, 4000, "editor");
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(300);
    assert(eqBytes(await fsRead("/work/notes.md"), before), "bytes changed on save");
  });

  await check("F-11", "auto-save keeps CRLF and BOM after an edit", async () => {
    await page.locator(".cm-content:visible").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\nAdded line.");
    await waitFor(async () => (await fsText("/work/notes.md"))?.includes("Added line."), 4000, "auto-save");
    const b = await fsRead("/work/notes.md");
    assert(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf, "BOM lost");
    const t = await fsText("/work/notes.md");
    assert(!/[^\r]\n/.test(t), "LF-only line ending found");
    const tab = await activeTab();
    assert(!tab.dirty, "still dirty after auto-save");
  });

  await check("F-12", "version history lists the original before the first save", async () => {
    const list = await page.evaluate(() => window.__app.platform.snapshotList("/work/notes.md"));
    assert(list.length >= 1 && list.some((s) => s.reason === "original"), `snapshots: ${JSON.stringify(list)}`);
  });

  await check("F-04b", "Windows-1252 text round-trips unchanged", async () => {
    const before = await fsRead("/work/legacy.txt");
    await open("/work/legacy.txt");
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(300);
    assert(eqBytes(await fsRead("/work/legacy.txt"), before), "bytes changed");
    assert(await page.locator(".statusbar").getByText("Windows 1252").isVisible(), "encoding not shown");
  });

  await check("F-04c", "code file gets language detection by shebang", async () => {
    await open("/work/script.py");
    await waitFor(async () => (await page.locator(".statusbar").innerText()).includes("Python"), 4000, "Python in status bar");
  });

  await check("F-04d", "CSV opens as a grid; unedited save is byte-identical", async () => {
    const before = await fsRead("/work/data.csv");
    await open("/work/data.csv");
    await waitFor(async () => (await page.locator(".csv-cell:visible").count()) > 0, 4000, "grid");
    assert(await page.getByText("Smith, J").isVisible(), "quoted value missing");
    assert(await page.getByText("00012").isVisible(), "leading zeros lost");
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(300);
    assert(eqBytes(await fsRead("/work/data.csv"), before), "bytes changed");
  });

  await check("F-11b", "editing one CSV cell rewrites only that row", async () => {
    await page.locator(".csv-cell:visible", { hasText: "Lee" }).click();
    await page.keyboard.type("Lee-Wong");
    await page.keyboard.press("Enter");
    await waitFor(async () => (await fsText("/work/data.csv"))?.includes("Lee-Wong"), 4000, "auto-save");
    const t = await fsText("/work/data.csv");
    assert(t === 'id,name,zip,amount\r\n00012,"Smith, J",01234,10.5\r\n00013,Lee-Wong,98765,20\r\n00014,"Quote ""Q""",00001,30\r\n', `unexpected: ${JSON.stringify(t)}`);
  });

  await check("F-04e", "semicolon CSV without final newline is detected and preserved", async () => {
    const before = await fsRead("/work/semi.csv");
    await open("/work/semi.csv");
    await waitFor(async () => (await page.locator(".statusbar").innerText()).includes("Semicolon"), 4000, "delimiter");
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(300);
    assert(eqBytes(await fsRead("/work/semi.csv"), before), "bytes changed");
  });

  await check("F-22", "PDF renders pages and thumbnails", async () => {
    await open("/work/sample.pdf");
    await waitFor(async () => (await page.locator(".pdfViewer .page canvas").count()) > 0, 8000, "page canvas");
    await waitFor(async () => (await page.locator(".statusbar").innerText()).includes("of 3"), 4000, "page count");
    assert((await page.locator(".thumb").count()) === 3, "thumbnails");
  });

  await check("F-18", "find in PDF reports matches", async () => {
    await page.keyboard.press("Control+f");
    await page.locator(".pdf-find input").fill("marigold");
    await waitFor(async () => /of 3/.test(await page.locator(".pdf-find .help").innerText()), 6000, "3 matches");
    await page.keyboard.press("Escape");
  });

  await check("F-24", "rotate and delete a PDF page, then save (the delete must not be lost while the rotate reloads)", async () => {
    await page.locator(".thumb").nth(1).click();
    await page.getByRole("button", { name: "Rotate right" }).click();
    await page.locator(".thumb").nth(2).click();
    await page.getByRole("button", { name: "Delete pages" }).click();
    await waitFor(async () => (await page.locator(".thumb").count()) === 2, 6000, "2 pages");
    await page.keyboard.press("Control+s");
    await waitFor(async () => !(await activeTab()).dirty, 5000, "saved");
    const bytes = await fsRead("/work/sample.pdf");
    const text = Buffer.from(bytes).toString("latin1");
    assert(text.startsWith("%PDF"), "not a PDF");
    assert(/\/Rotate 90/.test(text), "rotation not saved");
    assert((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length === 2, "page count not 2");
  });

  await check("F-22b", "add a text box annotation to a PDF and save it", async () => {
    await open("/work/sample.pdf");
    await waitFor(async () => (await page.locator(".pdfViewer .page canvas:visible").count()) > 0, 8000, "pages");
    await page.getByRole("button", { name: "Add text" }).click();
    const pg = page.locator(".pdfViewer .page").first();
    await page.evaluate(() => { const s = window.__app.getState(); window.__app.handles.get(s.activeId).goTo("1"); });
    await pg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await pg.boundingBox();
    await page.mouse.click(box.x + 120, box.y + 200);
    await page.waitForTimeout(300);
    await page.keyboard.type("Reviewed");
    await page.mouse.click(box.x + 300, box.y + 500);
    await waitFor(async () => (await activeTab())?.dirty, 5000, "dirty after annotation");
    await page.keyboard.press("Control+s");
    await waitFor(async () => !(await activeTab()).dirty, 5000, "saved");
    const text = Buffer.from(await fsRead("/work/sample.pdf")).toString("latin1");
    assert(/\/FreeText/.test(text), "no FreeText annotation in saved file");
    await page.getByRole("button", { name: "Select text" }).click();
  });

  await check("F-23", "draw a signature and place it on a page", async () => {
    const before = (await fsRead("/work/sample.pdf")).length;
    await page.getByRole("button", { name: "Sign" }).click();
    const canvas = page.locator(".sig-canvas");
    await waitFor(async () => await canvas.isVisible().catch(() => false), 3000, "signature pad");
    const c = await canvas.boundingBox();
    await page.mouse.move(c.x + 40, c.y + 80);
    await page.mouse.down();
    for (let i = 0; i < 20; i++) await page.mouse.move(c.x + 40 + i * 20, c.y + 80 + Math.sin(i) * 30);
    await page.mouse.up();
    await page.getByRole("button", { name: "Use once" }).click();
    await waitFor(async () => await page.getByText("Click where the signature should go").isVisible().catch(() => false), 3000, "placing hint");
    const pg = page.locator(".pdfViewer .page").first();
    await page.evaluate(() => { const s = window.__app.getState(); window.__app.handles.get(s.activeId).goTo("1"); });
    await pg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await pg.boundingBox();
    await page.mouse.click(box.x + 200, box.y + 300);
    await waitFor(async () => (await activeTab())?.dirty, 6000, "dirty after signing");
    await page.keyboard.press("Control+s");
    await waitFor(async () => !(await activeTab()).dirty, 5000, "saved");
    const bytes = await fsRead("/work/sample.pdf");
    const text = Buffer.from(bytes).toString("latin1");
    assert(/\/Subtype\s*\/Image/.test(text), "no image in saved PDF");
    assert(bytes.length > before, "file did not grow");
  });

  await check("F-04f", "Word, Excel and PowerPoint open as read-only previews", async () => {
    await open("/work/report.docx");
    await waitFor(async () => await page.getByText("Quarterly report").first().isVisible().catch(() => false), 8000, "docx text");
    await open("/work/budget.xlsx");
    await waitFor(async () => await page.getByText("Rent").first().isVisible().catch(() => false), 6000, "xlsx cells");
    await page.getByRole("cell", { name: "1650" }).click().catch(async () => { await page.locator(".xlsx-table td").nth(7).click(); });
    await open("/work/deck.pptx");
    await waitFor(async () => await page.getByText("Windows first, then Android").isVisible().catch(() => false), 6000, "pptx text");
    assert(await page.getByText("Mention the spikes").isVisible(), "notes missing");
  });

  await check("F-20", "command palette opens a file by name and runs commands", async () => {
    await page.keyboard.press("Control+k");
    await page.locator("[cmdk-input]").fill("legacy");
    await page.waitForTimeout(150);
    await page.keyboard.press("Enter");
    await waitFor(async () => (await activeTab())?.name === "legacy.txt", 4000, "legacy.txt active");
    await page.keyboard.press("Control+k");
    await page.locator("[cmdk-input]").fill(">show or hide the sidebar");
    await page.keyboard.press("Enter");
    await waitFor(async () => (await page.locator(".side").count()) > 0, 2000, "sidebar open");
  });

  await check("F-21", "following a relative link opens the target at its heading", async () => {
    await page.evaluate(() => window.__app.openLink(window.__app.getState().tabs.find((t) => t.name === "notes.md"), "plan.md#goals"));
    await waitFor(async () => (await activeTab())?.name === "plan.md", 3000, "link target");
  });

  await check("F-19", "search in folder finds text across files", async () => {
    await page.evaluate(() => window.__app.openFolder("/work"));
    await page.getByRole("tab", { name: "Search" }).click();
    await page.locator(".search-box input").fill("Ship the Windows");
    await waitFor(async () => (await page.locator(".hit").count()) > 0, 4000, "search hits");
  });

  await check("F-14", "file changed outside the app reloads a clean tab", async () => {
    await open("/work/plan.md");
    await page.evaluate(() => window.__fs.externalChange("/work/plan.md", "# Plan\n\nChanged elsewhere.\n"));
    await waitFor(async () => (await page.locator(".cm-content:visible").innerText()).includes("Changed elsewhere"), 4000, "reload");
  });

  await check("F-14b", "external change with unsaved edits shows a conflict banner", async () => {
    await page.locator(".cm-content:visible").click();
    await page.keyboard.press("Control+End");
    await page.evaluate(() => window.__app.updateSettings({ autoSave: false }));
    await page.keyboard.type(" mine");
    await page.evaluate(() => window.__fs.externalChange("/work/plan.md", "# Plan\n\nTheirs.\n"));
    await waitFor(async () => (await activeTab())?.conflict === "changed", 4000, "conflict");
    assert(await page.getByText("Another program changed this file").isVisible(), "banner missing");
    await page.getByRole("button", { name: "Keep my version" }).click();
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  });

  await check("F-15", "export Markdown to HTML and CSV to JSON", async () => {
    await open("/work/plan.md");
    await page.evaluate(() => window.__fs.queueSave("/work/plan.html"));
    await page.keyboard.press("Control+e");
    await page.locator(".export-row", { hasText: "Web page" }).click();
    await waitFor(async () => (await fsText("/work/plan.html"))?.includes("<h1"), 4000, "html written");
    await open("/work/data.csv");
    await page.evaluate(() => window.__fs.queueSave("/work/data.json"));
    await page.keyboard.press("Control+e");
    await page.locator(".export-row", { hasText: "JSON" }).click();
    await waitFor(async () => (await fsText("/work/data.json")) !== null, 4000, "json written");
    const json = JSON.parse(await fsText("/work/data.json"));
    assert(json[0].id === "00012" && json[0].name === "Smith, J", "json content");
  });

  await check("F-39", "unsaved work is written to recovery storage", async () => {
    await page.keyboard.press("Control+n");
    await page.locator(".cm-content:visible").click();
    await page.keyboard.type("unsaved idea");
    await waitFor(async () => (await page.evaluate(() => window.__app.platform.recoveryList())).length > 0, 4000, "recovery written");
  });

  await check("F-10", "closing an unsaved untitled tab asks first", async () => {
    await page.keyboard.press("Control+w");
    await waitFor(async () => await page.getByRole("alertdialog").isVisible().catch(() => false), 2000, "confirm");
    await page.getByRole("button", { name: "Don't save" }).click();
    await page.waitForTimeout(200);
    const list = await page.evaluate(() => window.__app.platform.recoveryList());
    const s = await appState();
    assert(!s.tabs.some((t) => t.name.startsWith("Untitled") && t.dirty), "tab still open");
    assert(list.every((r) => !JSON.parse(r.meta).name.startsWith("Untitled")), "recovery not cleared");
  });

  await check("F-08", "Ctrl+Tab switches to the last used tab", async () => {
    const before = (await activeTab()).name;
    await open("/work/plan.md");
    await page.keyboard.press("Control+Tab");
    await waitFor(async () => (await activeTab()).name === before, 2000, "previous tab");
  });

  await check("R-1", "restored content stays unsaved even after edit and undo", async () => {
    await open("/work/plan.md");
    await page.evaluate(() => { window.__app.updateSettings({ autoSave: false }); const s = window.__app.getState(); window.__app.replaceContent(s.activeId, new TextEncoder().encode("# Restored\n"), "Restored a version"); });
    await page.waitForTimeout(300);
    await page.locator(".cm-content:visible").click();
    await page.keyboard.type("x");
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(200);
    assert((await activeTab()).dirty, "tab became clean although the restored content is not on disk");
    await page.keyboard.press("Control+s");
    await waitFor(async () => (await fsText("/work/plan.md")) === "# Restored\n", 3000, "restored content saved");
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  });

  await check("R-3", "two tabs on the same file stay in sync", async () => {
    await open("/work/data.csv");
    const csvId = (await activeTab()).id;
    await page.evaluate((id) => window.__app.reopenAs(id, "text"), csvId);
    await waitFor(async () => (await activeTab()).kind === "text", 3000, "text tab");
    await page.locator(".cm-content:visible").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("00015,New,11111,40\n");
    await waitFor(async () => (await fsText("/work/data.csv"))?.includes("00015"), 4000, "auto-save from text tab");
    await page.evaluate((id) => window.__app.activate(id), csvId);
    await waitFor(async () => await page.locator(".csv-cell:visible", { hasText: "00015" }).isVisible().catch(() => false), 4000, "CSV tab reloaded");
  });

  await check("R-9a", "an empty CSV file stays empty when saved unedited", async () => {
    await page.evaluate(() => window.__fs.write("/work/empty.csv", ""));
    await open("/work/empty.csv");
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(300);
    assert((await fsText("/work/empty.csv")) === "", "empty file was changed");
  });

  await check("R-9b", "an unedited file with mixed line endings is not rewritten", async () => {
    await page.evaluate(() => window.__fs.write("/work/mixed.txt", "a\r\nb\nc\r\n"));
    await open("/work/mixed.txt");
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(300);
    assert((await fsText("/work/mixed.txt")) === "a\r\nb\nc\r\n", "file was rewritten");
  });

  await check("R-10", "Save As from CSV to TSV switches the delimiter", async () => {
    await open("/work/data.csv");
    await page.evaluate(() => window.__fs.queueSave("/work/data-copy.tsv"));
    await page.keyboard.press("Control+Shift+s");
    await waitFor(async () => (await fsText("/work/data-copy.tsv")) !== null, 4000, "tsv written");
    const t = await fsText("/work/data-copy.tsv");
    assert(t.startsWith("id\tname\tzip\tamount"), `not tab-separated: ${JSON.stringify(t.slice(0, 40))}`);
    assert(t.includes("Smith, J"), "quoted value lost");
  });

  await check("R-L", "Ctrl+S during a CSV cell edit saves the typed value", async () => {
    await page.evaluate(() => window.__app.updateSettings({ autoSave: false }));
    await open("/work/semi.csv");
    await page.locator(".csv-cell:visible", { hasText: "5" }).first().dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("55");
    await page.keyboard.press("Control+s");
    await waitFor(async () => (await fsText("/work/semi.csv"))?.includes("55"), 3000, "edit saved");
    assert((await fsText("/work/semi.csv")) === "a;b;c\n1;2;3\n4;55;6", `unexpected: ${JSON.stringify(await fsText("/work/semi.csv"))}`);
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  });

  await check("S-1", "a hostile Markdown file never makes the app touch network paths", async () => {
    await page.evaluate(() => {
      window.__reads = [];
      const p = window.__app.platform;
      if (!p.__wrapped) {
        const orig = p.readFile.bind(p);
        p.readFile = (path) => { window.__reads.push(path); return orig(path); };
        const origStat = p.stat.bind(p);
        p.stat = (path) => { window.__reads.push(path); return origStat(path); };
        p.__wrapped = true;
      }
      window.__fs.write("/work/evil.md", "# Evil\n\n![a](\\\\\\\\attacker\\\\share\\\\a.png)\n\n![b](//attacker.com/s/b.png)\n\n![c](file:///C:/secret.png)\n\n![d](https://tracker.example/pixel.png)\n\n[click](\\\\\\\\attacker\\\\share\\\\x.md)\n\n<form action=\"https://evil.example/login\"><input name=p><button>Go</button></form>\n\n<style>.toolbar{display:none}</style>\n\n<img src=x onerror=\"window.__pwned=1\">\n\n<a href=\"javascript:window.__pwned=2\">js</a>\n");
    });
    await open("/work/evil.md");
    await page.waitForTimeout(800);
    const reads = await page.evaluate(() => window.__reads);
    assert(!reads.some((r) => /attacker|tracker|^\/\/|^\\\\|^file:/i.test(r)), `touched: ${JSON.stringify(reads)}`);
    // Following the network link is refused with a message.
    await page.evaluate(() => { const s = window.__app.getState(); window.__app.openLink(s.tabs.find((t) => t.id === s.activeId), "\\\\attacker\\share\\x.md"); });
    await page.waitForTimeout(200);
    const reads2 = await page.evaluate(() => window.__reads);
    assert(!reads2.some((r) => /attacker/i.test(r)), "network link was followed");
    // The side-by-side preview strips forms, styles and script attributes.
    await page.getByRole("button", { name: "Side-by-side preview" }).click();
    await waitFor(async () => (await page.locator(".md-preview h1").count()) > 0, 5000, "preview rendered");
    const html = await page.locator(".md-preview").innerHTML();
    assert(!/<form|<input|<button|<style|onerror|javascript:/i.test(html), `unsafe HTML survived: ${html.slice(0, 300)}`);
    assert(await page.locator(".toolbar").isVisible(), "document CSS restyled the app");
    assert(!(await page.evaluate(() => window.__pwned)), "script ran");
    await page.getByRole("button", { name: "Side-by-side preview" }).click();
  });

  await check("S-8", "deeply nested Markdown cannot freeze the window", async () => {
    await page.evaluate(() => window.__fs.write("/work/nested.md", ">".repeat(20000) + " deep\n" + Array.from({ length: 3000 }, (_, i) => " ".repeat(i * 2) + "- x").join("\n")));
    await open("/work/nested.md");
    await page.getByRole("button", { name: "Side-by-side preview" }).click();
    const t0 = Date.now();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
    assert(Date.now() - t0 < 2000, "main thread blocked");
    await waitFor(async () => (await page.locator(".md-preview").innerText()).length > 0, 8000, "preview settled or reported too complex");
    await page.getByRole("button", { name: "Side-by-side preview" }).click();
  });

  await check("R-11", "an Office file that is also open in Microsoft Office shows a warning", async () => {
    const docx = Array.from(readFileSync(join(corpus, "report.docx")));
    await page.evaluate(([b]) => {
      window.__fs.write("/work/locked/Plan.docx", new Uint8Array(b));
      window.__fs.write("/work/locked/~$Plan.docx", new Uint8Array([1, 2, 3]));
    }, [docx]);
    await open("/work/locked/Plan.docx");
    await waitFor(() => page.getByText("looks open in Microsoft Office").isVisible(), 6000, "lock warning");
    await page.evaluate(() => { const s = window.__app.getState(); return window.__app.closeTab(s.activeId); });
  });

  await check("P-1", "large files stay fast: a 20 MB log opens in under 4 s and typing stays under 40 ms a key", async () => {
    const openMs = await page.evaluate(async () => {
      const line = "2026-11-22T10:00:00Z INFO request handled path=/api/items status=200 ms=12\n";
      window.__fs.write("/work/perf/big.log", new TextEncoder().encode(line.repeat(Math.ceil(20e6 / line.length))));
      const t0 = performance.now();
      await window.__app.openPath("/work/perf/big.log");
      while (!document.querySelector("section.doc-pane:not([hidden]) .cm-content")) await new Promise((r) => setTimeout(r, 20));
      return performance.now() - t0;
    });
    assert(openMs < 4000, `opening took ${Math.round(openMs)} ms`);
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    const t0 = Date.now();
    await page.keyboard.type("typing speed check");
    const perKey = (Date.now() - t0) / 18;
    assert(perKey < 40, `typing took ${perKey.toFixed(0)} ms per key`);
    // Close without keeping the edit (do not wait inside the page: closing may ask first).
    await page.evaluate(() => { const s = window.__app.getState(); void window.__app.closeTab(s.activeId); });
    const dlg = page.getByRole("alertdialog");
    await dlg.waitFor({ timeout: 3000 }).then(() => dlg.getByRole("button", { name: "Don't save" }).click()).catch(() => {});
    await waitFor(async () => !(await page.evaluate(() => window.__app.getState().tabs.some((t) => t.name === "big.log"))), 8000, "the large file to close");
  });

  await check("R-12", "a Markdown table shows as a table, opens for editing on click, and the file is untouched", async () => {
    const src = "# T\n\n| Owner | Task |\n|---|---|\n| Asha | Plan \\| draft |\n\nAfter.\n";
    await page.evaluate((t) => window.__fs.write("/work/table.md", new TextEncoder().encode(t)), src);
    await open("/work/table.md");
    await waitFor(() => page.locator("section.doc-pane:not([hidden]) .cm-md-table td").first().isVisible(), 5000, "rendered table");
    assert((await page.locator("section.doc-pane:not([hidden]) .cm-md-table td").nth(1).textContent()) === "Plan | draft", "escaped pipe not kept in the cell");
    await page.locator("section.doc-pane:not([hidden]) .cm-md-table").click();
    await waitFor(async () => !(await page.locator("section.doc-pane:not([hidden]) .cm-md-table").count()), 3000, "table source shown for editing");
    const bytes = await page.evaluate(async () => { const s = window.__app.getState(); return new TextDecoder().decode(await window.__app.handles.get(s.activeId).serialize()); });
    assert(bytes === src, "the document text changed");
  });

  await check("D-1", "an edit typed during a slow save (with a recovery copy taken meanwhile) is never lost", async () => {
    await page.evaluate(() => { window.__fs.write("/work/loss/a.md", new TextEncoder().encode("hello\n")); window.__app.updateSettings({ autoSave: false }); });
    await open("/work/loss/a.md");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("A");
    await page.evaluate(() => { const p = window.__app.platform; window.__origWrite = p.writeFile; p.writeFile = async (...a) => { await new Promise((r) => setTimeout(r, 2500)); return window.__origWrite.apply(p, a); }; });
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(150);
    await page.keyboard.type("X");
    await page.waitForTimeout(3500);
    await page.evaluate(() => { window.__app.platform.writeFile = window.__origWrite; });
    await page.keyboard.type("Y");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);
    assert((await activeTab()).dirty, "the tab looks saved although X was never written");
    await page.keyboard.press("Control+s");
    await waitFor(async () => !(await activeTab()).dirty, 5000, "saved");
    const disk = new TextDecoder().decode(new Uint8Array(await fsRead("/work/loss/a.md")));
    assert(disk.includes("AX"), `disk has ${JSON.stringify(disk)}`);
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  });

  await check("D-2", "when a later save fails, the tab stays unsaved and closing it asks", async () => {
    await page.evaluate(() => { window.__fs.write("/work/loss/b.md", new TextEncoder().encode("one\n")); window.__app.updateSettings({ autoSave: false }); });
    await open("/work/loss/b.md");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("1");
    await page.evaluate(() => { const p = window.__app.platform; window.__origWrite = p.writeFile; let n = 0; p.writeFile = async (...a) => { n++; if (n === 1) { await new Promise((r) => setTimeout(r, 1500)); return window.__origWrite.apply(p, a); } throw new Error("disk full"); }; });
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(100);
    await page.keyboard.type("2");
    await page.evaluate(() => { const s = window.__app.getState(); void window.__app.saveTab(s.activeId); });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { window.__app.platform.writeFile = window.__origWrite; });
    assert((await activeTab()).dirty, "a failed save left the tab looking saved");
    await page.evaluate(() => { const s = window.__app.getState(); void window.__app.closeTab(s.activeId); });
    await waitFor(() => page.getByRole("alertdialog").isVisible(), 3000, "the save question");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitFor(async () => !(await page.evaluate(() => window.__app.getState().tabs.some((t) => t.name === "b.md"))), 5000, "closed after saving");
    const disk = new TextDecoder().decode(new Uint8Array(await fsRead("/work/loss/b.md")));
    assert(disk.includes("12"), `disk has ${JSON.stringify(disk)}`);
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  });

  await check("D-3", "a CSV in an older encoding asks before characters it cannot hold are saved", async () => {
    await page.evaluate(() => window.__fs.write("/work/loss/latin.csv", new Uint8Array([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x63, 0x61, 0x66, 0xe9, 0x0a])));
    await open("/work/loss/latin.csv");
    await waitFor(() => page.locator("section.doc-pane:not([hidden]) .csv-cell").first().isVisible(), 5000, "grid");
    await page.locator("section.doc-pane:not([hidden]) .csv-cell").first().dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Łódź");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Control+s");
    await waitFor(() => page.getByRole("alertdialog").isVisible(), 4000, "the encoding question");
    await page.getByRole("button", { name: "Save as UTF-8" }).click();
    await waitFor(async () => !(await activeTab()).dirty, 5000, "saved");
    const disk = new TextDecoder().decode(new Uint8Array(await fsRead("/work/loss/latin.csv")));
    assert(disk.includes("Łódź"), `disk has ${JSON.stringify(disk)}`);
  });

  await check("U-1", "list and task buttons leave the cursor after the marker", async () => {
    await page.evaluate(() => window.__app.newFile("markdown"));
    await page.waitForSelector("section.doc-pane:not([hidden]) .cm-content");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.getByRole("button", { name: "Task list" }).click();
    await page.keyboard.type("abc");
    const text = await page.evaluate(async () => { const s = window.__app.getState(); return new TextDecoder().decode(await window.__app.handles.get(s.activeId).serialize()); });
    assert(text.startsWith("- [ ] abc"), `document reads ${JSON.stringify(text)}`);
  });

  await check("U-2", "focus returns to the document after the palette closes, and stays inside dialogs", async () => {
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.press("Control+k");
    await waitFor(() => page.locator("[cmdk-input]").isVisible(), 3000, "palette");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    assert(await page.evaluate(() => !!document.activeElement?.closest(".cm-editor")), "focus did not return to the editor");
    await page.keyboard.press("Control+,");
    await waitFor(() => page.getByRole("dialog", { name: "Settings" }).isVisible(), 3000, "settings");
    for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
    assert(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), "Tab left the dialog");
    await page.keyboard.press("Escape");
    await waitFor(async () => !(await page.getByRole("dialog", { name: "Settings" }).count()), 3000, "settings closed");
    await waitFor(() => page.evaluate(() => !!document.activeElement?.closest(".cm-editor")), 2000, "focus back in the editor after Settings");
    await page.evaluate(async () => { const s = window.__app.getState(); window.__app.updateSettings({ autoSave: false }); void window.__app.closeTab(s.activeId); });
    const dlg = page.getByRole("alertdialog");
    await dlg.waitFor({ timeout: 3000 }).then(() => dlg.getByRole("button", { name: "Don't save" }).click()).catch(() => {});
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  });

  await check("U-3", "highlighting PDF text shows no error", async () => {
    await open("/work/sample.pdf");
    await waitFor(async () => (await page.locator(".pdfViewer .page canvas:visible").count()) > 0, 8000, "pages");
    const before = await page.locator(".toast").count();
    await page.getByRole("button", { name: /Highlight/ }).first().click();
    const box = await page.locator(".pdfViewer .textLayer span").first().boundingBox();
    if (box) {
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
    }
    await page.waitForTimeout(600);
    const texts = await page.locator(".toast").allTextContents();
    assert(!texts.some((t) => /went wrong/i.test(t)), `error toast: ${texts.join(" | ")}`);
    await page.getByRole("button", { name: /Select/ }).first().click().catch(() => {});
    void before;
  });

  await check("D-4", "after typing during a save, undoing back to what is on disk reads as saved, and further back as unsaved", async () => {
    await page.evaluate(() => { window.__fs.write("/work/loss/c.txt", new TextEncoder().encode("start")); window.__app.updateSettings({ autoSave: false }); });
    await open("/work/loss/c.txt");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("A");
    await page.waitForTimeout(700); // separate undo steps (the editor groups quick typing)
    await page.evaluate(() => { const p = window.__app.platform; window.__origWrite = p.writeFile; p.writeFile = async (...a) => { await new Promise((r) => setTimeout(r, 1000)); return window.__origWrite.apply(p, a); }; });
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(100);
    await page.keyboard.type("B");
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__app.platform.writeFile = window.__origWrite; });
    assert((await activeTab()).dirty, "B is not on disk, so the tab must be unsaved");
    await page.keyboard.press("Control+z");
    await waitFor(async () => !(await activeTab()).dirty, 2000, "clean when the text equals the disk");
    await page.keyboard.press("Control+z");
    await waitFor(async () => (await activeTab()).dirty, 2000, "unsaved again when the text differs from the disk");
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  });

  await check("U-4", "a question over Settings keeps Tab to itself and Escape closes only the question", async () => {
    await page.evaluate(() => window.__app.newFile("markdown"));
    await page.waitForSelector("section.doc-pane:not([hidden]) .cm-content");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.type("unsaved note");
    await page.keyboard.press("Control+,");
    await waitFor(() => page.getByRole("dialog", { name: "Settings" }).isVisible(), 3000, "settings");
    await page.evaluate(() => { const s = window.__app.getState(); void window.__app.closeTab(s.activeId); });
    await waitFor(() => page.getByRole("alertdialog").isVisible(), 3000, "the save question");
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      seen.add(await page.evaluate(() => document.activeElement?.closest("[role=alertdialog]") ? document.activeElement.textContent : "outside"));
    }
    assert(!seen.has("outside"), "Tab left the question");
    assert(seen.has("Don't save") && seen.has("Cancel"), `buttons reached: ${[...seen].join(", ")}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    assert(!(await page.getByRole("alertdialog").count()), "the question did not close");
    assert(await page.getByRole("dialog", { name: "Settings" }).isVisible(), "Settings closed too");
    await page.keyboard.press("Escape");
  });

  await check("U-5", "double-clicking a column name renames it, its border fits it; Escape discards a name or cell edit", async () => {
    await page.evaluate(() => window.__fs.write("/work/rename.csv", new TextEncoder().encode("name,age\nLee,5\n")));
    await open("/work/rename.csv");
    const head = page.locator("section.doc-pane:not([hidden]) .csv-hcell").first();
    await waitFor(() => head.isVisible(), 5000, "grid");
    await head.dblclick();
    await page.locator("section.doc-pane:not([hidden]) .csv-head-input").fill("Full name");
    await page.keyboard.press("Enter");
    await head.dblclick();
    await page.locator("section.doc-pane:not([hidden]) .csv-head-input").fill("oops");
    await page.keyboard.press("Escape");
    const grip = page.locator("section.doc-pane:not([hidden]) .csv-hcell .grip").first();
    await head.evaluate((el) => (el.style.width = "300px"));
    await grip.dblclick();
    assert(!(await page.locator("section.doc-pane:not([hidden]) .csv-head-input").count()), "double-clicking the column border opened the rename box");
    const fitted = await head.evaluate((el) => el.getBoundingClientRect().width);
    assert(fitted < 200, `the column was not fitted to its text (${fitted}px)`);
    await page.locator("section.doc-pane:not([hidden]) .csv-cell", { hasText: "Lee" }).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("WRONG");
    await page.keyboard.press("Escape");
    const text = await page.evaluate(async () => { const s = window.__app.getState(); return new TextDecoder().decode(await window.__app.handles.get(s.activeId).serialize()); });
    assert(text === "Full name,age\nLee,5\n", `document reads ${JSON.stringify(text)}`);
    assert((await activeTab()).dirty, "rename did not mark the tab unsaved");
    const focused = await page.evaluate(() => !!document.activeElement?.closest("section.doc-pane:not([hidden])"));
    assert(focused, "focus left the grid after renaming");
  });

  await check("F-34", "dark theme applies", async () => {
    await page.evaluate(() => window.__app.updateSettings({ theme: "dark" }));
    await waitFor(async () => (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark", 2000, "dark");
    await open("/work/notes.md");
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(shots, "dark-markdown.png") });
    await page.evaluate(() => window.__app.updateSettings({ theme: "light" }));
  });

  await check("F-41", "phone-width window uses the compact layout", async () => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(300);
    assert(await page.locator(".tab-count").isVisible(), "tab count button not shown");
    await page.screenshot({ path: join(shots, "compact.png") });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ---------- Accessibility (A-*): keyboard, screen reader names and states, contrast, touch ----------
  const focusInfo = () => page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { where: "body" };
    const part = a.closest(".tabrow, .toolbar, .doc-area, .statusbar, .toasts, .menu, .side, .overlay");
    return { where: part ? part.classList[0] : "elsewhere", role: a.getAttribute("role"), name: (a.getAttribute("aria-label") ?? a.textContent ?? "").trim().slice(0, 40) };
  });
  const closeAllTabs = async () => {
    await page.evaluate(() => window.__app.updateSettings({ autoSave: false }));
    for (let i = 0; i < 60 && (await page.evaluate(() => window.__app.getState().tabs.length)); i++) {
      await page.evaluate(() => { const s = window.__app.getState(); void window.__app.closeTab(s.tabs[0].id); });
      const dlg = page.getByRole("alertdialog");
      if (await dlg.waitFor({ timeout: 500 }).then(() => true, () => false)) await dlg.getByRole("button", { name: "Don't save" }).click();
    }
    await page.evaluate(() => window.__app.updateSettings({ autoSave: true }));
  };
  const menuItem = () => page.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem" ? document.activeElement.firstElementChild.textContent : "(not on a menu item)");

  await check("A-1", "menus: Enter opens on the first item; arrows, Home, End and letters move; Escape goes back to the button", async () => {
    await open("/work/notes.md");
    const btn = page.getByRole("button", { name: "Menu", exact: true });
    assert((await btn.getAttribute("aria-haspopup")) === "menu" && (await btn.getAttribute("aria-expanded")) === "false", "the Menu button does not say it opens a menu");
    await btn.focus();
    await page.keyboard.press("Enter");
    await waitFor(() => page.locator(".menu[role=menu]").isVisible(), 2000, "the menu");
    assert((await btn.getAttribute("aria-expanded")) === "true", "aria-expanded is not true while open");
    assert((await menuItem()) === "New Markdown note", `it opened on ${await menuItem()}`);
    await page.keyboard.press("ArrowDown");
    assert((await menuItem()) === "Open file…", `ArrowDown went to ${await menuItem()}`);
    await page.keyboard.press("End");
    assert((await menuItem()) === "About Productivity", `End went to ${await menuItem()}`);
    await page.keyboard.press("ArrowDown");
    assert((await menuItem()) === "New Markdown note", "ArrowDown does not wrap round to the top");
    await page.keyboard.type("se");
    assert((await menuItem()) === "Settings", `typing "se" went to ${await menuItem()}`);
    await page.keyboard.press("Escape");
    await waitFor(async () => !(await page.locator(".menu").count()), 2000, "the menu to close");
    assert(await btn.evaluate((el) => el === document.activeElement), `Escape left the keyboard on ${JSON.stringify(await focusInfo())}`);
    assert((await btn.getAttribute("aria-expanded")) === "false", "aria-expanded is still true");
  });

  await check("A-2", "menus: Tab closes one and moves on; the status bar's Details menu goes back to its button", async () => {
    await page.getByRole("button", { name: "Menu", exact: true }).focus();
    await page.keyboard.press("Enter");
    await waitFor(() => page.locator(".menu").isVisible(), 2000, "the menu");
    await page.keyboard.press("Tab");
    await waitFor(async () => !(await page.locator(".menu").count()), 2000, "Tab to close the menu");
    assert((await focusInfo()).where === "toolbar", `Tab went to ${JSON.stringify(await focusInfo())}`);
    const details = page.locator("#status-details");
    assert((await details.getAttribute("aria-haspopup")) === "menu", "Details does not say it opens a menu");
    await details.click();
    await waitFor(() => page.locator(".menu").isVisible(), 2000, "the Details menu");
    assert((await details.getAttribute("aria-expanded")) === "true", "Details is not marked expanded");
    assert((await menuItem()).startsWith("Language"), `the Details menu opened on ${await menuItem()}`);
    await page.keyboard.press("Escape");
    assert(await details.evaluate((el) => el === document.activeElement), `Escape went to ${JSON.stringify(await focusInfo())}`);
  });

  await check("A-3", "tabs: one Tab stop, arrows move without opening, Enter opens, Delete closes and stays on the strip", async () => {
    await closeAllTabs();
    for (const f of ["plan.md", "data.csv", "legacy.txt"]) await open(`/work/${f}`);
    const s = await page.evaluate(() => ({
      nested: document.querySelectorAll(".tabs [role=tab] :is(button, a, input, [tabindex])").length,
      others: [...document.querySelectorAll(".tabs[role=tablist] *")].filter((el) => !el.closest("[aria-hidden=true]") && (el.hasAttribute("role") ? el.getAttribute("role") !== "tab" : el.matches("button, a, input"))).length,
      stops: document.querySelectorAll(".tabs[role=tablist] [tabindex='0']").length,
    }));
    assert(!s.nested && !s.others && s.stops === 1, `tab strip structure: ${JSON.stringify(s)}`);
    const tabName = () => page.evaluate(() => document.activeElement?.getAttribute("role") === "tab" ? document.activeElement.querySelector(".name").textContent : "(not on a tab)");
    await page.locator(".tabs [role=tab][aria-selected=true]").focus();
    await page.keyboard.press("ArrowLeft");
    assert((await tabName()) === "data.csv", `ArrowLeft went to ${await tabName()}`);
    assert((await activeTab()).name === "legacy.txt", "an arrow key opened the tab");
    await page.keyboard.press("Enter");
    await waitFor(async () => (await activeTab()).name === "data.csv", 2000, "Enter to open data.csv");
    await waitFor(async () => (await focusInfo()).where === "doc-area", 2000, "the keyboard to move into the opened table");
    await page.locator(".tabs [role=tab][aria-selected=true]").focus();
    await page.keyboard.press("End");
    assert((await tabName()) === "legacy.txt", `End went to ${await tabName()}`);
    await page.keyboard.press("Delete");
    await waitFor(async () => !(await appState()).tabs.some((t) => t.name === "legacy.txt"), 3000, "Delete to close legacy.txt");
    await waitFor(async () => (await tabName()) === "data.csv", 2000, "the keyboard to stay on the tab strip");
    const tab = page.locator(".tab", { hasText: "plan.md" });
    await tab.hover();
    await tab.locator(".close").click();
    await waitFor(async () => !(await appState()).tabs.some((t) => t.name === "plan.md"), 3000, "the close button to close plan.md");
  });

  await check("A-4", "Ctrl+W on the last tab leaves the keyboard on the home screen, which says nothing in its status bar", async () => {
    await closeAllTabs();
    await open("/work/plan.md");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.press("Control+w");
    await waitFor(() => page.locator(".home").isVisible(), 3000, "the home screen");
    await waitFor(() => page.evaluate(() => !!document.activeElement?.matches(".create-card")), 2000, "the keyboard on the first Create card");
    assert((await page.locator(".statusbar").innerText()).trim() === "", "the status bar has text with no file open");
    assert((await page.locator(".search-kbd").getAttribute("aria-label")) === "Search files and commands, Ctrl K", "the home search button's name");
  });

  await check("A-5", "home: recent files are a list of real buttons; Pin and Remove show on focus; the time lines up at the right", async () => {
    const s = await page.evaluate(() => {
      const row = document.querySelector(".recent-row");
      const r = row.getBoundingClientRect(), w = row.querySelector(".when").getBoundingClientRect();
      return { list: row.parentElement.tagName, row: row.tagName, fake: document.querySelectorAll(".home [role=button]").length, nested: document.querySelectorAll(".recent-open :is(button, a)").length, gap: Math.round(r.right - w.right) };
    });
    assert(s.list === "UL" && s.row === "LI" && !s.fake && !s.nested, `structure: ${JSON.stringify(s)}`);
    assert(s.gap <= 12, `the time is ${s.gap}px in from the right edge`);
    const first = page.locator(".recent-row").first();
    await first.locator(".recent-open").focus();
    await waitFor(async () => (await first.locator(".row-acts").evaluate((el) => getComputedStyle(el).opacity)) === "1", 1000, "Pin and Remove to show on focus");
    const name = await first.locator(".n").textContent();
    await page.keyboard.press(" ");
    await waitFor(async () => (await activeTab())?.name === name, 3000, "Space to open the file");
  });

  await check("A-6", "toasts stay while pointed at or focused, ones with a button wait to be used, and errors are alerts", async () => {
    await open("/work/report.docx");
    await waitFor(() => page.getByText("Quarterly report").first().isVisible(), 8000, "the Word preview");
    await page.locator(".tabs [role=tab][aria-selected=true]").focus();
    await page.keyboard.press("Control+s"); // a read-only preview: a message without a button
    const t = page.locator(".toast", { hasText: "read-only" });
    await waitFor(() => t.isVisible(), 2000, "the toast");
    assert((await t.evaluate((el) => el.closest("[role]")?.getAttribute("role"))) === "status", "a message is not a status");
    await t.hover();
    await page.waitForTimeout(5000);
    assert(await t.isVisible(), "it went away while pointed at");
    await page.mouse.move(640, 300);
    await waitFor(async () => !(await t.count()), 7000, "it to go after the pointer left");
    await page.keyboard.press("Control+s");
    await waitFor(() => t.isVisible(), 2000, "the toast again");
    await t.locator(".toast-close").focus();
    await page.waitForTimeout(5000);
    assert(await t.isVisible(), "it went away while focused");
    await page.keyboard.press("Enter");
    await waitFor(async () => !(await t.count()), 2000, "Enter to dismiss it");
    assert((await focusInfo()).role === "tab", `dismissing it left the keyboard on ${JSON.stringify(await focusInfo())}`);
    await open("/work/plan.md");
    await page.evaluate(() => window.__fs.queueSave("/work/plan-a11y.html"));
    await page.keyboard.press("Control+e");
    await page.locator(".export-row", { hasText: "Web page" }).click();
    const done = page.locator(".toast", { hasText: "Exported plan-a11y.html" });
    await waitFor(() => done.isVisible(), 4000, "the export toast");
    await page.waitForTimeout(5000);
    assert(await done.isVisible(), "a toast with a button went away by itself");
    await done.getByRole("button", { name: "Open" }).click();
    await waitFor(async () => (await activeTab())?.name === "plan-a11y.html", 3000, "Open in the toast");
    await page.evaluate(() => { const s = window.__app.getState(); window.__app.openLink(s.tabs.find((x) => x.id === s.activeId), "\\\\server\\share\\x.md"); });
    const err = page.locator(".toast.error");
    await waitFor(() => err.isVisible(), 2000, "the error toast");
    assert((await err.evaluate((el) => el.closest("[role]")?.getAttribute("role"))) === "alert", "an error is not an alert");
    await err.locator(".toast-close").click();
  });

  await check("A-7", "dialogs and the palette are modal: the window behind is inert until they close", async () => {
    const state = () => page.evaluate(() => ({
      modal: [...document.querySelectorAll('[aria-modal="true"]')].map((d) => d.getAttribute("role")),
      inert: [".tabrow", ".main", ".statusbar"].map((s) => !!document.querySelector(s)?.closest("[inert]")),
      toasts: !!document.querySelector(".toasts")?.closest("[inert]"),
    }));
    await page.keyboard.press("Control+,");
    await waitFor(() => page.getByRole("dialog", { name: "Settings" }).isVisible(), 2000, "Settings");
    let s = await state();
    assert(s.modal.includes("dialog") && s.inert.every(Boolean) && !s.toasts, `with Settings open: ${JSON.stringify(s)}`);
    await page.keyboard.press("Escape");
    await waitFor(async () => !(await page.getByRole("dialog", { name: "Settings" }).count()), 2000, "Settings to close");
    s = await state();
    assert(!s.modal.length && !s.inert.some(Boolean), `after closing: ${JSON.stringify(s)}`);
    await page.keyboard.press("Control+k");
    await waitFor(() => page.locator("[cmdk-input]").isVisible(), 2000, "the palette");
    s = await state();
    assert(s.modal.includes("dialog") && s.inert.every(Boolean), `with the palette open: ${JSON.stringify(s)}`);
    await page.keyboard.press("Escape");
    await waitFor(async () => !(await page.locator("[cmdk-input]").count()), 2000, "the palette to close");
    assert(!(await state()).inert.some(Boolean), "the window stayed inert after the palette");
    await page.evaluate(() => window.__app.newFile("markdown"));
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.type("draft");
    await page.evaluate(() => { const st = window.__app.getState(); void window.__app.closeTab(st.activeId); });
    const q = page.getByRole("alertdialog");
    await waitFor(() => q.isVisible(), 2000, "the save question");
    assert((await q.getAttribute("aria-modal")) === "true" && !!(await q.getAttribute("aria-describedby")), "the question is not a described modal alert dialog");
    await q.getByRole("button", { name: "Don't save" }).click();
  });

  await check("A-8", "save results are announced once, not on every key", async () => {
    await page.evaluate(() => window.__fs.write("/work/a11y-save.txt", new TextEncoder().encode("start")));
    await open("/work/a11y-save.txt");
    const live = page.locator(".statusbar [role=status]");
    assert((await live.textContent()) === "", "something was announced on opening");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" one");
    await waitFor(async () => (await live.textContent()) === "Saved", 4000, '"Saved" after the auto-save');
    await live.evaluate((el) => { window.__said = []; new MutationObserver(() => window.__said.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); });
    for (const c of " two three") { await page.keyboard.type(c); await page.waitForTimeout(120); }
    await waitFor(async () => !(await activeTab()).dirty, 4000, "the next auto-save");
    await page.waitForTimeout(300);
    const said = await page.evaluate(() => window.__said);
    assert(!said.length, `announced while typing and saving again: ${JSON.stringify(said)}`);
    await page.evaluate(() => { const p = window.__app.platform; window.__origWrite = p.writeFile; p.writeFile = async () => { throw new Error("disk full"); }; });
    await page.keyboard.type("!");
    await waitFor(async () => (await live.textContent()) === "Save failed", 4000, '"Save failed"');
    await page.evaluate(() => { window.__app.platform.writeFile = window.__origWrite; });
    await page.keyboard.type("?");
    await waitFor(async () => (await live.textContent()) === "Saved", 4000, '"Saved" once saving works again');
    assert((await page.locator(".save-state").getAttribute("aria-label")) === "Saved, version history", "the save state's name does not say it opens version history");
  });

  await check("A-9", "F6 and Shift+F6 move between the tab bar, toolbar, document and status bar; the shortcuts list says so", async () => {
    if (await page.locator(".side:not(.right)").count()) await page.getByRole("button", { name: "Show or hide the sidebar" }).click();
    for (const b of await page.locator(".toast-close").all()) await b.click().catch(() => {});
    await open("/work/notes.md");
    await page.locator("section.doc-pane:not([hidden]) .cm-content").click();
    const order = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press("F6"); order.push((await focusInfo()).where); }
    assert(order.join(" ") === "statusbar tabrow toolbar doc-area", `F6 went ${order.join(" → ")}`);
    await page.keyboard.press("Shift+F6");
    assert((await focusInfo()).where === "toolbar", `Shift+F6 went to ${JSON.stringify(await focusInfo())}`);
    await page.keyboard.press("Shift+F6");
    const f = await focusInfo();
    assert(f.where === "tabrow" && f.role === "tab", `the tab bar is entered at ${JSON.stringify(f)}`);
    await page.keyboard.press("Control+k");
    await page.locator("[cmdk-input]").fill("?");
    assert(await page.locator("[cmdk-item]", { hasText: "Move between the tab bar" }).isVisible(), "F6 is not in the shortcuts list");
    assert(await page.locator("[cmdk-item]", { hasText: "Leave a note or code editor" }).isVisible(), "Esc, then Tab is not in the shortcuts list");
    await page.keyboard.press("Escape");
  });

  await check("A-10", "Export stays in reach in a 640 × 400 window and on a phone; the zoom figure says what it does", async () => {
    await page.setViewportSize({ width: 640, height: 400 });
    try {
      await open("/work/sample.pdf");
      await waitFor(async () => (await page.locator(".pdfViewer .page canvas:visible").count()) > 0, 8000, "the pages");
      const reachable = () => page.evaluate(() => {
        const b = document.querySelector('.toolbar button[aria-label="Export"]');
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return r.left >= 0 && r.right <= window.innerWidth && !!hit && b.contains(hit);
      });
      assert(await reachable(), "Export is cut off at 640 px");
      assert(/^Zoom \d+%, fit to width$/.test(await page.locator("#status-zoom").getAttribute("aria-label")), "the zoom figure's name");
      await page.setViewportSize({ width: 390, height: 780 });
      await page.waitForTimeout(300);
      assert(await reachable(), "Export is cut off at 390 px");
      await page.locator('.toolbar button[aria-label="Export"]').click();
      await waitFor(() => page.getByRole("dialog", { name: "Export" }).isVisible(), 2000, "the Export dialog");
      await page.keyboard.press("Escape");
    } finally {
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  });

  await check("A-11", "Windows high contrast: selections, pressed buttons, the open tab, switches and focus stay visible", async () => {
    await page.emulateMedia({ forcedColors: "active" });
    try {
      const highlight = await page.evaluate(() => { const p = document.createElement("i"); p.style.color = "Highlight"; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
      await open("/work/data.csv");
      await waitFor(() => page.locator("section.doc-pane:not([hidden]) .csv-cell.cur").isVisible(), 4000, "the grid");
      const s = await page.evaluate(() => {
        const cs = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo);
        return { cell: cs("section.doc-pane:not([hidden]) .csv-cell.sel").backgroundColor, cur: cs("section.doc-pane:not([hidden]) .csv-cell.cur").outlineStyle, pressed: cs(".toolbar .icon-btn.active").backgroundColor, tab: cs(".tab.active", "::before").backgroundColor };
      });
      assert(s.cell === highlight && s.pressed === highlight && s.tab === highlight && s.cur === "solid", `${JSON.stringify(s)} (Highlight is ${highlight})`);
      await page.keyboard.press("Control+k");
      await waitFor(() => page.locator("[cmdk-item][data-selected=true]").isVisible(), 2000, "a palette item");
      const pal = await page.evaluate(() => { const c = getComputedStyle(document.querySelector("[cmdk-item][data-selected=true]")); return `${c.outlineStyle} ${c.outlineColor}`; });
      assert(pal === `solid ${highlight}`, `the palette's selected item: ${pal}`);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+,");
      await waitFor(() => page.getByRole("dialog", { name: "Settings" }).isVisible(), 2000, "Settings");
      const sw = await page.evaluate(() => { const el = document.querySelector(".switch"); return { border: getComputedStyle(el).borderTopStyle, knob: getComputedStyle(el.querySelector(".knob")).backgroundColor, track: getComputedStyle(el).backgroundColor }; });
      assert(sw.border === "solid" && sw.knob !== sw.track, `a switch: ${JSON.stringify(sw)}`);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+f");
      const box = page.locator("section.doc-pane:not([hidden]) .csv-filter .input");
      await waitFor(() => box.isVisible(), 2000, "the filter box");
      const ring = await box.evaluate((el) => { const c = getComputedStyle(el); return `${c.outlineStyle} ${c.outlineWidth}`; });
      assert(ring === "solid 2px", `a focused text box has no ring: ${ring}`);
      await page.keyboard.press("Escape");
    } finally {
      await page.emulateMedia({ forcedColors: "none" });
    }
  });

  await check("A-12", "contrast: format badges, code comments and control edges in light and dark", async () => {
    const measure = () => page.evaluate(() => {
      const rgb = (c) => {
        const m = /^rgba?\(([^)]+)\)/.exec(c);
        if (m) return m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
        return /^color\(srgb ([^)]+)\)/.exec(c)[1].split(/[\s/]+/).slice(0, 3).map((v) => Number(v) * 255);
      };
      const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const out = {};
      for (const b of document.querySelectorAll(".fmt-badge")) { const c = getComputedStyle(b); out[`badge ${b.textContent}`] = ratio(c.color, c.backgroundColor); }
      const surface = getComputedStyle(document.querySelector(".dialog")).backgroundColor;
      const probe = document.createElement("i");
      document.body.append(probe);
      for (const v of ["--syn-comment", "--control-edge"]) { probe.style.color = `var(${v})`; out[v] = ratio(getComputedStyle(probe).color, surface); }
      probe.remove();
      return out;
    });
    try {
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => window.__app.updateSettings({ theme: t }), theme);
        await open("/work/data.csv");
        assert(await page.getByRole("button", { name: "Header row" }).isVisible(), "the Header row button is not named by its words");
        await page.keyboard.press("Control+e");
        await waitFor(() => page.locator(".fmt-badge").first().isVisible(), 2000, "the Export dialog");
        const r = await measure();
        await page.keyboard.press("Escape");
        const low = Object.entries(r).filter(([k, v]) => v < (k === "--control-edge" ? 3 : 4.5));
        assert(!low.length, `${theme}: ${low.map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ")}`);
      }
    } finally {
      await page.evaluate(() => window.__app.updateSettings({ theme: "light" }));
    }
  });

  await check("A-13", "touch screens: no keyboard hints in the palette, controls of at least 24 px, toasts across the width", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    try {
      await p.goto(URL_);
      await p.waitForFunction(() => window.__app && window.__fs);
      await p.evaluate(() => {
        window.__fs.write("/m/t.csv", new TextEncoder().encode("a,b\n1,2\n"));
        window.__fs.write("/m/tasks.md", new TextEncoder().encode("- [ ] buy milk\n- [x] call Ana\n"));
      });
      const size = (sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, sel);
      await p.evaluate(() => window.__app.openPath("/m/t.csv"));
      await p.waitForSelector("section.doc-pane:not([hidden]) .csv-hcell .grip");
      const [gw] = await size("section.doc-pane:not([hidden]) .csv-hcell .grip");
      assert(gw >= 24, `a column grip is ${gw}px wide`);
      await p.evaluate(() => window.__app.openPath("/m/tasks.md"));
      await p.waitForSelector("section.doc-pane:not([hidden]) .cm-md-task");
      for (const sel of ["section.doc-pane:not([hidden]) .cm-md-task", ".tab.active .close"]) {
        const [w, h] = await size(sel);
        assert(w >= 24 && h >= 24, `${sel} is ${w}×${h}`);
      }
      await p.getByRole("button", { name: "Search and commands" }).click();
      await p.locator("[cmdk-input]").waitFor();
      const hints = await p.evaluate(() => [...document.querySelectorAll(".palette [cmdk-item] .kbd")].filter((k) => k.getClientRects().length).map((k) => k.textContent));
      assert(!hints.length, `keyboard hints shown on a touch screen: ${hints.join(", ")}`);
      assert(!(await p.locator(".palette .foot").innerText()).includes("shortcuts"), "the shortcuts tip is shown on a touch screen");
      await p.keyboard.press("Escape");
      await p.evaluate(() => { const s = window.__app.getState(); window.__app.openLink(s.tabs.find((t) => t.id === s.activeId), "\\\\server\\x.md"); });
      const t = p.locator(".toast");
      await t.first().waitFor();
      const w = await t.first().evaluate((el) => el.getBoundingClientRect().width);
      assert(w >= 390 - 32 - 1, `a toast is only ${Math.round(w)}px wide on a 390px screen`);
    } finally {
      await ctx.close();
    }
  });

  await check("A-14", "the palette stays quick in a folder of 20,000 files", async () => {
    await page.evaluate(async () => {
      const b = new TextEncoder().encode("x");
      for (let i = 0; i < 20000; i++) window.__fs.write(`/big/d${i % 50}/report-${i}.md`, b);
      await window.__app.openFolder("/big");
    });
    await page.keyboard.press("Control+k");
    await page.locator("[cmdk-input]").waitFor();
    await page.waitForTimeout(500);
    const times = [];
    for (const c of "report-12") {
      const t0 = Date.now();
      await page.keyboard.press(c);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
      times.push(Date.now() - t0);
    }
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__app.openFolder("/work"));
    times.sort((a, b) => a - b);
    assert(times[times.length >> 1] < 150, `a key takes ${times[times.length >> 1]} ms (median)`);
  });

  await check("A-15", "closing a large table gives its memory back (nothing keeps the closed document alive)", async () => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const heap = async () => {
      for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics");
      return metrics.find((m) => m.name === "JSHeapUsedSize").value / 1048576;
    };
    try {
      await page.evaluate(() => {
        const parts = ["id,name,zip,amount\n"];
        for (let i = 0; i < 200000; i++) parts.push(`${i},Person ${i},${10000 + (i % 89999)},${i % 1000}\n`);
        window.__fs.write("/work/big.csv", new TextEncoder().encode(parts.join("")));
      });
      const before = await heap();
      await open("/work/big.csv");
      await waitFor(() => page.locator("section.doc-pane:not([hidden]) .csv-cell").first().isVisible(), 20000, "the table");
      const opened = await heap();
      // What used to keep it: the Details menu, the palette, and React's copies of the status bar and toolbar.
      await page.locator("#status-details").click();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+k");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+w");
      await waitFor(async () => !(await appState()).tabs.some((t) => t.name === "big.csv"), 4000, "the table to close");
      await page.waitForTimeout(300);
      const after = await heap();
      assert(after - before < (opened - before) * 0.2, `${(after - before).toFixed(1)} MB of the table's ${(opened - before).toFixed(1)} MB stayed in memory`);
    } finally {
      await cdp.detach();
    }
  });

  // Screenshots of each engine for review.
  for (const f of ["notes.md", "data.csv", "sample.pdf", "report.docx", "budget.xlsx"]) {
    await open(`/work/${f}`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(shots, `engine-${f.replace(/\./g, "-")}.png`) });
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  const unexpected = errors.filter((e) => !/ResizeObserver|favicon/.test(e));
  console.log(`\n${results.length - failed.length}/${results.length} flows passed`);
  if (unexpected.length) console.log("Page errors:\n  " + [...new Set(unexpected)].slice(0, 10).join("\n  "));
  process.exit(failed.length || unexpected.length ? 1 : 0);
})();
