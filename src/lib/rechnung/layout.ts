// ─── Aus einer Vorlage wird ein Seitenlayout ─────────────────────────────────
//
// Diese Datei ist der Grund, warum Vorschau und PDF nicht auseinanderlaufen
// können: Beide zeichnen exakt dieselbe Liste von Kästen. Der Zeilenumbruch
// passiert hier, nicht im Zeichner – wer die Vorschau sieht, sieht das PDF.
//
// Der Aufbau ist bewusst rekursiv: `zeichneListe` bekommt einen Bereich (linker
// Rand und Breite) und arbeitet eine Bausteinliste von oben nach unten ab. Der
// Spalten-Baustein ruft dieselbe Funktion für jede seiner Spalten mit einem
// schmaleren Bereich auf. Deshalb kann in einer Spalte alles stehen, was auch
// auf der Seite stehen kann.
//
// Alles in Millimetern, Ursprung links oben.

import type {
  Baustein,
  BausteinStil,
  EckdatenBaustein,
  EckdatenFeld,
  FussFeld,
  Gestaltung,
  PositionsSpalte,
  Rechnungsvorlage,
} from '@/types/rechnungsvorlage';
import {
  A4_BREITE,
  A4_HOEHE,
  ECKDATEN_LABELS,
  SPALTEN_LABELS,
} from '@/types/rechnungsvorlage';
import type { LineItem } from '@/types/template';

// ─── Ausgabe ─────────────────────────────────────────────────────────────────

export type Ausrichtung = 'links' | 'mitte' | 'rechts';

export interface TextKasten {
  art: 'text';
  x: number;
  y: number;
  breite: number;
  /** Bereits umgebrochene Zeilen – der Zeichner bricht nichts mehr. */
  zeilen: string[];
  groesse: number;
  farbe: string;
  fett: boolean;
  kursiv?: boolean;
  ausrichtung: Ausrichtung;
  zeilenhoehe: number;
}

export interface LinieKasten {
  art: 'linie';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  farbe: string;
  dicke: number;
}

export interface FlaecheKasten {
  art: 'flaeche';
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  farbe: string;
}

export interface BildKasten {
  art: 'bild';
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  quelle: string;
}

export interface QrKasten {
  art: 'qr';
  x: number;
  y: number;
  groesse: number;
  daten: string;
}

export type Kasten = TextKasten | LinieKasten | FlaecheKasten | BildKasten | QrKasten;

export interface Seite {
  kaesten: Kasten[];
}

export interface Summen {
  netto: number;
  steuer: number;
  brutto: number;
  rabatt: number;
}

export interface LayoutErgebnis {
  seiten: Seite[];
  summen: Summen;
}

// ─── Textmaß ─────────────────────────────────────────────────────────────────
//
// Zeichenbreiten von Helvetica in Tausendstel der Schriftgröße. Damit lässt
// sich ohne Zeichenfläche und ohne jsPDF messen. Für Times und Courier weicht
// das leicht ab – aber da beide Zeichner dieselbe Schätzung benutzen, bleibt
// die Vorschau deckungsgleich mit dem PDF, und darauf kommt es an.

const HELVETICA: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778,
  R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333,
  s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
  '€': 556, '§': 556, ä: 556, ö: 556, ü: 556, Ä: 667, Ö: 778, Ü: 722, ß: 556,
};

/** Punkt in Millimeter – ein typografischer Punkt ist 1/72 Zoll. */
export const PT_ZU_MM = 25.4 / 72;

/** Breite eines Textes in Millimetern. */
export function textBreite(text: string, groesseInPt: number, fett = false): number {
  let einheiten = 0;
  for (const zeichen of text) einheiten += HELVETICA[zeichen] ?? 556;
  return (einheiten / 1000) * groesseInPt * PT_ZU_MM * (fett ? 1.06 : 1);
}

/**
 * Bricht Text auf eine Breite um. Bricht an Leerzeichen; ein Wort, das länger
 * ist als die Zeile, wird hart getrennt, damit nichts über den Rand läuft.
 */
