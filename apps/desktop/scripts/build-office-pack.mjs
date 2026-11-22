#!/usr/bin/env node
// Builds the Office pack: the Euro-Office (ONLYOFFICE-based) editors running entirely offline,
// with the x2t converter as WebAssembly. Output: packs/office (not committed).
//
// Sources, all pinned:
//   - npm @kreijstal/eurooffice* 9.3.5-rc.1.build.1 (editors from Euro-Office's Document Server
//     package, site shell from Ranuts/document, x2t built from source) — checked against the
//     registry's sha512 integrity before use
//   - fonts: Ranuts/document at a pinned commit (the npm font packages are not published)
//   - spell-check dictionary: ONLYOFFICE/dictionaries at a pinned commit (en_US only)
// Everything is AGPL-3.0 (editors) or the fonts' own licences; licence texts are kept in the pack.
//
// Usage: node scripts/build-office-pack.mjs [--fonts=core|all] [--cache=DIR]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const FONTS = args.fonts ?? "core";
const cache = args.cache ?? join(root, ".cache", "office");
const out = join(root, "packs", "office");

const VERSION = "9.3.5-rc.1.build.1";
const PACKAGES = {
  "@kreijstal/eurooffice": "sha512-MSzXEiNRnbQmdrUdLc1qLgdVW6xUAgnGwHdnteQaMQjQCnAK6FtTJAEiu5mLrnZhopCYsRUfhwXexf1gF5fXqg==",
  "@kreijstal/eurooffice-sdkjs-common": "sha512-wTIS4STBD58e4zxNooGkWEd9MQmFEAhztOV4mebYiZozeg+Ftr2P92soCUWoltveBlD/4FCpG1prLEEsdf/fnA==",
  "@kreijstal/eurooffice-web-apps-1": "sha512-J4mnvi5us9qoa5GpFai/927lS+3l+mtX8cRFEdYVbZAujyzRcnCAqrBNXX8uKOI3I8bBNxMBk3oUwFJWC1Ix0Q==",
  "@kreijstal/eurooffice-web-apps-2": "sha512-rq9dzTnYu8yCOLEuLvnRLkhPKgNBlR30nMb4ZveivXbeZb/2dNvS1Owk4xN2FjCBqhgonV3Apo84IWwlSeRljQ==",
};
const FONTS_REPO = { url: "https://github.com/ranuts/document", commit: "d1c9b03263aabe14789297f5c717fefff2fe4f0d", path: "public/fonts" };
const DICT_REPO = { url: "https://github.com/ONLYOFFICE/dictionaries", commit: "d3223bbb777883db66ac3cd249f71c6ebdc992c7", path: "en_US" };

// Fonts kept in the "core" set: Latin, Greek and Cyrillic families most documents use, plus
// symbol and emoji fonts. Other scripts fall back to DejaVu Sans (served by the app).
const CORE_FONTS = /^(Arial|Calibri|Carlito|Caladea|Comic Sans MS|Courier New|Andale Mono|Liberation.*|DejaVu.*|Noto Sans|Noto Emoji|Open Sans.*|Ubuntu.*|Free(Sans|Serif|Mono)|OpenSymbol|Symbola|ASCW3|Asana|Noto Sans (Armenian|Georgian|Hebrew)|Noto Naskh Arabic.*)$/;

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "inherit"], ...opts }).toString();
const log = (...a) => console.log("[office-pack]", ...a);

function sriOf(file) {
  return "sha512-" + createHash("sha512").update(readFileSync(file)).digest("base64");
}

function fetchPackage(name, integrity) {
  const dir = join(cache, "npm");
  mkdirSync(dir, { recursive: true });
  const tgz = join(dir, `${name.replace("@", "").replace("/", "-")}-${VERSION}.tgz`);
  if (!existsSync(tgz) || sriOf(tgz) !== integrity) {
    log("downloading", name);
    const produced = run("npm", ["pack", `${name}@${VERSION}`, "--silent", "--pack-destination", dir]).trim().split("\n").pop();
    const file = join(dir, produced);
    if (file !== tgz) cpSync(file, tgz);
  }
  if (sriOf(tgz) !== integrity) throw new Error(`Integrity check failed for ${name}`);
  return tgz;
}

function fetchSparse(repo, name) {
  const dir = join(cache, name);
  if (!existsSync(join(dir, ".git"))) {
    rmSync(dir, { recursive: true, force: true });
    log("cloning", repo.url, repo.path);
    run("git", ["clone", "--filter=blob:none", "--no-checkout", "--sparse", repo.url, dir]);
  }
  run("git", ["-C", dir, "sparse-checkout", "set", "--no-cone", `/${repo.path}/`]);
  run("git", ["-C", dir, "fetch", "--depth=1", "origin", repo.commit]);
  run("git", ["-C", dir, "checkout", "--force", repo.commit]);
  const head = run("git", ["-C", dir, "rev-parse", "HEAD"]).trim();
  if (head !== repo.commit) throw new Error(`${repo.url} is at ${head}, expected ${repo.commit}`);
  return join(dir, repo.path);
}

function rm(p) {
  rmSync(join(out, p), { recursive: true, force: true });
}

function walk(dir, f) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, f);
    else f(p);
  }
}

function dirSize(dir) {
  let n = 0;
  walk(dir, (p) => (n += statSync(p).size));
  return n;
}

