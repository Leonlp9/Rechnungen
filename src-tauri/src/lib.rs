use std::path::Path;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use tauri::Manager;

#[tauri::command]
fn extract_pdf_text(path: String) -> Result<String, String> {
    let bytes = std::fs::read(Path::new(&path))
        .map_err(|e| format!("Datei konnte nicht gelesen werden: {e}"))?;
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("PDF-Textextraktion fehlgeschlagen: {e}"))?;
    Ok(text)
}

#[tauri::command]
fn save_pdf_attachment(
    app: tauri::AppHandle,
    filename: String,
    data_base64: String,
) -> Result<String, String> {
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
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();

    let dest = invoices_dir.join(&safe_name);
    std::fs::write(&dest, &bytes)
        .map_err(|e| format!("Datei konnte nicht gespeichert werden: {e}"))?;

    Ok(dest.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(tauri::generate_handler![extract_pdf_text, save_pdf_attachment])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
