//! Android document URIs (`content://…`), which the system file picker returns instead of paths.
//! They are read and written through the file system plugin, which asks Android for a file
//! descriptor. Everywhere else they are refused, so a document can never name one.

use crate::files::FileMeta;

/// Largest Android document the app reads (matches the interface's own limit).
#[allow(dead_code)]
const MAX_BYTES: u64 = 300 * 1024 * 1024;

pub fn is_content_uri(path: &str) -> bool {
    path.len() > 10 && path[..10].eq_ignore_ascii_case("content://")
}

#[cfg(target_os = "android")]
mod imp {
    use super::*;
    use std::io::{Read, Write};
    use tauri::{AppHandle, Runtime};
    use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

    fn file_path(uri: &str) -> Result<FilePath, String> {
        let url = url::Url::parse(uri).map_err(|e| format!("Not a valid document address: {e}"))?;
        Ok(FilePath::Url(url))
    }

    pub fn read<R: Runtime>(app: &AppHandle<R>, uri: &str) -> Result<Vec<u8>, String> {
        let mut opts = OpenOptions::new();
        opts.read(true);
        let f = app.fs().open(file_path(uri)?, opts).map_err(|e| format!("Could not open the file: {e}"))?;
        let mut buf = Vec::new();
        // A limit, so a huge shared file cannot exhaust the phone's memory.
        f.take(MAX_BYTES + 1).read_to_end(&mut buf).map_err(|e| format!("Could not read the file: {e}"))?;
        if buf.len() as u64 > MAX_BYTES {
            return Err("The file is larger than this version can open.".into());
        }
        Ok(buf)
    }

    /// Android documents cannot be replaced by a rename, so the file is truncated and rewritten.
    /// The caller keeps a snapshot of the previous content first, so nothing is lost if this fails.
    pub fn write<R: Runtime>(app: &AppHandle<R>, uri: &str, bytes: &[u8]) -> Result<(), String> {
        let mut opts = OpenOptions::new();
        opts.write(true).truncate(true).create(true);
        let mut f = app.fs().open(file_path(uri)?, opts).map_err(|e| format!("Could not open the file for saving: {e}"))?;
        f.write_all(bytes).map_err(|e| format!("Could not save the file: {e}"))?;
        // Some storage providers ignore the truncate request; cut off any old tail ourselves.
        // (Fails harmlessly on providers that hand over a pipe.)
        let _ = f.set_len(bytes.len() as u64);
        f.sync_all().ok();
        drop(f);
        Ok(())
    }

    pub fn meta<R: Runtime>(app: &AppHandle<R>, uri: &str) -> FileMeta {
        let mut opts = OpenOptions::new();
        opts.read(true);
        match app.fs().open(match file_path(uri) { Ok(p) => p, Err(_) => return FileMeta::missing() }, opts) {
            Ok(f) => match f.metadata() {
                Ok(m) => FileMeta { exists: true, size: m.len(), modified: crate::files::millis(m.modified().ok()), readonly: false },
                Err(_) => FileMeta { exists: true, size: 0, modified: 0, readonly: false },
            },
            Err(_) => FileMeta::missing(),
        }
    }
}

#[cfg(not(target_os = "android"))]
mod imp {
    use super::*;
    use tauri::{AppHandle, Runtime};
    const REFUSED: &str = "Document addresses of this kind only work on Android.";
    pub fn read<R: Runtime>(_: &AppHandle<R>, _: &str) -> Result<Vec<u8>, String> {
        Err(REFUSED.into())
    }
    pub fn write<R: Runtime>(_: &AppHandle<R>, _: &str, _: &[u8]) -> Result<(), String> {
        Err(REFUSED.into())
    }
    pub fn meta<R: Runtime>(_: &AppHandle<R>, _: &str) -> FileMeta {
        FileMeta::missing()
    }
}

pub use imp::{meta, read, write};

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recognises_content_uris() {
        assert!(is_content_uri("content://com.android.providers.downloads.documents/document/12"));
        assert!(is_content_uri("CONTENT://x/y"));
        assert!(!is_content_uri("C:\\content\\a.txt"));
        assert!(!is_content_uri("/home/content://x"));
        assert!(!is_content_uri("content:/"));
    }
}
