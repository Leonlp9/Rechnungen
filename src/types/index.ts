export const CATEGORIES = [
  // Einnahmen
  'einnahmen',
  'erstattungen',
  // Betriebsausgaben
  'anlagevermoegen_afa',
  'gwg',
  'software_abos',
  'fremdleistungen',
  'buerobedarf',
  'reisekosten',
  'marketing',
  'weiterbildung',
  'miete',
  'versicherungen_betrieb',
  'fahrzeugkosten',
  'kommunikation',
  'vertraege',
  'sonstiges',
  // Sonderausgaben (kein regulärer Betriebsaufwand, aber steuerlich ggf. absetzbar)
  'spenden',
  'krankenkasse',
  'sozialversicherung',
  // Privat (weder Betriebsausgabe noch absetzbar)
  'privat',
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
];

export const CATEGORY_LABELS: Record<Category, string> = {
  einnahmen: 'Einnahmen',
  erstattungen: 'Erstattungen / Auslagen',
  anlagevermoegen_afa: 'Anlagevermögen / AfA',
  gwg: 'GWG',
  software_abos: 'Software & Abos',
  fremdleistungen: 'Fremdleistungen',
  buerobedarf: 'Bürobedarf & Material',
  reisekosten: 'Reisekosten',
  marketing: 'Marketing & Werbung',
  weiterbildung: 'Weiterbildung & Fachliteratur',
  miete: 'Miete & Raumkosten',
  versicherungen_betrieb: 'Versicherungen (Betrieb)',
  fahrzeugkosten: 'Fahrzeugkosten',
  kommunikation: 'Telefon & Internet',
  vertraege: 'Verträge',
  sonstiges: 'Sonstiges',
  // Sonderausgaben
  spenden: 'Spenden',
  krankenkasse: 'Krankenversicherung',
  sozialversicherung: 'Sozialversicherung / Altersvorsorge',
  // Privat
  privat: 'Privat (nicht absetzbar)',
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

