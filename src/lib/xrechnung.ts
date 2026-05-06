/**
 * XRechnung / UBL 2.1 XML-Export
 *
 * Erzeugt eine GoBD-konforme, strukturierte E-Rechnung im Format
 * EN 16931 / XRechnung 3.0 (UBL 2.1).
 *
 * Pflichtfelder gemäß § 14 Abs. 4 UStG:
 *  - BT-1  Rechnungsnummer (fortlaufend, einmalig)
 *  - BT-2  Ausstellungsdatum
 *  - BT-9  Fälligkeitsdatum
 *  - BT-10 Leistungsdatum / Lieferdatum
 *  - BT-27 Name des Rechnungsstellers
 *  - BT-35 Adresse des Rechnungsstellers
 *  - BT-44 Name des Rechnungsempfängers
 *  - BT-31 Steuernummer oder USt-ID
 *  - BT-92 Nettobetrag
 *  - BT-110 Steuerbetrag
 *  - BT-112 Bruttobetrag
 */

import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { Invoice } from '@/types';

const XRECHNUNG_FOLDER = 'xrechnung';

export interface XRechnungProfile {
  /** Vollständiger Name / Firma des Rechnungsstellers */
  sellerName: string;
  /** Straße und Hausnummer */
  sellerStreet: string;
  /** PLZ */
  sellerZip: string;
  /** Stadt */
  sellerCity: string;
  /** Land (ISO 3166-1 alpha-2, z.B. DE) */
  sellerCountry: string;
  /** Steuernummer (z.B. 123/456/78901) */
  taxNumber: string;
  /** Umsatzsteuer-ID (z.B. DE123456789) – bevorzugt vor Steuernummer */
  vatId: string;
  /** E-Mail des Rechnungsstellers */
  sellerEmail: string;
}

/** Konvertiert ISO-Datum (YYYY-MM-DD) → UBL-Datumsformat (YYYY-MM-DD) */
function toUblDate(isoDate: string): string {
  if (!isoDate) return new Date().toISOString().slice(0, 10);
  return isoDate.slice(0, 10);
}

/** XML-Sonderzeichen escapen */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Rundet auf 2 Dezimalstellen */
function round2(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2);
}

/**
 * Berechnet den Umsatzsteuersatz aus Netto und USt-Betrag.
 * Gibt 0 zurück wenn Netto = 0.
 */
function calcTaxRate(netto: number, ust: number): number {
  if (netto === 0 || Math.abs(netto) < 0.001) return 0;
  return Math.round((Math.abs(ust) / Math.abs(netto)) * 100);
}

/**
 * Baut eine XRechnung-konforme XML-Zeichenkette (UBL 2.1 / EN 16931).
 */
