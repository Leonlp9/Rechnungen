//! Update-Download für Android.
//!
//! Auf dem Desktop erledigt der Tauri-Updater alles selbst; auf Android gibt
//! es ihn nicht. Dort führte bisher der einzige Weg über den geöffneten
//! GitHub-Link und einen von Hand angestoßenen Download.
//!
//! Diese Datei lädt die APK stattdessen selbst herunter. Bewusst in Rust und
//! nicht per `fetch` im WebView: Der WebView unterliegt CORS, die
//! Auslieferung der Release-Dateien läuft über einen Umleitungs-Host, und ein
//! abgebrochener Download soll eine Teildatei hinterlassen, die beim nächsten
//! Versuch verworfen wird – all das ist hier einfacher und zuverlässiger.
//!
//! Der Fortschritt geht als Ereignis `update-download-progress` an die
//! Oberfläche. Installiert wird anschließend vom System selbst: Die
//! Oberfläche übergibt die Datei an den Paket-Installer.

use serde::Serialize;
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

/// Ergebnis eines Downloads – die Größe dient dem Aufrufer als Prüfsumme
/// dafür, ob eine bereits vorhandene Datei vollständig ist.
#[derive(Serialize)]
pub struct DownloadResult {
    pub path: String,
    pub size: u64,
}

/// Lädt `url` nach `dest`. Vorhandene Dateien werden überschrieben.
///
/// Geschrieben wird zunächst in eine `.part`-Datei und erst nach vollständigem
/// Download umbenannt. So kann ein Abbruch keine halbe APK hinterlassen, die
/// später als „schon heruntergeladen" durchgeht.
#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    url: String,
    dest: String,
) -> Result<DownloadResult, String> {
    tauri::async_runtime::spawn_blocking(move || download_blocking(app, url, dest))
        .await
        .map_err(|e| format!("Download-Task abgebrochen: {e}"))?
}

fn download_blocking(app: AppHandle, url: String, dest: String) -> Result<DownloadResult, String> {
    let dest_path = std::path::PathBuf::from(&dest);
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Ordner anlegen: {e}"))?;
    }
    let part_path = dest_path.with_extension("part");

    let response = ureq::get(&url)
        .set("User-Agent", "Klevr-Updater")
        .call()
        .map_err(|e| format!("Verbindung fehlgeschlagen: {e}"))?;

    let total: u64 = response
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let mut reader = response.into_reader();
    let mut file = std::fs::File::create(&part_path).map_err(|e| format!("Datei anlegen: {e}"))?;

    let mut buffer = vec![0u8; 64 * 1024];
    let mut downloaded: u64 = 0;
    // Nicht bei jedem Block melden – das flutet sonst die Oberfläche.
    let mut last_reported: u64 = 0;

    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Lesen fehlgeschlagen: {e}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|e| format!("Schreiben fehlgeschlagen: {e}"))?;
        downloaded += read as u64;

        if downloaded - last_reported >= 256 * 1024 {
            last_reported = downloaded;
            let _ = app.emit("update-download-progress", DownloadProgress { downloaded, total });
        }
    }

    file.flush().map_err(|e| format!("Abschließen: {e}"))?;
    drop(file);

    if total > 0 && downloaded != total {
        let _ = std::fs::remove_file(&part_path);
        return Err(format!(
            "Download unvollständig ({downloaded} von {total} Bytes)"
        ));
    }

    // Ein vorhandenes Ziel muss weichen, sonst schlägt das Umbenennen fehl.
    let _ = std::fs::remove_file(&dest_path);
    std::fs::rename(&part_path, &dest_path).map_err(|e| format!("Umbenennen: {e}"))?;

    let _ = app.emit(
        "update-download-progress",
        DownloadProgress { downloaded, total: downloaded },
    );

    Ok(DownloadResult {
        path: dest_path.to_string_lossy().to_string(),
        size: downloaded,
    })
}

/// Größe einer bereits heruntergeladenen Datei – 0, wenn es sie nicht gibt.
///
/// Damit erkennt die Oberfläche, ob die APK schon vollständig vorliegt und
/// nur noch einmal geöffnet werden muss, statt sie erneut zu laden.
#[tauri::command]
pub fn downloaded_file_size(path: String) -> u64 {
    std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
}

/// Räumt ältere Update-Dateien weg, damit im App-Ordner nicht jede je
/// heruntergeladene Version liegen bleibt.
#[tauri::command]
pub fn cleanup_update_files(dir: String, keep_file_name: String) -> Result<u32, String> {
    let path = std::path::PathBuf::from(&dir);
    if !path.is_dir() {
        return Ok(0);
    }
    let mut removed = 0;
    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == keep_file_name {
            continue;
        }
        if name.ends_with(".apk") || name.ends_with(".part") {
            if std::fs::remove_file(entry.path()).is_ok() {
                removed += 1;
            }
        }
    }
    Ok(removed)
}
