use crate::audit;
use tauri::Manager;

#[tauri::command]
pub async fn verify_audit_integrity(app: tauri::AppHandle) -> Result<bool, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("rechnungen.db");
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    audit::verify_audit_chain(&conn)
}

