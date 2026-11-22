//! File operations: reading, safe atomic writes, metadata, folder listing and search.

use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileMeta {
    pub exists: bool,
    pub size: u64,
    /// Milliseconds since the Unix epoch.
    pub modified: u64,
    pub readonly: bool,
}

impl FileMeta {
    pub fn missing() -> Self {
        FileMeta { exists: false, size: 0, modified: 0, readonly: false }
    }
}

pub fn millis(t: Option<std::time::SystemTime>) -> u64 {
    t.and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0)
}

pub fn meta(path: &Path) -> FileMeta {
    match fs::metadata(path) {
        Ok(m) => FileMeta {
            exists: true,
            size: m.len(),
            modified: millis(m.modified().ok()),
            readonly: m.permissions().readonly(),
        },
        Err(_) => FileMeta::missing(),
    }
}

/// Write `bytes` to `path` without ever leaving a half-written file:
/// write a temporary file in the same folder, flush it to disk, then rename it over the target.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    // Saving through a symbolic link updates the file it points to, and keeps the link.
    let resolved;
    let path = match fs::symlink_metadata(path) {
        Ok(m) if m.file_type().is_symlink() => {
            resolved = fs::canonicalize(path).map_err(|e| format!("Could not follow the link: {e}"))?;
            resolved.as_path()
        }
        _ => path,
    };
    let original_permissions = fs::metadata(path).ok().map(|m| m.permissions());
    let dir = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    if !dir.exists() {
        return Err(format!("Folder does not exist: {}", dir.display()));
    }
    if let Ok(m) = fs::metadata(path) {
        if m.permissions().readonly() {
            return Err("The file is read-only.".into());
        }
        if m.is_dir() {
            return Err("The path is a folder.".into());
        }
    }
    let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "file".into());
    let nonce = std::time::SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let tmp = dir.join(format!(".{name}.{nonce:x}.tmp"));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("Could not create a temporary file: {e}"))?;
        f.write_all(bytes).map_err(|e| {
            let _ = fs::remove_file(&tmp);
            format!("Could not write: {e}")
        })?;
        f.sync_all().map_err(|e| {
            let _ = fs::remove_file(&tmp);
            format!("Could not flush to disk: {e}")
        })?;
    }
    // Keep the original file's permissions (for example an executable script).
    if let Some(perms) = original_permissions {
        let _ = fs::set_permissions(&tmp, perms);
    }
    // On Windows, rename replaces an existing file (MoveFileEx with REPLACE_EXISTING).
    // Another program holding the file open can make it fail briefly, so retry a few times.
    let mut last_err = None;
    for attempt in 0..5 {
        match fs::rename(&tmp, path) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                std::thread::sleep(std::time::Duration::from_millis(40 * (attempt + 1)));
            }
        }
    }
    let _ = fs::remove_file(&tmp);
    Err(format!(
        "Could not replace the file (is it open in another program?): {}",
        last_err.map(|e| e.to_string()).unwrap_or_default()
    ))
}

/// Largest file the app reads (matches the interface's limit).
pub const MAX_READ: u64 = 300 * 1024 * 1024;

/// Read a regular file, up to MAX_READ bytes. Devices, pipes and folders are refused (a device such
/// as /dev/zero never ends).
pub fn read(path: &Path) -> Result<Vec<u8>, String> {
    let f = fs::File::open(path).map_err(|e| format!("Could not open {}: {e}", path.display()))?;
    let meta = f.metadata().map_err(|e| format!("Could not read: {e}"))?;
    if !meta.is_file() {
        return Err("This is not a regular file.".into());
    }
    let mut buf = Vec::new();
    f.take(MAX_READ + 1).read_to_end(&mut buf).map_err(|e| format!("Could not read: {e}"))?;
    if buf.len() as u64 > MAX_READ {
        return Err("The file is larger than this version can open.".into());
    }
    Ok(buf)
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

const SKIP_DIRS: &[&str] = &[".git", "node_modules", "target", ".svn", ".hg", "__pycache__", ".venv"];

pub fn list_dir(path: &Path) -> Result<Vec<DirEntry>, String> {
    let mut out = Vec::new();
    for entry in fs::read_dir(path).map_err(|e| format!("Could not list {}: {e}", path.display()))? {
        let Ok(entry) = entry else { continue };
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() && SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }
        if name.starts_with(".~lock.") || name.starts_with("~$") || (name.starts_with('.') && name.ends_with(".tmp")) {
            continue;
        }
        let size = if ft.is_file() { entry.metadata().map(|m| m.len()).unwrap_or(0) } else { 0 };
        out.push(DirEntry { name, path: entry.path().to_string_lossy().to_string(), is_dir: ft.is_dir(), size });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(out)
}

fn walker(root: &Path) -> ignore::Walk {
    ignore::WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .git_global(false)
        .require_git(false)
        .filter_entry(|e| !SKIP_DIRS.contains(&e.file_name().to_string_lossy().as_ref()))
        .build()
}

/// All files under `root`, respecting .gitignore, capped at `max`.
pub fn find_files(root: &Path, max: usize) -> Vec<String> {
    let mut out = Vec::new();
    for entry in walker(root).flatten() {
        if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            out.push(entry.path().to_string_lossy().to_string());
            if out.len() >= max {
                break;
            }
        }
    }
    out
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub line: usize,
    pub col: usize,
    pub text: String,
}

