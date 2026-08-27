// ─── Steuerliche Werte je Veranlagungszeitraum ───────────────────────────────
//
// Fast jede dieser Zahlen ändert sich jährlich. Vorher standen sie einzeln im
// Code verstreut – der Grundfreibetrag als eine Konstante im Store, die
// Entfernungspauschale als `KM_SATZ = 0.38` im Angestellten-Bericht. Neben
// beiden stand ein Jahreswähler, der bis 2023 zurückreicht. Wer 2025 wählte,
// bekam die Werte von 2026 vorgerechnet.
//
// Hier steht je Jahr, was in diesem Jahr galt. `werteFuer(jahr)` nimmt immer
// den jüngsten Eintrag, der nicht in der Zukunft liegt – damit rechnet ein
// künftiges Jahr mit dem letzten bekannten Stand weiter, statt bei null zu
// landen.

export interface Jahreswerte {
  /** Grundfreibetrag § 32a Abs. 1 EStG (Einzelveranlagung). */
  grundfreibetrag: number;

  // ── Umsatzsteuer ───────────────────────────────────────────────────────
  /** Umsatzgrenze des Vorjahres für § 19 UStG. */
  kleinunternehmerVorjahr: number;
  /**
   * Umsatzgrenze des laufenden Jahres. Bis 2024 eine Prognosegrenze
   * (Überschreiten wirkte erst im Folgejahr), ab 2025 eine harte Grenze:
   * Überschreiten beendet die Kleinunternehmerschaft sofort.
   */
  kleinunternehmerLaufend: number;
  /** Ab 2025 beendet das Überschreiten der laufenden Grenze den Status sofort. */
  kleinunternehmerSofortverlust: boolean;

  // ── Arbeitnehmer ───────────────────────────────────────────────────────
  /** Arbeitnehmer-Pauschbetrag § 9a Satz 1 Nr. 1a EStG. */
  arbeitnehmerPauschbetrag: number;
  /** Entfernungspauschale für die ersten 20 Kilometer. */
  entfernungBis20: number;
  /** Entfernungspauschale ab dem 21. Kilometer. */
  entfernungAb21: number;
  /** Höchstbetrag der Entfernungspauschale ohne eigenen Pkw. */
  entfernungHoechstbetrag: number;
  /** Homeoffice-Pauschale je Tag und Höchstzahl der Tage. */
  homeofficeSatz: number;
  homeofficeMaxTage: number;

  // ── Reisekosten ────────────────────────────────────────────────────────
  /** Kilometerpauschale für Dienstfahrten mit dem eigenen Pkw (§ 9 Abs. 1 Nr. 4a EStG). */
  dienstreiseKmSatz: number;
  /** Verpflegungsmehraufwand: voller Tag (24 Stunden Abwesenheit). */
  verpflegungVollerTag: number;
  /** Verpflegungsmehraufwand: An-/Abreisetag oder mehr als 8 Stunden. */
  verpflegungTeilTag: number;

  // ── Wirtschaftsgüter ───────────────────────────────────────────────────
  /** Bis hierher sofort abziehbar, ohne Eintrag ins Anlageverzeichnis. */
  gwgDirektGrenze: number;
  /** Grenze der GWG-Sofortabschreibung (§ 6 Abs. 2 EStG). */
  gwgSofortGrenze: number;
  /** Obergrenze des Sammelpostens (§ 6 Abs. 2a EStG). */
  sammelpostenGrenze: number;
  /** Laufzeit des Sammelpostens in Jahren. */
  sammelpostenJahre: number;

