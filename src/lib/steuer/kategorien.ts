// ─── Steuerliche Behandlung je Kategorie ─────────────────────────────────────
//
// Vorher hat jede Auswertungsseite ihre eigene Liste geführt, welche Kategorie
// den Gewinn mindert. Die Listen liefen auseinander: Das Dashboard rechnete
// brutto, der Steuerbericht netto, die Krankenkasse ohne AfA – und in der
// Spalte „Steuerlich" landeten Sonderausgaben gleichrangig neben der Miete,
// obwohl sie den Gewinn gar nicht mindern.
//
// Hier steht das nur noch einmal. Jede Kategorie sagt selbst, wie sie wirkt,
// und alle Seiten fragen dieselbe Tabelle.

import type { Category } from '@/types';

/**
 * Wohin ein Beleg steuerlich gehört.
 *
 * Der wichtige Unterschied: `betriebsausgabe` mindert den **Gewinn** der EÜR,
 * `sonderausgabe` mindert erst eine Stufe später das **zu versteuernde
 * Einkommen**. Beides ist „absetzbar", aber an völlig verschiedenen Stellen –
 * genau diese Verwechslung war der Fehler in der alten Fassung.
 */
export type SteuerWirkung =
  /** Betriebseinnahme – erhöht den Gewinn der EÜR. */
  | 'betriebseinnahme'
  /** Betriebsausgabe – mindert den Gewinn der EÜR. */
  | 'betriebsausgabe'
  /** Sonderausgabe (§ 10 EStG) – mindert das Einkommen, nicht den Gewinn. */
  | 'sonderausgabe'
  /** Außergewöhnliche Belastung (§ 33 EStG) – erst über der zumutbaren Belastung. */
  | 'aussergewoehnlich'
  /** Haushaltsnahe Leistung (§ 35a EStG) – 20 % direkt von der Steuer. */
  | 'haushaltsnah'
  /** Werbungskosten (Anlage N) – nur für Angestellte. */
  | 'werbungskosten'
  /** Arbeitslohn – Einnahme eines Angestellten. */
  | 'arbeitslohn'
  /** Weder das eine noch das andere: Privateinlage, Privatentnahme, Infobelege. */
  | 'neutral';

export interface KategorieRegel {
  wirkung: SteuerWirkung;
  /**
   * Anteil, der steuerlich tatsächlich wirkt. Fehlt der Wert, sind es 100 %.
   * Bewirtung steht bei 0,7 (§ 4 Abs. 5 Satz 1 Nr. 2 EStG).
   */
  quote?: number;
  /**
   * Darf die Vorsteuer aus diesem Beleg gezogen werden (§ 15 Abs. 1 UStG)?
   * Nur bei betrieblich veranlassten Ausgaben – privat, Versicherung und
   * Spende sind draußen.
   */
  vorsteuer?: boolean;
  /**
   * Zählt der Beleg zum Gesamtumsatz nach § 19 Abs. 2 UStG, also zur
   * Kleinunternehmergrenze? Privateinlagen und durchlaufende Posten nicht.
   */
  umsatz?: boolean;
  /** Wird über die Nutzungsdauer verteilt statt im Kaufjahr abgezogen. */
  ueberAfa?: boolean;
  /**
   * Erklärt in einem Satz, warum die Kategorie so behandelt wird. Die
   * Oberfläche zeigt den Satz an den Stellen, an denen die Einordnung sonst
   * überraschen würde.
   */
  hinweis?: string;
}

/** Voreinstellung für alles, was unten nicht ausdrücklich genannt ist. */
const UNBEKANNT: KategorieRegel = { wirkung: 'neutral' };

