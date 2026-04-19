// ─── Invoice Types ────────────────────────────────────────────────────────────

export const INVOICE_TYPES = ['einnahme', 'ausgabe', 'info'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const TYPE_LABELS: Record<InvoiceType, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  info: 'Info',
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const CATEGORIES = [
  // ── Einnahmen-Kategorien ────────────────────────────────
  'umsatz_pflichtig',
  'umsatz_steuerfrei',
  'ust_erstattung',
  'privateinlage',
  'anlagenverkauf',
  'erstattungen',
  'sonstige_einnahmen',
  'einnahmen', // legacy – veraltet, bitte neu zuordnen
  // ── Betriebsausgaben ────────────────────────────────────
  'anlagevermoegen_afa',
  'gwg',
  'buerobedarf',
  'fahrzeugkosten',
  'fremdleistungen',
  'marketing',
  'miete',
  'reisekosten',
  'software_abos',
  'sonstiges',
  'kommunikation',
  'versicherungen_betrieb',
  'weiterbildung',
  // ── Sonderausgaben ──────────────────────────────────────
  'krankenkasse',
  'sozialversicherung',
  'spenden',
  // ── Privat ──────────────────────────────────────────────
  'privat',
  'privatentnahme',
  // ── Info ────────────────────────────────────────────────
  'vertraege',
] as const;

export type Category = (typeof CATEGORIES)[number];

// ─── Kategorie-Labels ─────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<Category, string> = {
  umsatz_pflichtig: 'Umsatzerlöse (steuerpflichtig)',
  umsatz_steuerfrei: 'Umsatzerlöse (steuerfrei / §19 UStG)',
  ust_erstattung: 'USt-Erstattung vom Finanzamt',
  privateinlage: 'Privateinlage',
  anlagenverkauf: 'Verkauf von Anlagevermögen',
  erstattungen: 'Erstattungen / Auslagen',
  sonstige_einnahmen: 'Sonstige Einnahmen',
  einnahmen: 'Einnahmen (allgemein – bitte neu zuordnen)',
  anlagevermoegen_afa: 'Anlagevermögen / AfA',
  buerobedarf: 'Bürobedarf & Material',
  fahrzeugkosten: 'Fahrzeugkosten',
  fremdleistungen: 'Fremdleistungen',
  gwg: 'GWG (Geringwertige Wirtschaftsgüter)',
  marketing: 'Marketing & Werbung',
  miete: 'Miete & Raumkosten',
  reisekosten: 'Reisekosten',
  software_abos: 'Software & Abos',
  kommunikation: 'Telefon & Internet',
  versicherungen_betrieb: 'Versicherungen (Betrieb)',
  weiterbildung: 'Weiterbildung & Fachliteratur',
  krankenkasse: 'Krankenversicherung',
  sozialversicherung: 'Sozialversicherung / Altersvorsorge',
  spenden: 'Spenden (Sonderausgabe)',
  privat: 'Privat (Kauf, nicht absetzbar)',
  privatentnahme: 'Privatentnahme (Überweisung an sich selbst)',
  vertraege: 'Verträge',
  sonstiges: 'Sonstiges',
};

// ─── Typ-spezifische Kategorie-Listen ─────────────────────────────────────────

export const INCOME_CATEGORIES: Category[] = [
  'umsatz_pflichtig',
  'umsatz_steuerfrei',
  'ust_erstattung',
  'privateinlage',
  'anlagenverkauf',
  'erstattungen',
  'sonstige_einnahmen',
  'einnahmen', // legacy
];

export const EXPENSE_CATEGORIES: Category[] = [
  'anlagevermoegen_afa',
  'gwg',
  'buerobedarf',
  'fahrzeugkosten',
  'fremdleistungen',
  'marketing',
  'miete',
  'reisekosten',
  'software_abos',
  'kommunikation',
  'versicherungen_betrieb',
  'weiterbildung',
  'krankenkasse',
  'sozialversicherung',
  'spenden',
  'privat',
  'privatentnahme',
  'sonstiges',
];

export const INFO_CATEGORIES: Category[] = [
  'vertraege',
  'sonstiges',
];

/** Veraltete Kategorien, die nur noch für Altdaten existieren. */
export const LEGACY_CATEGORIES: Category[] = ['einnahmen'];

export function getCategoriesForType(type: InvoiceType): Category[] {
  if (type === 'einnahme') return INCOME_CATEGORIES;
  if (type === 'ausgabe') return EXPENSE_CATEGORIES;
  if (type === 'info') return INFO_CATEGORIES;
  return [...CATEGORIES] as Category[];
}

/**
 * Gibt die Kategorien für den Typ zurück.
 * Veraltete Kategorien werden NUR eingeschlossen, wenn `currentCategory` eine davon ist.
 */
export function getCategoriesForTypeFiltered(type: InvoiceType, currentCategory?: Category): Category[] {
  const base = getCategoriesForType(type);
  const isLegacySelected = currentCategory && (LEGACY_CATEGORIES as string[]).includes(currentCategory);
  if (isLegacySelected) return base; // legacy schon drin (INCOME_CATEGORIES enthält 'einnahmen')
  return base.filter((c) => !(LEGACY_CATEGORIES as string[]).includes(c));
}

export function getDefaultCategoryForType(type: InvoiceType): Category {
  if (type === 'einnahme') return 'umsatz_pflichtig';
  if (type === 'info') return 'vertraege';
  return 'sonstiges';
}

export function isCategoryValidForType(category: Category, type: InvoiceType): boolean {
  return (getCategoriesForType(type) as string[]).includes(category);
}

// ─── Sonder- / Privat-Kategorien ─────────────────────────────────────────────

export const SONDERAUSGABEN_CATEGORIES: Category[] = [
  'spenden',
  'krankenkasse',
  'sozialversicherung',
];

export const PRIVAT_CATEGORIES: Category[] = [
  'privat',
  'privatentnahme',
];

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

