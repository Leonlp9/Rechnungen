use quick_xml::Writer;
use quick_xml::events::{Event, BytesStart, BytesText, BytesEnd, BytesDecl};
use std::io::Cursor;
use serde::Deserialize;

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct XRechnungData {
    pub invoice_number: String,
    pub invoice_date: String,
    pub due_date: String,
    pub seller_name: String,
    pub seller_address: String,
    pub seller_tax_id: String,
    pub buyer_name: String,
    pub buyer_address: String,
    pub buyer_reference: String,
    pub line_items: Vec<XRechnungLineItem>,
    pub tax_rate: f64,
    pub payment_iban: String,
    pub payment_bic: String,
    pub currency: String,
    pub notes: String,
}

#[derive(Deserialize)]
pub struct XRechnungLineItem {
    pub name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_price: f64,
    pub tax_rate: f64,
}

pub fn generate_xrechnung_xml(data: &XRechnungData) -> Result<String, String> {
    let mut writer = Writer::new_with_indent(Cursor::new(Vec::new()), b' ', 2);

    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))
        .map_err(|e| e.to_string())?;

    let ns = [
        ("xmlns:rsm", "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"),
        ("xmlns:ram", "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"),
        ("xmlns:udt", "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"),
        ("xmlns:qdt", "urn:un:unece:uncefact:data:standard:QualifiedDataType:100"),
    ];
    let mut root = BytesStart::new("rsm:CrossIndustryInvoice");
    for (k, v) in &ns {
        root.push_attribute((*k, *v));
    }
    writer.write_event(Event::Start(root)).map_err(|e| e.to_string())?;

    // ExchangedDocumentContext
    write_element(&mut writer, "rsm:ExchangedDocumentContext", |w| {
        write_element(w, "ram:GuidelineSpecifiedDocumentContextParameter", |w| {
            write_text(w, "ram:ID",
                "urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0")
        })
    })?;

    // ExchangedDocument
    write_element(&mut writer, "rsm:ExchangedDocument", |w| {
        write_text(w, "ram:ID", &data.invoice_number)?;
        write_text(w, "ram:TypeCode", "380")?;
        write_element(w, "ram:IssueDateTime", |w| {
            write_date(w, &data.invoice_date)
        })
    })?;

    // SupplyChainTradeTransaction
    write_element(&mut writer, "rsm:SupplyChainTradeTransaction", |w| {
        // Line items
        for (i, item) in data.line_items.iter().enumerate() {
            let line_net = item.quantity * item.unit_price;
            write_element(w, "ram:IncludedSupplyChainTradeLineItem", |w| {
                write_element(w, "ram:AssociatedDocumentLineDocument", |w| {
                    write_text(w, "ram:LineID", &(i + 1).to_string())
                })?;
                write_element(w, "ram:SpecifiedTradeProduct", |w| {
                    write_text(w, "ram:Name", &item.name)
                })?;
                write_element(w, "ram:SpecifiedLineTradeAgreement", |w| {
                    write_element(w, "ram:NetPriceProductTradePrice", |w| {
                        write_amount(w, "ram:ChargeAmount", item.unit_price, &data.currency)
                    })
                })?;
                write_element(w, "ram:SpecifiedLineTradeDelivery", |w| {
                    let mut qty = BytesStart::new("ram:BilledQuantity");
                    qty.push_attribute(("unitCode", item.unit.as_str()));
                    w.write_event(Event::Start(qty)).map_err(|e| e.to_string())?;
                    w.write_event(Event::Text(BytesText::new(&format!("{:.2}", item.quantity))))
                        .map_err(|e| e.to_string())?;
                    w.write_event(Event::End(BytesEnd::new("ram:BilledQuantity")))
                        .map_err(|e| e.to_string())
                })?;
                write_element(w, "ram:SpecifiedLineTradeSettlement", |w| {
                    write_element(w, "ram:ApplicableTradeTax", |w| {
                        write_text(w, "ram:TypeCode", "VAT")?;
                        write_text(w, "ram:CategoryCode", if item.tax_rate > 0.0 { "S" } else { "Z" })?;
                        write_text(w, "ram:RateApplicablePercent", &format!("{:.0}", item.tax_rate * 100.0))
                    })?;
                    write_element(w, "ram:SpecifiedTradeSettlementLineMonetarySummation", |w| {
                        write_amount(w, "ram:LineTotalAmount", line_net, &data.currency)
                    })
                })
            })?;
        }

        // HeaderTradeAgreement
        write_element(w, "ram:ApplicableHeaderTradeAgreement", |w| {
            if !data.buyer_reference.is_empty() {
                write_text(w, "ram:BuyerReference", &data.buyer_reference)?;
            }
            write_element(w, "ram:SellerTradeParty", |w| {
                write_text(w, "ram:Name", &data.seller_name)?;
                if !data.seller_address.is_empty() {
                    write_element(w, "ram:PostalTradeAddress", |w| {
                        write_text(w, "ram:LineOne", &data.seller_address)?;
                        write_text(w, "ram:CountryID", "DE")
                    })?;
                }
                write_element(w, "ram:SpecifiedTaxRegistration", |w| {
                    let mut el = BytesStart::new("ram:ID");
                    el.push_attribute(("schemeID", if data.seller_tax_id.starts_with("DE") { "VA" } else { "FC" }));
                    w.write_event(Event::Start(el)).map_err(|e| e.to_string())?;
                    w.write_event(Event::Text(BytesText::new(&data.seller_tax_id))).map_err(|e| e.to_string())?;
                    w.write_event(Event::End(BytesEnd::new("ram:ID"))).map_err(|e| e.to_string())
                })
            })?;
            write_element(w, "ram:BuyerTradeParty", |w| {
                write_text(w, "ram:Name", &data.buyer_name)?;
                if !data.buyer_address.is_empty() {
                    write_element(w, "ram:PostalTradeAddress", |w| {
                        write_text(w, "ram:LineOne", &data.buyer_address)?;
                        write_text(w, "ram:CountryID", "DE")
                    })?;
                }
                Ok(())
            })
        })?;

        // HeaderTradeDelivery (mandatory but can be empty)
        write_element(w, "ram:ApplicableHeaderTradeDelivery", |_w| Ok(()))?;

        // HeaderTradeSettlement
        let net: f64 = data.line_items.iter().map(|i| i.quantity * i.unit_price).sum();
        let tax = net * data.tax_rate;
        let gross = net + tax;

        write_element(w, "ram:ApplicableHeaderTradeSettlement", |w| {
            write_text(w, "ram:InvoiceCurrencyCode", &data.currency)?;
            write_element(w, "ram:SpecifiedTradeSettlementPaymentMeans", |w| {
                write_text(w, "ram:TypeCode", "58")?;
                write_element(w, "ram:PayeePartyCreditorFinancialAccount", |w| {
                    write_text(w, "ram:IBANID", &data.payment_iban)
                })
            })?;
            write_element(w, "ram:ApplicableTradeTax", |w| {
                write_amount(w, "ram:CalculatedAmount", tax, &data.currency)?;
                write_text(w, "ram:TypeCode", "VAT")?;
                write_amount(w, "ram:BasisAmount", net, &data.currency)?;
                write_text(w, "ram:CategoryCode", if data.tax_rate > 0.0 { "S" } else { "Z" })?;
                write_text(w, "ram:RateApplicablePercent", &format!("{:.0}", data.tax_rate * 100.0))
            })?;
            if !data.due_date.is_empty() {
                write_element(w, "ram:SpecifiedTradePaymentTerms", |w| {
                    write_element(w, "ram:DueDateDateTime", |w| {
                        write_date(w, &data.due_date)
                    })
                })?;
            }
            write_element(w, "ram:SpecifiedTradeSettlementHeaderMonetarySummation", |w| {
                write_amount(w, "ram:LineTotalAmount", net, &data.currency)?;
                write_amount(w, "ram:TaxBasisTotalAmount", net, &data.currency)?;
                write_amount(w, "ram:TaxTotalAmount", tax, &data.currency)?;
                write_amount(w, "ram:GrandTotalAmount", gross, &data.currency)?;
                write_amount(w, "ram:DuePayableAmount", gross, &data.currency)
            })
        })
    })?;

    writer.write_event(Event::End(BytesEnd::new("rsm:CrossIndustryInvoice")))
        .map_err(|e| e.to_string())?;

    let result = writer.into_inner().into_inner();
    String::from_utf8(result).map_err(|e| e.to_string())
}

