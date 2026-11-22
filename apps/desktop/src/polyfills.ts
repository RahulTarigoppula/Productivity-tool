/** Small polyfills for older system WebViews (Android phones that have not updated it). Current
 *  WebView2 on Windows and current Android WebViews have all of these natively. */
const P = Promise as unknown as { withResolvers?: () => unknown };
const U0 = URL as unknown as { parse?: unknown };
/** True when this WebView needed polyfills: code that also runs in workers (PDF.js) must then use
 *  its legacy build, since workers do not get these polyfills. */
export const OLD_WEBVIEW = typeof P.withResolvers !== "function" || typeof U0.parse !== "function";
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

export {};
