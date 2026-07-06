// Datei-Index für den Sync: Scannen, Hashen und atomares Schreiben von
// Dateien im App-Datenordner (PDFs, Entwürfe, XRechnungen).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;

#[derive(Serialize)]
pub struct LocalFileEntry {
    pub rel_path: String,
    pub size: u64,
    pub mtime_ms: u64,
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("AppData-Ordner nicht gefunden: {e}"))
}

/// Verhindert Path-Traversal aus Remote-Daten (Sync-Ordner ist nicht vertrauenswürdig).
fn safe_join(base: &Path, rel: &str) -> Result<PathBuf, String> {
    let p = Path::new(rel);
    if p.is_absolute() || rel.contains('\\') || rel.starts_with('/') {
        return Err(format!("Ungültiger Pfad: {rel}"));
    }
    for comp in p.components() {
        match comp {
            Component::Normal(_) => {}
            _ => return Err(format!("Ungültiger Pfad: {rel}")),
        }
    }
    Ok(base.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR)))
}

/// Scannt die angegebenen Unterordner des App-Datenordners rekursiv.
#[tauri::command]
pub async fn sync_scan_app_files(
    app: tauri::AppHandle,
    dirs: Vec<String>,
) -> Result<Vec<LocalFileEntry>, String> {
    let base = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::new();
        for dir in dirs {
            let root = safe_join(&base, &dir)?;
            if !root.exists() {
                continue;
            }
            let mut stack = vec![root];
            while let Some(d) = stack.pop() {
                let entries = match std::fs::read_dir(&d) {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        stack.push(path);
                        continue;
                    }
                    let Ok(meta) = entry.metadata() else { continue };
                    let mtime_ms = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                    if let Ok(rel) = path.strip_prefix(&base) {
                        out.push(LocalFileEntry {
                            rel_path: rel.to_string_lossy().replace('\\', "/"),
                            size: meta.len(),
                            mtime_ms,
                        });
                    }
                }
            }
        }
        Ok(out)
    })
    .await
    .map_err(|e| format!("Task-Fehler: {e}"))?
}

/// SHA-256 einer Datei im App-Datenordner (streaming, speicherschonend).
#[tauri::command]
pub async fn sync_hash_app_file(app: tauri::AppHandle, rel_path: String) -> Result<String, String> {
    let base = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let abs = safe_join(&base, &rel_path)?;
        let file = std::fs::File::open(&abs).map_err(|e| format!("Datei nicht lesbar: {e}"))?;
        let mut reader = std::io::BufReader::new(file);
        let mut hasher = Sha256::new();
        let mut buf = [0u8; 65536];
        loop {
            let n = reader.read(&mut buf).map_err(|e| format!("Lesefehler: {e}"))?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        Ok(format!("{:x}", hasher.finalize()))
    })
    .await
    .map_err(|e| format!("Task-Fehler: {e}"))?
}

/// Schreibt eine Datei atomar in den App-Datenordner (temp + rename).
/// Eine bereits existierende Datei mit identischem Inhalt wird nicht angefasst.
#[tauri::command]
pub async fn sync_write_app_file(
    app: tauri::AppHandle,
    rel_path: String,
    data_b64: String,
) -> Result<(), String> {
    let base = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let abs = safe_join(&base, &rel_path)?;
        let data = B64.decode(&data_b64).map_err(|e| format!("Base64-Fehler: {e}"))?;
        if let Some(parent) = abs.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Ordner anlegen fehlgeschlagen: {e}"))?;
        }
        let tmp = abs.with_extension(format!(
            "tmp-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::write(&tmp, &data).map_err(|e| format!("Schreiben fehlgeschlagen: {e}"))?;
        if abs.exists() {
            std::fs::remove_file(&abs).map_err(|e| format!("Ersetzen fehlgeschlagen: {e}"))?;
        }
        std::fs::rename(&tmp, &abs).map_err(|e| {
            let _ = std::fs::remove_file(&tmp);
            format!("Umbenennen fehlgeschlagen: {e}")
        })?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task-Fehler: {e}"))?
}
