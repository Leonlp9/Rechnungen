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
  'reverse_charge',
  'ust_erstattung',
  'privateinlage',
  'anlagenverkauf',
  'erstattungen',
  'sponsoring',
  'affiliate',
  'donations_tips',
  'sachzuwendungen',
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
  'bewirtungskosten',
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
  // ── Angestellte: Einnahmen ──────────────────────────────
  'gehalt',
  'sonderzahlung',
  'lohnersatz',
  // ── Angestellte: Werbungskosten (Anlage N) ──────────────
  'wk_pendeln',
  'wk_homeoffice',
  'wk_arbeitsmittel',
  'wk_fortbildung',
  'wk_bewerbung',
  'wk_berufsverband',
  'wk_dienstreise',
  'wk_doppelter_haushalt',
  'wk_umzug',
  'wk_sonstige',
  // ── Angestellte: Sonderausgaben ─────────────────────────
  'sa_vorsorge',
  'sa_versicherungen',
  'sa_kinderbetreuung',
  // ── Außergewöhnliche Belastungen (§ 33 EStG) ────────────
  'agb_krankheit',
  'agb_pflege',
  'agb_sonstige',
  // ── Haushaltsnahe Leistungen (§ 35a EStG) ───────────────
  'hh_dienstleistung',
  'hh_handwerker',
  // ── Info ────────────────────────────────────────────────
  'vertraege',
] as const;

export type Category = (typeof CATEGORIES)[number];

// ─── Kategorie-Labels ─────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<Category, string> = {
  umsatz_pflichtig: 'Umsatzerlöse (steuerpflichtig)',
  umsatz_steuerfrei: 'Umsatzerlöse (steuerfrei / §19 UStG)',
  reverse_charge: 'Reverse Charge (§ 13b UStG)',
  ust_erstattung: 'USt-Erstattung vom Finanzamt',
  privateinlage: 'Privateinlage',
  anlagenverkauf: 'Verkauf von Anlagevermögen',
  erstattungen: 'Erstattungen / Auslagen',
  sponsoring: 'Sponsoring / Werbeleistung',
  affiliate: 'Affiliate / Vermittlungsprovision',
  donations_tips: 'Donations / Tips (Streaming)',
  sachzuwendungen: 'Sachzuwendungen (Marktwert)',
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
  // Bei der Bewirtung mindern nur 70 % den Gewinn (§ 4 Abs. 5 Satz 1 Nr. 2
  // EStG). „Absetzbar" war hier zu unscharf, weil die Vorsteuer trotzdem zu
  // 100 % gezogen werden darf – gekürzt wird allein der Gewinn.
  bewirtungskosten: 'Bewirtungskosten (70 % mindern den Gewinn)',
  software_abos: 'Software & Abos',
  kommunikation: 'Telefon & Internet',
  // Die Berufsgenossenschaft wird hier ausdrücklich genannt, damit ihre
  // Beiträge nicht bei der Altersvorsorge landen: Die gesetzliche
  // Unfallversicherung ist eine Betriebsausgabe.
  versicherungen_betrieb: 'Versicherungen & Berufsgenossenschaft (Betrieb)',
  weiterbildung: 'Weiterbildung & Fachliteratur',
  // Die Sonderausgaben stehen in derselben Auswahl wie die Betriebsausgaben
  // und sehen dort aus, als würden sie den Gewinn mindern. Sie mindern aber
  // erst eine Stufe später das zu versteuernde Einkommen (§ 10 EStG). Der
  // Zusatz „nicht betrieblich" macht diesen Unterschied schon im Menü sichtbar.
  krankenkasse: 'Krankenversicherung (Sonderausgabe, nicht betrieblich)',
  // Bewusst nicht mehr „Sozialversicherung": Auch die Berufsgenossenschaft ist
  // Sozialversicherung, gehört aber zu den Betriebsausgaben. Der alte Name hat
  // ihre Beiträge in die falsche Zeile gezogen.
  sozialversicherung: 'Altersvorsorge (Sonderausgabe, nicht betrieblich)',
  spenden: 'Spenden (Sonderausgabe)',
  privat: 'Privat (Kauf, nicht absetzbar)',
  privatentnahme: 'Privatentnahme (Überweisung an sich selbst)',
  gehalt: 'Gehalt / Lohn',
  sonderzahlung: 'Sonderzahlung (13. Gehalt, Bonus)',
  lohnersatz: 'Lohnersatz (Kranken-, Elterngeld)',
  wk_pendeln: 'Fahrt zur Arbeit (Pendlerpauschale)',
  wk_homeoffice: 'Homeoffice-Pauschale',
  wk_arbeitsmittel: 'Arbeitsmittel (Laptop, Werkzeug, Fachbuch)',
  wk_fortbildung: 'Fortbildung & Weiterbildung',
  wk_bewerbung: 'Bewerbungskosten',
  wk_berufsverband: 'Berufsverband / Gewerkschaft',
  wk_dienstreise: 'Dienstreise (nicht erstattet)',
  wk_doppelter_haushalt: 'Doppelte Haushaltsführung',
  wk_umzug: 'Berufsbedingter Umzug',
  wk_sonstige: 'Sonstige Werbungskosten',
  sa_vorsorge: 'Vorsorge (Kranken-, Pflege-, Rentenversicherung)',
  sa_versicherungen: 'Weitere Versicherungen (Haftpflicht, BU, Unfall)',
  sa_kinderbetreuung: 'Kinderbetreuung',
  // Diese drei stehen jetzt auch in der Ausgabenliste der Selbständigen, direkt
  // unter den Betriebsausgaben. „Krankheitskosten" allein hätte dort so
  // ausgesehen, als würde es den Gewinn mindern – deshalb der Zusatz.
  agb_krankheit: 'Krankheitskosten (außergewöhnliche Belastung)',
  agb_pflege: 'Pflegekosten (außergewöhnliche Belastung)',
  agb_sonstige: 'Sonstige außergewöhnliche Belastungen',
  hh_dienstleistung: 'Haushaltsnahe Dienstleistung (§ 35a)',
  hh_handwerker: 'Handwerkerleistung (§ 35a)',
  vertraege: 'Verträge',
  sonstiges: 'Sonstiges',
};

