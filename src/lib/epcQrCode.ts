import QRCode from 'qrcode';

/**
 * Generiert einen EPC-QR-Code (GiroCode / BezahlCode) als Data-URL (PNG).
 *
 * Format gemäß EPC069-12 v3.0 (European Payments Council).
 * Format der Payload:
 * BCD\n002\n1\nSCT\n{BIC}\n{Name}\n{IBAN}\nEUR{Betrag}\n\n\n{Verwendungszweck}\n
 *
 * @param iban   IBAN des Empfängers (z.B. "DE12345678901234567890")
 * @param bic    BIC/SWIFT-Code (optional seit Nov. 2016 für SEPA-Inland)
 * @param name   Name des Empfängers (max. 70 Zeichen)
 * @param amount Betrag in Euro (z.B. 142.50)
 * @param ref    Verwendungszweck / Referenz (max. 140 Zeichen)
 */
export async function generateEpcQrDataUrl(
  iban: string,
  bic: string,
  name: string,
  amount: number,
  ref: string,
  options?: { fgColor?: string; bgColor?: string },
): Promise<string> {
  // Betrag auf max 2 Nachkommastellen, EPC verlangt "EUR" + Betrag ohne Leerzeichen
  const amt = `EUR${amount.toFixed(2)}`;
  // Name auf 70 Zeichen kürzen
  const safeName = name.slice(0, 70);
  // Referenz auf 140 Zeichen kürzen
  const safeRef = ref.slice(0, 140);
  // IBAN normalisieren (Leerzeichen entfernen)
  const safeIban = iban.replace(/\s/g, '');

  const payload = [
    'BCD',         // Service Tag
    '002',         // Version
    '1',           // Encoding: UTF-8
    'SCT',         // Identification Code
    bic || '',     // BIC (optional)
    safeName,      // Empfänger Name
    safeIban,      // IBAN
    amt,           // Betrag
    '',            // Purpose (leer)
    '',            // Remittance Reference (strukturiert – leer)
    safeRef,       // Remittance (unstrukturiert)
    '',            // Beneficiary Information (optional)
  ].join('\n');

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    width: 200,
    margin: 1,
    color: {
      dark: options?.fgColor || '#111827',
      light: options?.bgColor || '#ffffff',
    },
  });
}

/**
 * Gibt den EPC-Payload-Text zurück (ohne QR-Code-Generierung),
 * nützlich für Debugging oder Textdarstellung.
 */
export function buildEpcPayload(
  iban: string,
  bic: string,
  name: string,
  amount: number,
  ref: string,
): string {
  const amt = `EUR${amount.toFixed(2)}`;
  return [
    'BCD', '002', '1', 'SCT',
    bic || '',
    name.slice(0, 70),
    iban.replace(/\s/g, ''),
    amt,
    '', '',
    ref.slice(0, 140),
    '',
  ].join('\n');
}

