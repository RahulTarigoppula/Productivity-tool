//! Android documents: the system document picker, "Open with" from other apps, and file names.
//! Implemented by DocumentsPlugin.kt in the Android project; on other platforms these commands
//! report that they are unavailable and the interface uses the normal dialogs instead.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocInfo {
    pub uri: String,
    pub name: String,
    pub size: i64,
    pub modified: i64,
    pub writable: bool,
}

#[cfg(target_os = "android")]
#[derive(Deserialize, Default)]
struct Files {
    #[serde(default)]
    files: Vec<DocInfo>,
}

#[cfg(target_os = "android")]
#[derive(Deserialize, Default)]
struct OneFile {
    file: Option<DocInfo>,
}

#[cfg(target_os = "android")]
mod imp {
    use super::*;
    use std::sync::OnceLock;
    use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
    use tauri::Wry;

    static HANDLE: OnceLock<PluginHandle<Wry>> = OnceLock::new();

    pub fn plugin() -> TauriPlugin<Wry> {
        Builder::new("documents")
            .setup(|_app, api| {
                let h = api.register_android_plugin("com.rahul.productivity", "DocumentsPlugin")?;
                let _ = HANDLE.set(h);
                Ok(())
            })
            .build()
    }

    fn handle() -> Result<&'static PluginHandle<Wry>, String> {
        HANDLE.get().ok_or_else(|| "The document picker is not ready.".to_string())
    }

    async fn call<T: serde::de::DeserializeOwned + Send + 'static>(method: &'static str, payload: serde_json::Value) -> Result<T, String> {
        let h = handle()?;
        tauri::async_runtime::spawn_blocking(move || h.run_mobile_plugin::<T>(method, payload).map_err(|e| e.to_string()))
            .await
            .map_err(|e| e.to_string())?
    }

    pub async fn pick(multiple: bool, mime_types: Vec<String>) -> Result<Vec<DocInfo>, String> {
        Ok(call::<Files>("pick", serde_json::json!({ "multiple": multiple, "mimeTypes": mime_types })).await?.files)
    }
    pub async fn create(file_name: String, mime_type: Option<String>) -> Result<Option<DocInfo>, String> {
        Ok(call::<OneFile>("create", serde_json::json!({ "fileName": file_name, "mimeType": mime_type })).await?.file)
    }
    pub async fn info(uri: String) -> Result<DocInfo, String> {
        call::<DocInfo>("info", serde_json::json!({ "uri": uri })).await
    }
    pub async fn take_opened() -> Result<Vec<DocInfo>, String> {
        Ok(call::<Files>("takeOpened", serde_json::json!({})).await?.files)
    }
}

#[cfg(not(target_os = "android"))]
mod imp {
    use super::*;
    const NO: &str = "Only available on Android.";
    pub async fn pick(_: bool, _: Vec<String>) -> Result<Vec<DocInfo>, String> {
        Err(NO.into())
    }
    pub async fn create(_: String, _: Option<String>) -> Result<Option<DocInfo>, String> {
        Err(NO.into())
    }
    pub async fn info(_: String) -> Result<DocInfo, String> {
        Err(NO.into())
    }
    pub async fn take_opened() -> Result<Vec<DocInfo>, String> {
        Ok(Vec::new())
    }
}

#[cfg(target_os = "android")]
pub use imp::plugin;

#[tauri::command]
pub async fn android_pick(multiple: bool, mime_types: Vec<String>) -> Result<Vec<DocInfo>, String> {
    imp::pick(multiple, mime_types).await
}

#[tauri::command]
pub async fn android_create(file_name: String, mime_type: Option<String>) -> Result<Option<DocInfo>, String> {
    imp::create(file_name, mime_type).await
}

#[tauri::command]
pub async fn android_info(uri: String) -> Result<DocInfo, String> {
    if !crate::uri::is_content_uri(&uri) {
        return Err("Not an Android document.".into());
    }
    imp::info(uri).await
}

#[tauri::command]
pub async fn android_take_opened() -> Result<Vec<DocInfo>, String> {
    imp::take_opened().await
}
