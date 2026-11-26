/// <reference lib="webworker" />
// Markdown → Word away from the window: a pathological note can take long to parse, and the
// window stays responsive while it does (the caller stops this worker after a time limit).
import { markdownToDocx } from "./docxWriter";

self.onmessage = async (e: MessageEvent<{ md: string; title: string }>) => {
  try {
    const bytes = await markdownToDocx(e.data.md, e.data.title);
    (self as unknown as Worker).postMessage({ bytes }, [bytes.buffer]);
  } catch (x) {
    (self as unknown as Worker).postMessage({ error: x instanceof Error ? x.message : String(x) });
  }
};