export const KATEGORIE_REGELN: Record<Category, KategorieRegel> = {
  // ── Betriebseinnahmen ───────────────────────────────────────────────────
  umsatz_pflichtig: { wirkung: 'betriebseinnahme', umsatz: true },
  umsatz_steuerfrei: { wirkung: 'betriebseinnahme', umsatz: true },
  reverse_charge: {
    wirkung: 'betriebseinnahme',
    umsatz: true,
    hinweis: 'Steuerschuldnerschaft des Leistungsempfängers – die Umsatzsteuer schuldet die Gegenseite.',
  },
  anlagenverkauf: {
    wirkung: 'betriebseinnahme',
    // Der Verkauf von Anlagevermögen bleibt beim Gesamtumsatz nach
    // § 19 Abs. 3 UStG außen vor – er würde die Kleinunternehmergrenze sonst
    // durch einen einmaligen Vorgang sprengen.
    umsatz: false,
    hinweis: 'Der Erlös ist Betriebseinnahme, zählt aber nicht zum Gesamtumsatz für die Kleinunternehmergrenze. Der Restbuchwert des verkauften Guts ist gleichzeitig Betriebsausgabe.',
  },
  sponsoring: { wirkung: 'betriebseinnahme', umsatz: true },
  affiliate: { wirkung: 'betriebseinnahme', umsatz: true },
  donations_tips: { wirkung: 'betriebseinnahme', umsatz: true },
  sachzuwendungen: {
    wirkung: 'betriebseinnahme',
    umsatz: true,
    hinweis: 'Mit dem Marktwert anzusetzen – auch ohne Geldfluss.',
  },
  sonstige_einnahmen: { wirkung: 'betriebseinnahme', umsatz: true },
  einnahmen: { wirkung: 'betriebseinnahme', umsatz: true, hinweis: 'Veraltete Sammelkategorie – bitte neu zuordnen.' },

  // Diese beiden sind KEIN Gewinn. Sie standen früher trotzdem in der
  // Einnahmensumme und haben Gewinn, Steuerrücklage, Krankenkassenbeitrag und
  // die Kleinunternehmergrenze nach oben verfälscht.
  privateinlage: {
    wirkung: 'neutral',
    umsatz: false,
    hinweis: 'Eigenes Geld im Betrieb – kein steuerpflichtiger Gewinn und kein Umsatz.',
  },
  ust_erstattung: {
    wirkung: 'neutral',
    umsatz: false,
    hinweis: 'In dieser Auswertung neutral, weil netto gerechnet wird. Im amtlichen Formular (Bruttomethode) ist sie dagegen Betriebseinnahme.',
  },
  erstattungen: {
    // Bewusst Betriebseinnahme, nicht neutral: Die zugehörige Ausgabe wurde in
    // ihrer eigenen Kategorie schon abgezogen. Bliebe die Erstattung außen vor,
    // stünde der Abzug ohne Gegenposten da und der Gewinn wäre zu niedrig.
    // Ein echter durchlaufender Posten nach § 4 Abs. 3 Satz 2 EStG liegt nur
    // vor, wenn im Namen und für Rechnung eines anderen vereinnahmt wurde –
    // dann darf auch die Ausgabe nicht gebucht werden.
    wirkung: 'betriebseinnahme',
    umsatz: true,
    hinweis: 'Auslagenersatz ist Betriebseinnahme, weil die erstattete Ausgabe bereits abgezogen wurde. Nur bei einem echten durchlaufenden Posten bleiben beide Seiten außen vor.',
  },

  // ── Betriebsausgaben ────────────────────────────────────────────────────
  anlagevermoegen_afa: { wirkung: 'betriebsausgabe', vorsteuer: true, ueberAfa: true },
  gwg: {
    wirkung: 'betriebsausgabe',
    vorsteuer: true,
    // Läuft wie das Anlagevermögen über die Wirtschaftsgut-Rechnung, obwohl
    // der Abzug meist sofort erfolgt. Nur so entscheidet eine Stelle über die
    // Methode – und nur so wird ein Bildschirm richtig behandelt, der wegen
    // fehlender selbständiger Nutzungsfähigkeit kein GWG sein kann.
    ueberAfa: true,
  },
  buerobedarf: { wirkung: 'betriebsausgabe', vorsteuer: true },
  fahrzeugkosten: {
    wirkung: 'betriebsausgabe',
    vorsteuer: true,
    hinweis: 'Nur bei Fahrzeug im Betriebsvermögen. Wer die Kilometerpauschale aus dem Fahrtenbuch ansetzt, darf diese Belege nicht zusätzlich abziehen.',
  },
  fremdleistungen: { wirkung: 'betriebsausgabe', vorsteuer: true },
  marketing: { wirkung: 'betriebsausgabe', vorsteuer: true },
  miete: { wirkung: 'betriebsausgabe', vorsteuer: true },
  reisekosten: { wirkung: 'betriebsausgabe', vorsteuer: true },
  bewirtungskosten: {
    wirkung: 'betriebsausgabe',
    quote: 0.7,
    vorsteuer: true,
    hinweis: '70 % mindern den Gewinn (§ 4 Abs. 5 Satz 1 Nr. 2 EStG), die Vorsteuer bleibt zu 100 % abziehbar.',
  },
  software_abos: { wirkung: 'betriebsausgabe', vorsteuer: true },
  kommunikation: {
    wirkung: 'betriebsausgabe',
    vorsteuer: true,
    hinweis: 'Bei privater Mitbenutzung nur den betrieblichen Anteil ansetzen.',
  },
  versicherungen_betrieb: {
    wirkung: 'betriebsausgabe',
    vorsteuer: false,
    hinweis: 'Nur betriebliche Risiken. Berufsunfähigkeit und private Haftpflicht gehören zu den Sonderausgaben.',
  },
  weiterbildung: { wirkung: 'betriebsausgabe', vorsteuer: true },
  sonstiges: { wirkung: 'betriebsausgabe', vorsteuer: true },

  // ── Sonderausgaben ──────────────────────────────────────────────────────
  // Absetzbar ja – aber privat, nicht gegen den Gewinn.
  krankenkasse: {
    wirkung: 'sonderausgabe',
    vorsteuer: false,
    hinweis: 'Kranken- und Pflegeversicherung sind Sonderausgaben (§ 10 Abs. 1 Nr. 3 EStG). Sie mindern den Gewinn nicht, sondern das zu versteuernde Einkommen.',
  },
  sozialversicherung: {
    wirkung: 'sonderausgabe',
    vorsteuer: false,
    hinweis: 'Altersvorsorge ist Sonderausgabe. Die Berufsgenossenschaft gehört dagegen zu den Betriebsausgaben.',
  },
  spenden: {
    wirkung: 'sonderausgabe',
    vorsteuer: false,
    hinweis: 'Sonderausgabe, kein Betriebsaufwand. Abziehbar bis 20 % des Gesamtbetrags der Einkünfte.',
  },

  // ── Privat ──────────────────────────────────────────────────────────────
  privat: {
    wirkung: 'neutral',
    vorsteuer: false,
    hinweis: 'Weder Betriebsausgabe noch Sonderausgabe – steuerlich ohne Wirkung.',
  },
  privatentnahme: {
    wirkung: 'neutral',
    vorsteuer: false,
    hinweis: 'Nur eine Umbuchung vom Firmen- aufs Privatkonto, kein Aufwand.',
  },

  // ── Angestellte: Einnahmen ──────────────────────────────────────────────
  gehalt: { wirkung: 'arbeitslohn' },
  sonderzahlung: { wirkung: 'arbeitslohn' },
  lohnersatz: {
    wirkung: 'neutral',
    hinweis: 'Steuerfrei, erhöht aber über den Progressionsvorbehalt den Steuersatz auf das übrige Einkommen.',
  },

  // ── Angestellte: Werbungskosten ─────────────────────────────────────────
  wk_pendeln: {
    wirkung: 'werbungskosten',
    hinweis: 'Wird aus Entfernung und Arbeitstagen berechnet – einzelne Belege hier nur, wenn sie zusätzlich anfallen.',
  },
  wk_homeoffice: { wirkung: 'werbungskosten' },
  wk_arbeitsmittel: { wirkung: 'werbungskosten' },
  wk_fortbildung: { wirkung: 'werbungskosten' },
  wk_bewerbung: { wirkung: 'werbungskosten' },
  wk_berufsverband: { wirkung: 'werbungskosten' },
  wk_dienstreise: { wirkung: 'werbungskosten' },
  wk_doppelter_haushalt: { wirkung: 'werbungskosten' },
  wk_umzug: { wirkung: 'werbungskosten' },
  wk_sonstige: { wirkung: 'werbungskosten' },

  // ── Angestellte: Sonderausgaben ─────────────────────────────────────────
  sa_vorsorge: { wirkung: 'sonderausgabe' },
  sa_versicherungen: {
    wirkung: 'sonderausgabe',
    hinweis: 'Zählt zu den sonstigen Vorsorgeaufwendungen. Deren Höchstbetrag ist durch die Krankenversicherung meist schon ausgeschöpft – dann wirkt sich das nicht mehr aus.',
  },
  sa_kinderbetreuung: {
    wirkung: 'sonderausgabe',
    hinweis: '80 % der Kosten, höchstens 4.800 € je Kind. Nur unbar gezahlt und nur für Kinder unter 14.',
  },

  // ── Angestellte: Außergewöhnliche Belastungen ───────────────────────────
  agb_krankheit: { wirkung: 'aussergewoehnlich' },
  agb_pflege: { wirkung: 'aussergewoehnlich' },
  agb_sonstige: { wirkung: 'aussergewoehnlich' },

  // ── § 35a EStG ──────────────────────────────────────────────────────────
  hh_dienstleistung: {
    wirkung: 'haushaltsnah',
    hinweis: 'Nur der Arbeitsanteil zählt, kein Material – und die Rechnung muss überwiesen sein.',
  },
  hh_handwerker: {
    wirkung: 'haushaltsnah',
    hinweis: 'Nur der Arbeitsanteil zählt, kein Material – und die Rechnung muss überwiesen sein.',
  },

  // ── Info ────────────────────────────────────────────────────────────────
  vertraege: { wirkung: 'neutral' },
};