pub struct SearchOptions {
    pub case_sensitive: bool,
    pub regex: bool,
    pub whole_word: bool,
    pub max_hits: usize,
}

fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8000).any(|b| *b == 0)
}

/// Search text files under `root` for `query`, line by line.
pub fn search(root: &Path, query: &str, opts: &SearchOptions) -> Result<Vec<SearchHit>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }
    let mut pattern = if opts.regex { query.to_string() } else { regex::escape(query) };
    if opts.whole_word {
        pattern = format!(r"\b(?:{pattern})\b");
    }
    let re = regex::RegexBuilder::new(&pattern)
        .case_insensitive(!opts.case_sensitive)
        .build()
        .map_err(|e| format!("Invalid search pattern: {e}"))?;
    let mut hits = Vec::new();
    for entry in walker(root).flatten() {
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        if fs::metadata(path).map(|m| m.len() > 20 * 1024 * 1024).unwrap_or(true) {
            continue;
        }
        let Ok(bytes) = fs::read(path) else { continue };
        if looks_binary(&bytes) {
            continue;
        }
        let text = String::from_utf8_lossy(&bytes);
        for (i, line) in text.lines().enumerate() {
            if let Some(m) = re.find(line) {
                let col = line[..m.start()].chars().count();
                let preview: String = line.trim_end().chars().take(240).collect();
                hits.push(SearchHit { path: path.to_string_lossy().to_string(), line: i + 1, col: col + 1, text: preview });
                if hits.len() >= opts.max_hits {
                    return Ok(hits);
                }
            }
        }
    }
    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_refuses_folders_and_devices() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read(dir.path()).is_err());
        #[cfg(unix)]
        assert!(read(Path::new("/dev/zero")).is_err());
        let p = dir.path().join("a.txt");
        fs::write(&p, b"ok").unwrap();
        assert_eq!(read(&p).unwrap(), b"ok");
    }

    #[test]
    fn atomic_write_creates_and_replaces() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.txt");
        write_atomic(&p, b"one").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"one");
        write_atomic(&p, b"two, longer").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"two, longer");
        // No temporary files left behind.
        let leftovers: Vec<_> = fs::read_dir(dir.path()).unwrap().flatten().filter(|e| e.file_name().to_string_lossy().ends_with(".tmp")).collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn atomic_write_preserves_exact_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("b.bin");
        let bytes: Vec<u8> = (0..=255u8).cycle().take(100_000).collect();
        write_atomic(&p, &bytes).unwrap();
        assert_eq!(fs::read(&p).unwrap(), bytes);
    }

    #[cfg(unix)]
    #[test]
    fn atomic_write_follows_symlinks_and_keeps_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("real.sh");
        fs::write(&target, b"old").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o755)).unwrap();
        let link = dir.path().join("link.sh");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        write_atomic(&link, b"new").unwrap();
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(fs::read(&target).unwrap(), b"new");
        assert_eq!(fs::metadata(&target).unwrap().permissions().mode() & 0o777, 0o755);
    }

    #[test]
    fn atomic_write_refuses_missing_folder() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("nope").join("c.txt");
        assert!(write_atomic(&p, b"x").is_err());
    }

    #[test]
    fn search_finds_lines_and_skips_binary() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "hello\nWorld here\n").unwrap();
        fs::write(dir.path().join("b.bin"), b"World\0\0\0").unwrap();
        let hits = search(dir.path(), "world", &SearchOptions { case_sensitive: false, regex: false, whole_word: false, max_hits: 10 }).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].line, 2);
        assert_eq!(hits[0].col, 1);
    }

    #[test]
    fn list_dir_sorts_folders_first_and_hides_lock_files() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("zfolder")).unwrap();
        fs::write(dir.path().join("a.txt"), "x").unwrap();
        fs::write(dir.path().join("~$a.docx"), "x").unwrap();
        let entries = list_dir(dir.path()).unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["zfolder", "a.txt"]);
    }
}
