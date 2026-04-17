export const CATEGORIES = [
  'einnahmen',
  'erstattungen',
  'anlagevermoegen_afa',
  'gwg',
  'software_abos',
  'fremdleistungen',
  'vertraege',
  'sonstiges',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  einnahmen: 'Einnahmen',
  erstattungen: 'Erstattungen / Auslagen',
  anlagevermoegen_afa: 'Anlagevermögen / AfA',
  gwg: 'GWG',
  software_abos: 'Software & Abos',
  fremdleistungen: 'Fremdleistungen',
  vertraege: 'Verträge',
  sonstiges: 'Sonstiges',
};

export const INVOICE_TYPES = ['einnahme', 'ausgabe', 'info'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const TYPE_LABELS: Record<InvoiceType, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  info: 'Info',
};

export interface Invoice {
  id: string;
  date: string;
  year: number;
  month: number;
  category: Category;
  description: string;
  partner: string;
  netto: number;
  ust: number;
  brutto: number;
  type: InvoiceType;
  currency: string;
  pdf_path: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface GeminiResult {
  date: string;
  description: string;
  partner: string;
  netto: number;
  ust: number;
  brutto: number;
  currency: string;
  type: InvoiceType;
  suggested_category: Category;
}

