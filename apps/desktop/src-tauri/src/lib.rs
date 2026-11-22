//! Productivity desktop core: the commands the interface calls.

mod files;
mod store;

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
        if bytes[i] == b'%' && i + 2 < bytes.len() {
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
        InvokeBody::Json(_) => Err("Expected binary content.".into()),
    }
}

#[tauri::command]
async fn read_file(path: String) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || files::read(Path::new(&path)).map(Response::new))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn file_meta(path: String) -> FileMeta {
    files::meta(Path::new(&path))
}

/// Raw body = file bytes. Headers: x-path (percent-encoded), x-snapshot ("1" to keep the previous version).
#[tauri::command]
async fn write_file(request: Request<'_>, state: tauri::State<'_, AppState>) -> Result<FileMeta, String> {
    let path = header(&request, "x-path").ok_or("Missing path")?;
    let bytes = body_bytes(&request)?;
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
    let p = PathBuf::from(&path);
    let Some(dir) = p.parent().map(|d| d.to_path_buf()) else { return Ok(()) };
    let mut watched = state.watched.lock().unwrap();
    if !watched.insert(p) {
        return Ok(());
    }
    let already = watched.iter().filter(|f| f.parent() == Some(dir.as_path())).count() > 1;
    if !already {
        if let Some(w) = state.watcher.lock().unwrap().as_mut() {
            w.watch(&dir, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn unwatch_file(path: String, state: tauri::State<'_, AppState>) {
    let p = PathBuf::from(&path);
    let mut watched = state.watched.lock().unwrap();
    if watched.remove(&p) {
        if let Some(dir) = p.parent() {
            if !watched.iter().any(|f| f.parent() == Some(dir)) {
                if let Some(w) = state.watcher.lock().unwrap().as_mut() {
                    let _ = w.unwatch(dir);
                }
            }
        }
    }
}

/// Folder for the built-in self-test, set by the PRODUCTIVITY_SELF_TEST environment variable.
#[tauri::command]
fn self_test_dir() -> Option<String> {
    std::env::var("PRODUCTIVITY_SELF_TEST").ok().filter(|s| !s.is_empty())
}

#[tauri::command]
fn launch_files(state: tauri::State<'_, AppState>) -> Vec<String> {
    std::mem::take(&mut *state.launch_files.lock().unwrap())
}

#[tauri::command]
fn reveal_in_folder(path: String) -> Result<(), String> {
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

/// Open a file or a web link with the system's default application.
#[tauri::command]
fn open_external(target: String) -> Result<(), String> {
    let is_url = target.starts_with("http://") || target.starts_with("https://") || target.starts_with("mailto:");
    if !is_url && !Path::new(&target).exists() {
        return Err("Not found".into());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe").arg(&target).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open").arg(&target).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let paths = file_args(&argv, Some(&cwd));
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            if !paths.is_empty() {
                let _ = app.emit("open-files", paths);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir().join("productivity"));
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
        .invoke_handler(tauri::generate_handler![
            read_file,
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
            reveal_in_folder,
            open_external
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_percent_encoded_paths() {
        assert_eq!(percent_decode("C%3A%5CUsers%5Cr%C3%A9sum%C3%A9.docx"), "C:\\Users\\résumé.docx");
        assert_eq!(percent_decode("plain"), "plain");
        assert_eq!(percent_decode("bad%zz"), "bad%zz");
        assert_eq!(percent_decode("end%2"), "end%2");
    }
}