/** Die Regel einer Kategorie; unbekannte Kategorien gelten als neutral. */
export function regelFuer(category: string): KategorieRegel {
  return KATEGORIE_REGELN[category as Category] ?? UNBEKANNT;
}

export function wirkungVon(category: string): SteuerWirkung {
  return regelFuer(category).wirkung;
}

/** Mindert die Kategorie den Gewinn der EÜR? */
export function istBetriebsausgabe(category: string): boolean {
  return regelFuer(category).wirkung === 'betriebsausgabe';
}

/** Erhöht die Kategorie den Gewinn der EÜR? */
export function istBetriebseinnahme(category: string): boolean {
  return regelFuer(category).wirkung === 'betriebseinnahme';
}

/** Anteil, der steuerlich wirkt – 1 außer bei der Bewirtung. */
export function abzugsQuote(category: string): number {
  return regelFuer(category).quote ?? 1;
}

/** Darf aus dieser Kategorie Vorsteuer gezogen werden? */
export function istVorsteuerfaehig(category: string): boolean {
  return regelFuer(category).vorsteuer === true;
}

/** Zählt die Kategorie zum Gesamtumsatz (§ 19 Abs. 2 UStG)? */
export function zaehltZumUmsatz(category: string): boolean {
  return regelFuer(category).umsatz === true;
}

