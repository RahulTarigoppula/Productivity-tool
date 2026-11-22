/** Small polyfills for older system WebViews (Android phones that have not updated it). Current
 *  WebView2 on Windows and current Android WebViews have all of these natively. */
const P = Promise as unknown as { withResolvers?: () => unknown };
const U0 = URL as unknown as { parse?: unknown };
/** True when this WebView needed polyfills: code that also runs in workers (PDF.js) must then use
 *  its legacy build, since workers do not get these polyfills. */
const A = AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal };
export const OLD_WEBVIEW = typeof P.withResolvers !== "function" || typeof U0.parse !== "function" || typeof A.any !== "function";
if (typeof P.withResolvers !== "function") {
  P.withResolvers = function withResolvers<T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (e?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

const U = URL as unknown as { parse?: (url: string, base?: string) => URL | null; canParse?: (url: string, base?: string) => boolean };
if (typeof U.parse !== "function") {
  U.parse = (url, base) => {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
if (typeof U.canParse !== "function") U.canParse = (url, base) => U.parse!(url, base) !== null;

// AbortSignal.any (Chrome 116): PDF.js's viewer combines abort signals with it; without it no
// page is laid out.
if (typeof A.any !== "function") {
  A.any = (signals: AbortSignal[]) => {
    const controller = new AbortController();
    for (const s of signals) {
      if (s.aborted) {
        controller.abort(s.reason);
        return controller.signal;
      }
    }
    for (const s of signals) s.addEventListener("abort", () => controller.abort(s.reason), { once: true, signal: controller.signal });
    return controller.signal;
  };
}

export {};
