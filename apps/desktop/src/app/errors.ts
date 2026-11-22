/** One place for unexpected errors: they are written to the app's log (so a problem can be
 *  diagnosed later) and, at most every few seconds, shown as a calm toast — never a blank window. */
import { platform } from "../platform";
import { toast } from "./store";

const IGNORED = [/ResizeObserver loop/i, /Script error\.?$/i, /AbortError/i, /The user aborted/i];
let lastToast = 0;
let logged = 0;

function text(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}${e.stack ? `\n${e.stack.split("\n").slice(1, 6).join("\n")}` : ""}`;
  try {
    return typeof e === "string" ? e : JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Record an unexpected error. `where` says which part of the app it came from. */
export function reportError(where: string, e: unknown, opts: { quiet?: boolean } = {}): void {
  const msg = text(e);
  if (IGNORED.some((r) => r.test(msg))) return;
  // A runaway loop of errors must not flood the disk.
  if (logged++ < 200) void platform.log("error", `[${where}] ${msg}`).catch(() => {});
  console.error(`[${where}]`, e);
  if (opts.quiet) return;
  const now = Date.now();
  if (now - lastToast > 8000) {
    lastToast = now;
    const short = (e instanceof Error ? e.message : msg).split("\n")[0].slice(0, 140);
    toast(`Something went wrong (${where}): ${short}`, "error");
  }
}

export function installErrorHandlers(): () => void {
  const onError = (ev: ErrorEvent) => reportError("window", ev.error ?? ev.message);
  const onRejection = (ev: PromiseRejectionEvent) => reportError("task", ev.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