/** Wird die Kategorie über die Nutzungsdauer verteilt? */
export function laeuftUeberAfa(category: string): boolean {
  return regelFuer(category).ueberAfa === true;
}

/**
 * Beschriftung der steuerlichen Wirkung – für Tabellen und Listen. Die
 * Unterscheidung ist der Kern: „mindert den Gewinn" ist etwas anderes als
 * „mindert das Einkommen".
 */
export const WIRKUNG_LABELS: Record<SteuerWirkung, string> = {
  betriebseinnahme: 'Betriebseinnahme',
  betriebsausgabe: 'Betriebsausgabe',
  sonderausgabe: 'Sonderausgabe',
  aussergewoehnlich: 'Außergewöhnliche Belastung',
  haushaltsnah: 'Haushaltsnah (§ 35a)',
  werbungskosten: 'Werbungskosten',
  arbeitslohn: 'Arbeitslohn',
  neutral: 'Steuerlich neutral',
};

/** Kurzform für enge Spalten. */
export const WIRKUNG_KURZ: Record<SteuerWirkung, string> = {
  betriebseinnahme: 'Einnahme',
  betriebsausgabe: 'mindert Gewinn',
  sonderausgabe: 'privat abziehbar',
  aussergewoehnlich: 'außergew. Belastung',
  haushaltsnah: '§ 35a',
  werbungskosten: 'Werbungskosten',
  arbeitslohn: 'Arbeitslohn',
  neutral: 'nicht absetzbar',
};

/** Erklärt in einem Satz, was mit der Kategorie steuerlich passiert. */
export const WIRKUNG_ERKLAERUNG: Record<SteuerWirkung, string> = {
  betriebseinnahme: 'Erhöht den Gewinn der Einnahmen-Überschuss-Rechnung.',
  betriebsausgabe: 'Mindert den Gewinn der Einnahmen-Überschuss-Rechnung.',
  sonderausgabe: 'Mindert nicht den Gewinn, sondern das zu versteuernde Einkommen in der Einkommensteuererklärung.',
  aussergewoehnlich: 'Wirkt erst oberhalb der zumutbaren Belastung (§ 33 EStG).',
  haushaltsnah: '20 % der Arbeitskosten gehen direkt von der Steuer ab (§ 35a EStG).',
  werbungskosten: 'Mindert den Arbeitslohn, sobald der Arbeitnehmer-Pauschbetrag überschritten ist.',
  arbeitslohn: 'Einkünfte aus nichtselbständiger Arbeit.',
  neutral: 'Wirkt sich steuerlich nicht aus.',
};

/** Alle Kategorien einer Wirkung – ersetzt die früheren handgepflegten Listen. */
export function kategorienMitWirkung(wirkung: SteuerWirkung): Category[] {
  return (Object.keys(KATEGORIE_REGELN) as Category[]).filter(
    (c) => KATEGORIE_REGELN[c].wirkung === wirkung,
  );
}
