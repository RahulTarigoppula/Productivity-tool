//! Serves the Office pack (Euro-Office / ONLYOFFICE editors, offline) on its own origin,
//! `office://localhost` (`http://office.localhost` on Windows). Running on a separate origin keeps
//! the editors isolated from the app's file-system commands: they talk to the app only through
//! postMessage, and the app decides what to read and write.

use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::Manager;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PackInfo {
    pub available: bool,
    pub version: Option<String>,
    pub bytes: Option<u64>,
    pub location: Option<String>,
}

static ROOT: OnceLock<Option<(PathBuf, String)>> = OnceLock::new();

/// Find the pack: next to the installed app (resources), next to a portable exe, in the user's
/// data folder, or where PRODUCTIVITY_OFFICE_PACK points. Returns the folder and fallback font.
fn locate(app: &tauri::AppHandle) -> Option<(PathBuf, String)> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(p) = std::env::var("PRODUCTIVITY_OFFICE_PACK") {
        candidates.push(PathBuf::from(p));
    }
    if let Ok(r) = app.path().resource_dir() {
        candidates.push(r.join("office"));
        candidates.push(r.join("packs").join("office"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("office"));
        }
    }
    if let Ok(d) = app.path().app_data_dir() {
        candidates.push(d.join("packs").join("office"));
    }
    if cfg!(debug_assertions) {
        candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("packs").join("office"));
    }
    for c in candidates {
        let manifest = c.join("pack.json");
        if let Ok(text) = fs::read_to_string(&manifest) {
            let fallback = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|v| v.get("fallbackFont").and_then(|f| f.as_str()).map(|s| s.to_string()))
                .unwrap_or_default();
            if let Ok(canon) = fs::canonicalize(&c) {
                return Some((canon, fallback));
            }
        }
    }
    None
}

fn root(app: &tauri::AppHandle) -> Option<&'static (PathBuf, String)> {
    ROOT.get_or_init(|| locate(app)).as_ref()
}

pub fn info(app: &tauri::AppHandle) -> PackInfo {
    match root(app) {
        Some((dir, _)) => {
            let manifest: Option<serde_json::Value> = fs::read_to_string(dir.join("pack.json")).ok().and_then(|t| serde_json::from_str(&t).ok());
            PackInfo {
                available: true,
                version: manifest.as_ref().and_then(|m| m.get("version")).and_then(|v| v.as_str()).map(|s| s.to_string()),
                bytes: manifest.as_ref().and_then(|m| m.get("bytes")).and_then(|v| v.as_u64()),
                location: Some(dir.to_string_lossy().to_string()),
            }
        }
        None => PackInfo { available: false, version: None, bytes: None, location: None },
    }
}

/// Origins of the app itself, the only pages allowed to embed the editors.
const APP_ORIGINS: &str = "tauri://localhost http://tauri.localhost https://tauri.localhost";

fn csp() -> String {
    let dev = if cfg!(debug_assertions) { " http://localhost:1420" } else { "" };
    format!(
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; \
         img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self' blob:; \
         frame-src 'self' blob:; child-src 'self' blob:; media-src 'self' blob: data:; form-action 'none'; base-uri 'self'; object-src 'none'; \
         frame-ancestors 'self' {APP_ORIGINS}{dev}"
    )
}

