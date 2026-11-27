//! App-owned storage in the per-user data folder: named state documents,
//! version snapshots of saved files, and crash-recovery copies of unsaved work.
//! Nothing here is written inside the user's document folders.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::files::write_atomic;

pub const MAX_SNAPSHOTS_PER_FILE: usize = 30;

#[derive(Clone)]
pub struct Store {
    pub root: PathBuf,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn safe_name(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').take(80).collect()
}

pub fn path_key(path: &str) -> String {
    let normalized = if cfg!(windows) { path.replace('/', "\\").to_lowercase() } else { path.to_string() };
    let digest = Sha256::digest(normalized.as_bytes());
    digest.iter().take(12).map(|b| format!("{b:02x}")).collect()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub id: String,
    pub path: String,
    pub created: u64,
    pub size: u64,
    pub reason: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryInfo {
    pub id: String,
    pub meta: String,
    pub size: u64,
    pub updated: u64,
}

impl Store {
    pub fn new(root: PathBuf) -> Self {
        let _ = fs::create_dir_all(&root);
        Store { root }
    }

    fn state_dir(&self) -> PathBuf {
        self.root.join("state")
    }
    fn snapshot_dir(&self, path: &str) -> PathBuf {
        self.root.join("snapshots").join(path_key(path))
    }
    fn recovery_dir(&self) -> PathBuf {
        self.root.join("recovery")
    }

    /// Append a line to logs/app.log (kept under 1 MB: the old log is kept as app.old.log).
    pub fn log(&self, level: &str, message: &str) {
        use std::io::Write;
        let dir = self.root.join("logs");
        if fs::create_dir_all(&dir).is_err() {
            return;
        }
        let path = dir.join("app.log");
        if fs::metadata(&path).map(|m| m.len() > 1_000_000).unwrap_or(false) {
            let _ = fs::rename(&path, dir.join("app.old.log"));
        }
        let level: String = level.chars().filter(|c| c.is_ascii_alphabetic()).take(8).collect();
        let message: String = message.chars().take(8000).collect();
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
            // One entry per line: line breaks are indented, other control characters shown as spaces.
            let clean: String = message.chars().map(|c| if c == '\n' || !c.is_control() { c } else { ' ' }).collect();
            let _ = writeln!(f, "{} {} {}", now_ms(), level, clean.replace('\n', "\n  "));
        }
    }

    pub fn state_get(&self, name: &str) -> Option<String> {
        fs::read_to_string(self.state_dir().join(format!("{}.json", safe_name(name)))).ok()
    }

    pub fn state_set(&self, name: &str, value: &str) -> Result<(), String> {
        let dir = self.state_dir();
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        write_atomic(&dir.join(format!("{}.json", safe_name(name))), value.as_bytes())
    }

    /// Keep a copy of `bytes` as a version of `path`.
    pub fn snapshot_write(&self, path: &str, bytes: &[u8], reason: &str) -> Result<SnapshotInfo, String> {
        let dir = self.snapshot_dir(path);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        // Skip if identical to the newest snapshot.
        if let Some(latest) = self.snapshot_list(path).first() {
            if latest.size == bytes.len() as u64 {
                if let Ok(prev) = fs::read(dir.join(format!("{}.bin", latest.id))) {
                    if prev == bytes {
                        return Ok(latest.clone());
                    }
                }
            }
        }
        let created = now_ms();
        let mut id = format!("{created}");
        let mut n = 0;
        while dir.join(format!("{id}.bin")).exists() {
            n += 1;
            id = format!("{created}-{n}");
        }
        fs::write(dir.join(format!("{id}.bin")), bytes).map_err(|e| e.to_string())?;
        let info = SnapshotInfo { id: id.clone(), path: path.to_string(), created, size: bytes.len() as u64, reason: reason.to_string() };
        fs::write(dir.join(format!("{id}.json")), serde_json::to_string(&info).unwrap()).map_err(|e| e.to_string())?;
        self.prune(path);
        Ok(info)
    }

    fn prune(&self, path: &str) {
        let list = self.snapshot_list(path);
        let dir = self.snapshot_dir(path);
        // Always keep the very first copy ever taken (the original before this app touched the file).
        let original = list.iter().find(|s| s.reason == "original").map(|s| s.id.clone());
        let mut kept = 0;
        for s in list.iter() {
            if Some(&s.id) == original.as_ref() {
                continue;
            }
            kept += 1;
            if kept > MAX_SNAPSHOTS_PER_FILE {
                let _ = fs::remove_file(dir.join(format!("{}.bin", s.id)));
                let _ = fs::remove_file(dir.join(format!("{}.json", s.id)));
            }
        }
    }

    /// Newest first.
    pub fn snapshot_list(&self, path: &str) -> Vec<SnapshotInfo> {
        let dir = self.snapshot_dir(path);
        let mut out: Vec<SnapshotInfo> = fs::read_dir(&dir)
            .into_iter()
            .flatten()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().ends_with(".json"))
            .filter_map(|e| fs::read_to_string(e.path()).ok())
            .filter_map(|s| serde_json::from_str(&s).ok())
            .collect();
        out.sort_by(|a, b| b.created.cmp(&a.created).then_with(|| b.id.cmp(&a.id)));
        out
    }

