use tauri_plugin_keyring::KeyringExt;

#[tauri::command]
pub async fn keyring_set(
    app: tauri::AppHandle,
    service: String,
    key: String,
    value: String,
) -> Result<(), String> {
    app.keyring()
        .set_password(&service, &key, &value)
        .map_err(|e| format!("Keyring-Fehler beim Speichern: {e}"))
}

#[tauri::command]
pub async fn keyring_get(
    app: tauri::AppHandle,
    service: String,
    key: String,
) -> Result<Option<String>, String> {
    match app.keyring().get_password(&service, &key) {
        Ok(v) => Ok(v),
        Err(e) => {
            let msg = format!("{e}");
            if msg.contains("not found")
                || msg.contains("NoEntry")
                || msg.contains("No matching")
                || msg.contains("not set")
            {
                Ok(None)
            } else {
                Err(format!("Keyring-Fehler beim Lesen: {e}"))
            }
        }
    }
}

#[tauri::command]
pub async fn keyring_delete(
    app: tauri::AppHandle,
    service: String,
    key: String,
) -> Result<(), String> {
    app.keyring()
        .delete_password(&service, &key)
        .map_err(|e| format!("Keyring-Fehler beim Löschen: {e}"))
}

