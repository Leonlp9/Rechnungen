use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::path::Path;

#[tauri::command]
pub fn extract_pdf_text(path: String) -> Result<String, String> {
    let bytes = std::fs::read(Path::new(&path))
        .map_err(|e| format!("Datei konnte nicht gelesen werden: {e}"))?;
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("PDF-Textextraktion fehlgeschlagen: {e}"))?;
    Ok(text)
}

#[tauri::command]
pub fn save_pdf_attachment(
    app: tauri::AppHandle,
    filename: String,
    data_base64: String,
) -> Result<String, String> {
    use tauri::Manager;

    let bytes = BASE64
        .decode(data_base64.trim())
        .map_err(|e| format!("Base64-Dekodierung fehlgeschlagen: {e}"))?;

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("AppData-Pfad nicht gefunden: {e}"))?;

    let invoices_dir = app_data.join("invoices");
    std::fs::create_dir_all(&invoices_dir)
        .map_err(|e| format!("Verzeichnis konnte nicht erstellt werden: {e}"))?;

    let safe_name = filename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();

    let dest = invoices_dir.join(&safe_name);
    std::fs::write(&dest, &bytes)
        .map_err(|e| format!("Datei konnte nicht gespeichert werden: {e}"))?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_invoice_file(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    use tauri::Manager;

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("AppData-Pfad nicht gefunden: {e}"))?;
    let safe_name = filename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();
    let path = app_data.join("invoices").join(&safe_name);
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Datei konnte nicht gelöscht werden: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn cleanup_old_invoice_files(app: tauri::AppHandle, days: u64) -> Result<u32, String> {
    use tauri::Manager;

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("AppData-Pfad nicht gefunden: {e}"))?;
    let invoices_dir = app_data.join("invoices");
    if !invoices_dir.exists() {
        return Ok(0);
    }
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(days * 86_400))
        .unwrap_or(std::time::UNIX_EPOCH);
    let mut deleted = 0u32;
    if let Ok(entries) = std::fs::read_dir(&invoices_dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    if let Ok(modified) = meta.modified() {
                        if modified < cutoff {
                            let _ = std::fs::remove_file(entry.path());
                            deleted += 1;
                        }
                    }
                }
            }
        }
    }
    Ok(deleted)
}

