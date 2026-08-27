// ─── Rechnungsvorlagen als Baukasten ─────────────────────────────────────────
//
// Eine Vorlage ist eine **Reihenfolge von Bausteinen** plus Gestaltung, die für
// das ganze Dokument gilt. Wo etwas landet, rechnet `layout.ts` aus – Ränder,
// Abstände und Ausrichtung sind damit nicht Handarbeit, sondern Folge der
// Regeln.
//
// Zwei Dinge machen den Baukasten trotzdem frei:
//
//  1. Jeder Baustein trägt einen optionalen `stil`. Damit lassen sich Schrift,
//     Farbe, Ausrichtung, Hintergrund, Rahmen und Breite einzeln übersteuern,
//     ohne dass man dafür die Gestaltung des ganzen Dokuments ändern muss.
//     Fehlt eine Angabe, erbt der Baustein sie – so bleibt eine Vorlage
//     einheitlich, solange man nichts anderes sagt.
//  2. Der Baustein `spalten` nimmt andere Bausteine auf und stellt sie
//     nebeneinander. Die Breite je Spalte ist frei einstellbar. Damit lässt
//     sich fast jedes Blatt bauen, ohne zum Pixelschieben zurückzukehren.
//
// Maßeinheit ist durchgehend **Millimeter**. jsPDF rechnet in mm, die Vorschau
// skaliert mm nach Pixel – ein Koordinatensystem, keine Umrechnung.

/** DIN A4 in Millimetern. */
export const A4_BREITE = 210;
export const A4_HOEHE = 297;

export type BausteinTyp =
  /** Logo und Dokumenttitel. */
  | 'kopf'
  /** Anschriftfeld: kleine Absenderzeile darüber, darunter der Empfänger. */
  | 'anschrift'
  /** Nummer, Datum, Leistungszeitpunkt, Fälligkeit – und eigene Zeilen. */
  | 'eckdaten'
  /** Betreffzeile. */
  | 'betreff'
  /** Freitext – Anschreiben, Hinweise, Steuerhinweis. */
  | 'text'
  /** Positionstabelle samt Summenblock. */
  | 'positionen'
  /** Bankverbindung, Zahlungsziel, optional der QR-Code zum Überweisen. */
  | 'zahlung'
  /** Mehrspaltige Fußzeile mit den Absenderdaten. */
  | 'fusszeile'
  /** Bewusster Abstand. */
  | 'abstand'
  /** Waagerechte Linie als Trenner. */
  | 'linie'
  /** Ein Bild – Logo, Unterschrift, Stempel. */
  | 'bild'
  /** Eine freie Tabelle aus Beschriftung und Wert. */
  | 'liste'
  /** Unterschriftsfeld mit Linie und Beschriftung. */
  | 'unterschrift'
  /** Erzwingt eine neue Seite. */
  | 'seitenumbruch'
  /** Nimmt andere Bausteine auf und stellt sie nebeneinander. */
  | 'spalten';

export type Ausrichtung = 'links' | 'mitte' | 'rechts';

/** Auf welchen Seiten ein Rahmen gezeichnet wird. */
export type RahmenSeite = 'oben' | 'unten' | 'links' | 'rechts';

/**
 * Feineinstellungen je Baustein. Alles ist wahlfrei: Was fehlt, wird von der
 * Gestaltung des Dokuments geerbt. Das ist der Unterschied zum alten
 * Pixel-Editor, wo jede Schriftgröße an jedem Element einzeln stand und
 * deshalb überall leicht abwich.
 */
export interface BausteinStil {
  /** Schriftgröße in Punkt. Fehlt sie, gilt die Grundgröße der Vorlage. */
  schriftgroesse?: number;
  /** Textfarbe. Leer heißt: erben. */
  farbe?: string;
  /** Waagerechte Ausrichtung des Inhalts. */
  ausrichtung?: Ausrichtung;
  fett?: boolean;
  kursiv?: boolean;
  /** Hintergrundfläche hinter dem Baustein. Leer heißt: keine. */
  hintergrund?: string;
  /** Rahmenfarbe und -stärke; `rahmenSeiten` legt fest, wo er erscheint. */
  rahmenFarbe?: string;
  rahmenDicke?: number;
  rahmenSeiten?: RahmenSeite[];
  /** Innenabstand in Millimetern – wirkt nur mit Hintergrund oder Rahmen. */
  innenabstand?: number;
  /** Abstand über und unter dem Baustein, in Millimetern. */
  abstandOben?: number;
  abstandUnten?: number;
  /**
   * Breite als Anteil des verfügbaren Bereichs, 0 bis 1. Zusammen mit
   * `ausrichtung` lässt sich ein Baustein damit auch ohne Spalten schmal
   * halten und rechts anschlagen.
   */
  breite?: number;
  /** Zeilenabstand als Vielfaches der Schriftgröße. */
  zeilenabstand?: number;
}