// ---------- assemble ----------
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const stage = join(cache, "stage");
for (const [name, integrity] of Object.entries(PACKAGES)) {
  const tgz = fetchPackage(name, integrity);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  run("tar", ["-xzf", tgz, "-C", stage]);
  cpSync(join(stage, "package"), out, { recursive: true, force: false, errorOnExist: false });
}
rmSync(stage, { recursive: true, force: true });

// ---------- prune what the app does not use ----------
// Website pages, other languages, marketing and service-worker files.
for (const e of readdirSync(out)) {
  const keep = ["editor.html", "assets", "libs", "sdkjs", "web-apps", "LICENSES", "README.md", "build", "themes.json", "plugins.json", "img", "ran-fonts", "manifest.json"];
    if (/^ran-tokens\.[0-9a-f]+\.css$/.test(e)) continue;
  if (!keep.includes(e)) rm(e);
}
// Editors the app does not use (PDF stays with PDF.js; Visio is not supported).
rm("web-apps/apps/visioeditor");
rm("web-apps/apps/pdfeditor");
rm("sdkjs/visio");
// Phone interfaces (the Android build will add them back), source maps, non-English UI text.
walk(join(out, "web-apps"), (p) => {
  const rel = relative(out, p).replace(/\\/g, "/");
  if (/\.map$/.test(rel)) rmSync(p);
  else if (/\/locale\/[^/]+\.json$/.test(rel) && !/\/(en|en-GB)\.json$/.test(rel)) rmSync(p);
});
for (const app of ["documenteditor", "presentationeditor", "spreadsheeteditor"]) {
  rm(`web-apps/apps/${app}/mobile`);
  rm(`web-apps/apps/${app}/forms`);
  const help = join(out, `web-apps/apps/${app}/main/resources/help`);
  if (existsSync(help)) for (const l of readdirSync(help)) if (l !== "en" && l !== "images") rmSync(join(help, l), { recursive: true, force: true });
}
walk(join(out, "sdkjs"), (p) => /\.map$/.test(p) && rmSync(p));
// Legacy asm.js fallbacks for Internet Explorer (WebView2 uses the WebAssembly builds) and the
// PDF renderer used only by the PDF editor. Office -> PDF export still works without it (x2t).
walk(join(out, "sdkjs"), (p) => /_ie\.js$/.test(p) && rmSync(p));
rm("sdkjs/pdf");

// ---------- hardening ----------
// Documents must never run code: turn off macros and plugins in the editors' configuration.
// (Macro "sandboxing" in the editors can be escaped, so they are disabled outright.)
{
  const shells = readdirSync(join(out, "assets")).filter((f) => /^document-.*\.js$/.test(f));
  let patched = 0;
  for (const f of shells) {
    const p = join(out, "assets", f);
    const src = readFileSync(p, "utf8");
    const next = src.replace("customization:{help:!1,", 'customization:{help:!1,macros:!1,macrosMode:"disable",plugins:!1,');
    if (next !== src) {
      writeFileSync(p, next);
      patched++;
    }
  }
  if (patched !== 1) throw new Error(`Expected to disable macros in one editor shell, patched ${patched}`);
}

// ---------- fonts ----------
const fontsSrc = fetchSparse(FONTS_REPO, "fonts");
const allFonts = readFileSync(join(out, "sdkjs/common/AllFonts.js"), "utf8").replace(/^﻿/, "");
const fileList = [...allFonts.split('window["__fonts_infos"]')[0].matchAll(/"(\d{3})"/g)].map((m) => m[1]);
const infos = [...allFonts.matchAll(/\["([^"]+)",\s*(-?\d+),\s*-?\d+,\s*(-?\d+),\s*-?\d+,\s*(-?\d+),\s*-?\d+,\s*(-?\d+),\s*-?\d+\]/g)];
const keepFiles = new Set();
let fallback = null;
for (const m of infos) {
  const [, name, ...idx] = m;
  if (FONTS === "all" || CORE_FONTS.test(name)) for (const i of idx) if (Number(i) >= 0) keepFiles.add(fileList[Number(i)]);
  if (name === "DejaVu Sans" && Number(idx[0]) >= 0) fallback = fileList[Number(idx[0])];
}
mkdirSync(join(out, "fonts"), { recursive: true });
for (const f of readdirSync(fontsSrc)) if (keepFiles.has(f)) cpSync(join(fontsSrc, f), join(out, "fonts", f));
if (!fallback || !existsSync(join(out, "fonts", fallback))) throw new Error("Fallback font missing");

// ---------- spell-check dictionary ----------
const dictSrc = fetchSparse(DICT_REPO, "dictionaries");
mkdirSync(join(out, "dictionaries/en_US"), { recursive: true });
for (const f of ["en_US.aff", "en_US.dic", "LICENSE"]) if (existsSync(join(dictSrc, f))) cpSync(join(dictSrc, f), join(out, "dictionaries/en_US", f));

// ---------- manifest ----------
const manifest = {
  name: "office",
  version: VERSION,
  fonts: FONTS,
  fallbackFont: fallback,
  sources: { npm: Object.keys(PACKAGES).map((n) => `${n}@${VERSION}`), fonts: FONTS_REPO, dictionaries: DICT_REPO },
  builtWith: "scripts/build-office-pack.mjs",
  bytes: 0,
};
manifest.bytes = dirSize(out);
writeFileSync(join(out, "pack.json"), JSON.stringify(manifest, null, 2));
log(`done: ${(manifest.bytes / 1048576).toFixed(0)} MB in ${out} (fonts: ${FONTS}, ${keepFiles.size} font files)`);
