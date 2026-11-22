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