interface BausteinBasis {
  id: string;
  typ: BausteinTyp;
  /** Ausgeschaltete Bausteine bleiben in der Liste, werden aber nicht gezeichnet. */
  aus?: boolean;
  /**
   * Früher stand der Abstand direkt am Baustein. Er bleibt erhalten, damit
   * bestehende Vorlagen weiter stimmen; neu gesetzt wird er über `stil`.
   */
  abstandOben?: number;
  stil?: BausteinStil;
}

export interface KopfBaustein extends BausteinBasis {
  typ: 'kopf';
  /** Wo das Logo steht. Der Titel steht jeweils gegenüber. */
  logoSeite: 'links' | 'rechts';
  /** Titel des Dokuments. Leer heißt: kein Titel. */
  titel: string;
  /** Höhe des Logos in Millimetern; die Breite ergibt sich aus dem Bild. */
  logoHoehe: number;
  /** Farbiger Balken unter dem Kopf. */
  trennlinie: boolean;
  /** Größe des Titels als Vielfaches der Grundschrift. */
  titelFaktor?: number;
  /** Eigene Titelfarbe. Leer heißt: Akzentfarbe. */
  titelFarbe?: string;
  /** Titel in Großbuchstaben setzen. */
  titelGrossbuchstaben?: boolean;
  /** Stärke des Balkens in Millimetern. */
  linienDicke?: number;
}

export interface AnschriftBaustein extends BausteinBasis {
  typ: 'anschrift';
  /** Die kleine, unterstrichene Absenderzeile über dem Anschriftfeld. */
  absenderzeile: boolean;
  /** Breite des Anschriftfelds in Millimetern. */
  feldBreite?: number;
  /** Zusätzlicher Text über der Anschrift, etwa „An" oder eine Kundennummer. */
  vorspann?: string;
}

export type EckdatenFeld = 'doc_number' | 'doc_date' | 'delivery_date' | 'due_date' | 'customer_number';

export const ECKDATEN_LABELS: Record<EckdatenFeld, string> = {
  doc_number: 'Rechnungsnummer',
  doc_date: 'Datum',
  delivery_date: 'Leistungszeitpunkt',
  due_date: 'Fällig bis',
  customer_number: 'Kundennummer',
};

/** Eine frei benannte Zeile in den Eckdaten oder in einer Liste. */
export interface EigeneZeile {
  id: string;
  beschriftung: string;
  /** Fester Text oder ein Platzhalter wie {{doc_number}}. */
  wert: string;
}

export interface EckdatenBaustein extends BausteinBasis {
  typ: 'eckdaten';
  /**
   * `block` stellt die Angaben rechts neben das Anschriftfeld – die übliche
   * Form auf deutschen Geschäftsbriefen. `zeile` legt sie als Reihe darunter.
   * `liste` setzt sie untereinander über die volle Breite.
   */
  form: 'block' | 'zeile' | 'liste';
  /** Welche Angaben erscheinen, in dieser Reihenfolge. */
  felder: EckdatenFeld[];
  /** Eigene Beschriftungen, die die Vorgaben übersteuern. */
  beschriftungen?: Partial<Record<EckdatenFeld, string>>;
  /** Zusätzliche, frei benannte Zeilen. */
  eigene?: EigeneZeile[];
  /** Breite des Blocks in Millimetern (nur bei `block`). */
  blockBreite?: number;
  /** Anteil, den die Beschriftung von der Blockbreite einnimmt. */
  beschriftungsAnteil?: number;
}

export interface BetreffBaustein extends BausteinBasis {
  typ: 'betreff';
  /** Darf Platzhalter enthalten, etwa „Rechnung {{doc_number}}". */
  inhalt: string;
}