// ─── Typ-spezifische Kategorie-Listen ─────────────────────────────────────────

export const INCOME_CATEGORIES: Category[] = [
  'umsatz_pflichtig',
  'umsatz_steuerfrei',
  'reverse_charge',
  'ust_erstattung',
  'privateinlage',
  'anlagenverkauf',
  'erstattungen',
  'sponsoring',
  'affiliate',
  'donations_tips',
  'sachzuwendungen',
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
  'bewirtungskosten',
  'software_abos',
  'kommunikation',
  'versicherungen_betrieb',
  'weiterbildung',
  'krankenkasse',
  'sozialversicherung',
  'spenden',
  // Außergewöhnliche Belastungen und haushaltsnahe Leistungen standen bisher
  // nur Angestellten zur Verfügung. Beide hängen aber am privaten Einkommen
  // und nicht am Betrieb: Ein Selbständiger zahlt genauso seine Krankheits-
  // kosten und lässt genauso den Handwerker kommen. Ohne diese Zeilen konnte
  // er die Belege nirgends erfassen und hat den Abzug schlicht verschenkt.
  'agb_krankheit',
  'agb_pflege',
  'agb_sonstige',
  'hh_dienstleistung',
  'hh_handwerker',
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

// ─── Angestellte ──────────────────────────────────────────────────────────────
//
// Wer angestellt ist, führt keinen Betrieb: Es gibt keine Umsatzerlöse, keine
// Umsatzsteuer und keine Betriebsausgaben. Stattdessen zählt für die
// Steuererklärung, was von der Anlage N und den Sonderausgaben abgedeckt ist –
// und was das Finanzamt nach § 35a EStG direkt von der Steuer abzieht.
//
// Die Beträge dazu stehen bewusst nicht mehr hier, sondern in
// `src/lib/steuer/jahreswerte.ts`. Arbeitnehmer-Pauschbetrag,
// Entfernungspauschale und Homeoffice-Pauschale ändern sich jährlich, und eine
// zweite Liste im Kommentar wäre nach dem nächsten Steueränderungsgesetz falsch.
//
// Nicht alles unterhalb dieser Überschrift gehört allein den Angestellten: Die
// außergewöhnlichen Belastungen (§ 33 EStG) und die haushaltsnahen Leistungen
// (§ 35a EStG) hängen am privaten Einkommen und stehen jedem zu. Sie stehen
// deshalb in beiden Ausgabenlisten.

export const EMPLOYEE_INCOME_CATEGORIES: Category[] = [
  'gehalt',
  'sonderzahlung',
  'lohnersatz',
  'erstattungen',
  'sonstige_einnahmen',
];

/** Werbungskosten – kommen in die Anlage N. */
export const WERBUNGSKOSTEN_CATEGORIES: Category[] = [
  'wk_pendeln',
  'wk_homeoffice',
  'wk_arbeitsmittel',
  'wk_fortbildung',
  'wk_bewerbung',
  'wk_berufsverband',
  'wk_dienstreise',
  'wk_doppelter_haushalt',
  'wk_umzug',
  'wk_sonstige',
];

/** Sonderausgaben – Vorsorge, weitere Versicherungen, Kinderbetreuung, Spenden. */
export const EMPLOYEE_SONDERAUSGABEN_CATEGORIES: Category[] = [
  'sa_vorsorge',
  'sa_versicherungen',
  'sa_kinderbetreuung',
  'spenden',
];

/**
 * Außergewöhnliche Belastungen – wirken erst über der zumutbaren Belastung.
 * Gilt für Angestellte und Selbständige gleichermaßen, weil § 33 EStG am
 * Einkommen ansetzt und nicht am Betrieb.
 */
export const AUSSERGEWOEHNLICHE_CATEGORIES: Category[] = [
  'agb_krankheit',
  'agb_pflege',
  'agb_sonstige',
];

/**
 * Haushaltsnahe Leistungen – 20 % gehen direkt von der Steuer ab (§ 35a).
 * Auch das ist kein Angestellten-Thema: Die Ermäßigung hängt am eigenen
 * Haushalt, nicht an der Art der Einkünfte.
 */
export const HAUSHALT_CATEGORIES: Category[] = [
  'hh_dienstleistung',
  'hh_handwerker',
];

export const EMPLOYEE_EXPENSE_CATEGORIES: Category[] = [
  ...WERBUNGSKOSTEN_CATEGORIES,
  ...EMPLOYEE_SONDERAUSGABEN_CATEGORIES,
  ...AUSSERGEWOEHNLICHE_CATEGORIES,
  ...HAUSHALT_CATEGORIES,
  'privat',
  'sonstiges',
];

/**
 * Alles, was nur Angestellte sehen sollen. Die außergewöhnlichen Belastungen
 * und die haushaltsnahen Leistungen gehören nicht mehr dazu – sie stehen jetzt
 * auch in der Ausgabenliste der Selbständigen, genau wie die Spenden.
 */
export const EMPLOYEE_ONLY_CATEGORIES: Category[] = [
  ...EMPLOYEE_INCOME_CATEGORIES.filter((c) => c !== 'erstattungen' && c !== 'sonstige_einnahmen'),
  ...WERBUNGSKOSTEN_CATEGORIES,
  ...EMPLOYEE_SONDERAUSGABEN_CATEGORIES.filter((c) => c !== 'spenden'),
];

export function getCategoriesForType(type: InvoiceType, angestellt = false): Category[] {
  if (angestellt) {
    if (type === 'einnahme') return EMPLOYEE_INCOME_CATEGORIES;
    if (type === 'ausgabe') return EMPLOYEE_EXPENSE_CATEGORIES;
    if (type === 'info') return INFO_CATEGORIES;
    return [...EMPLOYEE_INCOME_CATEGORIES, ...EMPLOYEE_EXPENSE_CATEGORIES, ...INFO_CATEGORIES];
  }
  if (type === 'einnahme') return INCOME_CATEGORIES;
  if (type === 'ausgabe') return EXPENSE_CATEGORIES;
  if (type === 'info') return INFO_CATEGORIES;
  return [...CATEGORIES] as Category[];
}

/**
 * Gibt die Kategorien für den Typ zurück.
 * Veraltete Kategorien werden NUR eingeschlossen, wenn `currentCategory` eine davon ist.
 */
export function getCategoriesForTypeFiltered(
  type: InvoiceType,
  currentCategory?: Category,
  angestellt = false,
): Category[] {
  const base = getCategoriesForType(type, angestellt);
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

// ─── Branchenprofil-abhängige Kategorie-Filterung ─────────────────────────────

/** Kategorien, die NUR für Content Creator relevant sind */
export const CONTENT_CREATOR_CATEGORIES: Category[] = [
  'reverse_charge',
  'sponsoring',
  'affiliate',
  'donations_tips',
  'sachzuwendungen',
];

/** Kategorien, die NUR für E-Commerce relevant sind */
export const ECOMMERCE_CATEGORIES: Category[] = [
  'reverse_charge',
];

type Branchenprofil = 'standard' | 'content_creator' | 'ecommerce' | 'handwerk' | 'beratung';

/**
 * Gibt die Kategorien für den Typ zurück, gefiltert nach Branchenprofil.
 * Branchenspezifische Kategorien werden nur eingeblendet, wenn das Profil passt
 * ODER die Kategorie bereits auf einem bestehenden Beleg ausgewählt ist.
 */
export function getCategoriesForBranche(
  type: InvoiceType,
  branchenprofil: Branchenprofil,
  currentCategory?: Category,
  /** Angestellte bekommen eine ganz andere Liste – ohne Betriebsausgaben. */
  angestellt = false,
): Category[] {
  const base = getCategoriesForTypeFiltered(type, currentCategory, angestellt);

  // Angestellte kennen keine Branchen-Sonderfälle; ihre Liste steht schon fest.
  if (angestellt) {
    if (currentCategory && !base.includes(currentCategory)) return [currentCategory, ...base];
    return base;
  }

  // Welche Kategorien sollen für dieses Profil VERSTECKT werden?
  let hiddenCats: Category[] = [];

  if (branchenprofil === 'standard' || branchenprofil === 'handwerk' || branchenprofil === 'beratung') {
    hiddenCats = CONTENT_CREATOR_CATEGORIES;
  } else if (branchenprofil === 'ecommerce') {
    // E-Commerce sieht Reverse Charge, aber nicht die Streaming-Kategorien
    hiddenCats = ['sponsoring', 'affiliate', 'donations_tips', 'sachzuwendungen'];
  }
  // content_creator sieht ALLE

  return base.filter((c) => {
    // Wenn die aktuelle Kategorie eine "versteckte" ist, trotzdem zeigen
    if (c === currentCategory) return true;
    return !hiddenCats.includes(c);
  });
}

// ─── Sonder- / Privat-Kategorien ─────────────────────────────────────────────

/**
 * Die echten Sonderausgaben (§ 10 EStG). Diese Liste ist ausdrücklich nicht
 * dasselbe wie „mindert den Gewinn nicht": Außergewöhnliche Belastungen und
 * haushaltsnahe Leistungen stehen hier nicht drin, wirken aber ebenfalls erst
 * hinter dem Gewinn. Wer alle nicht betrieblichen Belege sucht, fragt deshalb
 * besser `istBetriebsausgabe` aus `src/lib/steuer/kategorien.ts`.
 */
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

/**
 * Eine Gehaltsstufe: ab `valid_from` (YYYY-MM) gilt dieses Gehalt. Eine
 * Erhöhung ist ein neuer Eintrag – der alte bleibt, damit vergangene Monate
 * richtig bleiben.
 *
 * `payday` ist der Tag im Monat, an dem das Geld kommt; 0 steht für „zum
 * Monatsende".
 */
export interface Salary {
  id: string;
  valid_from: string;
  employer: string;
  gross: number;
  net: number;
  payday: number;
  note: string;
}

/** Einmalzahlung: 13. Gehalt, Bonus, Urlaubsgeld, Nachzahlung. */
export interface SalaryExtra {
  id: string;
  date: string;
  label: string;
  gross: number;
  net: number;
  note: string;
}

export interface Invoice {
  id: string;
  date: string;
  year: number;
  month: number;
  category: Category;
  description: string;
  partner: string;
  netto: number;
  /** Nicht steuerbare Gebuehren (z. B. Zahlungsanbieter), separat zum Belegbetrag gespeichert */
  fee: number;
  ust: number;
  brutto: number;
  type: InvoiceType;
  /**
   * Belegwährung (ISO-4217). Die Beträge oben sind IMMER Euro –
   * der Betrag in dieser Währung steht in den *_original-Feldern.
   */
  currency: string;
  pdf_path: string;
  note: string;
  created_at: string;
  updated_at: string;
  /** GoBD: Festgeschriebener Beleg – kann nur noch per Stornobuchung korrigiert werden */
  is_locked: boolean;
  /** SHA-256 Hash des Original-PDFs für Integritätsprüfung */
  pdf_sha256: string;
  /** Leistungszeitpunkt / Lieferdatum (Pflichtangabe § 14 Abs. 4 UStG) */
  delivery_date: string;
  /** Falls Stornobuchung: ID des stornierten Belegs */
  storno_of: string;
  /** Extrahierter Volltext des PDFs für die Volltextsuche */
  pdf_text?: string;
  /** Verknüpftes Projekt (optional) */
  project_id?: string;
  /**
   * Pfad zur archivierten XRechnung-XML-Datei (relativ zu app_data_dir).
   * Gemäß E-Rechnungspflicht (§ 14 UStG ab 2025) ist der XML-Teil das Originaldokument.
   * Pflichtfeld für alle ausgehenden B2B-Rechnungen ab 01.01.2025.
   */
  xrechnung_path?: string;

  // ─── Fremdwährung ──────────────────────────────────────────────────────────
  // netto/ust/brutto/fee oben sind immer Euro (damit rechnen alle
  // Auswertungen). Hier steht der Betrag so, wie er auf dem Beleg steht,
  // plus der EINMALIG zum Belegdatum ermittelte und danach eingefrorene Kurs.
  /** Nettobetrag in der Belegwährung */
  netto_original?: number;
  ust_original?: number;
  brutto_original?: number;
  fee_original?: number;
  /** EUR je 1 Einheit der Belegwährung. 0 = Umrechnung steht noch aus. */
  fx_rate?: number;
  /** Tatsächliches Kursdatum (EZB-Bankarbeitstag, ggf. vor dem Belegdatum) */
  fx_date?: string;
  fx_source?: FxSource;
}

/**
 * Herkunft des Umrechnungskurses:
 * - identity: Euro-Beleg, Kurs 1
 * - ecb:      EZB-Referenzkurs zum Belegdatum
 * - manual:   vom Nutzer gesetzter Kurs
 * - pending:  Kurs konnte noch nicht ermittelt werden (offline o. Ä.)
 */
export type FxSource = 'identity' | 'ecb' | 'manual' | 'pending';

export interface ProjectLink {
  url: string;
  label: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  links: ProjectLink[];
  youtube_url: string;
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
  /** Nicht steuerbare Gebuehren (z. B. Zahlungsanbieter) */
  fee: number;
  ust: number;
  brutto: number;
  currency: string;
  type: InvoiceType;
  suggested_category: Category;
  /** true wenn das Dokument eindeutig ein Rechnungs-/Buchhaltungsdokument ist */
  is_invoice: boolean;
  /** Ablehnungsgrund falls is_invoice=false, z.B. "Das Dokument ist ein Lebenslauf" */
  rejection_reason?: string;
}