/// The bridge runs inside the editor pages. It forwards app shortcuts typed inside the editor to
/// the app, reports when the document changes, resets the "modified" state after the app saves,
/// and turns off the service worker (the app serves every file itself).
pub const BRIDGE_JS: &str = r#"(function () {
  'use strict';
  if (window.__appBridge) return; window.__appBridge = true;
  try { if (navigator.serviceWorker) { navigator.serviceWorker.register = function () { return Promise.reject(new Error('disabled')); }; } } catch (e) {}
  var ALLOWED = ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', 'http://localhost:1420'];
  function appOrigin() {
    // Walk up through same-origin editor frames to the outer editor page, whose URL carries
    // embedOrigin. Reading a cross-origin parent throws, which marks the top of our frames.
    var w = window;
    for (var i = 0; i < 5 && w.parent !== w; i++) {
      try { if (w.parent.location.origin !== location.origin) break; w = w.parent; } catch (e) { break; }
    }
    try {
      var o = new URLSearchParams(w.location.search).get('embedOrigin');
      return ALLOWED.indexOf(o) >= 0 ? o : null;
    } catch (e) { return null; }
  }
  var ORIGIN = appOrigin();
  // Hide the editors' "new feature" tip pop-ups: the app is calm by default.
  try {
    var st = document.createElement('style');
    st.textContent = '.synch-tip-root.colored{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
  function toApp(msg) { if (ORIGIN) window.top.postMessage(msg, ORIGIN); }
  var RESERVED = function (e) {
    var m = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (e.key === 'F11') return true;
    if (!m) return false;
    if (e.key === 'Tab' || e.key === 'PageUp' || e.key === 'PageDown' || e.key === '\\' || e.key === ',') return true;
    if (/^[1-9]$/.test(e.key) && !e.shiftKey && !e.altKey) return true;
    if (!e.shiftKey && !e.altKey && (k === 'k' || k === 'w' || k === 'n' || k === 'o' || k === 'e')) return true;
    if (e.shiftKey && (k === 't' || k === 'p' || k === 's')) return true;
    return false;
  };
  window.addEventListener('keydown', function (e) {
    if (!RESERVED(e)) return;
    e.preventDefault(); e.stopPropagation();
    toApp({ type: 'office:key', key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey });
  }, true);
  window.addEventListener('message', function (e) {
    if (!ORIGIN || e.origin !== ORIGIN) return;
    var d = e.data || {};
    if (d.type === 'office:probe') {
      // Lets the app's self-test confirm the editors cannot reach the app's file commands.
      var internals = typeof window.__TAURI_INTERNALS__ !== 'undefined';
      var reply = function (works) { toApp({ type: 'office:probe-result', hasIpc: internals, ipcWorks: works }); };
      if (!internals) reply(false);
      else { try { window.__TAURI_INTERNALS__.invoke('state_get', { name: 'settings' }).then(function () { reply(true); }, function () { reply(false); }); } catch (x) { reply(false); } }
    }
    if (d.type === 'office:theme') {
      try { document.documentElement.setAttribute('data-ran-theme', d.theme === 'dark' ? 'dark' : 'light'); document.documentElement.setAttribute('theme', d.theme === 'dark' ? 'dark' : 'light'); } catch (x) {}
    }
    if (d.type === 'office:set-unchanged') {
      for (var i = 0; i < window.frames.length; i++) { try { window.frames[i].postMessage(d, location.origin); } catch (x) {} }
      if (window.editor && window.editor.SetUnchangedDocument) { window.editor.SetUnchangedDocument(); last = false; }
    }
  });
  // Relay from the outer editor page to the inner editor frame (same origin as this page).
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    var d = e.data || {};
    if (d.type === 'office:set-unchanged' && window.editor && window.editor.SetUnchangedDocument) { window.editor.SetUnchangedDocument(); last = false; }
  });
  var last = false, loaded = false;
  setInterval(function () {
    var ed = window.editor;
    if (!ed || !ed.isDocumentModified) return;
    if (!loaded && ed.isDocumentLoadComplete) { loaded = true; toApp({ type: 'office:loaded' }); }
    var now = !!ed.isDocumentModified();
    if (now && !last) toApp({ type: 'office:modified' });
    last = now;
  }, 300);
})();
"#;

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "wasm" => "application/wasm",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "txt" | "aff" | "dic" => "text/plain; charset=utf-8",
        "xml" => "application/xml",
        "bin" => "application/octet-stream",
        _ => "application/octet-stream",
    }
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Map a request path to a file inside the pack, refusing anything that could leave it.
pub fn resolve(root: &Path, fallback_font: &str, url_path: &str) -> Option<PathBuf> {
    let decoded = percent_decode(url_path);
    let rel = decoded.trim_start_matches('/');
    let rel = if rel.is_empty() { "editor.html" } else { rel };
    let rel_path = Path::new(rel);
    if rel_path.components().any(|c| !matches!(c, Component::Normal(_))) {
        return None;
    }
    let mut p = root.join(rel_path);
    if !p.is_file() {
        let s = p.to_string_lossy().to_string();
        if let Some(stripped) = s.strip_suffix(".br") {
            p = PathBuf::from(stripped);
        } else if root.join(format!("{rel}.html")).is_file() {
            p = root.join(format!("{rel}.html"));
        } else if rel.starts_with("fonts/") && !fallback_font.is_empty() {
            p = root.join("fonts").join(fallback_font);
        }
    }
    // Final containment check after any symlink resolution.
    let canon = fs::canonicalize(&p).ok()?;
    if !canon.starts_with(root) || !canon.is_file() {
        return None;
    }
    Some(canon)
}