export interface TextBaustein extends BausteinBasis {
  typ: 'text';
  /** Fester Text oder der Wert eines Feldes. */
  quelle: 'fest' | 'feld';
  /** Bei `fest` der Text selbst, bei `feld` der Schlüssel des Feldes. */
  inhalt: string;
  /** Bleibt für bestehende Vorlagen erhalten; neu zählt `stil.schriftgroesse`. */
  groesse: 'klein' | 'normal';
  betont: boolean;
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

export interface PositionenBaustein extends BausteinBasis {
  typ: 'positionen';
  /** Welche Spalten die Tabelle zeigt, in dieser Reihenfolge. */
  spalten: PositionsSpalte[];
  /**
   * Linien, abwechselnde Zeilenfarbe, Rahmen oder ganz ohne. Hieß früher
   * schlicht `stil`; der Name ist an `BausteinStil` gefallen, und der Speicher
   * zieht alte Vorlagen beim Laden nach.
   */
  stilVariante?: 'linien' | 'zebra' | 'schlicht' | 'rahmen';
  /** Umsatzsteuersatz in Prozent; 0 bedeutet Kleinunternehmer. */
  mwstSatz: number;
  /** Netto- und Steuerzeile zeigen oder nur die Endsumme. */
  summenAusweisen: boolean;
  /** Eigene Spaltenbreiten als Anteile. Fehlt die Angabe, rechnet die App. */
  spaltenBreiten?: number[];
  /** Eigene Spaltenüberschriften. */
  spaltenLabels?: Partial<Record<PositionsSpalte, string>>;
  /** Farbe des Tabellenkopfs. Leer heißt: Akzentfarbe. */
  kopfFarbe?: string;
  kopfTextFarbe?: string;
  /** Farbe der abwechselnden Zeilen. */
  zebraFarbe?: string;
  /** Farbe der Trennlinien. */
  linienFarbe?: string;
  /** Zeilenhöhe als Vielfaches der Zeilenhöhe der Schrift. */
  zeilenFaktor?: number;
  /** Breite des Summenblocks in Millimetern. */
  summenBreite?: number;
  /** Summenblock links statt rechts. */
  summenLinks?: boolean;
  /** Beschriftung der Endsumme. Leer heißt: von der Steuerpflicht abhängig. */
  summeLabel?: string;
}

export interface ZahlungBaustein extends BausteinBasis {
  typ: 'zahlung';
  /** QR-Code nach EPC-Standard, den Banking-Apps einlesen können. */
  qrCode: boolean;
  /** Bankverbindung ausschreiben. */
  bankverbindung: boolean;
  /** Kantenlänge des QR-Codes in Millimetern. */
  qrGroesse?: number;
  /** QR links statt rechts. */
  qrLinks?: boolean;
  /** Eigene Einleitung, etwa „Bitte überweisen Sie auf folgendes Konto:". */
  vorspann?: string;
}

export type FussFeld =
  | 'sender_name' | 'sender_address' | 'sender_email' | 'sender_phone'
  | 'sender_tax_number' | 'sender_vat_id' | 'sender_iban' | 'sender_bic'
  | 'sender_finanzamt' | 'sender_w_idnr';

export const FUSS_LABELS: Record<FussFeld, string> = {
  sender_name: 'Name',
  sender_address: 'Anschrift',
  sender_email: 'E-Mail',
  sender_phone: 'Telefon',
  sender_tax_number: 'Steuernummer',
  sender_vat_id: 'USt-IdNr.',
  sender_iban: 'IBAN',
  sender_bic: 'BIC',
  sender_finanzamt: 'Finanzamt',
  sender_w_idnr: 'W-IdNr.',
};

export interface FusszeileBaustein extends BausteinBasis {
  typ: 'fusszeile';
  /** Wie viele Spalten die Absenderdaten füllen. */
  spalten: 2 | 3 | 4;
  /** Trennlinie darüber. */
  trennlinie: boolean;
  /** Welche Angaben erscheinen. Fehlt die Liste, nimmt die App alle gefüllten. */
  felder?: FussFeld[];
  /** Seitenzahl mitdrucken, sobald es mehr als eine Seite gibt. */
  seitenzahl?: boolean;
  /** Auf jeder Seite oder nur auf der letzten. */
  nurLetzteSeite?: boolean;
}

export interface AbstandBaustein extends BausteinBasis {
  typ: 'abstand';
  hoehe: number;
}

export interface LinieBaustein extends BausteinBasis {
  typ: 'linie';
  /** Stärke in Millimetern. */
  dicke: number;
  /** Leer heißt: gedämpfte Farbe der Vorlage. */
  farbe?: string;
  /** Anteil der verfügbaren Breite, 0 bis 1. */
  breite?: number;
}

export interface BildBaustein extends BausteinBasis {
  typ: 'bild';
  /** Data-URL. Leer heißt: das Logo der Vorlage. */
  quelle: string;
  /** Höhe in Millimetern; die Breite ergibt sich aus dem Bild. */
  hoehe: number;
  /** Feste Breite in Millimetern. 0 heißt: aus dem Seitenverhältnis. */
  breiteMm?: number;
}

export interface ListeBaustein extends BausteinBasis {
  typ: 'liste';
  zeilen: EigeneZeile[];
  /** Anteil, den die Beschriftung einnimmt. */
  beschriftungsAnteil?: number;
  /** Trennlinie zwischen den Zeilen. */
  trennlinien?: boolean;
}

export interface UnterschriftBaustein extends BausteinBasis {
  typ: 'unterschrift';
  /** Text unter der Linie. */
  beschriftung: string;
  /** Breite der Linie in Millimetern. */
  linienBreite: number;
  /** Platz über der Linie, damit man unterschreiben kann. */
  freiraum: number;
}

export interface SeitenumbruchBaustein extends BausteinBasis {
  typ: 'seitenumbruch';
}

/** Eine Spalte im Spalten-Baustein. */
export interface Spalte {
  id: string;
  /** Gewicht der Spalte. Die App teilt die Breite im Verhältnis der Gewichte. */
  anteil: number;
  bausteine: Baustein[];
}

export interface SpaltenBaustein extends BausteinBasis {
  typ: 'spalten';
  spalten: Spalte[];
  /** Zwischenraum zwischen den Spalten, in Millimetern. */
  zwischenraum: number;
  /** Wie die Spalten zueinander stehen, wenn sie verschieden hoch sind. */
  ausrichtungSenkrecht?: 'oben' | 'mitte' | 'unten';
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
  | AbstandBaustein
  | LinieBaustein
  | BildBaustein
  | ListeBaustein
  | UnterschriftBaustein
  | SeitenumbruchBaustein
  | SpaltenBaustein;

/**
 * Gestaltung, die für das ganze Dokument gilt und die jeder Baustein erbt,
 * solange er nichts eigenes sagt.
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
   * ein Regler statt zwanzig.
   */
  schriftgroesse: number;
  /** Zeilenabstand als Vielfaches der Schriftgröße. */
  zeilenabstand: number;
  /** Seitenränder in Millimetern. */
  randOben: number;
  randUnten: number;
  randLinks: number;
  randRechts: number;
  /** Grundabstand zwischen zwei Bausteinen in Millimetern. */
  bausteinAbstand: number;
  /** Logo als Data-URL. Leer heißt: kein Logo. */
  logo: string;
  /** Seitenverhältnis des Logos (Breite geteilt durch Höhe). */
  logoVerhaeltnis?: number;
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
  linie: 'Linie',
  bild: 'Bild',
  liste: 'Freie Liste',
  unterschrift: 'Unterschrift',
  seitenumbruch: 'Seitenumbruch',
  spalten: 'Spalten',
};

/** Ein Satz, der erklärt, wofür ein Baustein gut ist. */
export const BAUSTEIN_BESCHREIBUNG: Record<BausteinTyp, string> = {
  kopf: 'Logo und Dokumenttitel, wahlweise mit farbigem Balken darunter.',
  anschrift: 'Anschriftfeld nach DIN 5008 – kleine Absenderzeile, darunter der Empfänger.',
  eckdaten: 'Nummer, Datum, Leistungszeitpunkt und Fälligkeit, dazu eigene Zeilen.',
  betreff: 'Eine fette Zeile, die sagt, worum es geht.',
  text: 'Freier Absatz – Anschreiben, Hinweise oder der Steuerhinweis.',
  positionen: 'Die Tabelle mit den Leistungen und den Summen darunter.',
  zahlung: 'Bankverbindung und Zahlungsziel, auf Wunsch mit QR-Code zum Überweisen.',
  fusszeile: 'Absenderdaten klein und mehrspaltig am Seitenfuß.',
  abstand: 'Bewusst gelassener Platz.',
  linie: 'Eine waagerechte Linie als Trenner.',
  bild: 'Ein Bild – Logo, Unterschrift oder Stempel.',
  liste: 'Frei benannte Zeilen aus Beschriftung und Wert.',
  unterschrift: 'Eine Linie zum Unterschreiben, mit Beschriftung darunter.',
  seitenumbruch: 'Erzwingt, dass es auf einer neuen Seite weitergeht.',
  spalten: 'Stellt andere Bausteine nebeneinander – die Breite bestimmst du.',
};

/** Bausteine, die höchstens einmal vorkommen dürfen. */
export const NUR_EINMAL: BausteinTyp[] = ['kopf', 'anschrift', 'positionen', 'fusszeile'];

/** Bausteine, die nicht in eine Spalte passen – sie brauchen die volle Breite. */
export const NICHT_IN_SPALTEN: BausteinTyp[] = ['fusszeile', 'seitenumbruch', 'spalten'];

/** Läuft der Baustein über die volle Seitenbreite, egal was der Stil sagt? */
export function istVollbreit(typ: BausteinTyp): boolean {
  return typ === 'fusszeile' || typ === 'seitenumbruch';
}
