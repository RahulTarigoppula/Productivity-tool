/** Exercises the real platform bridge end to end and writes a report, then closes the app.
 *  Used to verify an installed build: PRODUCTIVITY_SELF_TEST=C:\some\folder productivity.exe */
import { platform } from "./platform";
import { join } from "./lib/paths";
import { decodeText, encodeText, bytesEqual } from "./lib/textcodec";
import { loadCsv, saveCsv } from "./lib/csv";

/** Android: the sample files travel with the app and are written into the test folder first. */
async function seedCorpus(dir: string) {
  const files = import.meta.glob("../tests/corpus/*", { query: "?url", import: "default" });
  for (const [key, load] of Object.entries(files)) {
    const url = (await load()) as string;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    await platform.writeFile(join(dir, key.split("/").pop()!), bytes);
  }
}

export async function runSelfTest(dir: string) {
  // Android: progress goes to the system log, so a hang shows where it happened.
  const androidLog = async (message: string) => {
    if (platform.folders) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("android_log", { message }).catch(() => {});
  };
  await androidLog(`SELFTEST start ${dir}`);
  if (!platform.folders) await seedCorpus(dir).catch((e) => androidLog(`SELFTEST seed failed: ${e}`));
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const t = async (name: string, fn: () => Promise<void>) => {
    void androidLog(`SELFTEST step ${name}`);
    try {
      // A step that hangs is reported as a failure; the rest of the checks still run.
      await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error("timed out after 60 s")), 60000))]);
      results.push({ name, ok: true });
      void androidLog(`SELFTEST ok ${name}`);
    } catch (e) {
      results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
      void androidLog(`SELFTEST FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
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
  // Let start-up (session restore) finish first, as a person would.
  for (let i = 0; i < 200 && !getState().ready; i++) await new Promise((r) => setTimeout(r, 50));
  const selector: Record<string, string> = {
    md: ".cm-content", txt: ".cm-content", py: ".cm-content", csv: ".csv-cell",
    pdf: ".pdfViewer .page canvas", docx: ".docx-host section, .office-frame[style*='visible']", xlsx: ".xlsx-table td, .office-frame[style*='visible']", pptx: ".slide-card, .office-frame[style*='visible']",
  };
  const office = await platform.officePack();
  const seen: string[] = [];
  window.addEventListener("message", (e) => {
    if (seen.length < 40) seen.push(`${e.origin} ${String((e.data as { type?: string })?.type ?? typeof e.data)}`);
  });
  (timings as unknown as Record<string, unknown>).messages = seen;
  timings.officePack = office.available ? 1 : 0;
  const samples = (await platform.listDir(dir)).filter((e) => !e.isDir && selector[e.name.split(".").pop()!.toLowerCase()] && !e.name.startsWith("selftest"));
  for (const f of samples) {
    const ext = f.name.split(".").pop()!.toLowerCase();
    await t(`open ${f.name} in its engine`, async () => {
      const t0 = performance.now();
      const id = await openPath(f.path);
      assert(id, "no tab");
      // The first Office file also starts the editor engine (WebAssembly compile), so allow longer.
      const deadline = t0 + (["docx", "xlsx", "pptx"].includes(ext) ? 90000 : 20000);
      for (;;) {
        const tab = getState().tabs.find((x) => x.id === id);
        assert(tab && !tab.error, tab?.error ?? "tab missing");
        const pane = document.querySelector(selector[ext].split(",").map((part) => `section.doc-pane:not([hidden]) ${part.trim()}`).join(", "));
        if (pane && handles.has(id!)) break;
        if (performance.now() >= deadline) {
          const tb = getState().tabs.find((x) => x.id === id);
          const active = getState().activeId === id;
          throw new Error(`engine did not render in time (active=${active} handle=${handles.has(id!)} pane=${!!pane} tab=${JSON.stringify({ kind: tb?.kind, loading: tb?.loading, version: tb?.version, dirty: tb?.dirty, saveState: tb?.saveState })} spinner=${!!document.querySelector("section.doc-pane:not([hidden]) .spinner")})`);
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      timings[`open:${f.name}`] = Math.round(performance.now() - t0);
      // With the Office pack installed, Office files must open in the real editor and save.
      if (office.available && ["docx", "xlsx", "pptx"].includes(ext)) {
        assert(document.querySelector("section.doc-pane:not([hidden]) .office-frame"), "opened as a preview, not in the editor");
        const t1 = performance.now();
        const bytes = await handles.get(id!)!.serialize({ forSave: true });
        assert(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.length > 1000, "editor did not return a valid file");
        timings[`save:${f.name}`] = Math.round(performance.now() - t1);
      }
    });
  }

  if (office.available) {
    await t("Office editor frame cannot use the app's file commands", async () => {
      const frame = document.querySelector("section.doc-pane:not([hidden]) .office-frame, .office-frame") as HTMLIFrameElement | null;
      assert(frame?.contentWindow, "no editor frame");
      const { officeOriginOf } = await import("./engines/office/OfficeEditor");
      const origin = officeOriginOf(frame!.src);
      const result = await new Promise<{ hasIpc: boolean; ipcWorks: boolean; ipcHung?: boolean; siblingAccess?: boolean } | null>((resolve) => {
        const on = (e: MessageEvent) => {
          if (e.origin === origin && e.data?.type === "office:probe-result") {
            window.removeEventListener("message", on);
            resolve(e.data);
          }
        };
        window.addEventListener("message", on);
        frame!.contentWindow!.postMessage({ type: "office:probe" }, origin);
        setTimeout(() => resolve(null), 5000);
      });
      assert(result, "no answer from the editor bridge");
      timings.officeFrameHasIpcObject = result!.hasIpc ? 1 : 0;
      timings.officeFrameIpcHung = result!.ipcHung ? 1 : 0;
      assert(!result!.ipcWorks, "the editor frame could call an app command");
      assert(!result!.siblingAccess, "one tab's editor could reach another tab's editor");
    });
  }

  (timings as unknown as Record<string, unknown>).frames = Array.from(document.querySelectorAll("iframe")).map((f) => f.src);
  const report = JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, results, timings, userAgent: navigator.userAgent }, null, 2);
  await platform.writeFile(p("selftest-report.json"), new TextEncoder().encode(report));
  if (!platform.folders) {
    // Android: the CI smoke test reads the result from the system log.
    const { invoke } = await import("@tauri-apps/api/core");
    for (const r of results.filter((x) => !x.ok)) await invoke("android_log", { message: `SELFTEST FAIL ${r.name}: ${r.detail ?? ""}` });
    await invoke("android_log", { message: `SELFTEST passed=${results.filter((r) => r.ok).length} total=${results.length}` });
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().destroy();
}
