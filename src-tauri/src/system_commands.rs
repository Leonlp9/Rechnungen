use sysinfo::System;
use tauri::Manager;

#[derive(serde::Serialize)]
pub struct SystemStats {
    /// Datenbankgröße in Bytes
    pub db_size_bytes: u64,
    /// Gesamtgröße aller Dateien im invoices/-Ordner
    pub invoices_size_bytes: u64,
    /// Gesamtgröße aller Dateien im pdfs/-Ordner
    pub pdfs_size_bytes: u64,
    /// Summe aller obigen Größen
    pub total_app_size_bytes: u64,
    /// Anzahl Dateien im invoices/-Ordner
    pub invoices_file_count: u64,
    /// Anzahl Dateien im pdfs/-Ordner
    pub pdfs_file_count: u64,
    /// Genutzter RAM des Prozesses in Bytes
    pub process_memory_bytes: u64,
    /// Gesamter physischer RAM des Systems in Bytes
    pub system_memory_total_bytes: u64,
    /// Freier RAM des Systems in Bytes
    pub system_memory_free_bytes: u64,
    /// CPU-Auslastung des Systems in % (0–100)
    pub cpu_usage_percent: f32,
}

fn dir_size_and_count(path: &std::path::Path) -> (u64, u64) {
    let mut size = 0u64;
    let mut count = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    size += meta.len();
                    count += 1;
                }
            }
        }
    }
    (size, count)
}

#[tauri::command]
pub fn get_system_stats(app: tauri::AppHandle) -> Result<SystemStats, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("AppData nicht gefunden: {e}"))?;

    let db_path = app_data.join("rechnungen.db");
    let invoices_dir = app_data.join("invoices");
    let pdfs_dir = app_data.join("pdfs");

    let db_size_bytes = if db_path.exists() {
        std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let (invoices_size_bytes, invoices_file_count) = dir_size_and_count(&invoices_dir);
    let (pdfs_size_bytes, pdfs_file_count) = dir_size_and_count(&pdfs_dir);
    let total_app_size_bytes = db_size_bytes + invoices_size_bytes + pdfs_size_bytes;

    // sysinfo: RAM + CPU
    let mut sys = System::new_all();
    // Kurze Pause damit CPU-Sample sinnvoll ist
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_all();

    let pid = sysinfo::get_current_pid().ok();
    let process_memory_bytes = pid
        .and_then(|p| sys.process(p))
        .map(|p| p.memory())
        .unwrap_or(0);

    let system_memory_total_bytes = sys.total_memory();
    let system_memory_free_bytes = sys.free_memory();

    let cpus = sys.cpus();
    let cpu_usage_percent = if cpus.is_empty() {
        0.0
    } else {
        cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32
    };

    Ok(SystemStats {
        db_size_bytes,
        invoices_size_bytes,
        pdfs_size_bytes,
        total_app_size_bytes,
        invoices_file_count,
        pdfs_file_count,
        process_memory_bytes,
        system_memory_total_bytes,
        system_memory_free_bytes,
        cpu_usage_percent,
    })
}

