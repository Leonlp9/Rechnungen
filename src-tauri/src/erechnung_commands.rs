use crate::{xrechnung, xrechnung_parser, zugferd};

#[tauri::command]
pub async fn export_xrechnung(data_json: String, output_path: String) -> Result<(), String> {
    let data: xrechnung::XRechnungData =
        serde_json::from_str(&data_json).map_err(|e| format!("JSON-Fehler: {e}"))?;
    let xml = xrechnung::generate_xrechnung_xml(&data)?;
    std::fs::write(&output_path, xml).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_zugferd(
    data_json: String,
    pdf_path: String,
    output_path: String,
) -> Result<(), String> {
    let data: xrechnung::XRechnungData =
        serde_json::from_str(&data_json).map_err(|e| format!("JSON-Fehler: {e}"))?;
    let xml = xrechnung::generate_xrechnung_xml(&data)?;
    zugferd::embed_xml_in_pdf(&pdf_path, &xml, &output_path)
}

#[tauri::command]
pub async fn import_erechnung(file_path: String) -> Result<serde_json::Value, String> {
    let xml = if file_path.to_lowercase().ends_with(".pdf") {
        xrechnung_parser::extract_xml_from_zugferd_pdf(&file_path)?
    } else {
        std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?
    };

    let parsed = xrechnung_parser::parse_xrechnung(&xml)?;
    Ok(serde_json::json!({
        "invoiceNumber": parsed.invoice_number,
        "invoiceDate": parsed.invoice_date,
        "sellerName": parsed.seller_name,
        "buyerName": parsed.buyer_name,
        "netTotal": parsed.net_total,
        "taxTotal": parsed.tax_total,
        "grossTotal": parsed.gross_total,
        "paymentIban": parsed.payment_iban,
        "lineItems": parsed.line_items.iter().map(|i| serde_json::json!({
            "name": i.name,
            "quantity": i.quantity,
            "unitPrice": i.unit_price,
            "lineTotal": i.line_total,
        })).collect::<Vec<_>>(),
    }))
}