  // ── Sonderausgaben & Ermäßigungen ──────────────────────────────────────
  /** Kinderbetreuung: abziehbarer Anteil und Höchstbetrag je Kind. */
  kinderbetreuungQuote: number;
  kinderbetreuungMax: number;
  /** § 35a: begünstigte Aufwendungen und Ermäßigungssatz. */
  haushaltsnahMax: number;
  handwerkerMax: number;
  minijobMax: number;
  paragraf35aSatz: number;
  /** Spenden: Höchstbetrag als Anteil des Gesamtbetrags der Einkünfte. */
  spendenQuote: number;
  /**
   * Höchstbetrag der sonstigen Vorsorgeaufwendungen (§ 10 Abs. 4 EStG) –
   * Haftpflicht, Unfall, Berufsunfähigkeit. Bei Arbeitnehmern niedriger,
   * weil der Arbeitgeber die Hälfte der Krankenversicherung trägt.
   */
  sonstigeVorsorgeArbeitnehmer: number;
  sonstigeVorsorgeSelbstaendig: number;
  /** Höchstbetrag der Altersvorsorgeaufwendungen (§ 10 Abs. 3 EStG). */
  altersvorsorgeHoechstbetrag: number;
  /**
   * Der Krankenversicherungsbeitrag wird um 4 % gekürzt, soweit er einen
   * Anspruch auf Krankengeld begründet. Der Zusatzbeitrag bleibt ungekürzt.
   */
  kvKuerzungKrankengeld: number;

  // ── Gewerbesteuer ──────────────────────────────────────────────────────
  gewerbesteuerFreibetrag: number;
  gewerbesteuerMesszahl: number;
  /** Faktor der Anrechnung auf die Einkommensteuer (§ 35 EStG). */
  gewerbesteuerAnrechnungsfaktor: number;

  // ── Sozialversicherung ─────────────────────────────────────────────────
  /** Beitragsbemessungsgrenze Kranken-/Pflegeversicherung je Monat. */
  kvBemessungsgrenzeMonat: number;
  /** Mindestbemessungsgrundlage für freiwillig versicherte Selbständige je Monat. */
  kvMindestbemessungMonat: number;
  /** Allgemeiner Beitragssatz (mit Krankengeldanspruch). */
  kvSatzAllgemein: number;
  /** Ermäßigter Beitragssatz (ohne Krankengeldanspruch). */
  kvSatzErmaessigt: number;
  /** Durchschnittlicher Zusatzbeitrag – nur ein Anhaltspunkt, die Kasse legt ihn fest. */
  kvZusatzbeitragDurchschnitt: number;
  /** Pflegeversicherung: Grundsatz und Zuschlag für Kinderlose ab 23. */
  pvSatz: number;
  pvSatzKinderlos: number;

  // ── Aufbewahrung ───────────────────────────────────────────────────────
  /** Buchungsbelege (§ 147 Abs. 3 AO, verkürzt durch das BEG IV). */
  aufbewahrungBelegeJahre: number;
  /** Bücher, Aufzeichnungen, Jahresabschlüsse. */
  aufbewahrungBuecherJahre: number;
}

/**
 * Die Werte, sortiert nach dem Jahr, ab dem sie gelten. Neue Jahre werden
 * oben angehängt; Angaben, die sich nicht ändern, werden vom Vorjahr geerbt.
 */
