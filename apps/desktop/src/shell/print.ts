/** Print the active document through the system print dialog (which also offers "Save as PDF"). */
import { activeTab, handles, toast } from "../app/store";
import { decodeText } from "../lib/textcodec";
import { loadCsv, toTable } from "../lib/csv";
import { HTML_STYLE, markdownToHtml, tableToHtml } from "../app/exporters";

function printHtml(body: string, title: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>${HTML_STYLE} body{margin:0 auto} @page{margin:18mm} img.page{width:100%;page-break-after:always;display:block}</style></head><body>${body}</body></html>`);
  doc.close();
  const go = () => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => iframe.remove(), 60_000);
  };
  const imgs = Array.from(doc.images);
  if (!imgs.length) setTimeout(go, 50);
  else Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))).then(go);
}

export async function printActive() {
  const tab = activeTab();
  const handle = tab ? handles.get(tab.id) : undefined;
  if (!tab || !handle) return;
  try {
    const bytes = await handle.serialize();
    let body = "";
    if (tab.kind === "markdown") body = await markdownToHtml(decodeText(bytes).text);
    else if (tab.kind === "text") body = `<pre>${decodeText(bytes).text.replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>`;
    else if (tab.kind === "csv") body = tableToHtml(toTable(loadCsv(bytes, tab.name.split(".").pop())));
    else if (tab.kind === "image") body = `<img class="page" src="${URL.createObjectURL(new Blob([bytes.slice()]))}">`;
    else if (tab.kind === "pdf") {
      toast("Preparing pages for printing…");
      const { loadPdfjs } = await import("../engines/pdf/pdfjs");
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const parts: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvas, viewport: vp }).promise;
        parts.push(`<img class="page" src="${canvas.toDataURL("image/png")}">`);
      }
      await doc.loadingTask.destroy();
      body = parts.join("");
    } else {
      const text = handle.getText?.();
      if (!text) {
        toast("This file cannot be printed from here yet. Use Open in default app.");
        return;
      }
      body = `<pre>${text.replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>`;
    }
    printHtml(body, tab.name);
  } catch (e) {
    toast(`Could not print: ${e instanceof Error ? e.message : e}`, "error");
  }
}
