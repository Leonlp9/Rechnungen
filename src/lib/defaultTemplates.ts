import type { InvoiceTemplate, TemplateElement, TemplateVariable } from '@/types/template';

let _uid = 1;
function uid() { return `el-${_uid++}`; }

const sharedVars: TemplateVariable[] = [
  { key: 'sender_name', label: 'Ihr Name / Firma', defaultValue: '', settingsKey: 'profile_name', multiline: false },
  { key: 'sender_address', label: 'Ihre Adresse', defaultValue: '', settingsKey: 'profile_address', multiline: false },
  { key: 'sender_email', label: 'Ihre E-Mail', defaultValue: '', settingsKey: 'profile_email', multiline: false },
  { key: 'sender_phone', label: 'Ihr Telefon', defaultValue: '', settingsKey: 'profile_phone', multiline: false },
  { key: 'sender_tax_number', label: 'Steuernummer', defaultValue: '', settingsKey: 'profile_tax_number', multiline: false },
  { key: 'sender_vat_id', label: 'USt-IdNr.', defaultValue: '', settingsKey: 'profile_vat_id', multiline: false },
  { key: 'sender_iban', label: 'IBAN', defaultValue: '', settingsKey: 'profile_iban', multiline: false },
  { key: 'sender_bic', label: 'BIC', defaultValue: '', settingsKey: 'profile_bic', multiline: false },
  { key: 'receiver_name', label: 'Empfänger Name', defaultValue: '', settingsKey: '', multiline: false },
  { key: 'receiver_address', label: 'Empfänger Adresse', defaultValue: '', settingsKey: '', multiline: true },
  { key: 'doc_number', label: 'Dokumenten-Nr.', defaultValue: 'R-2024-001', settingsKey: '', multiline: false },
  { key: 'doc_date', label: 'Datum', defaultValue: '', settingsKey: '', multiline: false },
  { key: 'due_date', label: 'Fällig bis', defaultValue: '', settingsKey: '', multiline: false },
  { key: 'notes', label: 'Hinweise', defaultValue: 'Zahlung per Überweisung innerhalb von 14 Tagen nach Erhalt der Rechnung.', settingsKey: '', multiline: true },
  // Auto-calculated from line items – not shown as manual inputs
  { key: 'netto', label: 'Nettobetrag', defaultValue: '0,00 €', settingsKey: '', multiline: false, autoCalculated: true },
  { key: 'vat_amount', label: 'MwSt. Betrag', defaultValue: '0,00 €', settingsKey: '', multiline: false, autoCalculated: true },
  { key: 'total', label: 'Gesamtbetrag (Brutto)', defaultValue: '0,00 €', settingsKey: '', multiline: false, autoCalculated: true },
];

