/// <reference lib="webworker" />
// Renders Markdown off the main thread so a hostile or huge document cannot freeze the window.
import { marked } from "marked";

self.onmessage = async (e: MessageEvent<{ id: number; md: string }>) => {
  try {
    const html = await marked.parse(e.data.md, { gfm: true, async: true });
    (self as unknown as Worker).postMessage({ id: e.data.id, html });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: e.data.id, error: String(err instanceof Error ? err.message : err) });
  }
};