export function umbrechen(text: string, breite: number, groesse: number, fett = false): string[] {
  const zeilen: string[] = [];
  for (const absatz of String(text ?? '').split('\n')) {
    if (absatz.trim() === '') { zeilen.push(''); continue; }
    let zeile = '';
    for (const wort of absatz.split(' ')) {
      const versuch = zeile ? `${zeile} ${wort}` : wort;
      if (textBreite(versuch, groesse, fett) <= breite || zeile === '') {
        if (zeile === '' && textBreite(wort, groesse, fett) > breite) {
          let rest = wort;
          while (textBreite(rest, groesse, fett) > breite && rest.length > 1) {
            let schnitt = rest.length;
            while (schnitt > 1 && textBreite(rest.slice(0, schnitt), groesse, fett) > breite) schnitt--;
            zeilen.push(rest.slice(0, schnitt));
            rest = rest.slice(schnitt);
          }
          zeile = rest;
          continue;
        }
        zeile = versuch;
      } else {
        zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

// ─── Hilfsgrößen ─────────────────────────────────────────────────────────────

const euro = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const zahl = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Ersetzt {{platzhalter}} durch Werte. */
export function fuelle(text: string, werte: Record<string, string>): string {
  return String(text ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => werte[k] ?? '');
}

/** Betrag einer Position nach Rabatt. */
export function zeilenBetrag(p: LineItem): number {
  const roh = (p.quantity || 0) * (p.unitPrice || 0);
  return Math.round((roh - roh * ((p.discount || 0) / 100)) * 100) / 100;
}

export function berechneSummen(positionen: LineItem[], mwstSatz: number, globalerRabatt = 0): Summen {
  const roh = positionen.filter((p) => !p.isGroupHeader).reduce((s, p) => s + zeilenBetrag(p), 0);
  const rabatt = Math.round(roh * (globalerRabatt / 100) * 100) / 100;
  const netto = Math.round((roh - rabatt) * 100) / 100;
  const steuer = Math.round(netto * (mwstSatz / 100) * 100) / 100;
  return { netto, steuer, brutto: Math.round((netto + steuer) * 100) / 100, rabatt };
}

/**
 * Datensatz für den Überweisungs-QR-Code nach dem EPC-Standard. Banking-Apps
 * lesen ihn und füllen das Überweisungsformular aus.
 */
export function epcDaten(werte: Record<string, string>, betrag: number): string {
  return [
    'BCD', '002', '1', 'SCT',
    (werte.sender_bic ?? '').replace(/\s/g, ''),
    (werte.sender_name ?? '').slice(0, 70),
    (werte.sender_iban ?? '').replace(/\s/g, ''),
    `EUR${betrag.toFixed(2)}`,
    '', '',
    `Rechnung ${werte.doc_number ?? ''}`.slice(0, 140),
  ].join('\n');
}

// ─── Der Zeichenvorgang ──────────────────────────────────────────────────────

export interface LayoutEingaben {
  vorlage: Rechnungsvorlage;
  /** Feldwerte: sender_name, receiver_address, doc_number … */
  werte: Record<string, string>;
  positionen: LineItem[];
  /** Prozentualer Nachlass auf die Gesamtsumme. */
  globalerRabatt?: number;
}

/** Ein waagerechter Bereich, in dem Bausteine untereinander stehen. */
interface Bereich {
  x: number;
  breite: number;
}

/** Alles, was beim Zeichnen mitwandert. */
interface Lage {
  seiten: Seite[];
  seite: number;
  y: number;
  /** Unterkante, ab der eine neue Seite beginnt. */
  unten: number;
  g: Gestaltung;
  werte: Record<string, string>;
  positionen: LineItem[];
  summen: Summen;
  /** In einer Spalte darf nicht umgebrochen werden – sonst zerfällt die Reihe. */
  inSpalte: boolean;
}

const RECHTSBUENDIG: PositionsSpalte[] = ['menge', 'einzelpreis', 'rabatt', 'betrag'];

/** Wie breit die Spalten der Positionstabelle sind, als Anteil. */
function spaltenBreiten(spalten: PositionsSpalte[], eigene?: number[]): number[] {
  if (eigene && eigene.length === spalten.length) {
    const summe = eigene.reduce((s, v) => s + Math.max(0, v), 0);
    if (summe > 0) return eigene.map((v) => Math.max(0, v) / summe);
  }
  const gewicht: Record<PositionsSpalte, number> = {
    pos: 0.6, beschreibung: 4.4, menge: 0.8, einheit: 0.8,
    einzelpreis: 1.2, rabatt: 0.8, betrag: 1.3,
  };
  const summe = spalten.reduce((s, c) => s + gewicht[c], 0);
  return spalten.map((c) => gewicht[c] / summe);
}

export function layoutRechnung({
  vorlage,
  werte,
  positionen,
  globalerRabatt = 0,
}: LayoutEingaben): LayoutErgebnis {
  const g = vorlage.gestaltung;

  const positionsBaustein = findeBaustein(vorlage.bausteine, 'positionen');
  const mwstSatz = positionsBaustein && positionsBaustein.typ === 'positionen' ? positionsBaustein.mwstSatz : 0;
  const summen = berechneSummen(positionen, mwstSatz, globalerRabatt);

  const fuss = findeBaustein(vorlage.bausteine, 'fusszeile');
  const fussHoehe = fuss && fuss.typ === 'fusszeile' ? fussHoeheBerechnen(fuss, g, werte) : 0;

  const lage: Lage = {
    seiten: [{ kaesten: [] }],
    seite: 0,
    y: g.randOben,
    unten: A4_HOEHE - g.randUnten - fussHoehe,
    g,
    werte,
    positionen,
    summen,
    inSpalte: false,
  };

  const bereich: Bereich = {
    x: g.randLinks,
    breite: A4_BREITE - g.randLinks - g.randRechts,
  };

  // Die Eckdaten in Blockform stehen neben dem Anschriftfeld und werden dort
  // mitgezeichnet – hier also überspringen.
  const eckdatenBlock = vorlage.bausteine.find(
    (b): b is EckdatenBaustein => b.typ === 'eckdaten' && !b.aus && b.form === 'block',
  );

  zeichneListe(vorlage.bausteine, bereich, lage, { eckdatenBlock, erledigt: new Set() });

  if (fuss && fuss.typ === 'fusszeile') zeichneFusszeile(fuss, lage, fussHoehe);

  return { seiten: lage.seiten, summen };
}

function findeBaustein(bausteine: Baustein[], typ: string): Baustein | undefined {
  for (const b of bausteine) {
    if (b.aus) continue;
    if (b.typ === typ) return b;
    if (b.typ === 'spalten') {
      for (const s of b.spalten) {
        const treffer = findeBaustein(s.bausteine, typ);
        if (treffer) return treffer;
      }
    }
  }
  return undefined;
}

interface Kontext {
  eckdatenBlock?: EckdatenBaustein;
  erledigt: Set<string>;
}

/** Legt Bausteine untereinander in einen Bereich. Bewegt `lage.y`. */
function zeichneListe(bausteine: Baustein[], bereich: Bereich, lage: Lage, ctx: Kontext): void {
  for (const baustein of bausteine) {
    if (baustein.aus) continue;
    if (baustein.typ === 'fusszeile') continue; // sitzt am Seitenfuß
    if (ctx.erledigt.has(baustein.id)) continue;
    zeichneBaustein(baustein, bereich, lage, ctx);
  }
}

/** Der Bereich, den ein Baustein nach seinem Stil tatsächlich einnimmt. */
function stilBereich(stil: BausteinStil | undefined, bereich: Bereich): Bereich {
  const anteil = stil?.breite && stil.breite > 0 && stil.breite <= 1 ? stil.breite : 1;
  const breite = bereich.breite * anteil;
  if (anteil >= 1) return bereich;
  const aus = stil?.ausrichtung ?? 'links';
  const x = aus === 'rechts' ? bereich.x + bereich.breite - breite
    : aus === 'mitte' ? bereich.x + (bereich.breite - breite) / 2
      : bereich.x;
  return { x, breite };
}

function zeichneBaustein(baustein: Baustein, aussen: Bereich, lage: Lage, ctx: Kontext): void {
  const g = lage.g;
  const stil = baustein.stil;
  const male = (k: Kasten) => lage.seiten[lage.seite].kaesten.push(k);

  lage.y += stil?.abstandOben ?? baustein.abstandOben ?? 0;

  const bereich = stilBereich(stil, aussen);
  const innen = stil?.innenabstand ?? 0;
  const inhalt: Bereich = { x: bereich.x + innen, breite: Math.max(1, bereich.breite - innen * 2) };
  const startY = lage.y;
  lage.y += innen;

  // Ab hier zeichnet jeder Fall in `inhalt` und lässt `lage.y` unten stehen.
  switch (baustein.typ) {
    case 'seitenumbruch':
      if (lage.seiten[lage.seite].kaesten.length > 0) neueSeite(lage);
      return;

    case 'abstand':
      lage.y += baustein.hoehe;
      break;

    case 'linie': {
      const b = inhalt.breite * (baustein.breite && baustein.breite > 0 ? Math.min(1, baustein.breite) : 1);
      const aus = stil?.ausrichtung ?? 'links';
      const x = aus === 'rechts' ? inhalt.x + inhalt.breite - b
        : aus === 'mitte' ? inhalt.x + (inhalt.breite - b) / 2
          : inhalt.x;
      platz(lage, baustein.dicke + 1);
      male({ art: 'linie', x1: x, y1: lage.y, x2: x + b, y2: lage.y, farbe: baustein.farbe || g.gedaempft, dicke: baustein.dicke });
      lage.y += baustein.dicke;
      break;
    }

    case 'bild': {
      const quelle = baustein.quelle || g.logo;
      if (!quelle) break;
      const verhaeltnis = g.logoVerhaeltnis && g.logoVerhaeltnis > 0 ? g.logoVerhaeltnis : 2.6;
      const b = baustein.breiteMm && baustein.breiteMm > 0 ? baustein.breiteMm : baustein.hoehe * verhaeltnis;
      const aus = stil?.ausrichtung ?? 'links';
      const x = aus === 'rechts' ? inhalt.x + inhalt.breite - b
        : aus === 'mitte' ? inhalt.x + (inhalt.breite - b) / 2
          : inhalt.x;
      platz(lage, baustein.hoehe);
      male({ art: 'bild', x, y: lage.y, breite: Math.min(b, inhalt.breite), hoehe: baustein.hoehe, quelle });
      lage.y += baustein.hoehe;
      break;
    }

    case 'unterschrift': {
      platz(lage, baustein.freiraum + 6);
      lage.y += baustein.freiraum;
      const b = Math.min(baustein.linienBreite, inhalt.breite);
      const aus = stil?.ausrichtung ?? 'links';
      const x = aus === 'rechts' ? inhalt.x + inhalt.breite - b
        : aus === 'mitte' ? inhalt.x + (inhalt.breite - b) / 2
          : inhalt.x;
      male({ art: 'linie', x1: x, y1: lage.y, x2: x + b, y2: lage.y, farbe: stil?.farbe || g.text, dicke: 0.3 });
      lage.y += 1.5;
      if (baustein.beschriftung) {
        schreibe(lage, baustein.beschriftung, { x, breite: b }, {
          groesse: groesse(stil, g) * 0.8,
          farbe: g.gedaempft,
          ausrichtung: aus,
        });
      }
      break;
    }

    case 'kopf': zeichneKopf(baustein, inhalt, lage); break;
    case 'anschrift': zeichneAnschrift(baustein, inhalt, lage, ctx); break;
    case 'eckdaten': zeichneEckdaten(baustein, inhalt, lage); break;
    case 'betreff': {
      const text = fuelle(baustein.inhalt, lage.werte);
      if (!text.trim()) break;
      const gr = stil?.schriftgroesse ?? g.schriftgroesse * 1.15;
      platz(lage, gr * PT_ZU_MM * 2.5);
      schreibe(lage, text, inhalt, {
        groesse: gr,
        fett: stil?.fett ?? true,
        kursiv: stil?.kursiv,
        farbe: stil?.farbe || g.text,
        ausrichtung: stil?.ausrichtung ?? 'links',
      });
      break;
    }
    case 'text': {
      const text = baustein.quelle === 'feld'
        ? (lage.werte[baustein.inhalt] ?? '')
        : fuelle(baustein.inhalt, lage.werte);
      if (!text.trim()) break;
      const gr = stil?.schriftgroesse ?? (baustein.groesse === 'klein' ? g.schriftgroesse * 0.82 : g.schriftgroesse);
      platz(lage, gr * PT_ZU_MM * 2.5);
      schreibe(lage, text, inhalt, {
        groesse: gr,
        fett: stil?.fett ?? baustein.betont,
        kursiv: stil?.kursiv,
        farbe: stil?.farbe || (baustein.groesse === 'klein' && !stil?.farbe ? g.gedaempft : g.text),
        ausrichtung: stil?.ausrichtung ?? 'links',
        zeilenabstand: stil?.zeilenabstand,
      });
      break;
    }
    case 'liste': zeichneListeBaustein(baustein, inhalt, lage); break;
    case 'positionen': zeichnePositionen(baustein, inhalt, lage); break;
    case 'zahlung': zeichneZahlung(baustein, inhalt, lage); break;
    case 'spalten': zeichneSpalten(baustein, inhalt, lage, ctx); break;
  }

  lage.y += innen;

  // Hintergrund und Rahmen liegen hinter dem Inhalt, werden aber erst jetzt
  // gezeichnet, weil die Höhe vorher nicht feststand. Deshalb vorn einfügen.
  const hoehe = lage.y - startY;
  if (hoehe > 0 && (stil?.hintergrund || (stil?.rahmenDicke && stil.rahmenSeiten?.length))) {
    const hinten: Kasten[] = [];
    if (stil?.hintergrund) {
      hinten.push({ art: 'flaeche', x: bereich.x, y: startY, breite: bereich.breite, hoehe, farbe: stil.hintergrund });
    }
    if (stil?.rahmenDicke && stil.rahmenSeiten?.length) {
      const f = stil.rahmenFarbe || g.gedaempft;
      const d = stil.rahmenDicke;
      const r = bereich.x + bereich.breite;
      const u = startY + hoehe;
      for (const seite of stil.rahmenSeiten) {
        if (seite === 'oben') hinten.push({ art: 'linie', x1: bereich.x, y1: startY, x2: r, y2: startY, farbe: f, dicke: d });
        if (seite === 'unten') hinten.push({ art: 'linie', x1: bereich.x, y1: u, x2: r, y2: u, farbe: f, dicke: d });
        if (seite === 'links') hinten.push({ art: 'linie', x1: bereich.x, y1: startY, x2: bereich.x, y2: u, farbe: f, dicke: d });
        if (seite === 'rechts') hinten.push({ art: 'linie', x1: r, y1: startY, x2: r, y2: u, farbe: f, dicke: d });
      }
    }
    lage.seiten[lage.seite].kaesten.unshift(...hinten);
  }

  lage.y += stil?.abstandUnten ?? g.bausteinAbstand;
}

// ─── Werkzeug ────────────────────────────────────────────────────────────────

function groesse(stil: BausteinStil | undefined, g: Gestaltung): number {
  return stil?.schriftgroesse ?? g.schriftgroesse;
}

function zh(g: Gestaltung, groesseInPt: number, faktor?: number): number {
  return groesseInPt * PT_ZU_MM * (faktor ?? g.zeilenabstand ?? 1.35);
}

function neueSeite(lage: Lage): void {
  lage.seiten.push({ kaesten: [] });
  lage.seite++;
  lage.y = lage.g.randOben;
}

/** Beginnt eine neue Seite, wenn die angeforderte Höhe nicht mehr passt. */
function platz(lage: Lage, hoehe: number): void {
  if (lage.inSpalte) return; // in einer Spalte wird nicht umgebrochen
  if (lage.y + hoehe > lage.unten && lage.seiten[lage.seite].kaesten.length > 0) neueSeite(lage);
}

interface SchreibOpt {
  groesse?: number;
  farbe?: string;
  fett?: boolean;
  kursiv?: boolean;
  ausrichtung?: Ausrichtung;
  zeilenabstand?: number;
}

/** Schreibt Text in einen Bereich und schiebt `lage.y` darunter. */
function schreibe(lage: Lage, text: string, bereich: Bereich, opt: SchreibOpt = {}): number {
  const g = lage.g;
  const gr = opt.groesse ?? g.schriftgroesse;
  const fett = opt.fett ?? false;
  const zeilen = umbrechen(text, bereich.breite, gr, fett);
  const zeilenhoehe = zh(g, gr, opt.zeilenabstand);
  lage.seiten[lage.seite].kaesten.push({
    art: 'text',
    x: bereich.x,
    y: lage.y,
    breite: bereich.breite,
    zeilen,
    groesse: gr,
    farbe: opt.farbe || g.text,
    fett,
    kursiv: opt.kursiv,
    ausrichtung: opt.ausrichtung ?? 'links',
    zeilenhoehe,
  });
  const hoehe = zeilen.length * zeilenhoehe;
  lage.y += hoehe;
  return hoehe;
}

/** Schreibt Text an eine feste Stelle, ohne `lage.y` zu bewegen. */
function schreibeAn(lage: Lage, text: string, x: number, y: number, breite: number, opt: SchreibOpt = {}): number {
  const g = lage.g;
  const gr = opt.groesse ?? g.schriftgroesse;
  const fett = opt.fett ?? false;
  const zeilen = umbrechen(text, breite, gr, fett);
  const zeilenhoehe = zh(g, gr, opt.zeilenabstand);
  lage.seiten[lage.seite].kaesten.push({
    art: 'text', x, y, breite, zeilen, groesse: gr,
    farbe: opt.farbe || g.text, fett, kursiv: opt.kursiv,
    ausrichtung: opt.ausrichtung ?? 'links', zeilenhoehe,
  });
  return zeilen.length * zeilenhoehe;
}

// ─── Die einzelnen Bausteine ─────────────────────────────────────────────────

function zeichneKopf(b: Extract<Baustein, { typ: 'kopf' }>, bereich: Bereich, lage: Lage): void {
  const g = lage.g;
  const titelGroesse = g.schriftgroesse * (b.titelFaktor ?? 2.2);
  const logo = g.logo;
  const verhaeltnis = g.logoVerhaeltnis && g.logoVerhaeltnis > 0 ? g.logoVerhaeltnis : 2.6;
  const logoBreite = logo ? b.logoHoehe * verhaeltnis : 0;
  const hoehe = Math.max(logo ? b.logoHoehe : 0, titelGroesse * PT_ZU_MM * 1.2);
  platz(lage, hoehe + 6);

  if (logo) {
    lage.seiten[lage.seite].kaesten.push({
      art: 'bild',
      x: b.logoSeite === 'links' ? bereich.x : bereich.x + bereich.breite - logoBreite,
      y: lage.y,
      breite: Math.min(logoBreite, bereich.breite),
      hoehe: b.logoHoehe,
      quelle: logo,
    });
  }
  if (b.titel) {
    const text = fuelle(b.titel, lage.werte);
    schreibeAn(
      lage,
      (b.titelGrossbuchstaben ?? true) ? text.toUpperCase() : text,
      bereich.x,
      lage.y + (hoehe - titelGroesse * PT_ZU_MM) / 2,
      bereich.breite,
      {
        groesse: titelGroesse,
        fett: true,
        farbe: b.titelFarbe || g.akzent,
        ausrichtung: b.stil?.ausrichtung ?? (b.logoSeite === 'links' ? 'rechts' : 'links'),
      },
    );
  }
  lage.y += hoehe + 3;
  if (b.trennlinie) {
    lage.seiten[lage.seite].kaesten.push({
      art: 'linie', x1: bereich.x, y1: lage.y, x2: bereich.x + bereich.breite, y2: lage.y,
      farbe: b.titelFarbe || g.akzent, dicke: b.linienDicke ?? 0.8,
    });
    lage.y += 3;
  }
}

function zeichneAnschrift(
  b: Extract<Baustein, { typ: 'anschrift' }>,
  bereich: Bereich,
  lage: Lage,
  ctx: Kontext,
): void {
  const g = lage.g;
  const feldBreite = Math.min(b.feldBreite ?? 85, bereich.breite);
  const startY = lage.y;
  const gr = groesse(b.stil, g);

  if (b.vorspann) {
    lage.y += schreibe(lage, fuelle(b.vorspann, lage.werte), { x: bereich.x, breite: feldBreite }, {
      groesse: gr * 0.8, farbe: g.gedaempft,
    }) * 0;
  }
  if (b.absenderzeile) {
    const zeile = [lage.werte.sender_name, lage.werte.sender_address].filter(Boolean).join(' · ');
    if (zeile) {
      schreibe(lage, zeile, { x: bereich.x, breite: feldBreite }, { groesse: gr * 0.72, farbe: g.gedaempft });
      lage.seiten[lage.seite].kaesten.push({
        art: 'linie', x1: bereich.x, y1: lage.y + 0.5, x2: bereich.x + feldBreite, y2: lage.y + 0.5,
        farbe: g.gedaempft, dicke: 0.2,
      });
      lage.y += 3;
    }
  }
  const empfaenger = [lage.werte.receiver_name, lage.werte.receiver_address].filter(Boolean).join('\n');
  schreibe(lage, empfaenger || 'Empfänger', { x: bereich.x, breite: feldBreite }, {
    groesse: gr, farbe: b.stil?.farbe || g.text,
  });

  // Eckdaten in Blockform rechts daneben, auf gleicher Höhe.
  const block = ctx.eckdatenBlock;
  if (block && !ctx.erledigt.has(block.id)) {
    const merk = lage.y;
    lage.y = startY;
    const blockBreite = Math.min(block.blockBreite ?? 62, bereich.breite * 0.5);
    const x = bereich.x + bereich.breite - blockBreite;
    zeichneEckdatenZeilen(block, x, blockBreite, lage);
    ctx.erledigt.add(block.id);
    lage.y = Math.max(merk, lage.y);
  }
}

/** Die Beschriftung-Wert-Paare der Eckdaten, untereinander. */
function zeichneEckdatenZeilen(b: EckdatenBaustein, x: number, breite: number, lage: Lage): void {
  const g = lage.g;
  const gr = groesse(b.stil, g) * 0.85;
  const anteil = b.beschriftungsAnteil ?? 0.55;
  const zeilenhoehe = zh(g, gr);

  const eintraege: Array<[string, string]> = [];
  for (const feld of b.felder) {
    const wert = lage.werte[feld];
    if (!wert) continue;
    eintraege.push([b.beschriftungen?.[feld] ?? ECKDATEN_LABELS[feld as EckdatenFeld], wert]);
  }
  for (const eigen of b.eigene ?? []) {
    const wert = fuelle(eigen.wert, lage.werte);
    if (!wert.trim()) continue;
    eintraege.push([eigen.beschriftung, wert]);
  }

  for (const [beschriftung, wert] of eintraege) {
    schreibeAn(lage, beschriftung, x, lage.y, breite * anteil, { groesse: gr, farbe: g.gedaempft });
    schreibeAn(lage, wert, x + breite * anteil, lage.y, breite * (1 - anteil), {
      groesse: gr, fett: true, farbe: b.stil?.farbe || g.text, ausrichtung: 'rechts',
    });
    lage.y += zeilenhoehe;
  }
}

function zeichneEckdaten(b: EckdatenBaustein, bereich: Bereich, lage: Lage): void {
  if (b.form === 'block') {
    // Ohne Anschriftfeld davor steht der Block einfach rechts oben.
    const breite = Math.min(b.blockBreite ?? 62, bereich.breite);
    zeichneEckdatenZeilen(b, bereich.x + bereich.breite - breite, breite, lage);
    return;
  }
  if (b.form === 'liste') {
    zeichneEckdatenZeilen(b, bereich.x, bereich.breite, lage);
    return;
  }

  const g = lage.g;
  const gr = groesse(b.stil, g);
  const eintraege: Array<[string, string]> = [];
  for (const feld of b.felder) {
    if (!lage.werte[feld]) continue;
    eintraege.push([b.beschriftungen?.[feld] ?? ECKDATEN_LABELS[feld as EckdatenFeld], lage.werte[feld]]);
  }
  for (const eigen of b.eigene ?? []) {
    const wert = fuelle(eigen.wert, lage.werte);
    if (wert.trim()) eintraege.push([eigen.beschriftung, wert]);
  }
  if (eintraege.length === 0) return;

  const spaltenBreite = bereich.breite / eintraege.length;
  platz(lage, zh(g, gr) * 2);
  eintraege.forEach(([beschriftung, wert], i) => {
    const x = bereich.x + i * spaltenBreite;
    schreibeAn(lage, beschriftung, x, lage.y, spaltenBreite - 2, { groesse: gr * 0.78, farbe: g.gedaempft });
    schreibeAn(lage, wert, x, lage.y + zh(g, gr * 0.78), spaltenBreite - 2, {
      groesse: gr, fett: true, farbe: b.stil?.farbe || g.text,
    });
  });
  lage.y += zh(g, gr * 0.78) + zh(g, gr);
}

function zeichneListeBaustein(b: Extract<Baustein, { typ: 'liste' }>, bereich: Bereich, lage: Lage): void {
  const g = lage.g;
  const gr = groesse(b.stil, g);
  const anteil = b.beschriftungsAnteil ?? 0.4;
  for (const zeile of b.zeilen) {
    const wert = fuelle(zeile.wert, lage.werte);
    if (!zeile.beschriftung && !wert.trim()) continue;
    const h = zh(g, gr);
    platz(lage, h);
    schreibeAn(lage, zeile.beschriftung, bereich.x, lage.y, bereich.breite * anteil - 2, {
      groesse: gr, farbe: g.gedaempft,
    });
    schreibeAn(lage, wert, bereich.x + bereich.breite * anteil, lage.y, bereich.breite * (1 - anteil), {
      groesse: gr, farbe: b.stil?.farbe || g.text,
    });
    lage.y += h;
    if (b.trennlinien) {
      lage.seiten[lage.seite].kaesten.push({
        art: 'linie', x1: bereich.x, y1: lage.y, x2: bereich.x + bereich.breite, y2: lage.y,
        farbe: g.gedaempft, dicke: 0.15,
      });
      lage.y += 0.8;
    }
  }
}

function zeichnePositionen(b: Extract<Baustein, { typ: 'positionen' }>, bereich: Bereich, lage: Lage): void {
  const g = lage.g;
  const gr = groesse(b.stil, g);
  const variante = b.stilVariante ?? 'linien';
  const spalten = b.spalten;
  const anteile = spaltenBreiten(spalten, b.spaltenBreiten);
  const kopfHoehe = zh(g, gr) * 1.5;
  const zeilenHoehe = zh(g, gr) * (b.zeilenFaktor ?? 1.45);
  const linienFarbe = b.linienFarbe || '#e2e8f0';
  const male = (k: Kasten) => lage.seiten[lage.seite].kaesten.push(k);

  const kopfMalen = () => {
    if (variante === 'linien' || variante === 'rahmen') {
      male({ art: 'flaeche', x: bereich.x, y: lage.y, breite: bereich.breite, hoehe: kopfHoehe, farbe: b.kopfFarbe || g.akzent });
    }
    let x = bereich.x;
    spalten.forEach((sp, i) => {
      const sb = bereich.breite * anteile[i];
      schreibeAn(lage, b.spaltenLabels?.[sp] ?? SPALTEN_LABELS[sp], x + 1.5, lage.y + (kopfHoehe - zh(g, gr * 0.85)) / 2, sb - 3, {
        groesse: gr * 0.85,
        farbe: (variante === 'linien' || variante === 'rahmen') ? (b.kopfTextFarbe || '#ffffff') : g.gedaempft,
        fett: true,
        ausrichtung: RECHTSBUENDIG.includes(sp) ? 'rechts' : 'links',
      });
      x += sb;
    });
    lage.y += kopfHoehe;
    if (variante === 'schlicht' || variante === 'zebra') {
      male({ art: 'linie', x1: bereich.x, y1: lage.y, x2: bereich.x + bereich.breite, y2: lage.y, farbe: linienFarbe, dicke: 0.3 });
      lage.y += 1;
    }
  };

  platz(lage, kopfHoehe + zeilenHoehe * 2);
  kopfMalen();

  let nummer = 0;
  lage.positionen.forEach((p, index) => {
    if (p.isGroupHeader) {
      platz(lage, zeilenHoehe);
      male({ art: 'flaeche', x: bereich.x, y: lage.y, breite: bereich.breite, hoehe: zeilenHoehe, farbe: '#f1f5f9' });
      schreibeAn(lage, p.description || 'Gruppe', bereich.x + 1.5, lage.y + (zeilenHoehe - zh(g, gr)) / 2, bereich.breite - 3, {
        groesse: gr, fett: true,
      });
      lage.y += zeilenHoehe;
      return;
    }
    nummer++;

    const bi = spalten.indexOf('beschreibung');
    const bBreite = bi >= 0 ? bereich.breite * anteile[bi] - 3 : bereich.breite;
    const bZeilen = umbrechen(p.description || '', bBreite, gr);
    const hoehe = Math.max(zeilenHoehe, bZeilen.length * zh(g, gr) + 2);

    if (!lage.inSpalte && lage.y + hoehe > lage.unten) { neueSeite(lage); kopfMalen(); }

    if (variante === 'zebra' && index % 2 === 1) {
      male({ art: 'flaeche', x: bereich.x, y: lage.y, breite: bereich.breite, hoehe, farbe: b.zebraFarbe || '#f8fafc' });
    }

    let x = bereich.x;
    spalten.forEach((sp, i) => {
      const sb = bereich.breite * anteile[i];
      const wert =
        sp === 'pos' ? String(nummer)
          : sp === 'beschreibung' ? (p.description || '')
            : sp === 'menge' ? zahl(p.quantity || 0)
              : sp === 'einheit' ? (p.unit || '')
                : sp === 'einzelpreis' ? euro(p.unitPrice || 0)
                  : sp === 'rabatt' ? (p.discount ? `${zahl(p.discount)} %` : '')
                    : euro(zeilenBetrag(p));
      schreibeAn(lage, wert, x + 1.5, lage.y + 1, sb - 3, {
        groesse: gr,
        farbe: b.stil?.farbe || g.text,
        ausrichtung: RECHTSBUENDIG.includes(sp) ? 'rechts' : 'links',
      });
      x += sb;
    });
    lage.y += hoehe;
    if (variante === 'linien' || variante === 'rahmen') {
      male({ art: 'linie', x1: bereich.x, y1: lage.y, x2: bereich.x + bereich.breite, y2: lage.y, farbe: linienFarbe, dicke: 0.2 });
    }
  });

  // ── Summen ──
  const summenBreite = Math.min(b.summenBreite ?? 72, bereich.breite);
  const summenX = b.summenLinks ? bereich.x : bereich.x + bereich.breite - summenBreite;
  const zeile = (beschriftung: string, wert: string, fett = false, gr2 = gr) => {
    const h = zh(g, gr2) * 1.25;
    platz(lage, h);
    schreibeAn(lage, beschriftung, summenX, lage.y + (h - zh(g, gr2)) / 2, summenBreite * 0.55, {
      groesse: gr2, farbe: fett ? g.text : g.gedaempft, fett,
    });
    schreibeAn(lage, wert, summenX + summenBreite * 0.55, lage.y + (h - zh(g, gr2)) / 2, summenBreite * 0.45, {
      groesse: gr2, farbe: g.text, fett, ausrichtung: 'rechts',
    });
    lage.y += h;
  };

  lage.y += 3;
  if (lage.summen.rabatt > 0) zeile('Nachlass', `− ${euro(lage.summen.rabatt)}`);
  if (b.summenAusweisen && b.mwstSatz > 0) {
    zeile('Nettobetrag', euro(lage.summen.netto));
    zeile(`zzgl. ${zahl(b.mwstSatz)} % USt`, euro(lage.summen.steuer));
    male({ art: 'linie', x1: summenX, y1: lage.y, x2: summenX + summenBreite, y2: lage.y, farbe: g.gedaempft, dicke: 0.3 });
    lage.y += 1;
  }
  zeile(
    b.summeLabel || (b.mwstSatz > 0 ? 'Gesamtbetrag' : 'Rechnungsbetrag'),
    euro(lage.summen.brutto),
    true,
    gr * 1.15,
  );
  male({ art: 'linie', x1: summenX, y1: lage.y, x2: summenX + summenBreite, y2: lage.y, farbe: b.kopfFarbe || g.akzent, dicke: 0.6 });
  lage.y += 2;
}

function zeichneZahlung(b: Extract<Baustein, { typ: 'zahlung' }>, bereich: Bereich, lage: Lage): void {
  const g = lage.g;
  const gr = groesse(b.stil, g) * 0.9;
  const zeilen: string[] = [];
  if (b.vorspann) zeilen.push(fuelle(b.vorspann, lage.werte));
  if (b.bankverbindung) {
    const bank = [
      lage.werte.sender_iban ? `IBAN ${lage.werte.sender_iban}` : '',
      lage.werte.sender_bic ? `BIC ${lage.werte.sender_bic}` : '',
    ].filter(Boolean).join('   ');
    if (bank) zeilen.push(bank);
  }
  if (lage.werte.payment_terms) zeilen.push(lage.werte.payment_terms);

  const zeigtQr = b.qrCode && !!lage.werte.sender_iban;
  if (zeilen.length === 0 && !zeigtQr) return;

  const qrGroesse = b.qrGroesse ?? 24;
  const textBreiteHier = zeigtQr ? bereich.breite - qrGroesse - 5 : bereich.breite;
  const hoehe = Math.max(zeigtQr ? qrGroesse : 0, zeilen.length * zh(g, gr));
  platz(lage, hoehe + 4);

  if (zeigtQr) {
    lage.seiten[lage.seite].kaesten.push({
      art: 'qr',
      x: b.qrLinks ? bereich.x : bereich.x + bereich.breite - qrGroesse,
      y: lage.y,
      groesse: qrGroesse,
      daten: epcDaten(lage.werte, lage.summen.brutto),
    });
  }
  const textX = zeigtQr && b.qrLinks ? bereich.x + qrGroesse + 5 : bereich.x;
  const merk = lage.y;
  for (const z of zeilen) {
    schreibe(lage, z, { x: textX, breite: textBreiteHier }, {
      groesse: gr, farbe: b.stil?.farbe || g.text, ausrichtung: b.stil?.ausrichtung,
    });
  }
  lage.y = Math.max(lage.y, merk + (zeigtQr ? qrGroesse : 0));
}

/**
 * Stellt Bausteine nebeneinander.
 *
 * Jede Spalte bekommt einen eigenen Bereich und einen eigenen Cursor, der bei
 * derselben Höhe startet. Danach geht es unter der höchsten Spalte weiter.
 * Innerhalb einer Spalte wird nicht auf eine neue Seite umgebrochen – sonst
 * zerfiele die Reihe. Passt der ganze Block nicht mehr, rutscht er als Ganzes
 * auf die nächste Seite.
 */
function zeichneSpalten(
  b: Extract<Baustein, { typ: 'spalten' }>,
  bereich: Bereich,
  lage: Lage,
  ctx: Kontext,
): void {
  const sichtbar = b.spalten.filter((s) => s.bausteine.some((x) => !x.aus));
  if (sichtbar.length === 0) return;

  const zwischen = b.zwischenraum ?? 6;
  const gesamtGewicht = sichtbar.reduce((s, c) => s + Math.max(0.01, c.anteil), 0);
  const nutzbar = bereich.breite - zwischen * (sichtbar.length - 1);

  const startY = lage.y;
  const enden: number[] = [];
  let x = bereich.x;

  // Erst messen: Wie hoch wird die höchste Spalte? Dafür wird jede Spalte
  // gezeichnet und ihr Endstand gemerkt.
  const warInSpalte = lage.inSpalte;
  lage.inSpalte = true;

  const spaltenKaesten: Kasten[][] = [];
  for (const spalte of sichtbar) {
    const breite = nutzbar * (Math.max(0.01, spalte.anteil) / gesamtGewicht);
    const vorher = lage.seiten[lage.seite].kaesten.length;
    lage.y = startY;
    zeichneListe(spalte.bausteine, { x, breite }, lage, ctx);
    enden.push(lage.y);
    spaltenKaesten.push(lage.seiten[lage.seite].kaesten.slice(vorher));
    x += breite + zwischen;
  }

  lage.inSpalte = warInSpalte;

  const hoechste = Math.max(...enden, startY);

  // Senkrecht ausrichten: Wer kürzer ist, rückt nach unten oder in die Mitte.
  const senkrecht = b.ausrichtungSenkrecht ?? 'oben';
  if (senkrecht !== 'oben') {
    spaltenKaesten.forEach((kaesten, i) => {
      const versatz = senkrecht === 'unten'
        ? hoechste - enden[i]
        : (hoechste - enden[i]) / 2;
      if (versatz <= 0) return;
      for (const k of kaesten) {
        if (k.art === 'linie') { k.y1 += versatz; k.y2 += versatz; }
        else k.y += versatz;
      }
    });
  }

  lage.y = hoechste;
}

// ─── Fußzeile ────────────────────────────────────────────────────────────────

function fussFelder(b: Extract<Baustein, { typ: 'fusszeile' }>, werte: Record<string, string>): string[] {
  const alle: Array<[FussFeld, string]> = [
    ['sender_name', werte.sender_name],
    ['sender_address', werte.sender_address],
    ['sender_email', werte.sender_email],
    ['sender_phone', werte.sender_phone],
    ['sender_tax_number', werte.sender_tax_number ? `Steuernummer ${werte.sender_tax_number}` : ''],
    ['sender_vat_id', werte.sender_vat_id ? `USt-IdNr. ${werte.sender_vat_id}` : ''],
    ['sender_iban', werte.sender_iban ? `IBAN ${werte.sender_iban}` : ''],
    ['sender_bic', werte.sender_bic ? `BIC ${werte.sender_bic}` : ''],
    ['sender_finanzamt', werte.sender_finanzamt ? `Finanzamt ${werte.sender_finanzamt}` : ''],
    ['sender_w_idnr', werte.sender_w_idnr ? `W-IdNr. ${werte.sender_w_idnr}` : ''],
  ];
  const erlaubt = b.felder;
  return alle
    .filter(([schluessel, text]) => text && (!erlaubt || erlaubt.includes(schluessel)))
    .map(([, text]) => text);
}

function fussHoeheBerechnen(
  b: Extract<Baustein, { typ: 'fusszeile' }>,
  g: Gestaltung,
  werte: Record<string, string>,
): number {
  const anzahl = fussFelder(b, werte).length || 1;
  const zeilen = Math.ceil(anzahl / b.spalten);
  const gr = groesse(b.stil, g) * 0.7;
  return zeilen * zh(g, gr) + 4;
}

function zeichneFusszeile(
  b: Extract<Baustein, { typ: 'fusszeile' }>,
  lage: Lage,
  fussHoehe: number,
): void {
  const g = lage.g;
  const links = g.randLinks;
  const rechts = A4_BREITE - g.randRechts;
  const breite = rechts - links;
  const fussY = A4_HOEHE - g.randUnten - fussHoehe;
  const felder = fussFelder(b, lage.werte);
  const proSpalte = Math.ceil(felder.length / b.spalten);
  const gr = groesse(b.stil, g) * 0.7;

  lage.seiten.forEach((s, i) => {
    const letzte = i === lage.seiten.length - 1;
    if (b.nurLetzteSeite && !letzte) return;

    if (b.trennlinie) {
      s.kaesten.push({ art: 'linie', x1: links, y1: fussY, x2: rechts, y2: fussY, farbe: b.stil?.rahmenFarbe || g.gedaempft, dicke: 0.2 });
    }
    const spaltenBreite = breite / b.spalten;
    for (let sp = 0; sp < b.spalten; sp++) {
      const teil = felder.slice(sp * proSpalte, (sp + 1) * proSpalte);
      if (teil.length === 0) continue;
      s.kaesten.push({
        art: 'text',
        x: links + sp * spaltenBreite,
        y: fussY + 2,
        breite: spaltenBreite - 2,
        zeilen: teil,
        groesse: gr,
        farbe: b.stil?.farbe || g.gedaempft,
        fett: false,
        ausrichtung: b.stil?.ausrichtung ?? 'links',
        zeilenhoehe: zh(g, gr),
      });
    }
    if ((b.seitenzahl ?? true) && lage.seiten.length > 1) {
      s.kaesten.push({
        art: 'text',
        x: links,
        y: A4_HOEHE - g.randUnten + 1,
        breite,
        zeilen: [`Seite ${i + 1} von ${lage.seiten.length}`],
        groesse: gr,
        farbe: g.gedaempft,
        fett: false,
        ausrichtung: 'rechts',
        zeilenhoehe: zh(g, gr),
      });
    }
  });
}
