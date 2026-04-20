use roxmltree::Document;

pub struct ParsedInvoice {
    pub invoice_number: String,
    pub invoice_date: String,
    pub seller_name: String,
    pub buyer_name: String,
    pub net_total: f64,
    pub tax_total: f64,
    pub gross_total: f64,
    pub currency: String,
    pub payment_iban: String,
    pub line_items: Vec<ParsedLineItem>,
}

pub struct ParsedLineItem {
    pub name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub line_total: f64,
}

pub fn parse_xrechnung(xml: &str) -> Result<ParsedInvoice, String> {
    let doc = Document::parse(xml).map_err(|e| format!("XML-Parse-Fehler: {e}"))?;
    let root = doc.root_element();
    let is_cii = root.tag_name().name() == "CrossIndustryInvoice";

    if is_cii {
        parse_cii(&doc)
    } else {
        Err("UBL-Format noch nicht implementiert — bitte XRechnung im CII-Format verwenden".to_string())
    }
}

fn find_text<'a>(doc: &'a Document, tag: &str) -> Option<&'a str> {
    doc.descendants()
        .find(|n| n.tag_name().name() == tag)
        .and_then(|n| n.text())
}

fn parse_cii(doc: &Document) -> Result<ParsedInvoice, String> {
    let invoice_number = doc.descendants()
        .find(|n| n.tag_name().name() == "ID"
            && n.parent().map(|p| p.tag_name().name() == "ExchangedDocument").unwrap_or(false))
        .and_then(|n| n.text())
        .unwrap_or_default()
        .to_string();

    let invoice_date_raw = find_text(doc, "DateTimeString").unwrap_or_default();
    let invoice_date = if invoice_date_raw.len() == 8 {
        format!("{}-{}-{}", &invoice_date_raw[..4], &invoice_date_raw[4..6], &invoice_date_raw[6..])
    } else {
        invoice_date_raw.to_string()
    };

    let seller_name = doc.descendants()
        .find(|n| n.tag_name().name() == "SellerTradeParty")
        .and_then(|seller| seller.children()
            .find(|n| n.tag_name().name() == "Name")
            .and_then(|n| n.text()))
        .unwrap_or_default()
        .to_string();

    let buyer_name = doc.descendants()
        .find(|n| n.tag_name().name() == "BuyerTradeParty")
        .and_then(|buyer| buyer.children()
            .find(|n| n.tag_name().name() == "Name")
            .and_then(|n| n.text()))
        .unwrap_or_default()
        .to_string();

    let summation = doc.descendants()
        .find(|n| n.tag_name().name() == "SpecifiedTradeSettlementHeaderMonetarySummation");

    let net_total: f64 = summation
        .and_then(|s| s.children().find(|n| n.tag_name().name() == "TaxBasisTotalAmount"))
        .and_then(|n| n.text())
        .and_then(|t| t.parse().ok())
        .unwrap_or(0.0);

    let tax_total: f64 = summation
        .and_then(|s| s.children().find(|n| n.tag_name().name() == "TaxTotalAmount"))
        .and_then(|n| n.text())
        .and_then(|t| t.parse().ok())
        .unwrap_or(0.0);

    let gross_total: f64 = summation
        .and_then(|s| s.children().find(|n| n.tag_name().name() == "GrandTotalAmount"))
        .and_then(|n| n.text())
        .and_then(|t| t.parse().ok())
        .unwrap_or(0.0);

    let payment_iban = find_text(doc, "IBANID").unwrap_or_default().to_string();

    let line_items: Vec<ParsedLineItem> = doc.descendants()
        .filter(|n| n.tag_name().name() == "IncludedSupplyChainTradeLineItem")
        .map(|item| {
            let name = item.descendants()
                .find(|n| n.tag_name().name() == "Name")
                .and_then(|n| n.text())
                .unwrap_or_default()
                .to_string();
            let quantity: f64 = item.descendants()
                .find(|n| n.tag_name().name() == "BilledQuantity")
                .and_then(|n| n.text())
                .and_then(|t| t.parse().ok())
                .unwrap_or(1.0);
            let unit_price: f64 = item.descendants()
                .find(|n| n.tag_name().name() == "ChargeAmount")
                .and_then(|n| n.text())
                .and_then(|t| t.parse().ok())
                .unwrap_or(0.0);
            let line_total: f64 = item.descendants()
                .find(|n| n.tag_name().name() == "LineTotalAmount")
                .and_then(|n| n.text())
                .and_then(|t| t.parse().ok())
                .unwrap_or(quantity * unit_price);
            ParsedLineItem { name, quantity, unit_price, line_total }
        })
        .collect();

    Ok(ParsedInvoice {
        invoice_number,
        invoice_date,
        seller_name,
        buyer_name,
        net_total,
        tax_total,
        gross_total,
        currency: "EUR".to_string(),
        payment_iban,
        line_items,
    })
}

/// Extracts XML from a ZUGFeRD PDF
pub fn extract_xml_from_zugferd_pdf(pdf_path: &str) -> Result<String, String> {
    let doc = lopdf::Document::load(pdf_path)
        .map_err(|e| format!("PDF laden: {e}"))?;

    for (_, obj) in &doc.objects {
        if let Ok(dict) = obj.as_dict() {
            let is_filespec = dict.get(b"Type").ok()
                .and_then(|t| t.as_name().ok())
                .map(|n| n == b"Filespec")
                .unwrap_or(false);

            if is_filespec {
                let name = dict.get(b"F").ok()
                    .and_then(|n| n.as_string().ok())
                    .map(|s| String::from_utf8_lossy(s.as_bytes()).to_string())
                    .unwrap_or_default();

                if name.contains("factur-x") || name.contains("xrechnung") || name.ends_with(".xml") {
                    if let Ok(ef) = dict.get(b"EF").and_then(|e| e.as_dict()) {
                        if let Ok(stream_ref) = ef.get(b"F").and_then(|r| r.as_reference()) {
                            if let Ok(stream_obj) = doc.get_object(stream_ref) {
                                if let Ok(stream) = stream_obj.as_stream() {
                                    let content = stream.content.clone();
                                    return String::from_utf8(content)
                                        .map_err(|_| "XML ist nicht UTF-8".to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Err("Kein ZUGFeRD/XRechnung-XML im PDF gefunden".to_string())
}


