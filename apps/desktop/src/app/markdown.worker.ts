/// <reference lib="webworker" />
// Renders Markdown off the main thread so a hostile or huge document cannot freeze the window.
import { marked } from "marked";

self.onmessage = async (e: MessageEvent<{ id: number; md: string }>) => {
  try {
    let html = await marked.parse(e.data.md, { gfm: true, async: true });
    // Task boxes: form controls are removed by the sanitizer, so show them as symbols.
    html = html.replace(/<input\b[^>]*type="checkbox"[^>]*>/gi, (m) => (/\bchecked\b/i.test(m) ? '<span class="task-box done">☑</span> ' : '<span class="task-box">☐</span> '));
    (self as unknown as Worker).postMessage({ id: e.data.id, html });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: e.data.id, error: String(err instanceof Error ? err.message : err) });
  }
};
