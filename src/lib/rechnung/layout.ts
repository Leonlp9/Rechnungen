// ─── Aus einer Vorlage wird ein Seitenlayout ─────────────────────────────────
//
// Diese Datei ist der Grund, warum Vorschau und PDF nicht auseinanderlaufen
// können: Beide zeichnen exakt dieselbe Liste von Kästen. Der Zeilenumbruch
// passiert hier, nicht im Zeichner – wer die Vorschau sieht, sieht das PDF.
//
// Alles in Millimetern, Ursprung links oben.

import type {
  EckdatenBaustein,
  Gestaltung,
  PositionsSpalte,
  Rechnungsvorlage,
} from '@/types/rechnungsvorlage';
import { A4_BREITE, A4_HOEHE, ECKDATEN_LABELS, SPALTEN_LABELS } from '@/types/rechnungsvorlage';
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

export interface LayoutErgebnis {
  seiten: Seite[];
  /** Netto, Steuer und Endsumme – die Oberfläche zeigt sie auch außerhalb des Blatts. */
  summen: Summen;
}

export interface Summen {
  netto: number;
  steuer: number;
  brutto: number;
  rabatt: number;
}

// ─── Textmaß ─────────────────────────────────────────────────────────────────
//
// Zeichenbreiten von Helvetica in Tausendstel der Schriftgröße. Damit lässt
// sich ohne Zeichenfläche und ohne jsPDF messen. Die Werte sind die des
// Originalfonts; für Times und Courier weicht das leicht ab, aber da beide
// Zeichner dieselbe Schätzung benutzen, bleibt die Vorschau deckungsgleich
// mit dem PDF – und darauf kommt es an.

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
  // Fettschrift trägt etwas auf; der Faktor ist gemessen, nicht geraten.
  const faktor = fett ? 1.06 : 1;
  return (einheiten / 1000) * groesseInPt * PT_ZU_MM * faktor;
}

/**
 * Bricht Text auf eine Breite um. Bricht an Leerzeichen; ein einzelnes Wort,
 * das länger ist als die Zeile, wird hart getrennt, damit nichts über den Rand
 * läuft.
 */
