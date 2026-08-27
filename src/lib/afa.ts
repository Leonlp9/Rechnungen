// ─── Wirtschaftsgut-Typen und GWG-Bezeichnungen ──────────────────────────────
//
// Hier steht nur noch, wie ein Beleg einem Typ zugeordnet wird und welche
// Nutzungsdauer dazu gehört. Gerechnet wird in src/lib/steuer/anlagen.ts – die
// früher hier stehenden Rechenwege kannten weder die Bruttobemessung beim
// Kleinunternehmer noch die degressive Abschreibung und sind entfallen, damit
// niemand versehentlich wieder mit ihnen rechnet.


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
// Die Wortgrenze am Ende hat vorher Beugungen verschluckt: „Gaming Stuhls"
// blieb unerkannt, weil auf „stuhl" ein s folgt. Deshalb steht dort jetzt \w*,
// das Genitiv und Plural mit abdeckt.
const ASSET_PATTERNS: [RegExp, string][] = [
  [/\b(laptop|notebook|macbook|thinkpad|pc|desktop|imac|rechner|computer)\w*/i, 'computer'],
  [/\b(monitor|display|bildschirm|screen)\w*/i, 'monitor'],
  [/\b(drucker|printer|scanner)\w*/i, 'drucker'],
  [/\b(handy|smartphone|iphone|pixel|telefon|tablet|ipad)\w*|samsung\s+galaxy|galaxy\s+(s\d|z\s|z\d|a\d|tab|note|fold|flip|buds)/i, 'smartphone'],
  [/\b(stuhl|tisch|schreibtisch|bürostuhl|regal|schrank|möbel|sessel|rollcontainer)\w*/i, 'moebel'],
  [/\b(auto|pkw|kfz|fahrzeug|leasing|transporter)\w*/i, 'fahrzeug'],
  [/\b(lizenz|software|app|saas|adobe|microsoft|jetbrains)\w*/i, 'software'],
  [/\b(kamera|camera|objektiv|lens|gopro|insta360|dji|osmo|sony alpha|canon eos|foto)\w*/i, 'kamera'],
  [/\b(mikrofon|mikrofonarm|microphone|headset|kopfhörer|lautsprecher|audio|interface|mixer|podcast)\w*/i, 'audio'],
  [/\b(licht|lampe|beleuchtung|ring.?light|softbox|led.?panel)\w*/i, 'beleuchtung'],
  // Netzwerktechnik zählt zur Computerhardware und darf damit über ein Jahr
  // abgeschrieben werden (BMF vom 22.02.2022).
  [/\b(router|repeater|switch|access.?point|nas|dockingstation|usb.?hub|fritz)\w*/i, 'computer'],
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



/** Gibt die Nutzungsdauer für einen Asset-Typ zurück */
export function getNutzungsdauer(assetType: string, istDigital = false): number {
  if (istDigital) return 1;
  return NUTZUNGSDAUER[assetType] ?? 5;
}