// Helper functions
fn write_element<F>(writer: &mut Writer<Cursor<Vec<u8>>>, tag: &str, f: F) -> Result<(), String>
where F: FnOnce(&mut Writer<Cursor<Vec<u8>>>) -> Result<(), String>
{
    writer.write_event(Event::Start(BytesStart::new(tag))).map_err(|e| e.to_string())?;
    f(writer)?;
    writer.write_event(Event::End(BytesEnd::new(tag))).map_err(|e| e.to_string())
}

fn write_text(writer: &mut Writer<Cursor<Vec<u8>>>, tag: &str, text: &str) -> Result<(), String> {
    write_element(writer, tag, |w| {
        w.write_event(Event::Text(BytesText::new(text))).map_err(|e| e.to_string())
    })
}

fn write_amount(writer: &mut Writer<Cursor<Vec<u8>>>, tag: &str, amount: f64, currency: &str) -> Result<(), String> {
    let mut el = BytesStart::new(tag);
    el.push_attribute(("currencyID", currency));
    writer.write_event(Event::Start(el)).map_err(|e| e.to_string())?;
    writer.write_event(Event::Text(BytesText::new(&format!("{:.2}", amount)))).map_err(|e| e.to_string())?;
    writer.write_event(Event::End(BytesEnd::new(tag))).map_err(|e| e.to_string())
}

fn write_date(writer: &mut Writer<Cursor<Vec<u8>>>, date: &str) -> Result<(), String> {
    let mut el = BytesStart::new("udt:DateTimeString");
    el.push_attribute(("format", "102"));
    writer.write_event(Event::Start(el)).map_err(|e| e.to_string())?;
    writer.write_event(Event::Text(BytesText::new(&date.replace('-', "")))).map_err(|e| e.to_string())?;
    writer.write_event(Event::End(BytesEnd::new("udt:DateTimeString"))).map_err(|e| e.to_string())
}

