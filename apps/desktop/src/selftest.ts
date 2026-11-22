/** Exercises the real platform bridge end to end and writes a report, then closes the app.
 *  Used to verify an installed build: PRODUCTIVITY_SELF_TEST=C:\some\folder productivity.exe */
import { platform } from "./platform";
import { join } from "./lib/paths";
import { decodeText, encodeText, bytesEqual } from "./lib/textcodec";
import { loadCsv, saveCsv } from "./lib/csv";

export async function runSelfTest(dir: string) {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const t = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  };
  const assert = (c: unknown, m: string) => {
    if (!c) throw new Error(m);
  };
  const p = (n: string) => join(dir, n);
  const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => (i * 31) & 255);

  await t("write and read binary (3 MB)", async () => {
    await platform.writeFile(p("big.bin"), big);
    assert(bytesEqual(await platform.readFile(p("big.bin")), big), "bytes differ");
  });
  await t("unicode path and name", async () => {
    const name = p("résumé — 日本.txt");
    await platform.writeFile(name, new TextEncoder().encode("ok"));
    assert(new TextDecoder().decode(await platform.readFile(name)) === "ok", "content differs");
    assert((await platform.stat(name)).exists, "stat failed");
  });
  await t("text codec round trip through disk (CRLF + BOM)", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("a\r\nb\r\n")]);
    await platform.writeFile(p("crlf.md"), bytes);
    const d = decodeText(await platform.readFile(p("crlf.md")));
    assert(bytesEqual(encodeText(d.text, d.format), bytes), "not byte-identical");
  });
  await t("CSV round trip through disk", async () => {
    const bytes = new TextEncoder().encode('id,name\r\n00012,"Smith, J"\r\n');
    await platform.writeFile(p("data.csv"), bytes);
    assert(bytesEqual(saveCsv(loadCsv(await platform.readFile(p("data.csv")))), bytes), "not byte-identical");
  });
  await t("save keeps the previous version", async () => {
    await platform.writeFile(p("v.txt"), new TextEncoder().encode("one"));
    await platform.writeFile(p("v.txt"), new TextEncoder().encode("two"), { snapshot: true });
    const list = await platform.snapshotList(p("v.txt"));
    assert(list.length >= 1, "no snapshot");
    assert(new TextDecoder().decode(await platform.snapshotRead(p("v.txt"), list[0].id)) === "one", "wrong snapshot content");
  });
  await t("recovery storage round trip", async () => {
    await platform.recoveryWrite("selftest", JSON.stringify({ name: "x" }), new TextEncoder().encode("unsaved"));
    assert((await platform.recoveryList()).some((r) => r.id === "selftest"), "not listed");
    assert(new TextDecoder().decode(await platform.recoveryRead("selftest")) === "unsaved", "content");
    await platform.recoveryClear("selftest");
  });
  await t("app state round trip", async () => {
    await platform.stateSet("selftest", '{"a":1}');
    assert((await platform.stateGet("selftest")) === '{"a":1}', "state differs");
  });
  await t("list folder and search", async () => {
    await platform.writeFile(p("needle.md"), new TextEncoder().encode("hay\nfind the needle here\n"));
    const entries = await platform.listDir(dir);
    assert(entries.some((e) => e.name === "needle.md"), "listing missing file");
    const hits = await platform.searchFolder(dir, "needle here", { caseSensitive: false, regex: false, wholeWord: false });
    assert(hits.some((h) => h.line === 2), "search did not find line 2");
    const files = await platform.findFiles(dir);
    assert(files.length >= 5, "findFiles returned too few");
  });
  await t("writing to a missing folder fails cleanly", async () => {
    let failed = false;
    try {
      await platform.writeFile(join(join(dir, "no-such-folder"), "x.txt"), new Uint8Array([1]));
    } catch {
      failed = true;
    }
    assert(failed, "expected an error");
  });

  // Open every sample file in the folder through the real interface and time it.
  const timings: Record<string, number> = { startupToSelfTestMs: Math.round(performance.now()) };
  const { openPath } = await import("./app/actions");
  const { getState, handles } = await import("./app/store");
  const selector: Record<string, string> = {
    md: ".cm-content", txt: ".cm-content", py: ".cm-content", csv: ".csv-cell",
    pdf: ".pdfViewer .page canvas", docx: ".docx-host section", xlsx: ".xlsx-table td", pptx: ".slide-card",
  };
  const samples = (await platform.listDir(dir)).filter((e) => !e.isDir && selector[e.name.split(".").pop()!.toLowerCase()] && !e.name.startsWith("selftest"));
  for (const f of samples) {
    const ext = f.name.split(".").pop()!.toLowerCase();
    await t(`open ${f.name} in its engine`, async () => {
      const t0 = performance.now();
      const id = await openPath(f.path);
      assert(id, "no tab");
      const deadline = t0 + 20000;
      for (;;) {
        const tab = getState().tabs.find((x) => x.id === id);
        assert(tab && !tab.error, tab?.error ?? "tab missing");
        const pane = document.querySelector(`section.doc-pane:not([hidden]) ${selector[ext]}`);
        if (pane && handles.has(id!)) break;
        assert(performance.now() < deadline, "engine did not render within 20 s");
        await new Promise((r) => setTimeout(r, 50));
      }
      timings[`open:${f.name}`] = Math.round(performance.now() - t0);
    });
  }

  const report = JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, results, timings, userAgent: navigator.userAgent }, null, 2);
  await platform.writeFile(p("selftest-report.json"), new TextEncoder().encode(report));
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().destroy();
}
