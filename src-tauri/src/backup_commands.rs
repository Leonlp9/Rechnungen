use std::io::Write;
use tauri::{Emitter, Manager};

pub struct PendingBackupPath(pub std::sync::Mutex<Option<String>>);

#[derive(serde::Serialize, Clone)]
struct BackupProgress {
    step: String,
    current: u32,
    total: u32,
    bytes_done: u64,
    bytes_total: u64,
}

fn emit_progress(
    app: &tauri::AppHandle,
    step: &str,
    current: u32,
    total: u32,
    bytes_done: u64,
    bytes_total: u64,
) {
    let _ = app.emit(
        "backup-progress",
        BackupProgress {
            step: step.to_string(),
            current,
            total,
            bytes_done,
            bytes_total,
        },
    );
}

#[tauri::command]
pub fn get_pending_backup_path(state: tauri::State<PendingBackupPath>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
pub fn create_backup(
    app: tauri::AppHandle,
    dest_path: String,
    local_storage_json: String,
) -> Result<(), String> {
    use zip::write::FileOptions;
    use zip::CompressionMethod;

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("AppData nicht gefunden: {e}"))?;

    let db_path = app_data.join("rechnungen.db");
    let invoices_dir = app_data.join("invoices");
    let pdfs_dir = app_data.join("pdfs");

    emit_progress(&app, "Analysiere Dateien…", 0, 1, 0, 0);

    let mut all_files: Vec<(std::path::PathBuf, String)> = Vec::new();
    let mut bytes_total: u64 = 0;

    if db_path.exists() {
        let size = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
        bytes_total += size;
        all_files.push((db_path.clone(), "rechnungen.db".to_string()));
    }

    for (dir, prefix) in [(&invoices_dir, "invoices"), (&pdfs_dir, "pdfs")] {
        if dir.exists() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    if entry.metadata().map(|m| m.is_file()).unwrap_or(false) {
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        bytes_total += size;
                        let zip_name =
                            format!("{}/{}", prefix, entry.file_name().to_string_lossy());
                        all_files.push((entry.path(), zip_name));
                    }
                }
            }
        }
    }

    let total_files = all_files.len() as u32 + 2;

    emit_progress(&app, "Erstelle Backup-Datei…", 0, total_files, 0, bytes_total);

    let dest_file = match std::fs::File::create(&dest_path) {
        Ok(f) => f,
        Err(e) => {
            emit_progress(&app, "Fehler", 0, 0, 0, 0);
            return Err(format!("Backup-Datei konnte nicht erstellt werden: {e}"));
        }
    };

    let mut zip = zip::ZipWriter::new(dest_file);
    let options: FileOptions = FileOptions::default().compression_method(CompressionMethod::Deflated);

    let meta = serde_json::json!({
        "invoices_dir": invoices_dir.to_string_lossy(),
        "pdfs_dir": pdfs_dir.to_string_lossy(),
        "app_data_dir": app_data.to_string_lossy(),
    });
    zip.start_file("meta.json", options).map_err(|e| e.to_string())?;
    zip.write_all(meta.to_string().as_bytes()).map_err(|e| e.to_string())?;

    let mut bytes_done: u64 = 0;
    for (idx, (abs_path, zip_name)) in all_files.iter().enumerate() {
        let filename = abs_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        emit_progress(
            &app,
            &format!("Packe: {}", filename),
            idx as u32 + 1,
            total_files,
            bytes_done,
            bytes_total,
        );
        if let Ok(bytes) = std::fs::read(abs_path) {
            bytes_done += bytes.len() as u64;
            zip.start_file(zip_name, options).map_err(|e| e.to_string())?;
            zip.write_all(&bytes).map_err(|e| e.to_string())?;
        }
    }

    emit_progress(
        &app,
        "Speichere Einstellungen…",
        total_files - 1,
        total_files,
        bytes_done,
        bytes_total,
    );
    zip.start_file("localStorage.json", options).map_err(|e| e.to_string())?;
    zip.write_all(local_storage_json.as_bytes()).map_err(|e| e.to_string())?;

    emit_progress(&app, "Fertig!", total_files, total_files, bytes_total, bytes_total);
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_backup(app: tauri::AppHandle, src_path: String) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("AppData nicht gefunden: {e}"))?;

    let new_invoices_dir = app_data.join("invoices");
    let new_pdfs_dir = app_data.join("pdfs");

    let mut file = std::fs::File::open(&src_path)
        .map_err(|e| format!("Backup-Datei konnte nicht geöffnet werden: {e}"))?;

    let mut archive = zip::ZipArchive::new(&mut file)
        .map_err(|e| format!("Ungültige Backup-Datei: {e}"))?;

    let mut local_storage_json = String::new();
    let mut old_invoices_dir: Option<String> = None;
    let mut old_pdfs_dir: Option<String> = None;

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = zip_file.name().to_string();
        if name == "meta.json" {
            use std::io::Read;
            let mut s = String::new();
            zip_file.read_to_string(&mut s).ok();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                old_invoices_dir = v["invoices_dir"].as_str().map(|s| s.to_string());
                old_pdfs_dir = v["pdfs_dir"].as_str().map(|s| s.to_string());
            }
        } else if name == "localStorage.json" {
            use std::io::Read;
            zip_file
                .read_to_string(&mut local_storage_json)
                .map_err(|e| e.to_string())?;
        }
    }

    use std::io::Seek;
    drop(archive);
    file.seek(std::io::SeekFrom::Start(0))
        .map_err(|e| format!("Seek fehlgeschlagen: {e}"))?;
    let mut archive2 = zip::ZipArchive::new(&mut file)
        .map_err(|e| format!("Ungültige Backup-Datei: {e}"))?;

    for i in 0..archive2.len() {
        let mut zip_file = archive2.by_index(i).map_err(|e| e.to_string())?;
        let name = zip_file.name().to_string();

        if name == "localStorage.json" || name == "meta.json" {
            continue;
        }

        let outpath = app_data.join(&name);

        if name.ends_with('/') {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Datei '{name}' konnte nicht erstellt werden: {e}"))?;
            use std::io::copy;
            copy(&mut zip_file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    let db_path = app_data.join("rechnungen.db");
    if db_path.exists() {
        if let Ok(conn) = rusqlite::Connection::open(&db_path) {
            let mut replacements: Vec<(String, String)> = Vec::new();

            if let Some(old_inv) = old_invoices_dir {
                let new_inv = new_invoices_dir.to_string_lossy().to_string();
                let old_norm = old_inv.replace('\\', "/");
                let new_norm = new_inv.replace('\\', "/");
                if old_norm != new_norm {
                    replacements.push((old_inv.replace('\\', "/"), new_norm.clone()));
                    replacements.push((old_inv.replace('/', "\\"), new_norm));
                }
            }
            if let Some(old_pdf) = old_pdfs_dir {
                let new_pdf = new_pdfs_dir.to_string_lossy().to_string();
                let old_norm = old_pdf.replace('\\', "/");
                let new_norm = new_pdf.replace('\\', "/");
                if old_norm != new_norm {
                    replacements.push((old_pdf.replace('\\', "/"), new_norm.clone()));
                    replacements.push((old_pdf.replace('/', "\\"), new_norm));
                }
            }

            for (old_prefix, new_prefix) in replacements {
                let _ = conn.execute(
                    "UPDATE invoices SET pdf_path = ?1 || SUBSTR(pdf_path, LENGTH(?2) + 1) \
                     WHERE pdf_path LIKE ?3",
                    rusqlite::params![
                        new_prefix,
                        old_prefix,
                        format!("{}%", old_prefix),
                    ],
                );
            }
        }
    }

    Ok(local_storage_json)
}

