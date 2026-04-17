export const CATEGORIES = [
  'anlagevermoegen_afa',
  'buerobedarf',
  'einnahmen',
  'erstattungen',
  'fahrzeugkosten',
  'fremdleistungen',
  'gwg',
  'krankenkasse',
  'marketing',
  'miete',
  'privat',
  'privatentnahme',
  'reisekosten',
  'software_abos',
  'sozialversicherung',
  'sonstiges',
  'spenden',
  'kommunikation',
  'versicherungen_betrieb',
  'vertraege',
  'weiterbildung',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Kategorien, die KEINE regulären Betriebsausgaben sind.
 * Nur für type='ausgabe' relevant – bei type='einnahme' (z.B. Spendeneinnahmen) gelten sie normal als Einnahme.
 */
export const SONDERAUSGABEN_CATEGORIES: Category[] = [
  'spenden',
  'krankenkasse',
  'sozialversicherung',
];

/** Rein private Ausgaben – nicht absetzbar, kein Betriebsaufwand, kein Steuerbonus. */
export const PRIVAT_CATEGORIES: Category[] = [
  'privat',
  'privatentnahme',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  anlagevermoegen_afa: 'Anlagevermögen / AfA',
  buerobedarf: 'Bürobedarf & Material',
  einnahmen: 'Einnahmen',
  erstattungen: 'Erstattungen / Auslagen',
  fahrzeugkosten: 'Fahrzeugkosten',
  fremdleistungen: 'Fremdleistungen',
  gwg: 'GWG',
  krankenkasse: 'Krankenversicherung',
  marketing: 'Marketing & Werbung',
  miete: 'Miete & Raumkosten',
  privat: 'Privat (Kauf, nicht absetzbar)',
  privatentnahme: 'Privatentnahme (Überweisung an sich selbst)',
  reisekosten: 'Reisekosten',
  software_abos: 'Software & Abos',
  sozialversicherung: 'Sozialversicherung / Altersvorsorge',
  sonstiges: 'Sonstiges',
  spenden: 'Spenden',
  kommunikation: 'Telefon & Internet',
  versicherungen_betrieb: 'Versicherungen (Betrieb)',
  vertraege: 'Verträge',
  weiterbildung: 'Weiterbildung & Fachliteratur',
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

