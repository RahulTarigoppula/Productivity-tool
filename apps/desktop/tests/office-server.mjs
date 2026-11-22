// Serves packs/office for the browser tests the same way the app's Rust handler does:
// .br requests map to plain files, extension-less pages to .html, missing fonts to the fallback
// font, a strict CSP on every response, and the bridge script injected into editor pages.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, realpathSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = realpathSync(join(here, "..", "packs", "office"));
const port = Number(process.env.OFFICE_PORT ?? 4180);
const parent = process.env.APP_ORIGIN ?? "http://localhost:1420";
const pack = JSON.parse(readFileSync(join(root, "pack.json"), "utf8"));
const rust = readFileSync(join(here, "..", "src-tauri", "src", "office.rs"), "utf8");
// Same bridge as the app; the tests run against the dev origin, as a debug build allows.
const bridge = rust.split('pub const BRIDGE_JS: &str = r#"')[1].split('"#;')[0].replace("/*DEV_ORIGINS*/", `, '${parent}'`);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };
const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; child-src 'self' blob:; media-src 'self' blob: data:; form-action 'none'; base-uri 'self'; object-src 'none'; frame-ancestors 'self' ${parent}`;

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, type, body) => {
    res.writeHead(code, { "Content-Type": type, "Content-Security-Policy": csp, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" });
    res.end(body);
  };
  if (url.pathname === "/__app_bridge.js") return send(200, "text/javascript", bridge);
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "editor.html";
  if (normalize(rel).split(/[\\/]/).includes("..")) return send(404, "text/plain", "Not found");
  let p = join(root, rel);
  const isFile = (f) => existsSync(f) && statSync(f).isFile();
  if (!isFile(p)) {
    if (p.endsWith(".br") && isFile(p.slice(0, -3))) p = p.slice(0, -3);
    else if (isFile(p + ".html")) p = p + ".html";
    else if (rel.startsWith("fonts/")) p = join(root, "fonts", pack.fallbackFont);
    else return send(404, "text/plain", "Not found");
  }
  let body = readFileSync(p);
  if (rel === "editor" || rel === "editor.html" || (/^web-apps\/apps\/.*\/main\/index.*\.html$/.test(rel))) {
    body = Buffer.from(body.toString("utf8").replace("<head>", '<head><script src="/__app_bridge.js"></script>'));
  }
  send(200, types[extname(p)] ?? "application/octet-stream", body);
}).listen(port, () => console.log(`office pack on http://localhost:${port}, one origin per tab as http://<tab>.localhost:${port} (embeddable by ${parent})`));