export function umbrechen(text: string, breite: number, groesse: number, fett = false): string[] {
  const zeilen: string[] = [];
  for (const absatz of String(text ?? '').split('\n')) {
    if (absatz.trim() === '') { zeilen.push(''); continue; }
    let zeile = '';
    for (const wort of absatz.split(' ')) {
      const versuch = zeile ? `${zeile} ${wort}` : wort;
      if (textBreite(versuch, groesse, fett) <= breite || zeile === '') {
        // Ein einzelnes zu langes Wort hart trennen.
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

/** Zeilenhöhe zu einer Schriftgröße. */
const zh = (groesse: number) => groesse * PT_ZU_MM * 1.35;

/** Ersetzt {{platzhalter}} durch Werte. */
export function fuelle(text: string, werte: Record<string, string>): string {
  return String(text ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => werte[k] ?? '');
}

/** Betrag einer Position nach Rabatt. */
export function zeilenBetrag(p: LineItem): number {
  const roh = (p.quantity || 0) * (p.unitPrice || 0);
  const rabatt = roh * ((p.discount || 0) / 100);
  return Math.round((roh - rabatt) * 100) / 100;
}

export function berechneSummen(positionen: LineItem[], mwstSatz: number, globalerRabatt = 0): Summen {
  const roh = positionen
    .filter((p) => !p.isGroupHeader)
    .reduce((s, p) => s + zeilenBetrag(p), 0);
  const rabatt = Math.round(roh * (globalerRabatt / 100) * 100) / 100;
  const netto = Math.round((roh - rabatt) * 100) / 100;
  const steuer = Math.round(netto * (mwstSatz / 100) * 100) / 100;
  return { netto, steuer, brutto: Math.round((netto + steuer) * 100) / 100, rabatt };
}

// ─── Der Zeichenblock ────────────────────────────────────────────────────────

export interface LayoutEingaben {
  vorlage: Rechnungsvorlage;
  /** Feldwerte: sender_name, receiver_address, doc_number … */
  werte: Record<string, string>;
  positionen: LineItem[];
  /** Prozentualer Nachlass auf die Gesamtsumme. */
  globalerRabatt?: number;
}

/** Wie breit die Spalten der Positionstabelle sind, als Anteil. */
function spaltenBreiten(spalten: PositionsSpalte[]): number[] {
  const gewicht: Record<PositionsSpalte, number> = {
    pos: 0.6,
    beschreibung: 4.4,
    menge: 0.8,
    einheit: 0.8,
    einzelpreis: 1.2,
    rabatt: 0.8,
    betrag: 1.3,
  };
  const summe = spalten.reduce((s, c) => s + gewicht[c], 0);
  return spalten.map((c) => gewicht[c] / summe);
}

const RECHTSBUENDIG: PositionsSpalte[] = ['menge', 'einzelpreis', 'rabatt', 'betrag'];

/**
 * Rechnet die Vorlage in Seiten um.
 *
 * Der Ablauf ist bewusst einfach: ein Cursor wandert von oben nach unten,
 * jeder Baustein sagt, wie hoch er ist, und wenn kein Platz mehr bleibt,
 * beginnt eine neue Seite. Die Positionstabelle darf als Einzige mitten drin
 * umbrechen – sie wiederholt dann ihren Kopf.
 */
export function layoutRechnung({
  vorlage,
  werte,
  positionen,
  globalerRabatt = 0,
}: LayoutEingaben): LayoutErgebnis {
  const g = vorlage.gestaltung;
  const links = g.randLinks;
  const rechts = A4_BREITE - g.randRechts;
  const breite = rechts - links;

  const positionsBaustein = vorlage.bausteine.find((b) => b.typ === 'positionen' && !b.aus);
  const mwstSatz = positionsBaustein && positionsBaustein.typ === 'positionen' ? positionsBaustein.mwstSatz : 0;
  const summen = berechneSummen(positionen, mwstSatz, globalerRabatt);

  const fusszeile = vorlage.bausteine.find((b) => b.typ === 'fusszeile' && !b.aus);
  const fussHoehe = fusszeile ? fussHoeheBerechnen(fusszeile.typ === 'fusszeile' ? fusszeile.spalten : 3, g) : 0;
  const unten = A4_HOEHE - g.randUnten - fussHoehe;

  const seiten: Seite[] = [{ kaesten: [] }];
  let seite = 0;
  let y = g.randOben;

  const neueSeite = () => {
    seiten.push({ kaesten: [] });
    seite++;
    y = g.randOben;
  };
  const platz = (hoehe: number) => {
    if (y + hoehe > unten && seiten[seite].kaesten.length > 0) neueSeite();
  };
  const male = (k: Kasten) => seiten[seite].kaesten.push(k);

  const text = (
    inhalt: string,
    x: number,
    b: number,
    opt: Partial<Omit<TextKasten, 'art' | 'x' | 'y' | 'breite' | 'zeilen'>> = {},
  ): number => {
    const groesse = opt.groesse ?? g.schriftgroesse;
    const fett = opt.fett ?? false;
    const zeilen = umbrechen(inhalt, b, groesse, fett);
    const hoehe = zeilen.length * zh(groesse);
    male({
      art: 'text',
      x,
      y,
      breite: b,
      zeilen,
      groesse,
      farbe: opt.farbe ?? g.text,
      fett,
      kursiv: opt.kursiv,
      ausrichtung: opt.ausrichtung ?? 'links',
      zeilenhoehe: zh(groesse),
    });
    return hoehe;
  };

  // Eckdaten als Block stehen neben dem Anschriftfeld – sie werden dort
  // mitgezeichnet und hier übersprungen.
  const eckdatenBlock = vorlage.bausteine.find(
    (b): b is EckdatenBaustein => b.typ === 'eckdaten' && !b.aus && b.form === 'block',
  );
  let eckdatenErledigt = false;

  for (const baustein of vorlage.bausteine) {
    if (baustein.aus) continue;
    if (baustein.typ === 'fusszeile') continue; // kommt am Seitenfuß
    if (baustein === eckdatenBlock && eckdatenErledigt) continue;

    y += baustein.abstandOben ?? 0;

    switch (baustein.typ) {
      case 'kopf': {
        const titelGroesse = g.schriftgroesse * 2.2;
        const logo = g.logo;
        const logoBreite = logo ? baustein.logoHoehe * 2.6 : 0;
        const hoehe = Math.max(logo ? baustein.logoHoehe : 0, titelGroesse * PT_ZU_MM * 1.2);
        platz(hoehe + 6);

        if (logo) {
          male({
            art: 'bild',
            x: baustein.logoSeite === 'links' ? links : rechts - logoBreite,
            y,
            breite: logoBreite,
            hoehe: baustein.logoHoehe,
            quelle: logo,
          });
        }
        if (baustein.titel) {
          const merk = y;
          y += (hoehe - titelGroesse * PT_ZU_MM) / 2;
          text(fuelle(baustein.titel, werte).toUpperCase(), links, breite, {
            groesse: titelGroesse,
            fett: true,
            farbe: g.akzent,
            ausrichtung: baustein.logoSeite === 'links' ? 'rechts' : 'links',
          });
          y = merk;
        }
        y += hoehe + 3;
        if (baustein.trennlinie) {
          male({ art: 'linie', x1: links, y1: y, x2: rechts, y2: y, farbe: g.akzent, dicke: 0.8 });
          y += 3;
        }
        break;
      }

      case 'anschrift': {
        // Das Anschriftfeld ist so breit, dass es ins Sichtfenster passt.
        const feldBreite = Math.min(85, breite * 0.5);
        const startY = y;

        if (baustein.absenderzeile) {
          const zeile = [werte.sender_name, werte.sender_address].filter(Boolean).join(' · ');
          if (zeile) {
            y += text(zeile, links, feldBreite, { groesse: g.schriftgroesse * 0.72, farbe: g.gedaempft });
            male({ art: 'linie', x1: links, y1: y + 0.5, x2: links + feldBreite, y2: y + 0.5, farbe: g.gedaempft, dicke: 0.2 });
            y += 3;
          }
        }
        const empfaenger = [werte.receiver_name, werte.receiver_address].filter(Boolean).join('\n');
        y += text(empfaenger || 'Empfänger', links, feldBreite, {});

        // Eckdaten rechts daneben, auf gleicher Höhe.
        if (eckdatenBlock) {
          const merk = y;
          y = startY;
          const blockBreite = Math.min(62, breite * 0.42);
          const x = rechts - blockBreite;
          for (const feld of eckdatenBlock.felder) {
            const wert = werte[feld];
            if (!wert) continue;
            const beschriftung = ECKDATEN_LABELS[feld];
            const zeilenhoehe = zh(g.schriftgroesse * 0.85);
            male({
              art: 'text',
              x,
              y,
              breite: blockBreite * 0.55,
              zeilen: [beschriftung],
              groesse: g.schriftgroesse * 0.85,
              farbe: g.gedaempft,
              fett: false,
              ausrichtung: 'links',
              zeilenhoehe,
            });
            male({
              art: 'text',
              x: x + blockBreite * 0.55,
              y,
              breite: blockBreite * 0.45,
              zeilen: [wert],
              groesse: g.schriftgroesse * 0.85,
              farbe: g.text,
              fett: true,
              ausrichtung: 'rechts',
              zeilenhoehe,
            });
            y += zeilenhoehe;
          }
          eckdatenErledigt = true;
          y = Math.max(merk, y);
        }
        break;
      }

      case 'eckdaten': {
        // Nur noch die Zeilenform – die Blockform hängt am Anschriftfeld.
        if (baustein.form === 'block') break;
        const sichtbar = baustein.felder.filter((f) => werte[f]);
        if (sichtbar.length === 0) break;
        const spaltenBreite = breite / sichtbar.length;
        platz(zh(g.schriftgroesse) * 2);
        sichtbar.forEach((feld, i) => {
          const x = links + i * spaltenBreite;
          male({
            art: 'text', x, y, breite: spaltenBreite,
            zeilen: [ECKDATEN_LABELS[feld]],
            groesse: g.schriftgroesse * 0.78, farbe: g.gedaempft, fett: false,
            ausrichtung: 'links', zeilenhoehe: zh(g.schriftgroesse * 0.78),
          });
          male({
            art: 'text', x, y: y + zh(g.schriftgroesse * 0.78), breite: spaltenBreite,
            zeilen: [werte[feld]],
            groesse: g.schriftgroesse, farbe: g.text, fett: true,
            ausrichtung: 'links', zeilenhoehe: zh(g.schriftgroesse),
          });
        });
        y += zh(g.schriftgroesse * 0.78) + zh(g.schriftgroesse);
        break;
      }

      case 'betreff': {
        const inhalt = fuelle(baustein.inhalt, werte);
        if (!inhalt.trim()) break;
        platz(zh(g.schriftgroesse * 1.15) * 2);
        y += text(inhalt, links, breite, { groesse: g.schriftgroesse * 1.15, fett: true });
        break;
      }

      case 'text': {
        const inhalt = baustein.quelle === 'feld'
          ? (werte[baustein.inhalt] ?? '')
          : fuelle(baustein.inhalt, werte);
        if (!inhalt.trim()) break;
        const groesse = baustein.groesse === 'klein' ? g.schriftgroesse * 0.82 : g.schriftgroesse;
        platz(zh(groesse) * 2);
        y += text(inhalt, links, breite, {
          groesse,
          fett: baustein.betont,
          farbe: baustein.groesse === 'klein' ? g.gedaempft : g.text,
        });
        break;
      }

      case 'positionen': {
        const spalten = baustein.spalten;
        const anteile = spaltenBreiten(spalten);
        const kopfHoehe = zh(g.schriftgroesse) * 1.5;
        const zeilenHoehe = zh(g.schriftgroesse) * 1.45;

        const kopfMalen = () => {
          if (baustein.stil === 'linien') {
            male({ art: 'flaeche', x: links, y, breite, hoehe: kopfHoehe, farbe: g.akzent });
          }
          let x = links;
          spalten.forEach((sp, i) => {
            const b = breite * anteile[i];
            male({
              art: 'text',
              x: x + 1.5,
              y: y + (kopfHoehe - zh(g.schriftgroesse * 0.85)) / 2,
              breite: b - 3,
              zeilen: [SPALTEN_LABELS[sp]],
              groesse: g.schriftgroesse * 0.85,
              farbe: baustein.stil === 'linien' ? '#ffffff' : g.gedaempft,
              fett: true,
              ausrichtung: RECHTSBUENDIG.includes(sp) ? 'rechts' : 'links',
              zeilenhoehe: zh(g.schriftgroesse * 0.85),
            });
            x += b;
          });
          y += kopfHoehe;
          if (baustein.stil !== 'linien') {
            male({ art: 'linie', x1: links, y1: y, x2: rechts, y2: y, farbe: g.gedaempft, dicke: 0.3 });
            y += 1;
          }
        };

        platz(kopfHoehe + zeilenHoehe * 2);
        kopfMalen();

        let nummer = 0;
        positionen.forEach((p, index) => {
          if (p.isGroupHeader) {
            platz(zeilenHoehe);
            if (y === g.randOben) kopfMalen();
            male({ art: 'flaeche', x: links, y, breite, hoehe: zeilenHoehe, farbe: '#f1f5f9' });
            male({
              art: 'text', x: links + 1.5, y: y + (zeilenHoehe - zh(g.schriftgroesse)) / 2,
              breite: breite - 3, zeilen: [p.description || 'Gruppe'],
              groesse: g.schriftgroesse, farbe: g.text, fett: true,
              ausrichtung: 'links', zeilenhoehe: zh(g.schriftgroesse),
            });
            y += zeilenHoehe;
            return;
          }
          nummer++;

          // Die Beschreibung bestimmt, wie hoch die Zeile wird.
          const beschreibungIndex = spalten.indexOf('beschreibung');
          const beschreibungBreite = beschreibungIndex >= 0 ? breite * anteile[beschreibungIndex] - 3 : breite;
          const beschreibungZeilen = umbrechen(p.description || '', beschreibungBreite, g.schriftgroesse);
          const hoehe = Math.max(zeilenHoehe, beschreibungZeilen.length * zh(g.schriftgroesse) + 2);

          if (y + hoehe > unten) { neueSeite(); kopfMalen(); }

          if (baustein.stil === 'zebra' && index % 2 === 1) {
            male({ art: 'flaeche', x: links, y, breite, hoehe, farbe: '#f8fafc' });
          }

          let x = links;
          spalten.forEach((sp, i) => {
            const b = breite * anteile[i];
            const wert =
              sp === 'pos' ? String(nummer)
                : sp === 'beschreibung' ? (p.description || '')
                  : sp === 'menge' ? zahl(p.quantity || 0)
                    : sp === 'einheit' ? (p.unit || '')
                      : sp === 'einzelpreis' ? euro(p.unitPrice || 0)
                        : sp === 'rabatt' ? (p.discount ? `${zahl(p.discount)} %` : '')
                          : euro(zeilenBetrag(p));
            male({
              art: 'text',
              x: x + 1.5,
              y: y + 1,
              breite: b - 3,
              zeilen: sp === 'beschreibung' ? beschreibungZeilen : [wert],
              groesse: g.schriftgroesse,
              farbe: g.text,
              fett: false,
              ausrichtung: RECHTSBUENDIG.includes(sp) ? 'rechts' : 'links',
              zeilenhoehe: zh(g.schriftgroesse),
            });
            x += b;
          });
          y += hoehe;
          if (baustein.stil === 'linien') {
            male({ art: 'linie', x1: links, y1: y, x2: rechts, y2: y, farbe: '#e2e8f0', dicke: 0.2 });
          }
        });

        // ── Summen ──
        const summenBreite = Math.min(72, breite * 0.48);
        const summenX = rechts - summenBreite;
        const zeile = (beschriftung: string, wert: string, fett = false, groesse = g.schriftgroesse) => {
          const h = zh(groesse) * 1.25;
          platz(h);
          male({
            art: 'text', x: summenX, y: y + (h - zh(groesse)) / 2, breite: summenBreite * 0.55,
            zeilen: [beschriftung], groesse, farbe: fett ? g.text : g.gedaempft, fett,
            ausrichtung: 'links', zeilenhoehe: zh(groesse),
          });
          male({
            art: 'text', x: summenX + summenBreite * 0.55, y: y + (h - zh(groesse)) / 2, breite: summenBreite * 0.45,
            zeilen: [wert], groesse, farbe: g.text, fett,
            ausrichtung: 'rechts', zeilenhoehe: zh(groesse),
          });
          y += h;
        };

        y += 3;
        if (summen.rabatt > 0) zeile('Nachlass', `− ${euro(summen.rabatt)}`);
        if (baustein.summenAusweisen && baustein.mwstSatz > 0) {
          zeile('Nettobetrag', euro(summen.netto));
          zeile(`zzgl. ${zahl(baustein.mwstSatz)} % USt`, euro(summen.steuer));
          male({ art: 'linie', x1: summenX, y1: y, x2: rechts, y2: y, farbe: g.gedaempft, dicke: 0.3 });
          y += 1;
        }
        zeile(
          baustein.mwstSatz > 0 ? 'Gesamtbetrag' : 'Rechnungsbetrag',
          euro(summen.brutto),
          true,
          g.schriftgroesse * 1.15,
        );
        male({ art: 'linie', x1: summenX, y1: y, x2: rechts, y2: y, farbe: g.akzent, dicke: 0.6 });
        y += 2;
        break;
      }

      case 'zahlung': {
        const zeilen: string[] = [];
        if (baustein.bankverbindung) {
          const bank = [
            werte.sender_iban ? `IBAN ${werte.sender_iban}` : '',
            werte.sender_bic ? `BIC ${werte.sender_bic}` : '',
          ].filter(Boolean).join('   ');
          if (bank) zeilen.push(bank);
        }
        if (werte.payment_terms) zeilen.push(werte.payment_terms);
        if (zeilen.length === 0 && !baustein.qrCode) break;

        const qrGroesse = 24;
        const textBreiteHier = baustein.qrCode ? breite - qrGroesse - 5 : breite;
        const hoehe = Math.max(
          baustein.qrCode ? qrGroesse : 0,
          zeilen.length * zh(g.schriftgroesse * 0.9),
        );
        platz(hoehe + 4);

        if (baustein.qrCode && werte.sender_iban) {
          male({
            art: 'qr',
            x: rechts - qrGroesse,
            y,
            groesse: qrGroesse,
            daten: epcDaten(werte, summen.brutto),
          });
        }
        const merk = y;
        for (const z of zeilen) {
          y += text(z, links, textBreiteHier, { groesse: g.schriftgroesse * 0.9 });
        }
        y = Math.max(y, merk + (baustein.qrCode && werte.sender_iban ? qrGroesse : 0));
        break;
      }

      case 'abstand':
        y += baustein.hoehe;
        break;
    }

    y += g.bausteinAbstand;
  }

  // ── Fußzeile auf jede Seite ──
  if (fusszeile && fusszeile.typ === 'fusszeile') {
    const fussY = A4_HOEHE - g.randUnten - fussHoehe;
    const felder = fussFelder(werte);
    const proSpalte = Math.ceil(felder.length / fusszeile.spalten);
    seiten.forEach((s, i) => {
      if (fusszeile.trennlinie) {
        s.kaesten.push({ art: 'linie', x1: links, y1: fussY, x2: rechts, y2: fussY, farbe: g.gedaempft, dicke: 0.2 });
      }
      const spaltenBreite = breite / fusszeile.spalten;
      for (let sp = 0; sp < fusszeile.spalten; sp++) {
        const teil = felder.slice(sp * proSpalte, (sp + 1) * proSpalte);
        if (teil.length === 0) continue;
        s.kaesten.push({
          art: 'text',
          x: links + sp * spaltenBreite,
          y: fussY + 2,
          breite: spaltenBreite - 2,
          zeilen: teil,
          groesse: g.schriftgroesse * 0.7,
          farbe: g.gedaempft,
          fett: false,
          ausrichtung: 'links',
          zeilenhoehe: zh(g.schriftgroesse * 0.7),
        });
      }
      if (seiten.length > 1) {
        s.kaesten.push({
          art: 'text',
          x: links,
          y: A4_HOEHE - g.randUnten + 1,
          breite,
          zeilen: [`Seite ${i + 1} von ${seiten.length}`],
          groesse: g.schriftgroesse * 0.7,
          farbe: g.gedaempft,
          fett: false,
          ausrichtung: 'rechts',
          zeilenhoehe: zh(g.schriftgroesse * 0.7),
        });
      }
    });
  }

  return { seiten, summen };
}

function fussHoeheBerechnen(spalten: number, g: Gestaltung): number {
  const zeilen = Math.ceil(8 / spalten);
  return zeilen * zh(g.schriftgroesse * 0.7) + 4;
}

function fussFelder(werte: Record<string, string>): string[] {
  return [
    werte.sender_name,
    werte.sender_address,
    werte.sender_email,
    werte.sender_phone,
    werte.sender_tax_number ? `Steuernummer ${werte.sender_tax_number}` : '',
    werte.sender_vat_id ? `USt-IdNr. ${werte.sender_vat_id}` : '',
    werte.sender_iban ? `IBAN ${werte.sender_iban}` : '',
    werte.sender_bic ? `BIC ${werte.sender_bic}` : '',
  ].filter(Boolean);
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