const STAENDE: Array<{ ab: number; werte: Partial<Jahreswerte> }> = [
  {
    ab: 2023,
    werte: {
      grundfreibetrag: 10_908,
      kleinunternehmerVorjahr: 22_000,
      kleinunternehmerLaufend: 50_000,
      kleinunternehmerSofortverlust: false,
      arbeitnehmerPauschbetrag: 1_230,
      entfernungBis20: 0.30,
      entfernungAb21: 0.38,
      entfernungHoechstbetrag: 4_500,
      homeofficeSatz: 6,
      homeofficeMaxTage: 210,
      dienstreiseKmSatz: 0.30,
      verpflegungVollerTag: 28,
      verpflegungTeilTag: 14,
      gwgDirektGrenze: 250,
      gwgSofortGrenze: 800,
      sammelpostenGrenze: 1_000,
      sammelpostenJahre: 5,
      kinderbetreuungQuote: 2 / 3,
      kinderbetreuungMax: 4_000,
      haushaltsnahMax: 20_000,
      handwerkerMax: 6_000,
      minijobMax: 2_550,
      paragraf35aSatz: 0.20,
      spendenQuote: 0.20,
      sonstigeVorsorgeArbeitnehmer: 1_900,
      sonstigeVorsorgeSelbstaendig: 2_800,
      altersvorsorgeHoechstbetrag: 26_528,
      kvKuerzungKrankengeld: 0.04,
      gewerbesteuerFreibetrag: 24_500,
      gewerbesteuerMesszahl: 0.035,
      gewerbesteuerAnrechnungsfaktor: 4.0,
      kvBemessungsgrenzeMonat: 4_987.50,
      kvMindestbemessungMonat: 1_131.67,
      kvSatzAllgemein: 14.6,
      kvSatzErmaessigt: 14.0,
      kvZusatzbeitragDurchschnitt: 1.6,
      pvSatz: 3.05,
      pvSatzKinderlos: 3.40,
      aufbewahrungBelegeJahre: 10,
      aufbewahrungBuecherJahre: 10,
    },
  },
  {
    ab: 2024,
    werte: {
      grundfreibetrag: 11_784,
      altersvorsorgeHoechstbetrag: 27_566,
      kvBemessungsgrenzeMonat: 5_175.00,
      kvMindestbemessungMonat: 1_178.33,
      kvZusatzbeitragDurchschnitt: 1.7,
      pvSatz: 3.40,
      pvSatzKinderlos: 4.00,
    },
  },
  {
    ab: 2025,
    werte: {
      grundfreibetrag: 12_096,
      // Seit 2025 sind die Umsätze echt steuerfrei, und die laufende Grenze
      // wirkt sofort statt erst im Folgejahr.
      kleinunternehmerVorjahr: 25_000,
      kleinunternehmerLaufend: 100_000,
      kleinunternehmerSofortverlust: true,
      kinderbetreuungQuote: 0.80,
      kinderbetreuungMax: 4_800,
      altersvorsorgeHoechstbetrag: 29_344,
      kvBemessungsgrenzeMonat: 5_512.50,
      kvMindestbemessungMonat: 1_248.33,
      kvZusatzbeitragDurchschnitt: 2.5,
      pvSatz: 3.60,
      pvSatzKinderlos: 4.20,
      // Das BEG IV hat die Frist für Buchungsbelege verkürzt; Bücher,
      // Aufzeichnungen und Jahresabschlüsse bleiben bei zehn Jahren.
      aufbewahrungBelegeJahre: 8,
    },
  },
  {
    ab: 2026,
    werte: {
      grundfreibetrag: 12_348,
      // Steueränderungsgesetz 2025: 38 Cent ab dem ersten Kilometer.
      entfernungBis20: 0.38,
      entfernungAb21: 0.38,
      altersvorsorgeHoechstbetrag: 30_826,
      kvBemessungsgrenzeMonat: 5_812.50,
      kvMindestbemessungMonat: 1_318.33,
      kvZusatzbeitragDurchschnitt: 2.9,
    },
  },
];

const CACHE = new Map<number, Jahreswerte>();

/**
 * Die Werte eines Jahres. Jahre vor dem ersten Eintrag bekommen den ersten
 * Stand, Jahre nach dem letzten den letzten – so rechnet die App weiter,
 * statt mit Nullen zu antworten.
 */
export function werteFuer(jahr: number): Jahreswerte {
  const gecacht = CACHE.get(jahr);
  if (gecacht) return gecacht;

  let werte = {} as Jahreswerte;
  for (const stand of STAENDE) {
    if (stand.ab <= jahr || Object.keys(werte).length === 0) {
      werte = { ...werte, ...stand.werte } as Jahreswerte;
    }
    if (stand.ab > jahr) break;
  }

  CACHE.set(jahr, werte);
  return werte;
}

/** Das jüngste Jahr, für das eigene Werte hinterlegt sind. */
export const LETZTES_GEPFLEGTES_JAHR = STAENDE[STAENDE.length - 1].ab;

/**
 * Sagt, ob für dieses Jahr echte Werte vorliegen oder nur fortgeschrieben
 * wird. Die Oberfläche kann damit einen ehrlichen Hinweis setzen, statt eine
 * Zahl zu zeigen, die niemand geprüft hat.
 */
export function istFortgeschrieben(jahr: number): boolean {
  return jahr > LETZTES_GEPFLEGTES_JAHR;
}

/**
 * Entfernungspauschale für eine einfache Entfernung – gestaffelt, solange das
 * Jahr die Staffel kennt.
 */
export function entfernungspauschale(jahr: number, einfacheKm: number, tage: number): number {
  const w = werteFuer(jahr);
  const bis20 = Math.min(einfacheKm, 20);
  const ab21 = Math.max(0, einfacheKm - 20);
  const proTag = bis20 * w.entfernungBis20 + ab21 * w.entfernungAb21;
  return proTag * tage;
}
