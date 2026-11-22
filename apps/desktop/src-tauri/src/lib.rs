//! Productivity desktop core: the commands the interface calls.

mod android;
mod files;
mod office;
mod store;
mod uri;

use files::{FileMeta, SearchOptions};
use notify::{RecursiveMode, Watcher};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use store::{RecoveryInfo, SnapshotInfo, Store};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{Emitter, Manager};

struct AppState {
    store: Store,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
    watched: Mutex<HashSet<PathBuf>>,
    launch_files: Mutex<Vec<String>>,
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 3 <= bytes.len() {
            if let (Some(h), Some(l)) = (hex(bytes.get(i + 1)), hex(bytes.get(i + 2))) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn hex(b: Option<&u8>) -> Option<u8> {
    match b? {
        c @ b'0'..=b'9' => Some(c - b'0'),
        c @ b'a'..=b'f' => Some(c - b'a' + 10),
        c @ b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

fn header(request: &Request<'_>, name: &str) -> Option<String> {
    request.headers().get(name).and_then(|v| v.to_str().ok()).map(percent_decode)
}

fn body_bytes(request: &Request<'_>) -> Result<Vec<u8>, String> {
    match request.body() {
        InvokeBody::Raw(b) => Ok(b.clone()),
        // Android's IPC (postMessage) delivers binary bodies as a JSON array of numbers.
        InvokeBody::Json(v) => json_bytes(v).ok_or_else(|| "Expected binary content.".to_string()),
    }
}

/// Binary bodies that arrive as JSON (Android's IPC): `{"b64": "..."}` from the interface, or a
/// plain array of numbers.
fn json_bytes(v: &serde_json::Value) -> Option<Vec<u8>> {
    use base64::Engine;
    if let Some(b64) = v.get("b64").and_then(|b| b.as_str()) {
        return base64::engine::general_purpose::STANDARD.decode(b64).ok();
    }
    v.as_array()?.iter().map(|v| v.as_u64().filter(|n| *n <= 255).map(|n| n as u8)).collect()
}

/// Android: file contents as base64 text, much lighter through its IPC than raw bytes
/// (which travel as a JSON array of numbers).
#[tauri::command]
async fn read_file_b64(path: String, app: tauri::AppHandle) -> Result<String, String> {
    use base64::Engine;
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = if uri::is_content_uri(&path) { uri::read(&app, &path)? } else { files::read(Path::new(&path))? };
        Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_file(path: String, app: tauri::AppHandle) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if uri::is_content_uri(&path) {
            uri::read(&app, &path).map(Response::new)
        } else {
            files::read(Path::new(&path)).map(Response::new)
        }
    })
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn file_meta(path: String, app: tauri::AppHandle) -> FileMeta {
    tauri::async_runtime::spawn_blocking(move || {
        if uri::is_content_uri(&path) {
            uri::meta(&app, &path)
        } else {
            files::meta(Path::new(&path))
        }
    })
    .await
    .unwrap_or_else(|_| FileMeta::missing())
}

/// Raw body = file bytes. Headers: x-path (percent-encoded), x-snapshot ("1" to keep the previous version).
#[tauri::command]
async fn write_file(request: Request<'_>, state: tauri::State<'_, AppState>, app: tauri::AppHandle) -> Result<FileMeta, String> {
    let path = header(&request, "x-path").ok_or("Missing path")?;
    let bytes = body_bytes(&request)?;
    if uri::is_content_uri(&path) {
        // Android documents are rewritten in place, so the previous content is kept first; if it
        // cannot be read, nothing is overwritten.
        let store = state.store.clone();
        return tauri::async_runtime::spawn_blocking(move || {
            let old = uri::read(&app, &path).map_err(|e| format!("Not saved: the current file could not be read first ({e})."))?;
            if !old.is_empty() {
                let reason = if store.has_snapshots(&path) { "before save" } else { "original" };
                store.snapshot_write(&path, &old, reason)?;
            }
            uri::write(&app, &path, &bytes)?;
            let now = std::time::SystemTime::now();
            Ok(FileMeta { exists: true, size: bytes.len() as u64, modified: files::millis(Some(now)), readonly: false })
        })
        .await
        .map_err(|e| e.to_string())?;
    }
    let p = PathBuf::from(&path);
    if header(&request, "x-snapshot").as_deref() == Some("1") && p.exists() {
        store::snapshot_before_overwrite(&state.store, &p);
    }
    files::write_atomic(&p, &bytes)?;
    Ok(files::meta(&p))
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<files::DirEntry>, String> {
    files::list_dir(Path::new(&path))
}

#[tauri::command]
async fn find_files(root: String, max: Option<usize>) -> Vec<String> {
    tauri::async_runtime::spawn_blocking(move || files::find_files(Path::new(&root), max.unwrap_or(20_000)))
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn search_folder(
    root: String,
    query: String,
    case_sensitive: bool,
    regex: bool,
    whole_word: bool,
    max_hits: Option<usize>,
) -> Result<Vec<files::SearchHit>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        files::search(
            Path::new(&root),
            &query,
            &SearchOptions { case_sensitive, regex, whole_word, max_hits: max_hits.unwrap_or(2000) },
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn state_get(name: String, state: tauri::State<'_, AppState>) -> Option<String> {
    state.store.state_get(&name)
}

#[tauri::command]
fn state_set(name: String, value: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.store.state_set(&name, &value)
}

#[tauri::command]
fn snapshot_list(path: String, state: tauri::State<'_, AppState>) -> Vec<SnapshotInfo> {
    state.store.snapshot_list(&path)
}

#[tauri::command]
async fn snapshot_read(path: String, id: String, state: tauri::State<'_, AppState>) -> Result<Response, String> {
    state.store.snapshot_read(&path, &id).map(Response::new)
}

/// Raw body = bytes. Headers: x-path, x-reason.
#[tauri::command]
async fn snapshot_write(request: Request<'_>, state: tauri::State<'_, AppState>) -> Result<SnapshotInfo, String> {
    let path = header(&request, "x-path").ok_or("Missing path")?;
    let reason = header(&request, "x-reason").unwrap_or_else(|| "manual".into());
    state.store.snapshot_write(&path, &body_bytes(&request)?, &reason)
}

/// Raw body = bytes. Headers: x-id, x-meta (percent-encoded JSON).
#[tauri::command]
async fn recovery_write(request: Request<'_>, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let id = header(&request, "x-id").ok_or("Missing id")?;
    let meta = header(&request, "x-meta").unwrap_or_else(|| "{}".into());
    state.store.recovery_write(&id, &meta, &body_bytes(&request)?)
}

#[tauri::command]
fn recovery_list(state: tauri::State<'_, AppState>) -> Vec<RecoveryInfo> {
    state.store.recovery_list()
}

#[tauri::command]
fn recovery_read(id: String, state: tauri::State<'_, AppState>) -> Result<Response, String> {
    state.store.recovery_read(&id).map(Response::new)
}

#[tauri::command]
fn recovery_clear(id: String, state: tauri::State<'_, AppState>) {
    state.store.recovery_clear(&id)
}

/// Watch the folder that contains a file. Watching the folder (not the file) keeps working after
/// a save replaces the file, and the interface ignores events for files it has not opened.
#[tauri::command]
fn watch_file(path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if uri::is_content_uri(&path) {
        return Ok(()); // Android documents cannot be watched.
    }
    let p = PathBuf::from(&path);
    let Some(dir) = p.parent().map(|d| d.to_path_buf()) else { return Ok(()) };
    let mut watched = state.watched.lock().unwrap_or_else(|e| e.into_inner());
    if !watched.insert(p) {
        return Ok(());
    }
    let already = watched.iter().filter(|f| f.parent() == Some(dir.as_path())).count() > 1;
    if !already {
        if let Some(w) = state.watcher.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
            w.watch(&dir, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn unwatch_file(path: String, state: tauri::State<'_, AppState>) {
    let p = PathBuf::from(&path);
    let mut watched = state.watched.lock().unwrap_or_else(|e| e.into_inner());
    if watched.remove(&p) {
        if let Some(dir) = p.parent() {
            if !watched.iter().any(|f| f.parent() == Some(dir)) {
                if let Some(w) = state.watcher.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
                    let _ = w.unwatch(dir);
                }
            }
        }
    }
}

/// Folder for the built-in self-test, set by the PRODUCTIVITY_SELF_TEST environment variable.
#[tauri::command]
fn self_test_dir(app: tauri::AppHandle) -> Option<String> {
    // Android: started with the self-test flag (the activity leaves a marker in the app's folder).
    #[cfg(target_os = "android")]
    if let Ok(d) = app.path().app_data_dir() {
        let dir = d.join("selftest");
        let found = std::fs::remove_file(dir.join("RUN")).is_ok();
        eprintln!("ProductivitySelfTest: marker {} at {}", if found { "found" } else { "absent" }, dir.display());
        if found {
            return Some(dir.to_string_lossy().to_string());
        }
    }
    let _ = &app;
    std::env::var("PRODUCTIVITY_SELF_TEST").ok().filter(|s| !s.is_empty())
}

/// The interface's error log (unexpected errors, for diagnosis; stays on this computer).
#[tauri::command]
fn log_event(level: String, message: String, state: tauri::State<'_, AppState>) {
    state.store.log(&level, &message);
}

#[tauri::command]
fn office_pack_info(app: tauri::AppHandle) -> office::PackInfo {
    office::info(&app)
}

#[tauri::command]
fn launch_files(state: tauri::State<'_, AppState>) -> Vec<String> {
    std::mem::take(&mut *state.launch_files.lock().unwrap_or_else(|e| e.into_inner()))
}

/// File types that run code when opened. "Open in default app" refuses them, so a document
/// can never trick the app into launching a program.
const RUNNABLE: &[&str] = &[
    "exe", "com", "bat", "cmd", "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "msc", "msi", "msp", "mst",
    "scr", "pif", "lnk", "url", "hta", "cpl", "jar", "reg", "scf", "inf", "application", "appref-ms", "gadget", "chm", "hlp",
    "website", "msix", "msixbundle", "appx", "appxbundle", "appinstaller", "library-ms", "search-ms", "searchconnector-ms",
    "settingcontent-ms", "diagcab", "iso", "img", "vhd", "vhdx", "sys", "dll", "ocx", "drv", "xll", "xlam", "ppam", "py", "pyw",
    "rb", "pl", "sh", "command", "desktop", "app",
];

pub(crate) fn is_network_path(p: &str) -> bool {
    let s = p.trim_start();
    s.starts_with("\\\\") || s.starts_with("//") || s.starts_with("\\/") || s.starts_with("/\\")
}

fn check_openable_file(path: &str) -> Result<PathBuf, String> {
    if is_network_path(path) {
        return Err("Files on other computers are not opened from here.".into());
    }
    let p = PathBuf::from(path);
    if !p.is_file() {
        return Err("Not found".into());
    }
    let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if RUNNABLE.contains(&ext.as_str()) {
        return Err(format!("For safety, .{ext} files are not opened from this app. Open it from File Explorer if you trust it."));
    }
    Ok(p)
}

#[tauri::command]
fn reveal_in_folder(path: String) -> Result<(), String> {
    if is_network_path(&path) || path.contains('"') || !Path::new(&path).exists() {
        return Err("Cannot show this file.".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer.exe")
            .raw_arg(format!("/select,\"{}\"", path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let dir = Path::new(&path).parent().map(|p| p.to_path_buf()).unwrap_or_default();
        std::process::Command::new("xdg-open").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open a web link (http, https, mailto) in the system browser or mail app, or a document file
/// with its default application. Program and script files are refused.
#[tauri::command]
fn open_external(target: String) -> Result<(), String> {
    let lower = target.trim().to_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("mailto:") {
        let parsed = url::Url::parse(target.trim()).map_err(|_| "Not a valid link".to_string())?;
        if !matches!(parsed.scheme(), "http" | "https" | "mailto") {
            return Err("Only web and mail links are opened.".into());
        }
        // Re-serialised by the URL parser, so it cannot smuggle extra arguments.
        return open::that_detached(parsed.as_str()).map_err(|e| e.to_string());
    }
    if lower.contains("://") || (lower.contains(':') && !lower.chars().nth(1).map(|c| c == ':').unwrap_or(false)) {
        return Err("Only web and mail links are opened.".into());
    }
    let p = check_openable_file(&target)?;
    open::that_detached(&p).map_err(|e| e.to_string())
}

fn file_args(args: &[String], cwd: Option<&str>) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(|a| {
            let p = PathBuf::from(a);
            if p.is_absolute() {
                p
            } else if let Some(c) = cwd {
                PathBuf::from(c).join(p)
            } else {
                std::env::current_dir().map(|d| d.join(&p)).unwrap_or(p)
            }
        })
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().to_string())
        .collect()
}

/// True when an IPC request comes from an Office editor page (its Origin header names the
/// `office` protocol). Tauri judges IPC by the window's top-level page, so this second check makes
/// sure a document's editor can never call the app's commands, even if it could reach the IPC.
fn from_office_origin(origin: Option<&str>) -> bool {
    let Some(o) = origin else { return false };
    let o = o.to_ascii_lowercase();
    o.starts_with("office:") || o.starts_with("http://office.") || o.starts_with("https://office.")
}

fn guarded<R: tauri::Runtime>(
    handler: impl Fn(tauri::ipc::Invoke<R>) -> bool + Send + Sync + 'static,
) -> impl Fn(tauri::ipc::Invoke<R>) -> bool + Send + Sync + 'static {
    move |invoke| {
        let origin = invoke.message.headers().get("origin").and_then(|v| v.to_str().ok());
        if from_office_origin(origin) {
            invoke.resolver.reject("Not allowed from a document editor.");
            return true;
        }
        handler(invoke)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // A second launch (for example double-clicking another file) hands its files to the open window.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let paths = file_args(&argv, Some(&cwd));
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            if !paths.is_empty() {
                let _ = app.emit("open-files", paths);
            }
        }));
    #[cfg(target_os = "android")]
    let builder = builder.plugin(android::plugin());
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // The Office editors are served from the installed pack on their own origin.
        .register_asynchronous_uri_scheme_protocol("office", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            std::thread::spawn(move || responder.respond(office::handle(&app, &request)));
        })
        .setup(|app| {
            // The saved theme decides the window's first paint and (on Windows) the title bar.
            let data_dir_early = app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir().join("productivity"));
            let saved_theme = Store::new(data_dir_early)
                .state_get("settings")
                .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
                .and_then(|v| v.get("theme").and_then(|t| t.as_str()).map(|t| t.to_string()));
            let window = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()));
            // The page's own early background follows the system; this script overrides it with the
            // saved choice as soon as the page exists.
            let paint = |c: &str| {
                format!(
                    "(function(){{function a(){{var d=document.documentElement;if(d){{d.style.background='{c}';return true}}}}\
                     if(!a()){{new MutationObserver(function(m,o){{if(a())o.disconnect()}}).observe(document,{{childList:true}})}}}})();"
                )
            };
            let window = match saved_theme.as_deref() {
                Some("dark") => window
                    .theme(Some(tauri::Theme::Dark))
                    .background_color(tauri::webview::Color(0x18, 0x18, 0x1c, 0xff))
                    .initialization_script(paint("#18181c")),
                Some("light") => window
                    .theme(Some(tauri::Theme::Light))
                    .background_color(tauri::webview::Color(0xf4, 0xf4, 0xf6, 0xff))
                    .initialization_script(paint("#f4f4f6")),
                _ => window,
            };
            #[cfg(desktop)]
            let window = window.title("Productivity").inner_size(1280.0, 820.0).min_inner_size(360.0, 480.0).center();
            window
                // The window only ever shows the app's own pages; documents cannot navigate it away.
                .on_navigation(|u| {
                    let host = u.host_str().unwrap_or("");
                    // Office editor frames (their own scheme, or http://office.<tab>.localhost).
                    let office = u.scheme() == "office" || (host.starts_with("office.") && host.ends_with(".localhost"));
                    u.scheme() == "tauri"
                        || office
                        || host == "tauri.localhost"
                        || (cfg!(debug_assertions) && (host == "localhost" || host == "127.0.0.1"))
                })
                .build()?;
            let data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir().join("productivity"));
            // A panic in the core is written to the log before anything else happens.
            let crash_store = Store::new(data_dir.clone());
            let default_hook = std::panic::take_hook();
            std::panic::set_hook(Box::new(move |info| {
                crash_store.log("panic", &info.to_string());
                default_hook(info);
            }));
            let handle = app.handle().clone();
            let watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                if let Ok(event) = res {
                    use notify::EventKind::*;
                    if matches!(event.kind, Modify(_) | Create(_) | Remove(_)) {
                        for p in event.paths {
                            let _ = handle.emit("file-changed", p.to_string_lossy().to_string());
                        }
                    }
                }
            })
            .ok();
            let args: Vec<String> = std::env::args().collect();
            app.manage(AppState {
                store: Store::new(data_dir),
                watcher: Mutex::new(watcher),
                watched: Mutex::new(HashSet::new()),
                launch_files: Mutex::new(file_args(&args, None)),
            });
            Ok(())
        })
        .invoke_handler(guarded(tauri::generate_handler![
            read_file,
            read_file_b64,
            file_meta,
            write_file,
            list_dir,
            find_files,
            search_folder,
            state_get,
            state_set,
            snapshot_list,
            snapshot_read,
            snapshot_write,
            recovery_write,
            recovery_list,
            recovery_read,
            recovery_clear,
            watch_file,
            unwatch_file,
            launch_files,
            self_test_dir,
            office_pack_info,
            reveal_in_folder,
            open_external,
            log_event,
            android::android_pick,
            android::android_create,
            android::android_info,
            android::android_take_opened,
            android::android_log
        ]))
        .run(tauri::generate_context!())
        .expect("error while running application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_runnable_and_network_files() {
        let dir = std::env::temp_dir().join("productivity-open-test");
        std::fs::create_dir_all(&dir).unwrap();
        for name in ["a.exe", "b.LNK", "c.bat", "d.url", "e.hta", "f.ps1"] {
            let p = dir.join(name);
            std::fs::write(&p, b"x").unwrap();
            assert!(check_openable_file(&p.to_string_lossy()).is_err(), "{name} should be refused");
        }
        let ok = dir.join("notes.pdf");
        std::fs::write(&ok, b"x").unwrap();
        assert!(check_openable_file(&ok.to_string_lossy()).is_ok());
        assert!(check_openable_file("\\\\evil\\share\\a.pdf").is_err());
        assert!(check_openable_file("//evil/share/a.pdf").is_err());
        assert!(open_external("javascript:alert(1)".into()).is_err());
        assert!(open_external("file:///C:/Windows/system32/calc.exe".into()).is_err());
        assert!(open_external("ms-settings:privacy".into()).is_err());
    }

    #[test]
    fn accepts_binary_bodies_sent_as_json_arrays() {
        assert_eq!(json_bytes(&serde_json::json!([0, 104, 255])), Some(vec![0, 104, 255]));
        assert_eq!(json_bytes(&serde_json::json!([256])), None);
        assert_eq!(json_bytes(&serde_json::json!([-1])), None);
        assert_eq!(json_bytes(&serde_json::json!({"a": 1})), None);
        assert_eq!(json_bytes(&serde_json::json!([])), Some(vec![]));
        assert_eq!(json_bytes(&serde_json::json!({"b64": "AGj/"})), Some(vec![0, 104, 255]));
        assert_eq!(json_bytes(&serde_json::json!({"b64": "not base64!"})), None);
    }

    #[test]
    fn office_pages_cannot_call_commands() {
        assert!(from_office_origin(Some("http://office.t1a2.localhost")));
        assert!(from_office_origin(Some("office://t1a2.localhost")));
        assert!(from_office_origin(Some("HTTPS://OFFICE.x.localhost")));
        assert!(!from_office_origin(Some("http://tauri.localhost")));
        assert!(!from_office_origin(Some("tauri://localhost")));
        assert!(!from_office_origin(None));
    }

    #[test]
    fn decodes_percent_encoded_paths() {
        assert_eq!(percent_decode("C%3A%5CUsers%5Cr%C3%A9sum%C3%A9.docx"), "C:\\Users\\résumé.docx");
        assert_eq!(percent_decode("plain"), "plain");
        assert_eq!(percent_decode("bad%zz"), "bad%zz");
        assert_eq!(percent_decode("end%2"), "end%2");
        assert_eq!(percent_decode("a%41"), "aA");
    }
}
