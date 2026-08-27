// ─── Rechnungsvorlagen als Baukasten ─────────────────────────────────────────
//
// Die alte Vorlage war eine Sammlung frei platzierter Kästen: jedes Element mit
// eigenem x, y, width, height auf einer A4-Fläche von 794 × 1123 Pixeln. Damit
// ließ sich zwar alles bauen, aber nichts schnell – wer eine Zeile einfügte,
// musste alles darunter von Hand nachschieben, und ein gerader Rand entstand
// nur, wenn man ihn selbst traf. Der Nutzer hat in Monaten keine einzige eigene
// Vorlage angelegt.
//
// Hier steht das Gegenmodell: Eine Vorlage ist eine **Reihenfolge von
// Bausteinen** plus ein paar gestalterische Angaben, die für das ganze
// Dokument gelten. Wo etwas landet, rechnet `layout.ts` aus. Ränder,
// Abstände und Ausrichtung sind damit nicht mehr Handarbeit, sondern Folge
// der Regeln – und sehen deshalb von sich aus ordentlich aus.
//
// Maßeinheit ist durchgehend **Millimeter**. jsPDF rechnet in mm, und die
// Vorschau skaliert mm nach Pixel. So gibt es nur ein Koordinatensystem,
// und Vorschau und PDF können nicht auseinanderlaufen.

/** DIN A4 in Millimetern. */
export const A4_BREITE = 210;
export const A4_HOEHE = 297;

export type BausteinTyp =
  /** Logo und Dokumenttitel („RECHNUNG"). */
  | 'kopf'
  /** Anschriftfeld: kleine Absenderzeile darüber, darunter der Empfänger. */
  | 'anschrift'
  /** Nummer, Datum, Leistungszeitpunkt, Fälligkeit. */
  | 'eckdaten'
  /** Betreffzeile in Fettschrift. */
  | 'betreff'
  /** Freitext – Anschreiben, Hinweise, Steuerhinweis. */
  | 'text'
  /** Positionstabelle samt Summenblock. */
  | 'positionen'
  /** Bankverbindung, Zahlungsziel, optional der QR-Code zum Überweisen. */
  | 'zahlung'
  /** Mehrspaltige Fußzeile mit den Absenderdaten. */
  | 'fusszeile'
  /** Bewusster Abstand zwischen zwei Bausteinen. */
  | 'abstand';

interface BausteinBasis {
  id: string;
  typ: BausteinTyp;
  /** Ausgeschaltete Bausteine bleiben in der Liste, werden aber nicht gezeichnet. */
  aus?: boolean;
  /** Zusätzlicher Abstand über diesem Baustein, in Millimetern. */
  abstandOben?: number;
}

export interface KopfBaustein extends BausteinBasis {
  typ: 'kopf';
  /** Wo das Logo steht. Der Titel steht jeweils gegenüber. */
  logoSeite: 'links' | 'rechts';
  /** Titel des Dokuments. Leer heißt: kein Titel. */
  titel: string;
  /** Höhe des Logos in Millimetern; die Breite ergibt sich aus dem Seitenverhältnis. */
  logoHoehe: number;
  /** Farbiger Balken unter dem Kopf. */
  trennlinie: boolean;
}

export interface AnschriftBaustein extends BausteinBasis {
  typ: 'anschrift';
  /** Die kleine, unterstrichene Absenderzeile über dem Anschriftfeld (DIN 5008). */
  absenderzeile: boolean;
}

export interface EckdatenBaustein extends BausteinBasis {
  typ: 'eckdaten';
  /**
   * `block` stellt die Angaben rechts neben das Anschriftfeld – das ist die
   * übliche Form auf deutschen Geschäftsbriefen. `zeile` legt sie als Reihe
   * unter die Anschrift, was bei wenigen Angaben ruhiger wirkt.
   */
  form: 'block' | 'zeile';
  /** Welche Angaben erscheinen, in dieser Reihenfolge. */
  felder: EckdatenFeld[];
}

export type EckdatenFeld = 'doc_number' | 'doc_date' | 'delivery_date' | 'due_date' | 'customer_number';

export const ECKDATEN_LABELS: Record<EckdatenFeld, string> = {
  doc_number: 'Rechnungsnummer',
  doc_date: 'Datum',
  delivery_date: 'Leistungszeitpunkt',
  due_date: 'Fällig bis',
  customer_number: 'Kundennummer',
};

export interface BetreffBaustein extends BausteinBasis {
  typ: 'betreff';
  /** Darf Platzhalter enthalten, etwa „Rechnung {{doc_number}}". */
  inhalt: string;
}

export interface TextBaustein extends BausteinBasis {
  typ: 'text';
  /**
   * Entweder fester Text oder der Wert eines Feldes. Feste Texte dürfen
   * Platzhalter in doppelten geschweiften Klammern enthalten.
   */
  quelle: 'fest' | 'feld';
  /** Bei `fest` der Text selbst, bei `feld` der Schlüssel des Feldes. */
  inhalt: string;
  groesse: 'klein' | 'normal';
  betont: boolean;
}

