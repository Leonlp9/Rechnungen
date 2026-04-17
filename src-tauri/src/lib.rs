use std::path::Path;

#[tauri::command]
fn extract_pdf_text(path: String) -> Result<String, String> {
    let bytes = std::fs::read(Path::new(&path))
        .map_err(|e| format!("Datei konnte nicht gelesen werden: {e}"))?;
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("PDF-Textextraktion fehlgeschlagen: {e}"))?;
    Ok(text)
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
        .invoke_handler(tauri::generate_handler![extract_pdf_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
