use roxmltree::Document;
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct BankTransaction {
    pub booking_date: String,
    pub value_date: String,
    pub amount: f64,
    pub currency: String,
    pub creditor_name: Option<String>,
    pub debtor_name: Option<String>,
    pub remittance_info: String,
    pub transaction_id: String,
    /// Source filename (for multi-file / ZIP imports)
    pub source_file: Option<String>,
}

/// CAMT.053 XML parser (ISO 20022)
pub fn parse_camt053(xml: &str) -> Result<Vec<BankTransaction>, String> {
    let doc = Document::parse(xml).map_err(|e| format!("XML-Fehler: {e}"))?;
    let mut transactions = Vec::new();

    for entry in doc.descendants().filter(|n| n.tag_name().name() == "Ntry") {
        let amount: f64 = entry.descendants()
            .find(|n| n.tag_name().name() == "Amt")
            .and_then(|n| n.text())
            .and_then(|t| t.parse().ok())
            .unwrap_or(0.0);

        let is_debit = entry.descendants()
            .find(|n| n.tag_name().name() == "CdtDbtInd")
            .and_then(|n| n.text())
            .map(|t| t == "DBIT")
            .unwrap_or(false);

        let signed_amount = if is_debit { -amount } else { amount };

        let booking_date = entry.descendants()
            .find(|n| n.tag_name().name() == "BookgDt")
            .and_then(|n| n.children().find(|c| c.tag_name().name() == "Dt"))
            .and_then(|n| n.text())
            .unwrap_or_default()
            .to_string();

        let remittance_info = entry.descendants()
            .find(|n| n.tag_name().name() == "Ustrd")
            .and_then(|n| n.text())
            .unwrap_or_default()
            .to_string();

        let creditor_name = entry.descendants()
            .find(|n| n.tag_name().name() == "Cdtr")
            .and_then(|c| c.children().find(|n| n.tag_name().name() == "Nm"))
            .and_then(|n| n.text())
            .map(String::from);

        let debtor_name = entry.descendants()
            .find(|n| n.tag_name().name() == "Dbtr")
            .and_then(|d| d.children().find(|n| n.tag_name().name() == "Nm"))
            .and_then(|n| n.text())
            .map(String::from);

        let transaction_id = entry.descendants()
            .find(|n| n.tag_name().name() == "AcctSvcrRef")
            .and_then(|n| n.text())
            .unwrap_or("unknown")
            .to_string();

        transactions.push(BankTransaction {
            booking_date,
            value_date: String::new(),
            amount: signed_amount,
            currency: "EUR".to_string(),
            creditor_name,
            debtor_name,
            remittance_info,
            transaction_id,
            source_file: None,
        });
    }

    Ok(transactions)
}

/// MT940 parser (SWIFT legacy format)
pub fn parse_mt940(content: &str) -> Result<Vec<BankTransaction>, String> {
    let mut transactions = Vec::new();
    let mut current: Option<BankTransaction> = None;

    for line in content.lines() {
        if line.starts_with(":61:") {
            // Save previous
            if let Some(t) = current.take() {
                transactions.push(t);
            }

            let content = &line[4..];
            if content.len() < 6 { continue; }
            let booking_raw = &content[..6];
            let year = 2000 + booking_raw[..2].parse::<u32>().unwrap_or(0);
            let month = booking_raw[2..4].parse::<u32>().unwrap_or(1);
            let day = booking_raw[4..6].parse::<u32>().unwrap_or(1);
            let booking_date = format!("{year:04}-{month:02}-{day:02}");

            let rest = &content[6..];
            let is_debit = rest.contains('D') && !rest.starts_with('C');

            let amount_str: String = rest.chars()
                .skip_while(|c| !c.is_ascii_digit())
                .take_while(|c| c.is_ascii_digit() || *c == ',')
                .collect::<String>()
                .replace(',', ".");
            let amount: f64 = amount_str.parse().unwrap_or(0.0);
            let signed = if is_debit { -amount } else { amount };

            current = Some(BankTransaction {
                booking_date,
                value_date: String::new(),
                amount: signed,
                currency: "EUR".to_string(),
                creditor_name: None,
                debtor_name: None,
                remittance_info: String::new(),
                transaction_id: format!("{year}{month:02}{day:02}{}", transactions.len()),
                source_file: None,
            });
        } else if line.starts_with(":86:") {
            if let Some(ref mut t) = current {
                t.remittance_info = line[4..].to_string();
            }
        }
    }

    if let Some(t) = current {
        transactions.push(t);
    }

    Ok(transactions)
}