function buildInvoiceElements(titleText: string, titleColor: string): TemplateElement[] {
  return [
    // -- Header background --
    { id: uid(), type: 'rectangle', x: 0, y: 0, width: 794, height: 100, zIndex: 0, backgroundColor: '#eff6ff', borderColor: 'transparent', borderWidth: 0, borderRadius: 0 },
    // Title
    { id: uid(), type: 'text', x: 460, y: 22, width: 304, height: 55, zIndex: 2, content: titleText, fontSize: 30, fontWeight: 'bold', fontStyle: 'normal', color: titleColor, backgroundColor: 'transparent', textAlign: 'right', lineHeight: 1.2 },
    // Sender name
    { id: uid(), type: 'variable', x: 30, y: 22, width: 360, height: 30, zIndex: 2, variableKey: 'sender_name', prefix: '', suffix: '', fontSize: 15, fontWeight: 'bold', fontStyle: 'normal', color: '#111827', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    // Sender address
    { id: uid(), type: 'variable', x: 30, y: 54, width: 360, height: 18, zIndex: 2, variableKey: 'sender_address', prefix: '', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#6b7280', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    // Sender email
    { id: uid(), type: 'variable', x: 30, y: 74, width: 360, height: 18, zIndex: 2, variableKey: 'sender_email', prefix: '', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#6b7280', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    // Blue accent line
    { id: uid(), type: 'rectangle', x: 0, y: 100, width: 794, height: 3, zIndex: 1, backgroundColor: titleColor, borderColor: 'transparent', borderWidth: 0, borderRadius: 0 },

    // -- Invoice meta box (top right) --
    { id: uid(), type: 'rectangle', x: 494, y: 115, width: 270, height: 92, zIndex: 1, backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 6 },
    { id: uid(), type: 'text', x: 504, y: 125, width: 120, height: 18, zIndex: 3, content: 'Dokument-Nr.:', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#888', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 624, y: 125, width: 130, height: 18, zIndex: 3, variableKey: 'doc_number', prefix: '', suffix: '', fontSize: 9, fontWeight: 'bold', fontStyle: 'normal', color: '#111', backgroundColor: 'transparent', textAlign: 'right', lineHeight: 1.2 },
    { id: uid(), type: 'text', x: 504, y: 148, width: 120, height: 18, zIndex: 3, content: 'Datum:', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#888', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 624, y: 148, width: 130, height: 18, zIndex: 3, variableKey: 'doc_date', prefix: '', suffix: '', fontSize: 9, fontWeight: 'bold', fontStyle: 'normal', color: '#111', backgroundColor: 'transparent', textAlign: 'right', lineHeight: 1.2 },
    { id: uid(), type: 'text', x: 504, y: 171, width: 120, height: 18, zIndex: 3, content: 'Fällig bis:', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#888', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 624, y: 171, width: 130, height: 18, zIndex: 3, variableKey: 'due_date', prefix: '', suffix: '', fontSize: 9, fontWeight: 'bold', fontStyle: 'normal', color: '#111', backgroundColor: 'transparent', textAlign: 'right', lineHeight: 1.2 },

    // -- Receiver --
    { id: uid(), type: 'text', x: 30, y: 118, width: 250, height: 16, zIndex: 2, content: 'Rechnungsempfänger', fontSize: 8, fontWeight: 'normal', fontStyle: 'normal', color: '#bbb', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 30, y: 136, width: 380, height: 26, zIndex: 2, variableKey: 'receiver_name', prefix: '', suffix: '', fontSize: 13, fontWeight: 'bold', fontStyle: 'normal', color: '#111827', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 30, y: 164, width: 380, height: 40, zIndex: 2, variableKey: 'receiver_address', prefix: '', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#444', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.5 },

    // -- Items table (dynamic) --
    {
      id: uid(), type: 'items',
      x: 30, y: 220, width: 734, height: 180, zIndex: 2,
      fontSize: 9, rowHeight: 22,
      headerBgColor: titleColor, headerTextColor: '#ffffff',
      borderColor: '#e2e8f0', altRowBgColor: '#f8fafc', summaryBgColor: titleColor,
      mwstRate: 19,
      colWidths: [0.06, 0.40, 0.09, 0.09, 0.16, 0.20],
    } as TemplateElement,

    // -- Totals box --
    { id: uid(), type: 'rectangle', x: 494, y: 418, width: 270, height: 110, zIndex: 1, backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 6 },
    { id: uid(), type: 'text', x: 504, y: 430, width: 130, height: 18, zIndex: 3, content: 'Netto:', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#666', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 634, y: 430, width: 120, height: 18, zIndex: 3, variableKey: 'netto', prefix: '', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#222', backgroundColor: 'transparent', textAlign: 'right', lineHeight: 1.2 },
    { id: uid(), type: 'text', x: 504, y: 452, width: 130, height: 18, zIndex: 3, content: 'MwSt. (19%):', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#666', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 634, y: 452, width: 120, height: 18, zIndex: 3, variableKey: 'vat_amount', prefix: '', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#222', backgroundColor: 'transparent', textAlign: 'right', lineHeight: 1.2 },
    { id: uid(), type: 'rectangle', x: 504, y: 474, width: 250, height: 1, zIndex: 2, backgroundColor: '#cbd5e1', borderColor: 'transparent', borderWidth: 0, borderRadius: 0 },
    { id: uid(), type: 'text', x: 504, y: 480, width: 130, height: 24, zIndex: 3, content: 'Gesamt:', fontSize: 11, fontWeight: 'bold', fontStyle: 'normal', color: '#111', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 560, y: 480, width: 194, height: 24, zIndex: 3, variableKey: 'total', prefix: '', suffix: '', fontSize: 13, fontWeight: 'bold', fontStyle: 'normal', color: titleColor, backgroundColor: 'transparent', textAlign: 'right', lineHeight: 1.2 },

    // -- Notes --
    { id: uid(), type: 'text', x: 30, y: 422, width: 400, height: 16, zIndex: 2, content: 'Hinweise:', fontSize: 8, fontWeight: 'bold', fontStyle: 'normal', color: '#bbb', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 30, y: 440, width: 420, height: 55, zIndex: 2, variableKey: 'notes', prefix: '', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#555', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.5 },

    // -- Bank info --
    { id: uid(), type: 'text', x: 30, y: 540, width: 300, height: 16, zIndex: 2, content: 'Bankverbindung:', fontSize: 8, fontWeight: 'bold', fontStyle: 'normal', color: '#bbb', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 30, y: 558, width: 420, height: 18, zIndex: 2, variableKey: 'sender_iban', prefix: 'IBAN: ', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#444', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 30, y: 578, width: 420, height: 18, zIndex: 2, variableKey: 'sender_bic', prefix: 'BIC: ', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#444', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 30, y: 598, width: 420, height: 18, zIndex: 2, variableKey: 'sender_tax_number', prefix: 'St.-Nr.: ', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#444', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },
    { id: uid(), type: 'variable', x: 30, y: 618, width: 420, height: 18, zIndex: 2, variableKey: 'sender_vat_id', prefix: 'USt-IdNr.: ', suffix: '', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#444', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.2 },

    // -- Footer --
    { id: uid(), type: 'rectangle', x: 0, y: 1092, width: 794, height: 1, zIndex: 1, backgroundColor: '#e2e8f0', borderColor: 'transparent', borderWidth: 0, borderRadius: 0 },
    { id: uid(), type: 'text', x: 0, y: 1100, width: 794, height: 18, zIndex: 2, content: 'Vielen Dank für Ihren Auftrag!', fontSize: 9, fontWeight: 'normal', fontStyle: 'normal', color: '#bbb', backgroundColor: 'transparent', textAlign: 'center', lineHeight: 1.2 },
  ] as TemplateElement[];
}

export const DEFAULT_RECHNUNG: InvoiceTemplate = {
  id: 'builtin-rechnung',
  name: 'Rechnung (Standard)',
  templateType: 'invoice',
  isBuiltin: true,
  variables: sharedVars,
  elements: buildInvoiceElements('RECHNUNG', '#2563eb'),
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const DEFAULT_GUTSCHRIFT: InvoiceTemplate = {
  id: 'builtin-gutschrift',
  name: 'Gutschrift (Standard)',
  templateType: 'credit',
  isBuiltin: true,
  variables: sharedVars.map(v =>
    v.key === 'doc_number' ? { ...v, label: 'Gutschrift-Nr.', defaultValue: 'G-2024-001' } :
    v.key === 'due_date' ? { ...v, label: 'Gutschrift gültig bis' } : v
  ),
  elements: buildInvoiceElements('GUTSCHRIFT', '#16a34a'),
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

