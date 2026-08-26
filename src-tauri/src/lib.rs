mod xrechnung;
mod zugferd;
mod xrechnung_parser;
mod bank_import;
mod audit;

mod backup_commands;
mod pdf_commands;
mod erechnung_commands;
mod bank_commands;
mod audit_commands;
mod sync_storage;
mod sync_files;
mod open_external;
mod update_commands;

// Desktop-only: IMAP/SMTP, Keyring, Systemstatistiken
#[cfg(desktop)]
mod imap_pool;
#[cfg(desktop)]
mod imap_commands;
#[cfg(desktop)]
mod keyring_commands;
#[cfg(desktop)]
mod system_commands;

pub use backup_commands::PendingBackupPath;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending_path: Option<String> = std::env::args()
        .nth(1)
        .filter(|p| p.ends_with(".rmbackup"));

    let builder = tauri::Builder::default()
        .manage(PendingBackupPath(std::sync::Mutex::new(pending_path)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_oauth::init());

    #[cfg(desktop)]
    let builder = builder
        .manage(imap_pool::ImapPool::new())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(tauri::generate_handler![
            pdf_commands::extract_pdf_text,
            pdf_commands::save_pdf_attachment,
            pdf_commands::delete_invoice_file,
            pdf_commands::cleanup_old_invoice_files,
            imap_commands::imap_fetch_emails,
            imap_commands::imap_fetch_email_detail,
            imap_commands::imap_mark_read,
            imap_commands::imap_delete_email,
            imap_commands::imap_mark_unread,
            imap_commands::imap_toggle_flag,
            imap_commands::smtp_send_email,
            backup_commands::create_backup,
            backup_commands::restore_backup,
            backup_commands::get_pending_backup_path,
            keyring_commands::keyring_set,
            keyring_commands::keyring_get,
            keyring_commands::keyring_delete,
            erechnung_commands::export_xrechnung,
            erechnung_commands::export_zugferd,
            erechnung_commands::import_erechnung,
            bank_commands::import_bank_statement,
            bank_commands::import_bank_statements_batch,
            audit_commands::verify_audit_integrity,
            system_commands::get_system_stats,
            sync_storage::sync_storage_list,
            sync_storage::sync_storage_read,
            sync_storage::sync_storage_write,
            sync_storage::sync_storage_exists,
            sync_files::sync_scan_app_files,
            sync_files::sync_hash_app_file,
            sync_files::sync_write_app_file,
            open_external::open_file_external,
        ]);

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        pdf_commands::extract_pdf_text,
        pdf_commands::save_pdf_attachment,
        pdf_commands::delete_invoice_file,
        pdf_commands::cleanup_old_invoice_files,
        backup_commands::create_backup,
        backup_commands::restore_backup,
        backup_commands::get_pending_backup_path,
        erechnung_commands::export_xrechnung,
        erechnung_commands::export_zugferd,
        erechnung_commands::import_erechnung,
        bank_commands::import_bank_statement,
        bank_commands::import_bank_statements_batch,
        audit_commands::verify_audit_integrity,
        sync_storage::sync_storage_list,
        sync_storage::sync_storage_read,
        sync_storage::sync_storage_write,
        sync_storage::sync_storage_exists,
        sync_files::sync_scan_app_files,
        sync_files::sync_hash_app_file,
        sync_files::sync_write_app_file,
        open_external::open_file_external,
        update_commands::download_update,
        update_commands::downloaded_file_size,
        update_commands::cleanup_update_files,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