/// CSV parser for German bank exports (semicolon-separated, various formats)
pub fn parse_csv_bank(content: &str, source_file: Option<&str>) -> Result<Vec<BankTransaction>, String> {
    // Try to detect delimiter: semicolon (most German banks) vs comma
    let delimiter = if content.lines().take(3).any(|l| l.contains(';')) { b';' } else { b',' };

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .has_headers(true)
        .from_reader(content.as_bytes());

    let headers: Vec<String> = reader.headers()
        .map_err(|e| format!("CSV-Header-Fehler: {e}"))?
        .iter()
        .map(|h| h.trim().trim_matches('\u{feff}').to_lowercase())
        .collect();

    // Map column indices by common German bank CSV header names
    let date_idx = headers.iter().position(|h|
        h.contains("buchungstag") || h.contains("buchungsdatum") || h.contains("valutadatum")
        || h == "datum" || h == "date" || h.contains("booking")
    );
    let amount_idx = headers.iter().position(|h|
        h.contains("betrag") || h == "amount" || h.contains("umsatz") && !h.contains("typ")
    );
    let name_idx = headers.iter().position(|h|
        h.contains("auftraggeber") || h.contains("empfänger") || h.contains("begünstigter")
        || h.contains("beguenstigter") || h == "name" || h.contains("partner")
    );
    let info_idx = headers.iter().position(|h|
        h.contains("verwendungszweck") || h.contains("buchungstext") || h.contains("info")
        || h.contains("remittance") || h.contains("zweck") || h.contains("beschreibung")
    );
    let currency_idx = headers.iter().position(|h| h.contains("währung") || h.contains("waehrung") || h == "currency");

    let date_col = date_idx.ok_or("CSV: Keine Datumsspalte gefunden (z.B. 'Buchungstag', 'Datum')")?;
    let amount_col = amount_idx.ok_or("CSV: Keine Betragsspalte gefunden (z.B. 'Betrag', 'Umsatz')")?;

    let mut transactions = Vec::new();
    let mut row_idx = 0u32;

    for result in reader.records() {
        let record = match result {
            Ok(r) => r,
            Err(_) => continue,
        };
        row_idx += 1;

        let raw_date = record.get(date_col).unwrap_or_default().trim().to_string();
        // Normalize date: DD.MM.YYYY -> YYYY-MM-DD
        let booking_date = if raw_date.contains('.') {
            let parts: Vec<&str> = raw_date.split('.').collect();
            if parts.len() == 3 {
                format!("{}-{}-{}", parts[2], parts[1], parts[0])
            } else {
                raw_date.clone()
            }
        } else {
            raw_date.clone()
        };

        let raw_amount = record.get(amount_col).unwrap_or_default().trim().to_string();
        // Parse German number format: 1.234,56 -> 1234.56
        let amount: f64 = raw_amount
            .replace('.', "")
            .replace(',', ".")
            .replace('"', "")
            .trim()
            .parse()
            .unwrap_or(0.0);

        if amount == 0.0 && raw_amount.is_empty() {
            continue; // skip empty rows
        }

        let name = name_idx.and_then(|i| record.get(i)).unwrap_or_default().trim().to_string();
        let info = info_idx.and_then(|i| record.get(i)).unwrap_or_default().trim().to_string();
        let currency = currency_idx.and_then(|i| record.get(i)).unwrap_or("EUR").trim().to_string();

        let creditor_name = if amount > 0.0 { None } else { if name.is_empty() { None } else { Some(name.clone()) } };
        let debtor_name = if amount <= 0.0 { None } else { if name.is_empty() { None } else { Some(name.clone()) } };

        transactions.push(BankTransaction {
            booking_date,
            value_date: String::new(),
            amount,
            currency,
            creditor_name,
            debtor_name,
            remittance_info: info,
            transaction_id: format!("csv-{}-{}", row_idx, raw_date),
            source_file: source_file.map(String::from),
        });
    }

    if transactions.is_empty() {
        return Err("CSV: Keine Transaktionen gefunden. Prüfen Sie das Format.".to_string());
    }

    Ok(transactions)
}

/// Extract and parse all supported files from a ZIP archive
pub fn parse_zip_bank(zip_path: &str) -> Result<Vec<BankTransaction>, String> {
    let file = std::fs::File::open(zip_path)
        .map_err(|e| format!("ZIP-Datei konnte nicht geöffnet werden: {e}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Ungültige ZIP-Datei: {e}"))?;

    let mut all_transactions = Vec::new();

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = zip_file.name().to_string();
        let lower = name.to_lowercase();

        // Skip directories and non-supported files
        if zip_file.is_dir() {
            continue;
        }

        use std::io::Read;
        let mut content = String::new();
        if zip_file.read_to_string(&mut content).is_err() {
            continue; // binary or unreadable
        }

        let result = if lower.ends_with(".xml") {
            parse_camt053(&content)
        } else if lower.ends_with(".sta") || lower.ends_with(".mt940") {
            parse_mt940(&content)
        } else if lower.ends_with(".csv") || lower.ends_with(".txt") {
            parse_csv_bank(&content, Some(&name))
        } else {
            continue;
        };

        match result {
            Ok(mut txs) => {
                // Tag source file
                for tx in &mut txs {
                    if tx.source_file.is_none() {
                        tx.source_file = Some(name.clone());
                    }
                }
                all_transactions.extend(txs);
            }
            Err(_) => continue, // skip unparseable files in ZIP
        }
    }

    if all_transactions.is_empty() {
        return Err("ZIP: Keine unterstützten Bankdateien (CSV/XML/MT940) gefunden.".to_string());
    }

    Ok(all_transactions)
}
