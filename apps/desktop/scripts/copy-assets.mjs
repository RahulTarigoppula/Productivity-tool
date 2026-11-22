// Copy PDF.js runtime assets (character maps, standard fonts, image decoders, colour profiles)
// into public/ so they ship with the app and work offline.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const out = join(process.cwd(), "public", "vendor", "pdfjs");
mkdirSync(out, { recursive: true });
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const src = join(pdfjsRoot, dir);
  if (existsSync(src)) cpSync(src, join(out, dir), { recursive: true });
}
console.log("PDF.js assets copied to public/vendor/pdfjs");