export function buildXRechnungXml(invoice: Invoice, profile: XRechnungProfile): string {
  const issueDate = toUblDate(invoice.date);
  const deliveryDate = toUblDate(invoice.delivery_date || invoice.date);
  // Fälligkeitsdatum: 14 Tage nach Ausstellung (Standard)
  const dueDate = (() => {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  })();

  const taxAmount = round2(invoice.ust);
  const nettoAmount = round2(invoice.netto);
  const bruttoAmount = round2(invoice.brutto);
  const taxRate = calcTaxRate(invoice.netto, invoice.ust);

  // Steueridentifikation: USt-ID bevorzugt
  const taxIdBlock = profile.vatId
    ? `<cbc:CompanyID schemeID="VAT">${esc(profile.vatId)}</cbc:CompanyID>`
    : `<cbc:CompanyID schemeID="FC">${esc(profile.taxNumber)}</cbc:CompanyID>`;

  // Steuerbefreiungsgrund für Kleinunternehmer (§ 19 UStG)
  const isKleinunternehmer = invoice.ust === 0 && invoice.netto > 0;
  const taxExemptionNote = isKleinunternehmer
    ? `<cbc:TaxExemptionReasonCode>VATEX-EU-132-1-F</cbc:TaxExemptionReasonCode>
            <cbc:TaxExemptionReason>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</cbc:TaxExemptionReason>`
    : '';

  // Kategoriecode: S = Standard, E = befreit
  const taxCategoryCode = isKleinunternehmer ? 'E' : 'S';

  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <!-- ── Allgemeine Informationen ─────────────────────────────────────────── -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <!-- BT-1: Rechnungsnummer -->
  <cbc:ID>${esc(invoice.description || invoice.id.slice(0, 20))}</cbc:ID>
  <!-- BT-2: Ausstellungsdatum -->
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <!-- BT-9: Fälligkeitsdatum -->
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <!-- BT-3: Rechnungstyp (380 = Rechnung, 381 = Gutschrift) -->
  <cbc:InvoiceTypeCode>${invoice.brutto < 0 ? '381' : '380'}</cbc:InvoiceTypeCode>
  <!-- BT-22: Anmerkungen -->
  ${invoice.note ? `<cbc:Note>${esc(invoice.note)}</cbc:Note>` : '<!-- keine Notiz -->'}
  <!-- BT-5: Währung -->
  <cbc:DocumentCurrencyCode>${esc(invoice.currency || 'EUR')}</cbc:DocumentCurrencyCode>

  <!-- ── Rechnungsperiode (Leistungsdatum) ─────────────────────────────── -->
  <!-- BT-72/73: Leistungsdatum (§ 14 Abs. 4 Nr. 6 UStG) -->
  <cac:InvoicePeriod>
    <cbc:StartDate>${deliveryDate}</cbc:StartDate>
    <cbc:EndDate>${deliveryDate}</cbc:EndDate>
  </cac:InvoicePeriod>

  <!-- ── Rechnungssteller (Seller / Lieferant) ─────────────────────────── -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <!-- BT-27 -->
        <cbc:Name>${esc(profile.sellerName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <!-- BT-35: Straße -->
        <cbc:StreetName>${esc(profile.sellerStreet || '')}</cbc:StreetName>
        <!-- BT-37: PLZ -->
        <cbc:PostalZone>${esc(profile.sellerZip || '')}</cbc:PostalZone>
        <!-- BT-38: Ort -->
        <cbc:CityName>${esc(profile.sellerCity || '')}</cbc:CityName>
        <!-- BT-40: Land -->
        <cac:Country>
          <cbc:IdentificationCode>${esc(profile.sellerCountry || 'DE')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <!-- BT-31: Steuerliche Identifikation -->
        ${taxIdBlock}
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(profile.sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${profile.sellerEmail ? `<cac:Contact>
        <cbc:ElectronicMail>${esc(profile.sellerEmail)}</cbc:ElectronicMail>
      </cac:Contact>` : ''}
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- ── Rechnungsempfänger (Buyer / Kunde) ────────────────────────────── -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <!-- BT-44 -->
        <cbc:Name>${esc(invoice.partner || 'Unbekannt')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(invoice.partner || 'Unbekannt')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- ── Steuerzusammenfassung ─────────────────────────────────────────── -->
  <cac:TaxTotal>
    <!-- BT-110: Gesamtbetrag der Umsatzsteuer -->
    <cbc:TaxAmount currencyID="${esc(invoice.currency || 'EUR')}">${taxAmount}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <!-- BT-116: Nettobetrag je Steuerkategorie -->
      <cbc:TaxableAmount currencyID="${esc(invoice.currency || 'EUR')}">${nettoAmount}</cbc:TaxableAmount>
      <!-- BT-117: Steuerbetrag je Steuerkategorie -->
      <cbc:TaxAmount currencyID="${esc(invoice.currency || 'EUR')}">${taxAmount}</cbc:TaxAmount>
      <cac:TaxCategory>
        <!-- BT-118: Steuerkategoriecode -->
        <cbc:ID>${taxCategoryCode}</cbc:ID>
        <!-- BT-119: Steuersatz -->
        <cbc:Percent>${taxRate}</cbc:Percent>
        ${taxExemptionNote}
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- ── Monetäre Gesamtbeträge ─────────────────────────────────────────── -->
  <cac:LegalMonetaryTotal>
    <!-- BT-106: Summe der Netto-Einzelposten -->
    <cbc:LineExtensionAmount currencyID="${esc(invoice.currency || 'EUR')}">${nettoAmount}</cbc:LineExtensionAmount>
    <!-- BT-109: Nettobetrag Gesamt -->
    <cbc:TaxExclusiveAmount currencyID="${esc(invoice.currency || 'EUR')}">${nettoAmount}</cbc:TaxExclusiveAmount>
    <!-- BT-112: Bruttobetrag Gesamt inkl. USt. -->
    <cbc:TaxInclusiveAmount currencyID="${esc(invoice.currency || 'EUR')}">${bruttoAmount}</cbc:TaxInclusiveAmount>
    <!-- BT-115: Zu zahlender Betrag -->
    <cbc:PayableAmount currencyID="${esc(invoice.currency || 'EUR')}">${bruttoAmount}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- ── Rechnungsposition ─────────────────────────────────────────────── -->
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <!-- BT-129: Menge -->
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <!-- BT-131: Nettobetrag der Zeile -->
    <cbc:LineExtensionAmount currencyID="${esc(invoice.currency || 'EUR')}">${nettoAmount}</cbc:LineExtensionAmount>
    <cac:Item>
      <!-- BT-153: Leistungsbeschreibung -->
      <cbc:Description>${esc(invoice.description || 'Dienstleistung')}</cbc:Description>
      <cbc:Name>${esc(invoice.description || 'Dienstleistung')}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${taxCategoryCode}</cbc:ID>
        <cbc:Percent>${taxRate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <!-- BT-146: Netto-Einzelpreis -->
      <cbc:PriceAmount currencyID="${esc(invoice.currency || 'EUR')}">${nettoAmount}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>

</ubl:Invoice>`;
}

/**
 * Öffnet den Speichern-Dialog und schreibt die XRechnung-XML-Datei auf die Festplatte.
 */
export async function saveXRechnungFile(invoice: Invoice, profile: XRechnungProfile): Promise<void> {
  const invoiceNum = (invoice.description || invoice.id.slice(0, 20)).replace(/[^a-zA-Z0-9\-_]/g, '_');
  const defaultName = `XRechnung_${invoiceNum}_${invoice.date.slice(0, 10)}.xml`;

  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: 'XML E-Rechnung', extensions: ['xml'] }],
  });
  if (!path) return;

  const xml = buildXRechnungXml(invoice, profile);
  await writeTextFile(path, xml);
}

// ─── Archivierung in app_data_dir ─────────────────────────────────────────────

async function ensureXRechnungFolder(): Promise<string> {
  const base = await appDataDir();
  const dir = await join(base, XRECHNUNG_FOLDER);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

/**
 * Speichert die XRechnung-XML als Originaldokument im app_data_dir/xrechnung/-Ordner.
 * Gemäß E-Rechnungspflicht (§ 14 UStG ab 2025) ist diese XML das rechtsgültige Original.
 *
 * @returns Relativer Pfad (z. B. "xrechnung/inv-abc123.xml") für die Datenbank
 */
export async function saveXRechnungToAppData(invoice: Invoice, profile: XRechnungProfile): Promise<string> {
  const dir = await ensureXRechnungFolder();
  const safeId = invoice.id.replace(/[^a-zA-Z0-9\-_]/g, '_');
  const fileName = `${safeId}.xml`;
  const destPath = await join(dir, fileName);
  const xml = buildXRechnungXml(invoice, profile);
  await writeTextFile(destPath, xml);
  return `${XRECHNUNG_FOLDER}/${fileName}`;
}

/**
 * Liest eine archivierte XRechnung-XML aus dem app_data_dir zurück.
 * Gibt null zurück wenn die Datei nicht existiert.
 */
export async function readXRechnungFromAppData(relativePath: string): Promise<string | null> {
  try {
    const base = await appDataDir();
    const absPath = await join(base, relativePath);
    if (!(await exists(absPath))) return null;
    return await readTextFile(absPath);
  } catch {
    return null;
  }
}

/**
 * Gibt den absoluten Pfad einer archivierten XRechnung zurück.
 */
export async function getAbsoluteXRechnungPath(relativePath: string): Promise<string> {
  const base = await appDataDir();
  return join(base, relativePath);
}

// ─── XRechnung Import / Parsing ───────────────────────────────────────────────

export interface ParsedXRechnung {
  invoiceNumber: string;
  issueDate: string;          // YYYY-MM-DD
  deliveryDate: string;       // YYYY-MM-DD
  sellerName: string;
  sellerTaxId: string;
  buyerName: string;
  nettoAmount: number;
  taxAmount: number;
  bruttoAmount: number;
  taxRate: number;
  currency: string;
  note: string;
}

/**
 * Parst eine XRechnung (UBL 2.1) oder ZUGFeRD XML-Datei und extrahiert die Rechnungsdaten.
 * Unterstützt:
 *  - XRechnung / Peppol BIS Billing 3.0 (UBL Invoice)
 *  - ZUGFeRD / Factur-X (UN/CEFACT CII)
 */
export function parseXRechnungXml(xmlString: string): ParsedXRechnung | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    if (doc.querySelector('parsererror')) return null;

    const rootTag = doc.documentElement.localName;

    // ── UBL 2.1 (XRechnung / Peppol) ──
    if (rootTag === 'Invoice') {
      return parseUblInvoice(doc);
    }

    // ── UN/CEFACT CII (ZUGFeRD / Factur-X) ──
    if (rootTag === 'CrossIndustryInvoice') {
      return parseCiiInvoice(doc);
    }

    return null;
  } catch {
    return null;
  }
}

function getTextContent(doc: Document, ...selectors: string[]): string {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    } catch { /* try next */ }
  }
  return '';
}

function parseUblInvoice(doc: Document): ParsedXRechnung {
  const get = (...s: string[]) => getTextContent(doc, ...s);

  // Dates
  const issueDate = get('IssueDate') || get('cbc\\:IssueDate');
  const startDate = get('InvoicePeriod StartDate') || get('cbc\\:StartDate');

  // Seller (AccountingSupplierParty)
  const sellerName = get(
    'AccountingSupplierParty Party PartyName Name',
    'AccountingSupplierParty Party PartyLegalEntity RegistrationName'
  );

  // Tax ID
  const sellerTaxId = get(
    'AccountingSupplierParty Party PartyTaxScheme CompanyID'
  );

  // Buyer
  const buyerName = get(
    'AccountingCustomerParty Party PartyName Name',
    'AccountingCustomerParty Party PartyLegalEntity RegistrationName'
  );

  // Amounts (LegalMonetaryTotal)
  const nettoStr = get('LegalMonetaryTotal TaxExclusiveAmount', 'LegalMonetaryTotal LineExtensionAmount');
  const bruttoStr = get('LegalMonetaryTotal TaxInclusiveAmount', 'LegalMonetaryTotal PayableAmount');
  const taxStr = get('TaxTotal TaxAmount');
  const taxRateStr = get('TaxTotal TaxSubtotal TaxCategory Percent');
  const currency = doc.querySelector('DocumentCurrencyCode, cbc\\:DocumentCurrencyCode')?.textContent?.trim() || 'EUR';
  const invoiceNumber = get('ID', 'cbc\\:ID') || '';
  const note = get('Note', 'cbc\\:Note') || '';

  return {
    invoiceNumber,
    issueDate: normalizeDate(issueDate),
    deliveryDate: normalizeDate(startDate || issueDate),
    sellerName,
    sellerTaxId,
    buyerName,
    nettoAmount: parseFloat(nettoStr.replace(',', '.')) || 0,
    taxAmount: parseFloat(taxStr.replace(',', '.')) || 0,
    bruttoAmount: parseFloat(bruttoStr.replace(',', '.')) || 0,
    taxRate: parseFloat(taxRateStr.replace(',', '.')) || 0,
    currency,
    note,
  };
}

function parseCiiInvoice(doc: Document): ParsedXRechnung {
  const get = (...s: string[]) => getTextContent(doc, ...s);

  const invoiceNumber = get('ExchangedDocument ID', 'ram\\:ID');
  const issueDate = parseCiiDate(get('ExchangedDocument IssueDateTime DateTimeString'));
  const deliveryDate = parseCiiDate(
    get('SpecifiedSupplyChainTradeDelivery ActualDeliverySupplyChainEvent OccurrenceDateTime DateTimeString') || issueDate
  );

  const sellerName = get(
    'SellerTradeParty Name',
    'ram\\:SellerTradeParty ram\\:Name'
  );
  const sellerTaxId = get(
    'SellerTradeParty SpecifiedTaxRegistration ID',
    'ram\\:SpecifiedTaxRegistration ram\\:ID'
  );
  const buyerName = get(
    'BuyerTradeParty Name',
    'ram\\:BuyerTradeParty ram\\:Name'
  );

  const nettoStr = get('SpecifiedTradeSettlementHeaderMonetarySummation TaxBasisTotalAmount');
  const bruttoStr = get('SpecifiedTradeSettlementHeaderMonetarySummation GrandTotalAmount');
  const taxStr = get('SpecifiedTradeSettlementHeaderMonetarySummation TaxTotalAmount');
  const taxRateStr = get('ApplicableTradeTax RateApplicablePercent');
  const currency = doc.querySelector('InvoiceCurrencyCode, ram\\:InvoiceCurrencyCode')?.textContent?.trim() || 'EUR';
  const note = get('IncludedNote Content') || '';

  return {
    invoiceNumber,
    issueDate,
    deliveryDate,
    sellerName,
    sellerTaxId,
    buyerName,
    nettoAmount: parseFloat(nettoStr.replace(',', '.')) || 0,
    taxAmount: parseFloat(taxStr.replace(',', '.')) || 0,
    bruttoAmount: parseFloat(bruttoStr.replace(',', '.')) || 0,
    taxRate: parseFloat(taxRateStr.replace(',', '.')) || 0,
    currency,
    note,
  };
}

/** Normalisiert ein ISO-Datum (YYYY-MM-DD) oder gibt heute zurück */
function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // Bereits YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // YYYYMMDD (CII-Format)
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch { /* ignore */ }
  return new Date().toISOString().slice(0, 10);
}

/** Parst CII DateTimeString (z. B. "20250315" mit format 102) */
function parseCiiDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  return normalizeDate(raw.trim());
}

/**
 * Liest eine XRechnung/ZUGFeRD XML-Datei von der Festplatte und parst sie.
 */
export async function importXRechnungFromFile(filePath: string): Promise<ParsedXRechnung | null> {
  try {
    const xml = await readTextFile(filePath);
    return parseXRechnungXml(xml);
  } catch {
    return null;
  }
}