export interface PositionenBaustein extends BausteinBasis {
  typ: 'positionen';
  /** Welche Spalten die Tabelle zeigt. Beschreibung und Betrag sind Pflicht. */
  spalten: PositionsSpalte[];
  /** Linien, abwechselnde Zeilenfarbe oder ganz ohne. */
  stil: 'linien' | 'zebra' | 'schlicht';
  /** Umsatzsteuersatz in Prozent; 0 bedeutet Kleinunternehmer. */
  mwstSatz: number;
  /** Netto- und Steuerzeile zeigen oder nur die Endsumme. */
  summenAusweisen: boolean;
}

export type PositionsSpalte = 'pos' | 'beschreibung' | 'menge' | 'einheit' | 'einzelpreis' | 'rabatt' | 'betrag';

export const SPALTEN_LABELS: Record<PositionsSpalte, string> = {
  pos: 'Pos.',
  beschreibung: 'Beschreibung',
  menge: 'Menge',
  einheit: 'Einheit',
  einzelpreis: 'Einzelpreis',
  rabatt: 'Rabatt',
  betrag: 'Betrag',
};

export interface ZahlungBaustein extends BausteinBasis {
  typ: 'zahlung';
  /** QR-Code nach EPC-Standard, den Banking-Apps einlesen können. */
  qrCode: boolean;
  /** Bankverbindung ausschreiben. */
  bankverbindung: boolean;
}

export interface FusszeileBaustein extends BausteinBasis {
  typ: 'fusszeile';
  /** Wie viele Spalten die Absenderdaten füllen. */
  spalten: 2 | 3 | 4;
  /** Trennlinie darüber. */
  trennlinie: boolean;
}

export interface AbstandBaustein extends BausteinBasis {
  typ: 'abstand';
  hoehe: number;
}

export type Baustein =
  | KopfBaustein
  | AnschriftBaustein
  | EckdatenBaustein
  | BetreffBaustein
  | TextBaustein
  | PositionenBaustein
  | ZahlungBaustein
  | FusszeileBaustein
  | AbstandBaustein;

/**
 * Gestaltung, die für das ganze Dokument gilt. Genau das war der Grund, warum
 * die alten Vorlagen unruhig aussahen: Schriftgröße und Farbe standen an jedem
 * Element einzeln und wichen deshalb überall leicht voneinander ab.
 */
export interface Gestaltung {
  /** Akzentfarbe für Titel, Tabellenkopf und Linien. */
  akzent: string;
  /** Farbe des Fließtextes. */
  text: string;
  /** Gedämpfte Farbe für Beschriftungen und Fußzeile. */
  gedaempft: string;
  schriftart: string;
  /**
   * Grundgröße des Fließtextes in Punkt. Alles andere leitet sich davon ab –
   * Überschriften größer, Beschriftungen kleiner. Ein Regler statt zwanzig.
   */
  schriftgroesse: number;
  /** Seitenränder in Millimetern. */
  randOben: number;
  randUnten: number;
  randLinks: number;
  randRechts: number;
  /** Grundabstand zwischen zwei Bausteinen in Millimetern. */
  bausteinAbstand: number;
  /** Logo als Data-URL. Leer heißt: kein Logo. */
  logo: string;
}

export interface Rechnungsvorlage {
  id: string;
  name: string;
  art: 'rechnung' | 'gutschrift';
  /** Mitgelieferte Vorlagen lassen sich nicht löschen, aber kopieren. */
  mitgeliefert: boolean;
  gestaltung: Gestaltung;
  bausteine: Baustein[];
  erstelltAm: string;
  geaendertAm: string;
}

/** Beschriftungen für die Oberfläche. */
export const BAUSTEIN_LABELS: Record<BausteinTyp, string> = {
  kopf: 'Kopfzeile',
  anschrift: 'Anschriftfeld',
  eckdaten: 'Eckdaten',
  betreff: 'Betreff',
  text: 'Text',
  positionen: 'Positionen',
  zahlung: 'Zahlung',
  fusszeile: 'Fußzeile',
  abstand: 'Abstand',
};

/** Ein Satz, der erklärt, wofür ein Baustein gut ist. */
export const BAUSTEIN_BESCHREIBUNG: Record<BausteinTyp, string> = {
  kopf: 'Logo und Dokumenttitel, wahlweise mit farbigem Balken darunter.',
  anschrift: 'Anschriftfeld nach DIN 5008 – kleine Absenderzeile, darunter der Empfänger.',
  eckdaten: 'Nummer, Datum, Leistungszeitpunkt und Fälligkeit.',
  betreff: 'Eine fette Zeile, die sagt, worum es geht.',
  text: 'Freier Absatz – Anschreiben, Hinweise oder der Steuerhinweis.',
  positionen: 'Die Tabelle mit den Leistungen und den Summen darunter.',
  zahlung: 'Bankverbindung und Zahlungsziel, auf Wunsch mit QR-Code zum Überweisen.',
  fusszeile: 'Absenderdaten klein und mehrspaltig am Seitenfuß.',
  abstand: 'Bewusst gelassener Platz.',
};

/** Bausteine, die höchstens einmal vorkommen dürfen. */
export const NUR_EINMAL: BausteinTyp[] = ['kopf', 'anschrift', 'eckdaten', 'positionen', 'fusszeile'];
