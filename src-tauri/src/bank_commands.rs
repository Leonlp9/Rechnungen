use crate::bank_import;

#[tauri::command]
pub async fn import_bank_statement(file_path: String) -> Result<serde_json::Value, String> {
    let lower = file_path.to_lowercase();
    if lower.ends_with(".zip") {
        let transactions = bank_import::parse_zip_bank(&file_path)?;
        return serde_json::to_value(&transactions).map_err(|e| e.to_string());
    }
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let filename = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string());
    let transactions = if lower.ends_with(".xml") {
        bank_import::parse_camt053(&content)?
    } else if lower.ends_with(".csv") {
        bank_import::parse_csv_bank(&content, filename.as_deref())?
    } else {
        bank_import::parse_mt940(&content)?
    };
    serde_json::to_value(&transactions).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_bank_statements_batch(
    file_paths: Vec<String>,
) -> Result<serde_json::Value, String> {
    let mut all_transactions = Vec::new();
    let mut errors = Vec::new();

    for file_path in &file_paths {
        let lower = file_path.to_lowercase();
        let result: Result<Vec<bank_import::BankTransaction>, String> = if lower.ends_with(".zip") {
            bank_import::parse_zip_bank(file_path)
        } else {
            let content = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
            let filename = std::path::Path::new(file_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string());
            if lower.ends_with(".xml") {
                bank_import::parse_camt053(&content)
            } else if lower.ends_with(".csv") {
                bank_import::parse_csv_bank(&content, filename.as_deref())
            } else {
                bank_import::parse_mt940(&content)
            }
        };
        match result {
            Ok(txs) => all_transactions.extend(txs),
            Err(e) => errors.push(format!(
                "{}: {}",
                std::path::Path::new(file_path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy(),
                e
            )),
        }
    }

    if all_transactions.is_empty() && !errors.is_empty() {
        return Err(errors.join("\n"));
    }

    Ok(serde_json::json!({
        "transactions": all_transactions,
        "errors": errors,
    }))
}