    /// A renamed file keeps its version history (unless the new name already has one).
    pub fn move_history(&self, from: &str, to: &str) {
        let (a, b) = (self.snapshot_dir(from), self.snapshot_dir(to));
        if a != b && a.exists() && !b.exists() {
            let _ = fs::rename(a, b);
        }
    }

    pub fn has_snapshots(&self, path: &str) -> bool {
        self.snapshot_dir(path).exists()
    }

    pub fn snapshot_read(&self, path: &str, id: &str) -> Result<Vec<u8>, String> {
        fs::read(self.snapshot_dir(path).join(format!("{}.bin", safe_name(id)))).map_err(|e| e.to_string())
    }

    pub fn recovery_write(&self, id: &str, meta: &str, bytes: &[u8]) -> Result<(), String> {
        let dir = self.recovery_dir();
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let id = safe_name(id);
        write_atomic(&dir.join(format!("{id}.bin")), bytes)?;
        let info = RecoveryInfo { id: id.clone(), meta: meta.to_string(), size: bytes.len() as u64, updated: now_ms() };
        write_atomic(&dir.join(format!("{id}.json")), serde_json::to_string(&info).unwrap().as_bytes())
    }

    pub fn recovery_list(&self) -> Vec<RecoveryInfo> {
        fs::read_dir(self.recovery_dir())
            .into_iter()
            .flatten()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().ends_with(".json"))
            .filter_map(|e| fs::read_to_string(e.path()).ok())
            .filter_map(|s| serde_json::from_str(&s).ok())
            .collect()
    }

    pub fn recovery_read(&self, id: &str) -> Result<Vec<u8>, String> {
        fs::read(self.recovery_dir().join(format!("{}.bin", safe_name(id)))).map_err(|e| e.to_string())
    }

    pub fn recovery_clear(&self, id: &str) {
        let id = safe_name(id);
        let _ = fs::remove_file(self.recovery_dir().join(format!("{id}.bin")));
        let _ = fs::remove_file(self.recovery_dir().join(format!("{id}.json")));
    }
}

/// Before overwriting an existing file, keep its current bytes as a version.
/// The first time the app ever writes a given file, that copy is marked "original".
pub fn snapshot_before_overwrite(store: &Store, path: &Path) {
    let p = path.to_string_lossy().to_string();
    if let Ok(bytes) = fs::read(path) {
        let reason = if store.has_snapshots(&p) { "before save" } else { "original" };
        let _ = store.snapshot_write(&p, &bytes, reason);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_appends_and_rotates() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().to_path_buf());
        store.log("error", "first\nsecond");
        let text = fs::read_to_string(dir.path().join("logs/app.log")).unwrap();
        assert!(text.contains("error first\n  second"));
        fs::write(dir.path().join("logs/app.log"), vec![b'x'; 1_100_000]).unwrap();
        store.log("info", "after");
        assert!(dir.path().join("logs/app.old.log").exists());
        assert!(fs::read_to_string(dir.path().join("logs/app.log")).unwrap().contains("info after"));
    }

    #[test]
    fn snapshots_are_kept_newest_first_and_deduplicated() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().to_path_buf());
        store.snapshot_write("C:/a.txt", b"one", "original").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(3));
        store.snapshot_write("C:/a.txt", b"two", "before save").unwrap();
        store.snapshot_write("C:/a.txt", b"two", "before save").unwrap();
        let list = store.snapshot_list("C:/a.txt");
        assert_eq!(list.len(), 2);
        assert_eq!(store.snapshot_read("C:/a.txt", &list[0].id).unwrap(), b"two");
        assert_eq!(list[1].reason, "original");
    }

    #[test]
    fn pruning_keeps_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().to_path_buf());
        store.snapshot_write("x", b"orig", "original").unwrap();
        for i in 0..(MAX_SNAPSHOTS_PER_FILE + 5) {
            store.snapshot_write("x", format!("v{i}").as_bytes(), "before save").unwrap();
        }
        let list = store.snapshot_list("x");
        assert_eq!(list.len(), MAX_SNAPSHOTS_PER_FILE + 1);
        assert!(list.iter().any(|s| s.reason == "original"));
    }

    #[test]
    fn recovery_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().to_path_buf());
        store.recovery_write("tab-1", "{\"name\":\"x\"}", b"unsaved").unwrap();
        let list = store.recovery_list();
        assert_eq!(list.len(), 1);
        assert_eq!(store.recovery_read("tab-1").unwrap(), b"unsaved");
        store.recovery_clear("tab-1");
        assert!(store.recovery_list().is_empty());
    }

    #[test]
    fn state_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().to_path_buf());
        assert!(store.state_get("session").is_none());
        store.state_set("session", "{\"a\":1}").unwrap();
        assert_eq!(store.state_get("session").unwrap(), "{\"a\":1}");
    }
}
