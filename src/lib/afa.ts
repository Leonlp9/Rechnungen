// ─── AfA-Rechner & GWG-Schwellen-Logik ───────────────────────────────────────
// Steuerliche Abschreibungsberechnung für Wirtschaftsgüter

export type AfaMethode = 'sofort' | 'gwg' | 'pool' | 'linear';

export interface AfaResult {
  methode: AfaMethode;
  label: string;
  description: string;
  jahresAbschreibung: number;
  nutzungsdauer: number; // in Jahren
  restwert: number; // nach 1 Jahr
}

/** GWG-Grenzen (Stand 2025/2026) */
const GWG_SOFORT_GRENZE = 800;   // Sofortabschreibung bis 800 € netto
const GWG_POOL_GRENZE = 1_000;   // Poolabschreibung bis 1.000 € netto
const DIREKT_ABZUG_GRENZE = 250; // Direktabzug ohne Verzeichnispflicht

/** Typische Nutzungsdauern (AfA-Tabelle, vereinfacht) */
const NUTZUNGSDAUER: Record<string, number> = {
  computer: 3,
  monitor: 3,
  drucker: 3,
  smartphone: 5,
  moebel: 13,
  fahrzeug: 6,
  software: 3, // oder 1 Jahr (digitale WG)
  kamera: 7,
  audio: 7,
  beleuchtung: 10,
  sonstiges: 5,
};

/** Labels für die Nutzungsdauer-Typen */
export const NUTZUNGSDAUER_LABELS: Record<string, string> = {
  computer: 'Computer / Laptop',
  monitor: 'Monitor / Peripherie',
  drucker: 'Drucker',
  smartphone: 'Smartphone / Tablet',
  moebel: 'Büromöbel',
  fahrzeug: 'Fahrzeug',
  software: 'Software (digital)',
  kamera: 'Kamera / Foto',
  audio: 'Audio / Mikrofon',
  beleuchtung: 'Beleuchtung',
  sonstiges: 'Sonstiges',
};

/** Keyword-Patterns für die automatische Erkennung */
const ASSET_PATTERNS: [RegExp, string][] = [
  [/\b(laptop|notebook|macbook|thinkpad|pc|desktop|imac|rechner|computer)\b/i, 'computer'],
  [/\b(monitor|display|bildschirm|screen)\b/i, 'monitor'],
  [/\b(drucker|printer|scanner)\b/i, 'drucker'],
  [/\b(handy|smartphone|iphone|pixel|telefon|tablet|ipad)\b|samsung\s+galaxy|galaxy\s+(s\d|z\s|z\d|a\d|tab|note|fold|flip|buds)/i, 'smartphone'],
  [/\b(stuhl|tisch|schreibtisch|bürostuhl|regal|schrank|möbel)\b/i, 'moebel'],
  [/\b(auto|pkw|kfz|fahrzeug|leasing|transporter)\b/i, 'fahrzeug'],
  [/\b(lizenz|software|app|saas|adobe|microsoft|jetbrains)\b/i, 'software'],
  [/\b(kamera|camera|objektiv|lens|gopro|sony alpha|canon eos|foto)\b/i, 'kamera'],
  [/\b(mikrofon|microphone|headset|kopfhörer|lautsprecher|audio|interface|mixer|podcast)\b/i, 'audio'],
  [/\b(licht|lampe|beleuchtung|ring.?light|softbox|led.?panel)\b/i, 'beleuchtung'],
];

/**
 * Erkennt den Wirtschaftsgut-Typ anhand der Beschreibung/Partner.
 * Gibt den key für NUTZUNGSDAUER zurück.
 */