fn needs_bridge(rel: &str) -> bool {
    rel == "editor" || rel == "editor.html" || (rel.starts_with("web-apps/apps/") && rel.contains("/main/index") && rel.ends_with(".html"))
}

fn respond(status: StatusCode, ctype: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, ctype)
        .header("Content-Security-Policy", csp())
        .header("X-Content-Type-Options", "nosniff")
        .header("Referrer-Policy", "no-referrer")
        .header("Cache-Control", "no-cache")
        .body(body)
        .unwrap()
}

pub fn handle(app: &tauri::AppHandle, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let Some((root, fallback)) = root(app) else {
        return respond(StatusCode::NOT_FOUND, "text/plain", b"Office pack not installed".to_vec());
    };
    let path = request.uri().path();
    if path == "/__app_bridge.js" {
        return respond(StatusCode::OK, "text/javascript; charset=utf-8", BRIDGE_JS.as_bytes().to_vec());
    }
    let Some(file) = resolve(root, fallback, path) else {
        return respond(StatusCode::NOT_FOUND, "text/plain", b"Not found".to_vec());
    };
    let Ok(mut body) = fs::read(&file) else {
        return respond(StatusCode::NOT_FOUND, "text/plain", b"Not found".to_vec());
    };
    let rel = path.trim_start_matches('/');
    if needs_bridge(rel) {
        if let Ok(html) = String::from_utf8(body.clone()) {
            let tag = "<script src=\"/__app_bridge.js\"></script>";
            let injected = if let Some(i) = html.find("<head>") { format!("{}{}{}", &html[..i + 6], tag, &html[i + 6..]) } else { format!("{tag}{html}") };
            body = injected.into_bytes();
        }
    }
    respond(StatusCode::OK, content_type(&file), body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_stays_inside_the_pack() {
        let dir = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(dir.path()).unwrap();
        fs::create_dir_all(root.join("fonts")).unwrap();
        fs::create_dir_all(root.join("sdkjs/common/wasm/x2t")).unwrap();
        fs::write(root.join("editor.html"), "<head></head>").unwrap();
        fs::write(root.join("fonts/117"), "font").unwrap();
        fs::write(root.join("sdkjs/common/wasm/x2t/x2t.wasm"), "wasm").unwrap();
        fs::write(dir.path().parent().unwrap().join("secret.txt"), "s").ok();
        assert_eq!(resolve(&root, "117", "/editor"), Some(root.join("editor.html")));
        assert_eq!(resolve(&root, "117", "/"), Some(root.join("editor.html")));
        assert_eq!(resolve(&root, "117", "/sdkjs/common/wasm/x2t/x2t.wasm.br"), Some(root.join("sdkjs/common/wasm/x2t/x2t.wasm")));
        assert_eq!(resolve(&root, "117", "/fonts/233"), Some(root.join("fonts/117")));
        assert_eq!(resolve(&root, "117", "/../secret.txt"), None);
        assert_eq!(resolve(&root, "117", "/%2e%2e/secret.txt"), None);
        assert_eq!(resolve(&root, "117", "/fonts/..%2f..%2fsecret.txt"), None);
        assert_eq!(resolve(&root, "117", "/missing.js"), None);
    }

    #[test]
    fn bridge_is_injected_only_into_editor_pages() {
        assert!(needs_bridge("editor"));
        assert!(needs_bridge("web-apps/apps/documenteditor/main/index.html"));
        assert!(!needs_bridge("sdkjs/word/sdk-all.js"));
        assert!(!needs_bridge("web-apps/apps/api/documents/api.js"));
    }
}