export function guessAssetType(description: string, partner?: string): string {
  const text = `${description} ${partner ?? ''}`.toLowerCase();
  for (const [pattern, type] of ASSET_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return 'sonstiges';
}

/**
 * Berechnet die möglichen Abschreibungsmethoden für ein Wirtschaftsgut.
 */
export function berechneAfaOptionen(
  nettoPreis: number,
  kategorie?: string,
  istDigital = false,
): AfaResult[] {
  const ergebnisse: AfaResult[] = [];

  if (nettoPreis <= DIREKT_ABZUG_GRENZE) {
    ergebnisse.push({
      methode: 'sofort',
      label: 'Direkter Betriebsausgabenabzug',
      description: `Bis ${DIREKT_ABZUG_GRENZE} € netto: Sofort als Betriebsausgabe abziehbar, kein Anlageverzeichnis nötig.`,
      jahresAbschreibung: nettoPreis,
      nutzungsdauer: 1,
      restwert: 0,
    });
    return ergebnisse;
  }

  if (nettoPreis <= GWG_SOFORT_GRENZE) {
    ergebnisse.push({
      methode: 'gwg',
      label: 'GWG-Sofortabschreibung',
      description: `Bis ${GWG_SOFORT_GRENZE} € netto: Im Anschaffungsjahr vollständig abschreibbar. Eintrag im Anlageverzeichnis erforderlich.`,
      jahresAbschreibung: nettoPreis,
      nutzungsdauer: 1,
      restwert: 0,
    });
  }

  if (nettoPreis > DIREKT_ABZUG_GRENZE && nettoPreis <= GWG_POOL_GRENZE) {
    const poolAfA = nettoPreis / 5;
    ergebnisse.push({
      methode: 'pool',
      label: 'Sammelposten (Poolabschreibung)',
      description: `250,01–${GWG_POOL_GRENZE} € netto: Gleichmäßig über 5 Jahre abschreiben. Nicht mit GWG-Sofortabschreibung im selben Jahr kombinierbar.`,
      jahresAbschreibung: Math.round(poolAfA * 100) / 100,
      nutzungsdauer: 5,
      restwert: Math.round((nettoPreis - poolAfA) * 100) / 100,
    });
  }

  // Lineare AfA (für alle > 250 €, Pflicht ab > 800 €)
  const nd = istDigital ? 1 : (NUTZUNGSDAUER[kategorie ?? 'sonstiges'] ?? 5);
  const jahresAfa = Math.round((nettoPreis / nd) * 100) / 100;

  ergebnisse.push({
    methode: 'linear',
    label: `Lineare AfA über ${nd} Jahr${nd > 1 ? 'e' : ''}`,
    description: istDigital
      ? 'Digitale Wirtschaftsgüter: Sonder-AfA über 1 Jahr (de facto Sofortabzug).'
      : `Anschaffungskosten werden gleichmäßig über ${nd} Jahre verteilt (${Math.round(100 / nd)}% pro Jahr).`,
    jahresAbschreibung: jahresAfa,
    nutzungsdauer: nd,
    restwert: Math.round((nettoPreis - jahresAfa) * 100) / 100,
  });

  return ergebnisse;
}

/**
 * Gibt eine Empfehlung für die beste Abschreibungsmethode.
 */
export function empfohlenAfaMethode(nettoPreis: number): AfaMethode {
  if (nettoPreis <= DIREKT_ABZUG_GRENZE) return 'sofort';
  if (nettoPreis <= GWG_SOFORT_GRENZE) return 'gwg';
  return 'linear';
}

/**
 * Gibt die GWG-Kategorie-Bezeichnung zurück.
 */
export function getGwgKategorie(nettoPreis: number): string {
  if (nettoPreis <= DIREKT_ABZUG_GRENZE) return 'Direktabzug (≤ 250 €)';
  if (nettoPreis <= GWG_SOFORT_GRENZE) return 'GWG – Sofortabschreibung (≤ 800 €)';
  if (nettoPreis <= GWG_POOL_GRENZE) return 'Pool-Option möglich (≤ 1.000 €)';
  return 'Reguläre AfA (> 1.000 €)';
}

export { NUTZUNGSDAUER, GWG_SOFORT_GRENZE, GWG_POOL_GRENZE, DIREKT_ABZUG_GRENZE };

/** Alle verfügbaren Wirtschaftsgut-Typen für manuelle Auswahl */
export const ASSET_TYPES = Object.keys(NUTZUNGSDAUER);

/**
 * Berechnet die zeitanteilige (pro rata temporis) AfA für ein bestimmtes Kalenderjahr.
 * Der Kaufmonat zählt als voller Monat.
 */
export interface ProRataAfaResult {
  /** AfA-Betrag für das angefragte Jahr */
  afaBetragImJahr: number;
  /** Anzahl der Monate im angefragten Jahr */
  monateImJahr: number;
  /** Volle Jahres-AfA (12 Monate) */
  volleJahresAfa: number;
  /** Monatliche AfA */
  monatsAfa: number;
  /** Jahr in dem das Gut komplett abgeschrieben ist */
  endeJahr: number;
  /** Monat im letzten Jahr */
  endeMonat: number;
  /** Restwert zum Ende des angefragten Jahres */
  restwertEndeJahr: number;
  /** Tabelle aller Jahre mit jeweiliger AfA */
  jahresplan: { jahr: number; monate: number; betrag: number; restwert: number }[];
}

export function berechneProRataAfa(
  nettoPreis: number,
  kaufdatum: string, // ISO date "2026-07-15"
  nutzungsdauer: number,
  fuerJahr: number,
): ProRataAfaResult {
  const kaufDate = new Date(kaufdatum);
  const kaufJahr = kaufDate.getFullYear();
  const kaufMonat = kaufDate.getMonth() + 1; // 1-12

  const volleJahresAfa = Math.round((nettoPreis / nutzungsdauer) * 100) / 100;
  const monatsAfa = Math.round((volleJahresAfa / 12) * 100) / 100;

  // Kaufmonat zählt als voller Monat
  const monateErstesJahr = 13 - kaufMonat; // z.B. Juli = 13-7 = 6 Monate
  const restMonate = 12 * nutzungsdauer - monateErstesJahr;
  const volleJahreDazwischen = Math.floor(restMonate / 12);
  const monateLetztesJahr = restMonate % 12;

  // Jahresplan erstellen
  const jahresplan: { jahr: number; monate: number; betrag: number; restwert: number }[] = [];
  let verbleibendeKosten = nettoPreis;

  // Erstes Jahr (anteilig)
  const afaErstesJahr = Math.round(monatsAfa * monateErstesJahr * 100) / 100;
  verbleibendeKosten = Math.round((verbleibendeKosten - afaErstesJahr) * 100) / 100;
  jahresplan.push({ jahr: kaufJahr, monate: monateErstesJahr, betrag: afaErstesJahr, restwert: verbleibendeKosten });

  // Volle Jahre
  for (let i = 1; i <= volleJahreDazwischen; i++) {
    const betrag = Math.min(volleJahresAfa, verbleibendeKosten);
    verbleibendeKosten = Math.round((verbleibendeKosten - betrag) * 100) / 100;
    jahresplan.push({ jahr: kaufJahr + i, monate: 12, betrag, restwert: verbleibendeKosten });
  }

  // Letztes Jahr (Rest)
  if (monateLetztesJahr > 0 && verbleibendeKosten > 0) {
    const betrag = verbleibendeKosten; // Rest komplett
    jahresplan.push({ jahr: kaufJahr + volleJahreDazwischen + 1, monate: monateLetztesJahr, betrag, restwert: 0 });
  }

  // Ende-Datum
  const letzterEintrag = jahresplan[jahresplan.length - 1];
  const endeJahr = letzterEintrag?.jahr ?? kaufJahr;
  const endeMonat = monateLetztesJahr > 0 ? monateLetztesJahr : 12;

  // Betrag für das angefragte Jahr
  const eintrag = jahresplan.find((e) => e.jahr === fuerJahr);
  const afaBetragImJahr = eintrag?.betrag ?? 0;
  const monateImJahr = eintrag?.monate ?? 0;
  const restwertEndeJahr = eintrag?.restwert ?? (fuerJahr < kaufJahr ? nettoPreis : 0);

  return {
    afaBetragImJahr,
    monateImJahr,
    volleJahresAfa,
    monatsAfa,
    endeJahr,
    endeMonat,
    restwertEndeJahr,
    jahresplan,
  };
}

/** Gibt die Nutzungsdauer für einen Asset-Typ zurück */
export function getNutzungsdauer(assetType: string, istDigital = false): number {
  if (istDigital) return 1;
  return NUTZUNGSDAUER[assetType] ?? 5;
}




